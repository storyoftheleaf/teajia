// Builds the picture archive page from the archive folder's index.json.
// Usage: node build.cjs <archiveDir> <outHtml> <filesMapJson>
const fs = require('fs');
const path = require('path');
// Width and height straight from the file header (WebP, PNG), no image library needed.
function dims(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') { const n = b.readUInt32LE(21); return { width: 1 + (n & 0x3fff), height: 1 + ((n >> 14) & 0x3fff) }; }
  }
  if (b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return { width: 0, height: 0 };
}

const [archiveDir, outHtml, outMap, notesFile] = process.argv.slice(2);
const notes = notesFile && fs.existsSync(notesFile) ? JSON.parse(fs.readFileSync(notesFile, 'utf8')) : {};
const ROOMS = [
  ['today', 'Today'],
  ['curate-old', 'Curate (current)'],
  ['curate-new', 'Curate (v2)'],
  ['tasting', 'Tasting'],
  ['stock', 'Stock'],
  ['purchases', 'Purchases'],
  ['sales', 'Sales'],
  ['people', 'People'],
  ['sessions', 'Sessions'],
  ['publish', 'Publish'],
  ['settings', 'Settings'],
  ['shop', 'Shop'],
];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const words = s => String(s).replace(/^\d+-/, '').replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());

(async () => {
  const index = JSON.parse(fs.readFileSync(path.join(archiveDir, 'index.json'), 'utf8'));
  const present = index.filter(e => fs.existsSync(path.join(archiveDir, e.file)));
  // Published under short numbered names (s/001.webp), copied into <outHtml dir>/pub.
  const pubDir = path.join(path.dirname(outHtml), 'pub');
  fs.rmSync(pubDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(pubDir, 's'), { recursive: true });
  present.forEach((e, i) => {
    const m = dims(path.join(archiveDir, e.file));
    e.w = m.width; e.h = m.height;
    e.pub = `s/${String(i + 1).padStart(3, '0')}${path.extname(e.file)}`;
    fs.copyFileSync(path.join(archiveDir, e.file), path.join(pubDir, e.pub));
  });
  const known = new Map(ROOMS);
  const roomOrder = [...ROOMS.map(r => r[0]), ...new Set(present.map(e => e.room).filter(r => !known.has(r)))];
  const rooms = roomOrder
    .map(id => ({ id, name: known.get(id) ?? words(id), shots: present.filter(e => e.room === id) }))
    .filter(r => r.shots.length);

  // Pair phone and laptop of one state, keeping first-seen order.
  for (const r of rooms) {
    const states = [];
    const by = new Map();
    for (const s of r.shots) {
      if (!by.has(s.state)) { by.set(s.state, { state: s.state, note: s.note, route: s.route }); states.push(by.get(s.state)); }
      by.get(s.state)[s.size] = s;
    }
    r.states = states;
  }
  const total = present.length;
  const figure = (s, label) => {
    if (!s) return '';
    const long = s.w && (s.size === 'phone' ? s.h / s.w > 2.4 : s.h / s.w > 0.82);
    return `<button class="shot ${s.size}${long ? ' long' : ''}" type="button" data-full="${esc(s.pub)}" data-cap="${esc(label)}" data-size="${s.size}">`
      + `<img src="${esc(s.pub)}" ${s.w ? `width="${s.w}" height="${s.h}" ` : ''}loading="lazy" decoding="async" alt="${esc(label)}, ${s.size}">`
      + `<span class="tag">${s.size === 'phone' ? 'Phone' : 'Laptop'}</span>${long ? '<span class="more">Whole page, open to scroll</span>' : ''}</button>`;
  };
  const sections = rooms.map(r => `
<section class="room" id="${esc(r.id)}">
  <header class="room-head"><h2>${esc(r.name)}</h2><p class="count">${r.states.length} screens</p></header>
  <div class="states">
${r.states.map(st => {
    const title = words(st.state);
    const label = `${r.name}: ${title}`;
    return `    <article class="state">
      <div class="state-head"><h3>${esc(title)}</h3>${st.note ? `<p>${esc(st.note)}</p>` : ''}${st.route ? `<code>${esc(st.route)}</code>` : ''}</div>
      <div class="pair">${figure(st.phone, label)}${figure(st.laptop, label)}</div>
    </article>`;
  }).join('\n')}
  </div>
</section>`).join('\n');

  const html = `<title>Teajia Manage Archive</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@400;500;600&display=swap">
<style>
/* Layout: a contact sheet. One sticky room rail, then each room as a run of screens, phone and laptop side by side. */
:root {
  --bg: #22201c; --surface: #322e29; --raised: #423d36;
  --fg: #ede4d4; --fg-sec: #ddd2bd; --fg-dim: #b3a283;
  --gold: #bfa06a; --line: rgba(168, 135, 77, 0.22);
  --display: "Cormorant Garamond", "Iowan Old Style", Georgia, serif;
  --body: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) {
  --bg: #f4ece0; --surface: #e4ddd3; --raised: #d5c8b4;
  --fg: #18130e; --fg-sec: #332b20; --fg-dim: #564a37;
  --gold: #8e6d2e; --line: rgba(142, 109, 46, 0.28); color-scheme: light;
} }
:root[data-theme="light"] {
  --bg: #f4ece0; --surface: #e4ddd3; --raised: #d5c8b4;
  --fg: #18130e; --fg-sec: #332b20; --fg-dim: #564a37;
  --gold: #8e6d2e; --line: rgba(142, 109, 46, 0.28); color-scheme: light;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 15px/1.55 var(--body); }
.wrap { max-width: 1280px; margin: 0 auto; padding-block: 28px 80px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1, h2, h3 { font-family: var(--display); font-weight: 500; text-wrap: balance; margin: 0; letter-spacing: 0.01em; }
h1 { font-size: clamp(30px, 5vw, 44px); font-weight: 400; line-height: 1.1; }
.lead { max-width: 65ch; color: var(--fg-sec); margin: 12px 0 0; }
.facts { display: flex; flex-wrap: wrap; gap: 6px 22px; margin: 16px 0 0; padding: 0; list-style: none; color: var(--fg-dim); font-size: 13px; font-variant-numeric: tabular-nums; }
.facts b { color: var(--fg); font-weight: 600; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }
.rail { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); border-bottom: 1px solid var(--line); margin-top: 24px; }
.rail-in { max-width: 1280px; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding-block: 10px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.rail a, .seg button { font: 500 13px/1 var(--body); color: var(--fg-sec); text-decoration: none; padding: 9px 12px; border-radius: 999px; border: 1px solid transparent; background: none; cursor: pointer; }
.rail a:hover, .seg button:hover { color: var(--fg); background: var(--surface); }
.rail a[aria-current="true"] { color: var(--bg); background: var(--gold); }
.seg { margin-left: auto; display: flex; gap: 2px; border: 1px solid var(--line); border-radius: 999px; padding: 2px; }
.seg button[aria-pressed="true"] { background: var(--raised); color: var(--fg); }
:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.room { padding-top: 44px; scroll-margin-top: 110px; }
.room-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.room-head h2 { font-size: clamp(24px, 3.4vw, 32px); }
.count { margin: 0; color: var(--fg-dim); font-size: 13px; font-variant-numeric: tabular-nums; }
.states { display: flex; flex-direction: column; gap: 36px; padding-top: 24px; }
.state { display: grid; grid-template-columns: minmax(0, 230px) minmax(0, 1fr); gap: 20px; align-items: start; }
.state-head { min-width: 0; position: sticky; top: calc(env(safe-area-inset-top, 0px) + 120px); }
.state-head h3 { font-size: 21px; font-weight: 400; line-height: 1.2; }
.state-head p { margin: 6px 0 0; color: var(--fg-sec); font-size: 13.5px; }
.state-head code { display: block; margin-top: 8px; font: 11.5px/1.4 var(--mono); color: var(--fg-dim); overflow-wrap: anywhere; }
.pair { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 3.1fr); gap: 16px; align-items: start; }
.shot { position: relative; display: block; padding: 0; margin: 0; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--surface); cursor: zoom-in; min-width: 0; max-height: 620px; }
.shot img { display: block; width: 100%; height: auto; }
.shot.phone { max-width: 260px; }
.tag { position: absolute; left: 8px; top: 8px; font: 600 10.5px/1 var(--body); letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg); background: color-mix(in srgb, var(--bg) 82%, transparent); padding: 5px 7px; border-radius: 5px; }
.gaps { max-width: 70ch; margin: 20px 0 0; padding-left: 20px; color: var(--fg-sec); display: flex; flex-direction: column; gap: 8px; }
.shot.long::after { content: ""; position: absolute; inset: auto 0 0; height: 90px; background: linear-gradient(to bottom, transparent, var(--bg)); pointer-events: none; }
.more { position: absolute; left: 0; right: 0; bottom: 10px; z-index: 1; text-align: center; font: 500 12px/1 var(--body); color: var(--fg-sec); }
body[data-show="phone"] .shot.laptop, body[data-show="laptop"] .shot.phone { display: none; }
body[data-show="phone"] .pair { grid-template-columns: minmax(0, 260px); }
body[data-show="laptop"] .pair { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 760px) {
  .state { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .state-head { position: static; }
  .pair { grid-template-columns: minmax(0, 1fr); }
  .shot.phone { max-width: 100%; }
  .shot { max-height: 520px; }
  .seg { margin-left: 0; }
  .rail { position: static; }
  .room { scroll-margin-top: 12px; }
}
dialog.view { border: 0; padding: 0; margin: 0; width: 100%; height: 100%; max-width: none; max-height: none; background: color-mix(in srgb, var(--bg) 94%, #000); color: var(--fg); }
dialog.view::backdrop { background: rgba(0, 0, 0, 0.6); }
.view-in { height: 100%; display: flex; flex-direction: column; }
.view-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; border-bottom: 1px solid var(--line);
  padding: calc(10px + env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px)); }
.view-bar p { margin: 0; flex: 1 1 200px; min-width: 0; font-size: 14px; color: var(--fg-sec); }
.view-bar button { font: 500 13px/1 var(--body); color: var(--fg); background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 10px 14px; min-height: 40px; cursor: pointer; }
.view-bar button:hover { background: var(--raised); }
.view-scroll { flex: 1; min-height: 0; overflow: auto; padding: 20px max(16px, env(safe-area-inset-right, 0px)) calc(20px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); text-align: center; }
.view-scroll img { max-width: 100%; height: auto; border: 1px solid var(--line); border-radius: 10px; }
.view-scroll img.phone { max-width: min(100%, 430px); }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
</style>

<div class="wrap">
  <h1>Manage, as it stood in November 2026</h1>
  <p class="lead">Every Manage screen before the rebuild, on a phone and on a laptop, so anything you liked can be found again and pointed to. The teas, suppliers and orders shown are sample data used for testing. They are not your shop's records.</p>
  <ul class="facts">
    <li><b>${rooms.reduce((n, r) => n + r.states.length, 0)}</b> screens</li>
    <li><b>${total}</b> pictures</li>
    <li>Phone <b>390 × 844</b></li>
    <li>Laptop <b>1440 × 950</b></li>
    <li>Code recovery point <b>936bf53</b></li>
  </ul>
</div>
<nav class="rail" aria-label="Rooms"><div class="rail-in">
  ${rooms.map(r => `<a href="#${esc(r.id)}">${esc(r.name)}</a>`).join('\n  ')}
  <div class="seg" role="group" aria-label="Which size to show">
    <button type="button" id="show-both" data-show="both" aria-pressed="true">Both</button>
    <button type="button" id="show-phone" data-show="phone" aria-pressed="false">Phone</button>
    <button type="button" id="show-laptop" data-show="laptop" aria-pressed="false">Laptop</button>
  </div>
</div></nav>
<div class="wrap" style="padding-block: 0 80px">
${sections}
${(notes.notPictured || []).length ? `<section class="room" id="not-pictured">
  <header class="room-head"><h2>Not pictured</h2><p class="count">${notes.notPictured.length} gaps</p></header>
  <ul class="gaps">${notes.notPictured.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
</section>` : ''}
</div>

<dialog class="view" id="view" aria-label="Picture">
  <div class="view-in">
    <div class="view-bar">
      <p id="view-cap"></p>
      <button type="button" id="view-prev">Previous</button>
      <button type="button" id="view-next">Next</button>
      <button type="button" id="view-close">Close</button>
    </div>
    <div class="view-scroll"><img id="view-img" alt=""></div>
  </div>
</dialog>

<script>
(function () {
  var body = document.body;
  var segs = Array.prototype.slice.call(document.querySelectorAll('.seg button'));
  function show(which) {
    body.dataset.show = which;
    segs.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.show === which)); });
    try { localStorage.setItem('archive-show', which); } catch (e) {}
  }
  var saved = null;
  try { saved = localStorage.getItem('archive-show'); } catch (e) {}
  show(saved === 'phone' || saved === 'laptop' ? saved : 'both');
  segs.forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.show); }); });

  var links = Array.prototype.slice.call(document.querySelectorAll('.rail a'));
  var rooms = Array.prototype.slice.call(document.querySelectorAll('.room'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + en.target.id)); });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    rooms.forEach(function (r) { io.observe(r); });
  }

  var dlg = document.getElementById('view');
  var img = document.getElementById('view-img');
  var cap = document.getElementById('view-cap');
  var current = -1;
  function visible() {
    return Array.prototype.slice.call(document.querySelectorAll('.shot')).filter(function (s) { return s.offsetParent !== null; });
  }
  function open(list, i) {
    var s = list[i]; if (!s) return;
    current = i;
    img.className = s.dataset.size;
    img.src = s.dataset.full;
    img.alt = s.dataset.cap;
    cap.textContent = s.dataset.cap + ' (' + (s.dataset.size === 'phone' ? 'phone' : 'laptop') + ')';
    if (!dlg.open) dlg.showModal();
    dlg.querySelector('.view-scroll').scrollTop = 0;
  }
  function step(d) { var list = visible(); open(list, (current + d + list.length) % list.length); }
  document.addEventListener('click', function (e) {
    var s = e.target.closest ? e.target.closest('.shot') : null;
    if (!s) return;
    var list = visible(); open(list, list.indexOf(s));
  });
  document.getElementById('view-prev').addEventListener('click', function () { step(-1); });
  document.getElementById('view-next').addEventListener('click', function () { step(1); });
  document.getElementById('view-close').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
})();
</script>
`;
  fs.writeFileSync(outHtml, html);
  const map = {};
  for (const e of present) map[e.pub] = e.file;
  fs.writeFileSync(outMap, JSON.stringify(map));
  const bytes = present.reduce((n, e) => n + fs.statSync(path.join(archiveDir, e.file)).size, 0);
  console.log(JSON.stringify({ rooms: rooms.map(r => [r.id, r.states.length]), pictures: total, missing: index.length - present.length, mb: +(bytes / 1048576).toFixed(1) }));
})();
