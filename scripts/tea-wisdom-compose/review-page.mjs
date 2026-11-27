#!/usr/bin/env node
// Adrian's one review page for the new-tea chain (docs/agents/TEA-WISDOM-AGENTS.md, steps 3 and 6).
//
//   node scripts/tea-wisdom-compose/review-page.mjs [--pages banzhang,jingmai] [--no-entries] [--scopes <json>] [--out <html>]
//
// Writes one self-contained HTML page: every Wisdom section waiting for
// approval, rendered as a reader sees it with its sources, and every composed
// entry not yet approved, with its flags. Each item has Approve and Send back.
// The agent publishes the file as an Artifact with the `db` capability; the
// page saves each choice to runs/<run>/decisions/<item>, and apply-review.mjs
// carries the saved choices into the claim ledger and the entries.
// Read-only: it reads pages, the ledger and entries, and writes only --out.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWisdom } from '../tea-reference-markdown/lib/page-builder.mjs';
import { readEntries } from './lib/entries.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (
  value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]?.startsWith('--') ? 'true' : all[index + 1] ?? 'true']] : pairs
), []));
const OUT = path.resolve(args.out ?? path.join(ROOT, '.tea-wisdom-review', 'review.html'));

const wisdom = await buildWisdom({
  pagesDirectory: path.join(ROOT, 'data', 'tea-reference', 'pages'),
  translationsPath: path.join(ROOT, 'data', 'tea-reference', 'private', 'translations.json'),
  claimsPath: path.join(ROOT, 'data', 'tea-reference', 'claims.json'),
});
const scopes = args.scopes ? JSON.parse(await fs.readFile(path.resolve(args.scopes), 'utf8')) : {};
const onlyPages = args.pages ? new Set(args.pages.split(',')) : null;
const sources = new Map(wisdom.draftSources.map(source => [source.sourceId, source]));
const pages = new Map(wisdom.draftPages.map(page => [page.id, page]));

const KIND = { tea_family: 'Tea family', tea_type: 'Style', major_region: 'Region', tea_area: 'Place', leaf_grade: 'Grade', named_tea: 'Named tea', reference_topic: 'Topic' };

const claimItems = wisdom.draftClaims
  .filter(claim => (claim.reviewState === 'draft' || claim.reviewState === 'pending') && !claim.withdrawn)
  .filter(claim => !onlyPages || onlyPages.has(claim.pageId))
  .map(claim => {
    const page = pages.get(claim.pageId);
    return {
      key: claim.claimId,
      kind: 'claim',
      group: claim.pageId,
      groupLabel: page?.label ?? claim.pageId,
      groupMeta: [KIND[page?.kind] ?? page?.kind, page?.nativeName, page?.parentId ? `inside ${pages.get(page.parentId)?.label ?? page.parentId}` : null].filter(Boolean).join(' · '),
      label: claim.label,
      text: claim.pendingText ?? claim.text,
      before: claim.reviewState === 'pending' ? claim.text : null,
      scope: claim.scope || scopes[claim.claimId] || page?.label || claim.pageId,
      sources: claim.sourceIds.map(id => sources.get(id)).filter(Boolean).map(source => ({ title: source.title, publisher: source.publisher, url: /^https:\/\//.test(source.url ?? '') ? source.url : null })),
      flags: claim.unresolvedSourceIds?.length ? [`${claim.unresolvedSourceIds.length} source(s) not captured yet`] : [],
    };
  });

const entryItems = args['no-entries'] ? [] : (await readEntries(path.join(ROOT, 'data', 'tea-reference', 'entries')))
  .filter(({ file }) => file.status !== 'approved')
  .map(({ file }) => ({
    key: `entry:${file.record.id}`,
    kind: 'entry',
    group: 'entries',
    groupLabel: file.record.name,
    groupMeta: [file.record.type, file.record.form, file.record.year, file.record.origin].filter(Boolean).join(' · '),
    label: file.record.chineseName ?? '',
    paragraphs: (file.entry?.paragraphs ?? []).map(part => part.text),
    brewing: file.entry?.brewing ?? null,
    notice: file.entry?.notice ?? null,
    flags: [...(file.problems ?? []).map(problem => `${problem.where}: ${problem.problem}`), ...(file.unsupported ?? []).map(flag => `Not supported: "${flag.words}"${flag.why ? ` (${flag.why})` : ''}`)],
  }));

const run = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const data = { run, items: [...claimItems, ...entryItems] };
const json = JSON.stringify(data).replace(/</g, '\\u003c');

const html = `<title>Wisdom Review</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600&display=swap">
<style>
/* One reading column; each page or tea is a card; decisions sit under each item. */
:root{--bg:#f6f7f4;--surface:#fff;--ink:#1f2a24;--ink-sec:#55625a;--line:#d9ded6;--gold:#a8873f;--gold-soft:#efe6cf;--you:#2f5d50;--warn:#9b3b2e;
--display:"Cormorant Garamond",Georgia,serif;--body:"Inter",system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141a17;--surface:#1c2420;--ink:#e7ece8;--ink-sec:#a5b0a9;--line:#33403a;--gold:#d2b46c;--gold-soft:#3a3322;--you:#8cc6b3;--warn:#e08b7e;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#141a17;--surface:#1c2420;--ink:#e7ece8;--ink-sec:#a5b0a9;--line:#33403a;--gold:#d2b46c;--gold-soft:#3a3322;--you:#8cc6b3;--warn:#e08b7e;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font:15px/1.65 var(--body);font-variant-numeric:lining-nums}
.wrap{max-width:760px;margin:0 auto;padding-block:28px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:28px}
h1,h2{font-family:var(--display);font-weight:600;margin:0;line-height:1.15;text-wrap:balance}h1{font-size:2.2rem}h2{font-size:1.6rem}
p{margin:0;max-width:65ch}.sec{color:var(--ink-sec)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:18px;display:grid;gap:16px}
.meta{font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--gold);font-weight:600}
.item{display:grid;gap:8px;padding-top:14px;border-top:1px solid var(--line)}.item:first-of-type{border-top:0;padding-top:0}
.item h3{margin:0;font-size:1rem;font-weight:600}
.term{text-decoration:underline;text-decoration-color:var(--gold);text-underline-offset:3px}
.before{font-size:.88rem;color:var(--ink-sec)}.before b{font-weight:600}
.src{font-size:.82rem;color:var(--ink-sec)}.src a{color:inherit}
.flag{font-size:.85rem;color:var(--warn)}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
button{font:inherit;font-size:.9rem;min-height:44px;padding:8px 14px;border-radius:4px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer}
button:hover{border-color:var(--gold)}button:focus-visible,textarea:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
button[aria-pressed="true"].ok{background:var(--you);border-color:var(--you);color:var(--bg)}
button[aria-pressed="true"].back{background:var(--warn);border-color:var(--warn);color:var(--bg)}
textarea{font:inherit;width:100%;box-sizing:border-box;min-height:64px;padding:8px;border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--ink)}
.state{font-size:.8rem;color:var(--ink-sec)}
.bulk{background:var(--gold-soft);border-color:transparent}
.empty{color:var(--ink-sec)}
.rule{display:flex;gap:8px;align-items:center;font-size:.9rem;min-height:44px}.rule input{width:20px;height:20px;accent-color:var(--you)}
</style>
<div class="wrap">
  <header style="display:grid;gap:8px"><div class="meta">Teajia · Wisdom review · run ${run}</div><h1>Wisdom Review</h1>
  <p class="sec">Pages first: each section as a reader will see it, with where it comes from. Then the tea entries. Approve, or send back with a note. Tick \"Make this a rule for every page\" when the note should change how every page is written. Your choices save here, and nothing goes live until you say "push".</p></header>
  <div id="list"></div>
</div>
<script id="data" type="application/json">${json}</script>
<script>
(async () => {
  const data = JSON.parse(document.getElementById('data').textContent);
  const list = document.getElementById('list');
  const el = (tag, attrs = {}, text) => { const node = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v); if (text != null) node.textContent = text; return node; };
  const withTerms = (text) => { const p = el('p'); let last = 0; for (const m of text.matchAll(/\\[([^\\]]+)\\]\\(([a-z0-9-]+:[a-z0-9-]+)\\)/g)) { p.append(text.slice(last, m.index)); p.append(el('span', { class: 'term', title: m[2] }, m[1])); last = m.index + m[0].length; } p.append(text.slice(last)); return p; };
  let db = null; try { db = await window.claude?.use?.('db'); } catch { db = null; }
  const coll = 'runs/' + data.run + '/decisions';
  const controls = new Map();
  const save = async (item, choice, note) => {
    const c = controls.get(item.key); c.ok.setAttribute('aria-pressed', String(choice === 'approve')); c.back.setAttribute('aria-pressed', String(choice === 'send_back'));
    c.note.hidden = choice !== 'send_back'; c.ruleRow.hidden = choice !== 'send_back'; if (!db) { c.state.textContent = 'This view cannot save. Tell Claude in chat.'; return; }
    c.state.textContent = 'Saving…';
    try { await db.doc(coll + '/' + item.key).set({ item: item.key, kind: item.kind, choice, note: note || '', rule: choice === 'send_back' && c.rule.checked, scope: item.scope || '', at: new Date().toISOString() }); c.state.textContent = choice === 'approve' ? 'Approved.' : (c.rule.checked ? 'Sent back. Becomes a rule for every page.' : 'Sent back.'); }
    catch { c.state.textContent = 'Not saved. Tell Claude in chat.'; }
  };
  const decide = (item) => {
    const box = el('div', { class: 'row' }); const ok = el('button', { class: 'ok', type: 'button', 'aria-pressed': 'false' }, 'Approve');
    const back = el('button', { class: 'back', type: 'button', 'aria-pressed': 'false' }, 'Send back'); const state = el('span', { class: 'state', 'aria-live': 'polite' });
    const note = el('textarea', { id: 'note-' + item.key.replace(/[^a-z0-9]/gi, '-'), placeholder: 'What is wrong, in your words', 'aria-label': 'Note for ' + item.label }); note.hidden = true;
    const ruleRow = el('label', { class: 'rule' }); const rule = el('input', { type: 'checkbox', id: 'rule-' + item.key.replace(/[^a-z0-9]/gi, '-') }); ruleRow.append(rule, ' Make this a rule for every page'); ruleRow.hidden = true;
    rule.addEventListener('change', () => save(item, 'send_back', note.value));
    let timer; note.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => save(item, 'send_back', note.value), 800); });
    ok.addEventListener('click', () => save(item, 'approve', '')); back.addEventListener('click', () => { save(item, 'send_back', note.value); note.focus(); });
    box.append(ok, back, state); controls.set(item.key, { ok, back, state, note, rule, ruleRow }); const wrap = el('div', { style: 'display:grid;gap:8px' }); wrap.append(box, note, ruleRow); return wrap;
  };
  if (!data.items.length) { list.append(el('p', { class: 'empty' }, 'Nothing is waiting for review.')); return; }
  const groups = new Map(); for (const item of data.items) { const g = item.kind === 'entry' ? item.key : item.group; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(item); }
  const cleanEntries = data.items.filter(i => i.kind === 'entry' && !i.flags.length);
  if (cleanEntries.length > 1) { const bulk = el('div', { class: 'card bulk' }); bulk.append(el('p', {}, cleanEntries.length + ' entries have no flags.')); const b = el('button', { type: 'button' }, 'Approve all ' + cleanEntries.length + ' clean entries'); b.addEventListener('click', () => cleanEntries.forEach(i => save(i, 'approve', ''))); bulk.append(b); list.append(bulk); }
  const stack = el('div', { style: 'display:grid;gap:20px' }); list.append(stack);
  for (const items of groups.values()) {
    const first = items[0]; const card = el('section', { class: 'card' }); const head = el('div', { style: 'display:grid;gap:4px' });
    head.append(el('div', { class: 'meta' }, first.kind === 'entry' ? 'Tea entry' : 'Wisdom page'), el('h2', {}, first.groupLabel)); if (first.groupMeta) head.append(el('p', { class: 'sec' }, first.groupMeta)); card.append(head);
    for (const item of items) {
      const box = el('div', { class: 'item' });
      if (item.kind === 'claim') {
        box.append(el('h3', {}, item.label)); box.append(withTerms(item.text));
        if (item.before) { const b = el('p', { class: 'before' }); b.append(el('b', {}, 'Live now: '), item.before); box.append(b); }
        const s = el('p', { class: 'src' }); s.append('Sources: '); if (!item.sources.length) s.append('trade knowledge, no citation');
        item.sources.forEach((src, i) => { if (i) s.append('; '); if (src.url) { const a = el('a', { href: src.url, target: '_blank', rel: 'noopener' }, src.title || src.publisher); s.append(a); } else s.append(src.title || src.publisher); });
        box.append(s);
      } else {
        if (item.label) box.append(el('p', { class: 'sec' }, item.label));
        item.paragraphs.forEach(t => box.append(withTerms(t)));
        if (item.brewing) box.append(el('p', { class: 'sec' }, typeof item.brewing === 'string' ? item.brewing : 'Brewing: from the style kit'));
      }
      item.flags.forEach(f => box.append(el('p', { class: 'flag' }, f)));
      box.append(decide(item)); card.append(box);
    }
    stack.append(card);
  }
  if (!db) return;
  try { db.collection(coll).onSnapshot(snap => { for (const doc of (snap.docs || [])) { const d = doc.data(); const c = controls.get(d.item); if (!c) continue; c.ok.setAttribute('aria-pressed', String(d.choice === 'approve')); c.back.setAttribute('aria-pressed', String(d.choice === 'send_back')); c.note.hidden = d.choice !== 'send_back'; c.ruleRow.hidden = d.choice !== 'send_back'; c.rule.checked = !!d.rule; if (document.activeElement !== c.note) c.note.value = d.note || ''; c.state.textContent = d.choice === 'approve' ? 'Approved.' : 'Sent back.'; } }); } catch {}
})();
</script>
`;

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, html);
console.log(`${OUT}\nrun ${run}: ${claimItems.length} section(s) on ${new Set(claimItems.map(i => i.group)).size} page(s), ${entryItems.length} entr${entryItems.length === 1 ? 'y' : 'ies'}`);
console.log(`Decisions will save to runs/${run}/decisions`);
