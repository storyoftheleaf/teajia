/**
 * mag-send, held by the build.
 *
 * 1. Every story page turns into a draft and back into exactly itself, so the
 *    draft markup can express everything a page does (runs in CI).
 * 2. The draft refuses what is not ready: an unapproved ==line==, an em dash,
 *    an unclosed side (runs in CI, on a made-up draft).
 * 3. A line keeps its edit key when its words stay, and new words never take
 *    a key an earlier version used.
 * 4. On a machine with the vault: each generated story file is exactly what its
 *    draft produces now. A hand edit to the generated file, or a draft changed
 *    and never sent, fails here. CI skips it; the transcripts never leave the vault.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DraftError, draftBody, memoryOf, parseDraft, storyToDraft, storyToTs, textKeys, type Story } from './magSend';
import { CONVERSATIONS } from './pieces';

const pick = (s: Story) => ({ portrait: s.portrait, intro: s.intro, hook: s.hook, opening: s.opening, parts: s.parts, ending: s.ending, closing: s.closing });
const sort = (v: unknown): unknown => (Array.isArray(v) ? v.map(sort)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v);

describe.each(CONVERSATIONS.map((c) => [c.slug, c] as const))('mag-send round trip: %s', (_slug, spec) => {
  it('turns into a draft and back into exactly the same page', () => {
    const back = parseDraft(storyToDraft(spec), memoryOf(spec));
    expect(sort(pick(back))).toEqual(sort(pick(spec)));
  });
});

const DRAFT = `---
type: DEV
---

**Story Subject:** A maker

---

%%photo: portrait.jpg · A maker at the bench · cover y=0.3%%

%%pull: hook%%
> "Clay remembers **the hand.**"

I came in from the rain and the kiln was still warm.

## The first part

%%photo: kiln.jpg · The kiln · opener%%

"I learned from my father. He said it's the water."

*"Did he teach you the glaze too?"*

He shows the bowl before he answers. "Only the fire."

%%pull: xl follow%%
> "Clay **remembers.**"

"And it forgets nothing."

%%photos: a.jpg · A bowl | b.jpg · A cup · stagger%%

%%ending%%

"That is all."

%%saying: last.jpg · The last bowl · aspect=4/5%%
> "Make it slowly."

I left with a cup in my pocket.

---

%%Notes for the writer.%%
`;

describe('the draft markup', () => {
  const story = parseDraft(draftBody(DRAFT).body);

  it('reads every kind of block', () => {
    expect(story.hook).toBe('Clay remembers ==the hand.==');
    expect(story.intro).toBe('I came in from the rain and the kiln was still warm.');
    expect(story.portrait).toEqual({ slot: 'portrait', file: 'portrait.jpg', alt: 'A maker at the bench', y: 0.3 });
    const [part] = story.parts;
    expect(part.opener?.file).toBe('kiln.jpg');
    expect(part.blocks.map((b) => b.kind)).toEqual(['a', 'q', 'n', 'a', 'line', 'photos']);
    expect(part.blocks[0]).toMatchObject({ text: 'I learned from my father. He said it’s the water.' });
    expect(part.blocks[3]).toMatchObject({ kind: 'a', text: 'Only the fire.' });
    expect(part.blocks[4]).toMatchObject({ size: 'xl', text: 'Clay ==remembers.==', follow: { text: 'And it forgets nothing.' } });
    expect(story.ending.saying.text).toBe('“Make it slowly.”');
    expect(story.ending.shot.file).toBe('last.jpg');
    expect(story.closing).toBe('I left with a cup in my pocket.');
  });

  it('gives every passage a key of its own', () => {
    const keys = [...textKeys(story).keys()];
    expect(keys.length).toBe(new Set(keys).size);
    expect(keys.every(Boolean)).toBe(true);
  });

  it('refuses a connecting line that is not approved yet', () => {
    const body = draftBody(DRAFT).body.replace('He shows the bowl before he answers.', '==He shows the bowl before he answers.==');
    expect(() => parseDraft(body)).toThrow(DraftError);
  });

  it('refuses an em dash', () => {
    expect(() => parseDraft(draftBody(DRAFT).body.replace('That is all.', 'That is all \u2014 truly.'))).toThrow(/em dash/);
  });

  it('refuses a side that is never closed', () => {
    const body = draftBody(DRAFT).body.replace('"That is all."', '%%side: s.jpg · A side%%\n\n"That is all."');
    expect(() => parseDraft(body)).toThrow(/never closed/);
  });

  it('keeps a key with its words, and never reuses one for new words', () => {
    const first = parseDraft(draftBody(DRAFT).body);
    const oldKeys = textKeys(first);
    const edited = draftBody(DRAFT).body
      .replace('"And it forgets nothing."', '"And it forgets nothing at all."')
      .replace('"That is all."', '"Something new entirely, nothing like before."');
    const second = parseDraft(edited, memoryOf({ ...first }));
    const k2 = textKeys(second);
    const idOf = (m: Map<string, string>, start: string) => [...m].find(([, t]) => t.startsWith(start))?.[0];
    expect(idOf(k2, 'I learned from my father')).toBe(idOf(oldKeys, 'I learned from my father'));
    expect(idOf(k2, 'And it forgets nothing at all')).toBe(idOf(oldKeys, 'And it forgets nothing'));
    const fresh = idOf(k2, 'Something new entirely')!;
    expect([...oldKeys.keys()]).not.toContain(fresh);
  });
});

// ── With the vault: the committed story file is what the draft makes now ─────
const develop = process.env.MAGAZINE_DEVELOP_DIR
  ?? join(homedir(), 'Library/Mobile Documents/iCloud~md~obsidian/Documents/Adrian-obsidian/Brands/Teajia/Magazine/Workflow/3-Develop');
const piecesDir = join(__dirname, 'pieces');
const generated = readdirSync(piecesDir).filter((f) => f.endsWith('.story.ts'));

describe.each(generated.map((f) => [f] as const))('generated %s', (file) => {
  const ts = readFileSync(join(piecesDir, file), 'utf8');
  const source = ts.match(/from the magazine draft "([^"]+)"/)?.[1] ?? '';
  const devPath = join(develop, `${source}.md`);

  it('names the draft it was made from', () => { expect(source).not.toBe(''); });

  it.skipIf(!existsSync(devPath))('is exactly what its draft makes now (no hand edits, no unsent draft)', async () => {
    const piece = CONVERSATIONS.find((c) => ts.includes(`"${c.portrait.file}"`));
    const story = parseDraft(draftBody(readFileSync(devPath, 'utf8')).body, memoryOf(piece));
    expect(storyToTs(story, source)).toBe(ts);
  });
});
