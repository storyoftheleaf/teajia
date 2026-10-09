/**
 * mag-send: the magazine draft becomes the page.
 *
 * A story is written and approved as a markdown draft (DEV) in Adrian's vault.
 * Until 2026-09-29 a session copied that draft into a spec file by hand, and
 * the copy drifted: a question reworded, a line of Adrian's set as a question,
 * the glossary marks dropped, the hook moved. Now the story's words and their
 * layout are generated from the draft (`pieces/<name>.story.ts`), and the page
 * facts (title, byline, credit, what to read next) stay in the hand-written
 * piece file. The draft is the one source; the generated file is never edited
 * by hand.
 *
 * This file is pure (no Node, no DOM), so the site's tests can run it, and the
 * command line (`scripts/mag-send.mjs`) can load it with Node directly.
 *
 * ## The draft's markup
 *
 * Words, as the magazine already writes them:
 *   "their words"            → their words ('a')
 *   *"Adrian's question"*    → a question he kept ('q')
 *   plain paragraph          → Adrian's telling ('n'); the first one before any heading is his opening
 *   Plain line. "Their words" → his telling, then their words
 *   **words** inside a pull  → the bronze highlight
 *   _words_                  → emphasis
 *   [[term:id|words]]        → the words (glossary pop-ups are not on the story page yet)
 *   ==line==                 → REFUSED: a connecting line Adrian has not approved yet
 *
 * Layout, in notes the reading view hides (`%%…%%`):
 *   %%photo: FILE · ALT · cover%%                 the cover portrait
 *   %%pull: hook%% then > "…"                     the hook on the cover
 *   ## Title  then  %%photo: FILE · ALT · opener%%  a part, opening as a spread
 *   %%photo: FILE · ALT · wide [aspect=4/5] [narrow] [left|right]%%
 *   %%photo: FILE · ALT · bleed%%
 *   %%photos: FILE · ALT | FILE · ALT · [stagger] [narrow] [aspect=…]%%
 *   %%pull: xl|l|m [follow]%% then > "…"         a sentence set large; `follow` takes the next paragraph as its continuation
 *   %%side: FILE · ALT · [flip] [bleed]%% … %%/side%%   words beside a photograph
 *   %%glyph: 缘分%% … %%/glyph%%                 a large Chinese word beside the words
 *   %%ending%%                                    the last stretch, after the parts
 *   %%on-photo: FILE · ALT · aspect=… ink=#… accent=#…%% then > "…"
 *   %%saying: FILE · ALT · aspect=…%% then > "…"  their closing saying, then the closing photograph
 *   %%saying%% then > "…"                         their closing saying, with no photograph yet
 *   any paragraph after the saying               Adrian's close
 *
 * Photographs are optional (Adrian, 2026-10-01: "I don't mind publishing
 * without photos"). With no cover the page typesets one; with no closing
 * photograph the story ends on the saying and the close. A photograph that IS
 * placed must still be in the story's image folder, or the send is refused.
 * Every photo note may carry x= and y= (the focal point, 0 to 1).
 * Any other %%note%% is left out of the page.
 */
import type { Block, ConversationSpec, LineSize, Part, Shot } from './spec';

export type Story = Pick<ConversationSpec, 'portrait' | 'intro' | 'hook' | 'opening' | 'parts' | 'ending' | 'closing'>;

export class DraftError extends Error {}

const SEP = ' · ';

// ── Text ─────────────────────────────────────────────────────────────────────
/** Straight quotes and apostrophes become the page's typographic ones. Curly ones are left alone. */
export function smarten(t: string): string {
  return t
    .replace(/(\w)'(\w)/g, '$1’$2')
    .replace(/(^|[\s(“])'/g, '$1‘')
    .replace(/'/g, '’')
    .replace(/(^|[\s(‘])"/g, '$1“')
    .replace(/"/g, '”');
}

/** A draft's inline text as the page stores it. */
function pageText(md: string): string {
  if (/==/.test(md)) throw new DraftError(`A connecting line is still marked ==…== (not approved yet): "${md.slice(0, 70)}"`);
  if (/\u2014/.test(md)) throw new DraftError(`An em dash: "${md.slice(0, 70)}"`);
  return smarten(md
    .replace(/%%[\s\S]*?%%/g, '')
    .replace(/\[\[term:[^|\]]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '==$1==')
    .replace(/[ \t]+\n/g, '\n')
    .trim());
}

const draftText = (page: string) => page.replace(/==([^=]+)==/g, '**$1**');

/** Strip one pair of outer quotation marks, straight or curly. */
function unquote(s: string): string | null {
  const m = s.match(/^["“]([\s\S]*)["”]$/);
  return m ? m[1] : null;
}

// ── Photo notes ──────────────────────────────────────────────────────────────
type PhotoNote = { file: string; alt: string; words: string[]; opts: Record<string, string> };

function photoNote(body: string): PhotoNote {
  const bits = body.split(SEP);
  const [file, alt = '', layout = ''] = [bits[0], bits[1], bits.slice(2).join(SEP)];
  const words: string[] = [];
  const opts: Record<string, string> = {};
  layout.split(/\s+/).filter(Boolean).forEach((w) => {
    const kv = w.match(/^(\w+)=(.+)$/);
    if (kv) opts[kv[1]] = kv[2];
    else if (/^\d+\/\d+$/.test(w)) opts.aspect = w;
    else words.push(w);
  });
  return { file: file.trim(), alt: alt.trim(), words, opts };
}

function shotOf(n: PhotoNote, slots: Map<string, string>): Shot {
  const shot: Shot = { slot: slots.get(n.file) ?? n.file.replace(/\.[a-z]+$/i, ''), file: n.file, alt: n.alt };
  if (n.opts.x !== undefined) shot.x = Number(n.opts.x);
  if (n.opts.y !== undefined) shot.y = Number(n.opts.y);
  return shot;
}

function noteText(s: Shot, layout: string[]): string {
  const extra = [...layout];
  if (s.x !== undefined) extra.push(`x=${s.x}`);
  if (s.y !== undefined) extra.push(`y=${s.y}`);
  return [s.file, s.alt, extra.join(' ')].filter((x, i) => i < 2 || x).join(SEP);
}

// ── Draft → story ────────────────────────────────────────────────────────────
/** The body of a DEV file: between the metadata block and the closing notes. */
export function draftBody(dev: string): { head: string; body: string; tail: string } {
  const parts = dev.split(/^---[ \t]*$/m);
  if (parts.length < 4) throw new DraftError('The draft needs frontmatter, a metadata block, and a body, each closed by ---.');
  // parts: ['', frontmatter, metadata, body, (notes…)]
  const head = ['', parts[1], parts[2]].join('---');
  const body = parts[3];
  const tail = parts.slice(4).join('---');
  return { head, body, tail };
}

type Ids = { byText: Map<string, string>; slots: Map<string, string> };

export function parseDraft(body: string, prev: Ids = { byText: new Map(), slots: new Map() }): Story {
  const chunks = body.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
  let portrait: Shot | undefined;
  let intro: string | undefined;
  let hook: string | undefined;
  let closing: string | undefined;
  const opening: Block[] = [];
  const parts: Part[] = [];
  const endingBlocks: Block[] = [];
  let saying: { id: string; text: string } | undefined;
  let endShot: Shot | undefined;
  let endAspect = '';
  let where: 'opening' | 'parts' | 'ending' | 'closing' = 'opening';
  const stack: Block[][] = [];
  let pendingFollow: Extract<Block, { kind: 'line' }> | null = null;

  const target = (): Block[] => {
    if (stack.length) return stack[stack.length - 1];
    if (where === 'opening') return opening;
    if (where === 'ending') return endingBlocks;
    if (where === 'parts') return parts[parts.length - 1].blocks;
    throw new DraftError('Nothing may follow Adrian’s close except notes.');
  };
  const push = (b: Block) => target().push(b);
  const note = (c: string, tag: string) => c.match(new RegExp(`^%%${tag}:\\s*([^%]*)%%`))?.[1]?.trim();
  const pullQuote = (c: string) => {
    const q = c.split('\n').slice(1).join(' ').replace(/^>\s*/, '').trim();
    const inner = unquote(q);
    if (inner === null) throw new DraftError(`A pull quote must sit in quotation marks: ${q.slice(0, 60)}`);
    return pageText(inner);
  };

  for (const c of chunks) {
    if (c.startsWith('## ')) {
      if (where === 'ending' || where === 'closing') throw new DraftError('A part heading after %%ending%%.');
      where = 'parts';
      parts.push({ title: pageText(c.slice(3)), blocks: [] });
      continue;
    }
    if (c === '%%ending%%') { where = 'ending'; continue; }
    if (c === '%%/side%%' || c === '%%/glyph%%') {
      if (!stack.length) throw new DraftError(`${c} with nothing open.`);
      stack.pop();
      continue;
    }
    let n: string | undefined;
    if ((n = note(c, 'photo')) !== undefined) {
      const p = photoNote(n);
      const shot = shotOf(p, prev.slots);
      if (p.words.includes('cover')) portrait = shot;
      else if (p.words.includes('opener')) {
        if (where !== 'parts' || parts[parts.length - 1].blocks.length) throw new DraftError(`An opener photo must come straight after a part heading: ${p.file}`);
        parts[parts.length - 1].opener = shot;
      } else if (p.words.includes('bleed')) push({ kind: 'bleed', shot });
      else {
        const b: Extract<Block, { kind: 'wide' }> = { kind: 'wide', shot };
        if (p.opts.aspect) b.aspect = p.opts.aspect;
        if (p.words.includes('narrow')) b.narrow = true;
        if (p.words.includes('left')) b.offset = 'left';
        if (p.words.includes('right')) b.offset = 'right';
        push(b);
      }
      continue;
    }
    if ((n = note(c, 'photos')) !== undefined) {
      const items = n.split(' | ');
      const last = photoNote(items[items.length - 1]);
      const shots = items.map((it, i) => shotOf(i === items.length - 1 ? last : photoNote(it), prev.slots));
      const b: Extract<Block, { kind: 'photos' }> = { kind: 'photos', shots };
      if (last.opts.aspect) b.aspect = last.opts.aspect;
      if (last.words.includes('stagger')) b.stagger = true;
      if (last.words.includes('narrow')) b.narrow = true;
      push(b);
      continue;
    }
    if ((n = note(c, 'side')) !== undefined) {
      const p = photoNote(n);
      const b: Extract<Block, { kind: 'side' }> = { kind: 'side', shot: shotOf(p, prev.slots), blocks: [] };
      if (p.words.includes('flip')) b.flip = true;
      if (p.words.includes('bleed')) b.bleed = true;
      push(b);
      stack.push(b.blocks);
      continue;
    }
    if ((n = note(c, 'glyph')) !== undefined) {
      const b: Extract<Block, { kind: 'glyph' }> = { kind: 'glyph', glyph: n, blocks: [] };
      push(b);
      stack.push(b.blocks);
      continue;
    }
    if ((n = note(c, 'pull')) !== undefined) {
      const words = n.split(/\s+/);
      const text = pullQuote(c);
      if (words[0] === 'hook') { hook = text; continue; }
      const size = words[0] as LineSize;
      if (!['xl', 'l', 'm'].includes(size)) throw new DraftError(`A pull quote size is xl, l or m, or "hook": %%pull: ${n}%%`);
      const b: Extract<Block, { kind: 'line' }> = { kind: 'line', id: '', text, size };
      push(b);
      if (words.includes('follow')) pendingFollow = b;
      continue;
    }
    if ((n = note(c, 'on-photo')) !== undefined) {
      const p = photoNote(n);
      if (!p.opts.ink || !p.opts.accent || !p.opts.aspect) throw new DraftError(`An on-photo line needs aspect=, ink= and accent= (measured on that photo): ${p.file}`);
      push({ kind: 'on-photo', id: '', shot: shotOf(p, prev.slots), text: pullQuote(c), ink: p.opts.ink, accent: p.opts.accent, aspect: p.opts.aspect });
      continue;
    }
    // %%saying: FILE · ALT · aspect=…%% places the closing photograph after the
    // saying; a bare %%saying%% is a story sent before its photographs, which
    // ends on the saying and Adrian's close.
    const bareSaying = /^%%saying:?\s*%%/.test(c);
    if (bareSaying || (n = note(c, 'saying')) !== undefined) {
      if (where !== 'ending') throw new DraftError('The closing saying belongs after %%ending%%.');
      saying = { id: 'e-saying', text: `“${pullQuote(c)}”` };
      if (!bareSaying) {
        const p = photoNote(n!);
        if (!p.opts.aspect) throw new DraftError(`The closing photograph needs aspect=: ${p.file}`);
        endShot = shotOf(p, prev.slots);
        endAspect = p.opts.aspect;
      }
      where = 'closing';
      continue;
    }
    if (/^%%[\s\S]*%%$/.test(c)) continue; // a note for Adrian or the writer; never on the page

    // Words.
    const text = c.replace(/%%[\s\S]*?%%/g, '').trim();
    if (!text) continue;
    if (where === 'closing') {
      if (closing !== undefined) throw new DraftError('Adrian’s close is one paragraph.');
      closing = pageText(text);
      continue;
    }
    const q = text.match(/^\*(["“][\s\S]*["”])\*$/);
    if (q) { push({ kind: 'q', id: '', text: pageText(unquote(q[1])!) }); continue; }
    const whole = unquote(text);
    if (whole !== null && !/["“”]/.test(whole.replace(/[‘’']/g, ''))) {
      const a = pageText(whole);
      if (pendingFollow) { pendingFollow.follow = { id: '', text: a }; pendingFollow = null; continue; }
      push({ kind: 'a', id: '', text: a });
      continue;
    }
    pendingFollow = null;
    const mixed = text.match(/^([^"“]+?[.!?])\s+["“]([\s\S]*)["”]$/);
    if (mixed) {
      push({ kind: 'n', id: '', text: pageText(mixed[1]) });
      push({ kind: 'a', id: '', text: pageText(mixed[2]) });
      continue;
    }
    if (where === 'opening' && intro === undefined && !opening.length) { intro = pageText(text); continue; }
    push({ kind: 'n', id: '', text: pageText(text) });
  }

  if (stack.length) throw new DraftError('A %%side%% or %%glyph%% was never closed.');
  // No cover photo is allowed: the page typesets the cover instead (Adrian,
  // 2026-10-01: "I don't mind publishing without photos").
  if (intro === undefined) throw new DraftError('No opening paragraph of Adrian’s before the first part.');
  if (!saying) throw new DraftError('No closing saying (%%saying%%, or %%saying: FILE · ALT · aspect=…%% with its photograph).');
  const ending: Story['ending'] = endShot
    ? { blocks: endingBlocks, saying, shot: endShot, aspect: endAspect }
    : { blocks: endingBlocks, saying };
  const story: Story = portrait
    ? { portrait, intro, opening, parts, ending }
    : { intro, opening, parts, ending };
  if (hook !== undefined) story.hook = hook;
  if (closing !== undefined) story.closing = closing;
  assignIds(story, prev.byText);
  return story;
}

// ── Keys ─────────────────────────────────────────────────────────────────────
// Owner edits on the page are stored by key, so a key must follow its words
// from one send to the next. A block keeps the key of the same words in the
// previous version; new words get a new key that no earlier version used.
const norm = (t: string) => t.toLowerCase().replace(/==|_/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function similar(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (x === y) return true;
  const grams = (s: string) => { const g = new Set<string>(); for (let i = 0; i < s.length - 2; i++) g.add(s.slice(i, i + 3)); return g; };
  const gx = grams(x), gy = grams(y);
  let both = 0; gx.forEach((g) => { if (gy.has(g)) both++; });
  return (2 * both) / (gx.size + gy.size || 1) >= 0.8;
}

export function textKeys(story: Pick<Story, 'opening' | 'parts' | 'ending'>): Map<string, string> {
  const m = new Map<string, string>();
  const walk = (bs: Block[]) => bs.forEach((b) => {
    if ('id' in b && 'text' in b) m.set(b.id, b.text);
    if (b.kind === 'line' && b.follow) m.set(b.follow.id, b.follow.text);
    if (b.kind === 'side' || b.kind === 'glyph') walk(b.blocks);
  });
  walk(story.opening); story.parts.forEach((p) => walk(p.blocks)); walk(story.ending.blocks);
  return m;
}

function assignIds(story: Story, prevByText: Map<string, string>): void {
  const prev = [...prevByText.entries()]; // [id, text]
  const used = new Set<string>(['e-saying']);
  const all = new Set(prev.map(([id]) => id));
  const pending: { set: (id: string) => void; text: string; scope: string; letter: string }[] = [];
  const walk = (bs: Block[], scope: string) => bs.forEach((b) => {
    const letter = b.kind === 'line' ? 'l' : b.kind === 'on-photo' ? 'on' : b.kind;
    if ('id' in b && 'text' in b) pending.push({ set: (id) => { (b as { id: string }).id = id; }, text: b.text, scope, letter });
    if (b.kind === 'line' && b.follow) { const f = b.follow; pending.push({ set: (id) => { f.id = id; }, text: f.text, scope, letter: 'a' }); }
    if (b.kind === 'side' || b.kind === 'glyph') walk(b.blocks, scope);
  });
  walk(story.opening, 'o'); story.parts.forEach((p, i) => walk(p.blocks, `p${i + 1}`)); walk(story.ending.blocks, 'e');
  // Exact words first, then close ones, so an unchanged line never loses its key to an edited neighbour.
  for (const pass of ['exact', 'close'] as const) {
    pending.forEach((p) => {
      if (p.text === '\u0000') return;
      const hit = prev.find(([id, t]) => !used.has(id) && (pass === 'exact' ? norm(t) === norm(p.text) : similar(t, p.text)));
      if (hit) { p.set(hit[0]); used.add(hit[0]); p.text = '\u0000'; }
    });
  }
  pending.forEach((p) => {
    if (p.text === '\u0000') return;
    let k = 1, id = '';
    do { id = `${p.scope}-${p.letter}${k++}`; } while (used.has(id) || all.has(id));
    p.set(id); used.add(id);
  });
}

// ── Story → draft (used once per story to seed a draft from a page built by hand) ──
export function storyToDraft(s: Story): string {
  const out: string[] = [];
  const quote = (t: string) => `"${draftText(t)}"`;
  const blocks = (bs: Block[]) => bs.forEach((b) => {
    switch (b.kind) {
      case 'a': out.push(quote(b.text)); break;
      case 'q': out.push(`*${quote(b.text)}*`); break;
      case 'n': out.push(draftText(b.text)); break;
      case 'line':
        out.push(`%%pull: ${b.size}${b.follow ? ' follow' : ''}%%\n> ${quote(b.text)}`);
        if (b.follow) out.push(quote(b.follow.text));
        break;
      case 'on-photo': out.push(`%%on-photo: ${noteText(b.shot, [`aspect=${b.aspect}`, `ink=${b.ink}`, `accent=${b.accent}`])}%%\n> ${quote(b.text)}`); break;
      case 'wide': out.push(`%%photo: ${noteText(b.shot, ['wide', ...(b.aspect ? [`aspect=${b.aspect}`] : []), ...(b.narrow ? ['narrow'] : []), ...(b.offset ? [b.offset] : [])])}%%`); break;
      case 'bleed': out.push(`%%photo: ${noteText(b.shot, ['bleed'])}%%`); break;
      case 'photos': {
        if (b.caption) throw new DraftError('Photo captions are not in the draft markup yet.');
        const layout = [...(b.stagger ? ['stagger'] : []), ...(b.narrow ? ['narrow'] : []), ...(b.aspect ? [`aspect=${b.aspect}`] : [])];
        out.push(`%%photos: ${b.shots.map((sh, i) => noteText(sh, i === b.shots.length - 1 ? layout : [])).join(' | ')}%%`);
        break;
      }
      case 'side':
        out.push(`%%side: ${noteText(b.shot, [...(b.flip ? ['flip'] : []), ...(b.bleed ? ['bleed'] : [])])}%%`);
        blocks(b.blocks); out.push('%%/side%%'); break;
      case 'glyph':
        out.push(`%%glyph: ${b.glyph}%%`); blocks(b.blocks); out.push('%%/glyph%%'); break;
    }
  });
  if (s.portrait) out.push(`%%photo: ${noteText(s.portrait, ['cover'])}%%`);
  if (s.hook !== undefined) out.push(`%%pull: hook%%\n> ${quote(s.hook)}`);
  out.push(draftText(s.intro));
  blocks(s.opening);
  s.parts.forEach((p) => {
    out.push(`## ${p.title}`);
    if (p.opener) out.push(`%%photo: ${noteText(p.opener, ['opener'])}%%`);
    blocks(p.blocks);
  });
  out.push('%%ending%%');
  blocks(s.ending.blocks);
  const inner = s.ending.saying.text.replace(/^“/, '').replace(/”$/, '');
  out.push(s.ending.shot
    ? `%%saying: ${noteText(s.ending.shot, [`aspect=${s.ending.aspect}`])}%%\n> ${quote(inner)}`
    : `%%saying%%\n> ${quote(inner)}`);
  if (s.closing !== undefined) out.push(draftText(s.closing));
  return `\n\n${out.join('\n\n')}\n\n`;
}

// ── Story → TypeScript ───────────────────────────────────────────────────────
const camel = (slot: string) => slot.replace(/[-_ ]+(\w)/g, (_, c: string) => c.toUpperCase()).replace(/^\d/, (d) => `s${d}`);

export function storyToTs(s: Story, source: string): string {
  const shots = new Map<string, Shot>();
  const collect = (sh: Shot) => { shots.set(sh.slot, sh); };
  if (s.portrait) collect(s.portrait);
  const walk = (bs: Block[]) => bs.forEach((b) => {
    if ('shot' in b) collect(b.shot);
    if (b.kind === 'photos') b.shots.forEach(collect);
    if (b.kind === 'side' || b.kind === 'glyph') walk(b.blocks);
  });
  walk(s.opening); s.parts.forEach((p) => { if (p.opener) collect(p.opener); walk(p.blocks); }); walk(s.ending.blocks); if (s.ending.shot) collect(s.ending.shot);

  const key = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
  const ser = (v: unknown, ind: string): string => {
    if (v && typeof v === 'object' && !Array.isArray(v) && 'slot' in v && 'file' in v) return `shots.${camel((v as Shot).slot)}`;
    if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => `${ind}  ${ser(x, `${ind}  `)},`).join('\n')}\n${ind}]` : '[]';
    if (v && typeof v === 'object') {
      const fields = Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${key(k)}: ${ser(x, `${ind}  `)}`);
      const one = `{ ${fields.join(', ')} }`;
      if (!one.includes('\n') && one.length + ind.length < 150) return one;
      return `{\n${fields.map((f) => `${ind}  ${f},`).join('\n')}\n${ind}}`;
    }
    return JSON.stringify(v);
  };
  const shotLines = [...shots.values()].map((sh) => `  ${camel(sh.slot)}: { ${Object.entries(sh).map(([k, x]) => `${k}: ${JSON.stringify(x)}`).join(', ')} },`).join('\n');
  const hasColours = /"ink"|ink:/.test(JSON.stringify(s));
  const field = (k: keyof Story) => (s[k] === undefined ? '' : `  ${k}: ${ser(s[k], '  ')},\n`);
  return `${hasColours ? '/**\n * @color-literals. An on-photo line carries two colours measured against its one\n * photograph; they do not change with the theme any more than the photograph does.\n */\n' : ''}/**
 * GENERATED by mag-send from the magazine draft "${source}".
 * Do not edit by hand: change the draft in the vault and send it again
 * (see src/pages/read/conversation/magSend.ts). Page facts such as the title,
 * byline and credit live in the hand-written piece file beside this one.
 */
import type { ConversationSpec, Shot } from '../spec';

export const shots = {
${shotLines}
} satisfies Record<string, Shot>;

export const story: Pick<ConversationSpec, 'portrait' | 'intro' | 'hook' | 'opening' | 'parts' | 'ending' | 'closing'> = {
${(['portrait', 'intro', 'hook', 'opening', 'parts', 'ending', 'closing'] as (keyof Story)[]).map(field).join('')}};
`;
}

/** The previous version's keys and photo slots, so a new send keeps them. */
export function memoryOf(prev: Pick<ConversationSpec, 'portrait' | 'opening' | 'parts' | 'ending'> | undefined): Ids {
  const byText = prev ? textKeys(prev) : new Map<string, string>();
  const slots = new Map<string, string>();
  if (prev) {
    const add = (sh: Shot) => slots.set(sh.file, sh.slot);
    if (prev.portrait) add(prev.portrait);
    const walk = (bs: Block[]) => bs.forEach((b) => {
      if ('shot' in b) add(b.shot);
      if (b.kind === 'photos') b.shots.forEach(add);
      if (b.kind === 'side' || b.kind === 'glyph') walk(b.blocks);
    });
    walk(prev.opening); prev.parts.forEach((p) => { if (p.opener) add(p.opener); walk(p.blocks); }); walk(prev.ending.blocks); if (prev.ending.shot) add(prev.ending.shot);
  }
  return { byText, slots };
}

/** Every photograph a story places, by file. */
export function placedFiles(s: Story): string[] {
  const out: string[] = [];
  if (s.portrait) out.push(s.portrait.file);
  if (s.ending.shot) out.push(s.ending.shot.file);
  const walk = (bs: Block[]) => bs.forEach((b) => {
    if ('shot' in b) out.push(b.shot.file);
    if (b.kind === 'photos') b.shots.forEach((sh) => out.push(sh.file));
    if (b.kind === 'side' || b.kind === 'glyph') walk(b.blocks);
  });
  walk(s.opening); s.parts.forEach((p) => { if (p.opener) out.push(p.opener.file); walk(p.blocks); }); walk(s.ending.blocks);
  return out;
}
