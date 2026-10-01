#!/usr/bin/env node
/**
 * mag-send: a magazine draft (DEV, in Adrian's vault) becomes a story's page.
 *
 *   node scripts/mag-send.mjs send "<DEV file>" <piece> [--check] [--slug <slug>]
 *   node scripts/mag-send.mjs seed "<DEV file>" <piece>
 *
 * send   Reads the draft, refuses anything not ready (an unapproved ==line==,
 *        an em dash, an unclosed side), checks every photograph in the story's
 *        image folder is placed and every placed one exists, keeps each line's
 *        edit key from the previous version, and writes
 *        src/pages/read/conversation/pieces/<piece>.story.ts.
 *        --check writes nothing and lists what would change.
 * seed   Once per story that was built by hand before mag-send: writes the
 *        draft's body from the page as it stands, so the draft and the page
 *        start identical. The draft's metadata block and notes are kept.
 *
 * The markup and the rules live in src/pages/read/conversation/magSend.ts.
 * Transcripts never enter this repo: only the story's own words do, which are
 * already public on the page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const convDir = path.join(repo, 'src/pages/read/conversation');
const m = await import(pathToFileURL(path.join(convDir, 'magSend.ts')).href);

const [cmd, devPath, piece, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(`--${name}`);
const opt = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
if (!['send', 'seed'].includes(cmd) || !devPath || !piece) {
  console.error('Usage: node scripts/mag-send.mjs send|seed "<DEV file>" <piece> [--check] [--slug <slug>]');
  process.exit(2);
}

const say = (s) => console.log(s);
const fail = (s) => { console.error(`✗ ${s}`); process.exit(1); };

const storyFile = path.join(convDir, 'pieces', `${piece}.story.ts`);
const pieceFile = path.join(convDir, 'pieces', `${piece}.ts`);

/** The page as it stands: the generated story if there is one, else the hand-built piece. */
async function currentPage() {
  if (fs.existsSync(pieceFile)) {
    const mod = await import(pathToFileURL(pieceFile).href + `?t=${Date.now()}`);
    const spec = Object.values(mod).find((v) => v && typeof v === 'object' && 'parts' in v);
    if (spec) return spec;
  }
  if (fs.existsSync(storyFile)) {
    const mod = await import(pathToFileURL(storyFile).href + `?t=${Date.now()}`);
    return mod.story;
  }
  return undefined;
}

const dev = fs.readFileSync(devPath, 'utf8');
const { head, body, tail } = m.draftBody(dev);
const prev = await currentPage();

if (cmd === 'seed') {
  if (!prev) fail(`No page to seed from: ${path.relative(repo, pieceFile)} does not exist.`);
  let md = m.storyToDraft(prev);
  // Carry across what the page never held: the tea-term marks (first use of each)
  // and the notes for Adrian, which move to the notes below the story.
  const terms = [...body.matchAll(/\[\[term:([^|\]]+)\|([^\]]+)\]\]/g)];
  const seen = new Set();
  for (const [, id, words] of terms) {
    if (seen.has(id)) continue;
    const re = new RegExp(`(?<![\\w|])${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w\\]])`, 'g');
    // The first use in the story's words, never inside a note or a pull quote.
    const hit = [...md.matchAll(re)].find((x) => {
      const lineStart = md.lastIndexOf('\n', x.index) + 1;
      return md.lastIndexOf('%%', x.index) < lineStart && md[lineStart] !== '>';
    });
    if (!hit) continue;
    const at = hit.index;
    md = `${md.slice(0, at)}[[term:${id}|${words}]]${md.slice(at + words.length)}`;
    seen.add(id);
  }
  const carried = [...body.matchAll(/%%(?:Adrian|Source|heard|speaker\?):[\s\S]*?%%/g)].map((x) => x[0]);
  // Round trip before writing: the draft must turn back into exactly this page.
  const back = m.parseDraft(md, m.memoryOf(prev));
  const pick = (s) => JSON.stringify(sortKeys({ portrait: s.portrait, intro: s.intro, hook: s.hook, opening: s.opening, parts: s.parts, ending: s.ending, closing: s.closing }));
  if (pick(back) !== pick(prev)) fail('The page does not survive the round trip; nothing written. (A block the draft markup cannot express yet.)');
  const carriedNote = carried.length ? `\n\n%%Carried from the draft's body when it was seeded from the page (${new Date().toISOString().slice(0, 10)}):%%\n\n${carried.join('\n\n')}` : '';
  fs.writeFileSync(devPath, `${head}---${md}---${carriedNote}${tail}`);
  say(`✓ Seeded the draft's body from the page, and it turns back into the same page.\n  ${seen.size} tea-term marks and ${carried.length} notes for Adrian carried across.\n  ${devPath}`);
  process.exit(0);
}

// send
let story;
try {
  story = m.parseDraft(body, m.memoryOf(prev));
} catch (e) {
  if (e instanceof m.DraftError) fail(e.message);
  throw e;
}

// Photographs: every one in the folder is placed, and every placed one is in the folder.
// share.jpg is the card a pasted link shows (functions/_middleware.ts), not a photograph of the story.
const SHARE_CARD = 'share.jpg';
const slug = opt('slug') ?? prev?.images?.replace(/^\/read\/|\/$/g, '') ?? prev?.slug;
if (!slug) fail('No image folder: pass --slug for a new story.');
const imgDir = path.join(repo, 'public/read', slug);
const onDisk = fs.existsSync(imgDir) ? fs.readdirSync(imgDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && f !== SHARE_CARD) : [];
const placed = new Set(m.placedFiles(story));
const missing = [...placed].filter((f) => !onDisk.includes(f));
const unplaced = onDisk.filter((f) => !placed.has(f));
if (missing.length) fail(`Placed in the draft but not in public/read/${slug}/: ${missing.join(', ')}`);
if (unplaced.length) fail(`In public/read/${slug}/ but not placed in the draft (every photo goes in): ${unplaced.join(', ')}`);

// What changes, by key.
const before = prev ? m.textKeys(prev) : new Map();
const after = m.textKeys(story);
const changed = [...after].filter(([id, t]) => before.has(id) && before.get(id) !== t).map(([id]) => id);
const added = [...after.keys()].filter((id) => !before.has(id));
const dropped = [...before.keys()].filter((id) => !after.has(id));

// Owner edits saved on the live page, by key, so none lands on different words unnoticed.
let edits = null;
try {
  const res = await fetch(`https://api.teajia.com/api/story-content/${encodeURIComponent(prev?.slug ?? slug)}`, { signal: AbortSignal.timeout(10000) });
  if (res.ok) edits = (await res.json()).text ?? {};
} catch { /* offline: reported below */ }
const editWarn = edits ? Object.keys(edits).filter((k) => changed.includes(k)) : [];

// A story may go out before its photographs: no cover (the page typesets one),
// no closing photograph, an empty or missing folder. A placed photograph that
// is not in the folder is still refused above.
if (placed.size === 0) say('No photographs yet: the cover is typeset and the story ends on the saying. Add them later and send again.');
else say(`${placed.size} photographs placed, all ${onDisk.length} in the folder.`);
say(`${after.size} passages: ${changed.length} changed, ${added.length} new, ${dropped.length} gone.`);
changed.forEach((id) => say(`  changed ${id}: "${after.get(id).slice(0, 70)}"`));
added.forEach((id) => say(`  new ${id}: "${after.get(id).slice(0, 70)}"`));
dropped.forEach((id) => say(`  gone ${id}: "${before.get(id).slice(0, 70)}"`));
if (edits === null) say('! Could not read the page edits saved on teajia.com; check none sits on a changed passage.');
else if (editWarn.length) say(`! A page edit is saved on a changed passage (${editWarn.join(', ')}): it will still show over the new words. Bring the edit into the draft, or clear it on the page.`);

if (flag('check')) { say('Check only: nothing written.'); process.exit(0); }
const source = path.basename(devPath, '.md');
fs.writeFileSync(storyFile, m.storyToTs(story, source));
say(`✓ Wrote ${path.relative(repo, storyFile)}`);

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, sortKeys(v[k])]));
  return v;
}
