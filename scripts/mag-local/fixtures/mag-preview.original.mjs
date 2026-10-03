// mag-preview — the Teajia magazine page, on this Mac only: http://localhost:8766/
//
//   node ~/builds/mag-preview.mjs
//
// The front page is Adrian's: every story, ordered by how close it is to done (a toggle flips it),
// in three groups: waiting on you, what Claude is working on, and live. Every choice he has to make
// is a button. The questions come from `Workflow/ASK - [Story].md` files that /mag writes as the work
// goes (format in mag-ask.mjs); a click writes the answer back into that file, so a new decision
// needs no new code here. He only ever opens something he can act on: a draft or a map to read,
// with that question's buttons at the bottom of the page.
//
// Also serves any magazine file as a readable page (/read/<path>), opens a story's Photos folder or
// the Drop folder in Finder, and takes a shared iCloud album link (then runs mag-photos).
// Writes only: answers into ASK files (and the record each names), album-link.txt in a story's Files
// folder. Binds to 127.0.0.1, so nothing is reachable from outside this Mac.

import { splitBlocks, plain, editable, hash, edit } from './mag-edit.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFile, execFileSync, spawn } from 'child_process';
import { listAsks, answer } from './mag-ask.mjs';
import { dropped, DROPS } from './mag-config.mjs';
import os from 'os';

const HOME = process.env.HOME;
const FILES = process.env.MAG_FILES || (() => {
  try {
    const m = fs.readFileSync(path.join(HOME, 'builds/mag-intake.config'), 'utf8').match(/MAG_FILES:=([^}]+)\}/);
    return m ? m[1].replace('$HOME', HOME) : '';
  } catch { return ''; }
})();
const PORT = Number(process.env.MAG_PREVIEW_PORT || 8766);
const MAG = process.env.MAG_VAULT ||
  path.join(HOME, 'Library/Mobile Documents/iCloud~md~obsidian/Documents/Adrian-obsidian/Brands/Teajia/Magazine');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const href = (rel) => '/read/' + rel.split('/').map(p => encodeURIComponent(p).replace(/[()]/g, c => '%' + c.charCodeAt(0).toString(16))).join('/');
const lead = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).join(' ');

// ── Reading a file ──────────────────────────────────────────────────────
function inline(s) {
  s = esc(s);
  s = s.replace(/(?<!\[)\[([^\[\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/%%rework%%([\s\S]*?)%%\/rework%%/g, '<span class="rework" title="marked for rework">$1</span>');
  s = s.replace(/%%([\s\S]*?)%%/g, '<span class="note">$1</span>');
  s = s.replace(/==([\s\S]*?)==/g, '<mark>$1</mark>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[\[term:([^|\]]+)\|([^\]]+)\]\]/g, '<span class="term" title="glossary: $1">$2</span>');
  s = s.replace(/\[\[([^\]]+)\]\]/g, '<span class="wl">$1</span>');
  return s;
}
// The inside of one edited block, for the page to swap in without reloading.
function blockHtml(raw) {
  const t = raw.trim();
  const h = t.match(/^#{1,4}\s+(.*)$/s);
  if (h) return inline(h[1]);
  if (t.startsWith('>')) return inline(t.replace(/^>\s?/gm, ''));
  return t.split('\n').map(inline).join('<br>');
}
function render(md, editFile = '') {
  // A draft is editable on its page: each paragraph carries its place and a hash of what was shown.
  const { parts } = splitBlocks(md);
  const out = [];
  for (let k = 0; k < parts.length; k += 2) {
    const block = parts[k];
    const t = block.trim();
    if (!t) continue;
    const ed = editFile && editable(block) ? ` data-b="${k / 2}" data-h="${hash(block)}" data-plain="${esc(plain(block))}"` : '';
    if (/^%%[\s\S]*%%$/.test(t)) { out.push(`<p class="note block">${inline(t.slice(2, -2))}</p>`); continue; }
    if (t === '---') { out.push('<hr>'); continue; }
    const h = t.match(/^(#{1,4})\s+(.*)$/s);
    if (h) { const n = Math.min(h[1].length, 3); out.push(`<h${n}${ed}>${inline(h[2])}</h${n}>`); continue; }
    if (t.startsWith('>')) { out.push(`<blockquote${ed}>${inline(t.replace(/^>\s?/gm, ''))}</blockquote>`); continue; }
    if (/^[-*] /m.test(t) && t.split('\n').every(l => /^\s*([-*] |\d+\. )/.test(l) || /^\s+/.test(l))) {
      out.push('<ul>' + t.split('\n').map(l => `<li>${inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`).join('') + '</ul>'); continue;
    }
    if (/^\|/.test(t)) { out.push(`<pre>${esc(t)}</pre>`); continue; }
    const lines = t.split('\n');
    const label = lines[0].match(/^\*\*([^*]+):\*\*\s*$/);
    if (label) { out.push(`<p class="speaker">${esc(label[1])}</p><p>${inline(lines.slice(1).join(' '))}</p>`); continue; }
    out.push(`<p${ed}>${lines.map(inline).join('<br>')}</p>`);
  }
  const body = out.join('\n');
  return editFile ? `<div class="editable" data-file="${esc(editFile)}">${body}</div>` : body;
}

// ── The data: the board (steps, photos, live) and the questions ─────────
function data() {
  let board = [];
  try { board = JSON.parse(execFileSync('node', [path.join(HOME, 'builds/mag-status.mjs'), '--json'], { encoding: 'utf8', env: process.env })).board; } catch {}
  const asks = listAsks(MAG);
  for (const b of board) {
    b.askFile = (asks.find(a => lead(a.story) === lead(b.story) || lead(a.story).startsWith(lead(b.story))) || {}).file || '';
    b.questions = b.askFile ? asks.find(a => a.file === b.askFile).questions : [];
    b.title = b.published
      ? b.published.replace(/\/$/, '').split('/').pop().split('-').map((w, i) => i && /^(and|of|the|a)$/.test(w) ? w : w[0].toUpperCase() + w.slice(1)).join(' ')
      : b.story;
  }
  return board;
}

// What Claude is doing at each of his steps, in plain words.
const DOING = { 2: 'Preparing the transcript', 3: 'Making the map', 5: 'Writing and editing the draft', 7: 'Folding in your changes and checking every quote',
  9: 'Placing the photos', 12: 'Filing their replies' };

// ── Pieces of the page ──────────────────────────────────────────────────
const bar = (step) => `<div class="bar" title="Step ${step} of 12">${Array.from({ length: 12 }, (_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('')}</div>`;

function questionHtml(q, file) {
  const id = `${file}#${q.index}`;
  if (!q.open) {
    return `<div class="q done"><span class="check">✓</span><span class="qt">${esc(q.title)}</span><span class="val">${esc(q.value)}</span>` +
      `<button class="link" data-reopen="${esc(id)}">Change</button><div class="reopen" hidden>${questionHtml({ ...q, open: true }, file).replace('class="q"', 'class="q inner"')}</div></div>`;
  }
  const opts = q.options.map(o => `<button class="opt${o.recommended ? ' rec' : ''}${o.chosen ? ' chosen' : ''}" data-file="${esc(file)}" data-index="${q.index}" data-value="${esc(o.label)}">${esc(o.label)}${o.recommended ? '<small>my pick</small>' : ''}</button>`).join('');
  const other = (q.other || q.text) ? `<form class="other" data-file="${esc(file)}" data-index="${q.index}"${q.text ? '' : ' hidden'}><input name="v" placeholder="${q.text ? 'Type it here' : 'Say what instead'}" value="${esc(q.text ? q.answer : '')}"><button class="save" type="submit">Save</button></form>` : '';
  const otherBtn = q.other && !q.text ? `<button class="opt ghost" data-show-other>${esc(q.otherLabel || "Something else")}…</button>` : '';
  const read = q.read ? (q.reads || [q.read]).map(r => `<a class="read" href="${href(r.file)}">${esc(r.label)} →</a>`).join(' &nbsp; ') : '';
  return `<div class="q"><div class="qt">${esc(q.title)}</div>${q.context.length ? `<p class="ctx">${inline(q.context.join(' '))}</p>` : ''}${read}` +
    `<div class="opts">${opts}${otherBtn}</div>${other}</div>`;
}

function photosHtml(b, remote) {
  const n = b.photos || 0;
  const what = b.published ? 'On the live page' : n ? `${n} photo${n === 1 ? '' : 's'}` : 'No photos yet';
  // "Open folder" opens Finder on the Mac, so it only shows on the Mac itself, not on the phone.
  return `<div class="photos"><span>${what}${b.album ? ' · shared album linked' : ''}</span>` +
    (remote ? '' : `<a class="mini" href="${esc(new URL(b.photosLink).pathname)}" data-open>Open folder</a>`) +
    `<button class="mini" data-show-album>Shared album link</button>` +
    `<form class="album" data-story="${esc(b.story)}" hidden><input name="link" placeholder="https://www.icloud.com/sharedalbum/#…"><button class="save" type="submit">Add</button></form></div>`;
}

function card(b, remote) {
  const open = b.questions.filter(q => q.open);
  const answered = b.questions.filter(q => !q.open);
  const kind = open.length ? 'you' : b.step >= 11 && b.who !== 'you' ? 'live' : open.length || b.who === 'you' ? 'you' : 'me';
  const doing = answered.length && !open.length ? 'You answered; I act on it the next time /mag runs' : DOING[b.step] || b.stepName;
  const head = `<div class="head"><div><h2>${esc(b.title)}</h2><p class="meta">Step ${b.step} of 12 · ${esc(b.stepName)}</p></div>${bar(b.step)}</div>`;
  let body = '';
  if (kind === 'you') {
    body = open.map(q => questionHtml(q, b.askFile)).join('') + answered.map(q => questionHtml(q, b.askFile)).join('');
    if (!b.questions.length) body = `<p class="ctx">Waiting on you: ${esc(b.stepName.toLowerCase())}. I'll put the question here as buttons on my next run.</p>`;
  } else body = `<p class="doing">${esc(doing)}</p>` + answered.map(q => questionHtml(q, b.askFile)).join('');
  const live = b.published ? `<a class="mini" href="${esc(b.published)}">Live page</a>` : '';
  return { kind, html: `<article class="card ${kind}" data-step="${b.step}">${head}${body}<div class="foot">${photosHtml(b, remote)}${live}</div></article>` };
}

// ── Upload: the easiest way in, from the Mac or the phone ───────────────
// The file is streamed into the first drop folder. With a story name, intake starts at once in the
// background (transcribing a recording takes minutes), so the story is at step 2 by the next /mag.
// Each intake is a job with a small JSON record, so the page can say what is running or what failed.
const JOBS = '/tmp/mag-intake-jobs';
fs.mkdirSync(JOBS, { recursive: true });
const MAX_UPLOAD = 4 * 1024 ** 3; // 4 GB: a long interview in m4a is well under 1 GB; video can be more
function startIntake(story, file) {
  const id = Date.now().toString(36);
  const rec = { id, story, file: path.basename(file), state: 'running', started: new Date().toISOString() };
  const save = () => fs.writeFileSync(path.join(JOBS, `${id}.json`), JSON.stringify(rec));
  save();
  const log = fs.openSync(path.join(JOBS, `${id}.log`), 'a');
  const p = spawn('bash', [path.join(HOME, 'builds/mag-intake.sh'), story, file], { stdio: ['ignore', log, log], env: process.env });
  p.on('exit', code => { rec.state = code === 0 ? 'done' : 'failed'; rec.code = code; rec.ended = new Date().toISOString(); save(); });
  return id;
}
function jobs() {
  try {
    return fs.readdirSync(JOBS).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(JOBS, f), 'utf8')))
      // Running ones, and anything that ended in the last day.
      .filter(j => j.state === 'running' || Date.now() - Date.parse(j.ended || j.started) < 864e5)
      .sort((a, b) => b.started.localeCompare(a.started));
  } catch { return []; }
}
const lastLine = (id) => { try { return fs.readFileSync(path.join(JOBS, `${id}.log`), 'utf8').replace(/\x1b\[[0-9;]*m/g, '').trim().split('\n').filter(Boolean).pop() || ''; } catch { return ''; } };
// A drop zone like Google Drive: drag several files onto it, or tap it to pick several. Each file
// uploads on its own with its own bar. One file with a story name starts intake straight away; several
// files land in the drop folder for /mag to sort out (a recording and its voice note, parts, and so on).
const UPLOAD = `<form class="upload card">
<label class="zone"><input type="file" name="file" multiple accept="audio/*,video/*,.m4a,.mp3,.wav,.mov,.mp4,.txt,.md,.docx,.rtf,.srt,.vtt">
<span class="big">Drop recordings or transcripts here</span><span class="small">or tap to choose · several at once is fine</span></label>
<div class="other"><input name="story" placeholder="Story name, for a single file (optional): I start on it straight away"></div>
<div class="queue"></div></form>`;

// The other ways in, all landing in a drop folder that /mag takes in the same way.
const HOW_TO_DROP = `<details class="how"><summary>Other ways to drop a file</summary>
<p><strong>On this computer:</strong> put it in the Drop folder (the button opens it).</p>
<p><strong>From your phone, iCloud:</strong> Voice Memos → Share → Save to Files → iCloud Drive → Teajia Drop.</p>
<p><strong>From your phone, pCloud:</strong> upload it to Files → 1 Areas → Brands → Teajia → Magazine → Drop. pCloud can take a while to reach the Mac.</p>
<p>Then tell me <code>/mag</code> and I take it in.</p></details>`;

function frontPage(remote) {
  const board = data();
  const groups = { you: [], me: [], live: [] };
  for (const b of board) { const c = card(b, remote); groups[c.kind].push(c.html); }
  const section = (k, title, empty) => `<section data-group="${k}"><h3>${title} <span class="count">${groups[k].length}</span></h3>${groups[k].join('') || `<p class="empty">${empty}</p>`}</section>`;
  const drops = dropped();
  const js = jobs();
  const running = new Set(js.filter(j => j.state === 'running').map(j => j.file));
  const rows = [
    ...js.map(j => `<p class="dropped"><strong>${esc(j.story)}</strong><span>${j.state === 'running' ? `being taken in · ${esc(lastLine(j.id).slice(0, 90))}` : j.state === 'done' ? 'taken in · its transcript is ready for me' : `couldn't be taken in · ${esc(lastLine(j.id).slice(0, 120))}`}</span></p>`),
    ...drops.filter(d => !running.has(d.name)).map(d => `<p class="dropped"><strong>${esc(d.name)}</strong><span>${d.downloading ? 'still downloading from iCloud' : 'ready'} · I take it in the next time you say /mag</span></p>`),
  ];
  const dropSection = rows.length ? `<section><h3>Coming in <span class="count">${rows.length}</span></h3><div class="card">${rows.join('')}</div></section>` : '';
  return `<header><div><p class="eyebrow">Teajia Magazine</p><h1>Stories</h1></div>` +
    `<div class="tools"><div class="seg" role="group"><button data-sort="done">Closest to done</button><button data-sort="start">Closest to start</button></div>` +
    (remote ? '' : `<a class="mini" href="/drop" data-open>Open the Drop folder</a>`) + `</div></header>` + UPLOAD + HOW_TO_DROP + dropSection +
    section('you', 'Waiting on you', 'Nothing. Everything is on my side.') +
    section('me', 'I\'m working on it', 'Nothing in progress.') +
    section('live', 'Live', 'Nothing live yet.');
}

// ── Look: one typeface everywhere, Claude-style ─────────────────────────
const CSS = `:root{--bg:#faf9f5;--panel:#fff;--text:#1f1e1d;--body:#3d3d3a;--dim:#73726c;--line:#e8e6dc;--hover:#f0eee6;--accent:#c96442;--accent-soft:#f6e6de;--mark:#f5e3c8;--note:#f0eee6;--ok:#4f7a4f}
@media (prefers-color-scheme:dark){:root{--bg:#262624;--panel:#30302e;--text:#f5f4ef;--body:#dcdad2;--dim:#a3a19a;--line:#3e3e3a;--hover:#393936;--accent:#d97757;--accent-soft:#4a3329;--mark:#4a3b26;--note:#353532;--ok:#8fbf8f}}
*{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--body);font:15px/1.6 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.col{max-width:760px;margin:0 auto;padding:28px 20px 96px}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline;text-underline-offset:3px}
h1,h2,h3{color:var(--text);font-weight:600;letter-spacing:-.01em;line-height:1.25;margin:0}
h1{font-size:26px}h2{font-size:17px}h3{font-size:13px;font-weight:600;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;margin:34px 0 12px}
p{margin:0 0 1em}ul{padding-left:1.2em}li{margin:4px 0}hr{border:0;border-top:1px solid var(--line);margin:32px 0}
button,input{font:inherit}
.eyebrow{font-size:12px;color:var(--dim);margin:0 0 2px}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:6px}
.tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.seg{display:inline-flex;background:var(--note);border-radius:8px;padding:2px}
.seg button{border:0;background:none;color:var(--dim);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:13px}
.seg button.on{background:var(--panel);color:var(--text);box-shadow:0 0 0 1px var(--line)}
.count{font-weight:500;color:var(--dim);margin-left:4px}
.empty{color:var(--dim);font-size:14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:0 0 12px}
.card.you{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.meta{font-size:13px;color:var(--dim);margin:2px 0 0}
.bar{display:flex;gap:3px;margin-top:6px;flex:none}.bar i{width:9px;height:6px;border-radius:2px;background:var(--line)}.bar i.on{background:var(--accent)}
.card.live .bar i.on{background:var(--ok)}
.doing{margin:12px 0 0;color:var(--body)}
.q{border-top:1px solid var(--line);margin-top:14px;padding-top:14px}.q.inner{border:0;margin:8px 0 0;padding:0}
.qt{color:var(--text);font-weight:600}
.ctx{color:var(--body);margin:4px 0 8px;font-size:14px}
.read{display:inline-block;font-size:14px;font-weight:500;margin:0 0 10px}
.opts{display:flex;flex-wrap:wrap;gap:8px}
.opt{border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:8px;padding:7px 12px;cursor:pointer;font-size:14px;text-align:left}
.opt:hover{background:var(--hover)}
.opt.rec{border-color:var(--accent)}
.opt small{display:block;font-size:11px;color:var(--accent);margin-top:1px}
.opt.chosen{background:var(--accent);border-color:var(--accent);color:#fff}.opt.chosen small{color:#fff}
.opt.ghost{color:var(--dim)}
.other,.album{display:flex;gap:8px;margin-top:8px}
.other input,.album input{flex:1;min-width:0;border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:8px;padding:7px 10px}
.save{border:0;background:var(--accent);color:#fff;border-radius:8px;padding:7px 14px;cursor:pointer;font-weight:500}
.q.done{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;font-size:14px}
.q.done .qt{font-weight:500;color:var(--dim)}.q.done .val{color:var(--text)}.check{color:var(--ok);font-weight:700}
.q.done .reopen{flex-basis:100%}
.link{border:0;background:none;color:var(--accent);cursor:pointer;padding:0;font-size:13px}
.foot{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;color:var(--dim)}
.photos{display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:1}.photos form{flex-basis:100%}
.mini{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:7px;padding:4px 10px;font-size:13px;cursor:pointer}
.mini:hover{background:var(--hover);text-decoration:none}
.how{margin:10px 0 0;font-size:14px;color:var(--body)}.how summary{color:var(--dim);font-size:13px}.how p{margin:6px 0}.dropped{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0;padding:6px 0}.dropped span{color:var(--dim);font-size:13px}
.upload{margin:14px 0 6px}.zone{display:flex;flex-direction:column;align-items:center;gap:4px;border:1.5px dashed var(--line);border-radius:10px;padding:26px 16px;cursor:pointer;text-align:center}.zone:hover,.zone.over{border-color:var(--accent);background:var(--accent-soft)}.zone input{display:none}.zone .big{color:var(--text);font-weight:600}.zone .small{color:var(--dim);font-size:13px}.queue{margin-top:6px}.up{display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:13px;padding:8px 0;border-top:1px solid var(--line)}.up em{font-style:normal;color:var(--dim)}.up .progress{grid-column:1/-1;margin-top:4px}.up.bad em{color:var(--accent)}.upload input[type=file]{margin:6px 0 2px;font-size:14px;color:var(--body);max-width:100%}.progress{height:4px;background:var(--line);border-radius:3px;margin-top:10px;overflow:hidden}.progress i{display:block;height:100%;width:0;background:var(--accent);transition:width .2s}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:8px 14px;border-radius:8px;font-size:14px}
/* A file read as a page: the same typeface, a calmer measure. */
.doc{font-size:16px;line-height:1.75}
.doc h1{font-size:28px;margin:8px 0 18px}.doc h2{font-size:20px;margin:36px 0 10px}.doc h3{font-size:16px;margin:26px 0 8px;text-transform:none;letter-spacing:0;color:var(--text)}
.doc blockquote{margin:24px 0;padding-left:16px;border-left:3px solid var(--accent);font-size:19px;line-height:1.45;color:var(--text);font-style:italic}
.top{font-size:13px;margin-bottom:22px}.top a{color:var(--dim)}
.note{font-size:12.5px;line-height:1.5;color:var(--dim);background:var(--note);padding:2px 6px;border-radius:5px}
.note.block{display:block;padding:9px 12px;border-radius:8px}
mark{background:var(--mark);color:var(--text);padding:0 3px;border-radius:3px}
.term{border-bottom:1px dotted var(--accent);color:var(--text)}
.speaker{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin:22px 0 6px}
code{font:13px ui-monospace,Menlo,monospace;background:var(--note);padding:1px 5px;border-radius:5px}
pre{white-space:pre-wrap;font-size:13px;color:var(--dim);background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px}
.decide{margin-top:40px}.decide h3{margin-top:0}
.editable [data-b]{cursor:text;border-radius:6px;transition:background .15s}.editable [data-b]:hover{background:var(--note)}.editing{outline:none;cursor:text}.editable [data-b].editing:hover{background:transparent}.edit-bar{position:absolute;z-index:50;display:flex;gap:6px;align-items:center;flex-wrap:wrap;background:var(--bg);padding:4px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.35)}.edit-bar .opt{padding:5px 10px;font-size:13px}.edit-hint{font-size:12px;color:var(--dim)}.just-saved{animation:saved 2s}.rework{background:rgba(255,196,0,.28);border-bottom:2px wavy rgba(230,160,0,.9)}@keyframes saved{from{background:var(--note)}to{background:transparent}}@media (max-width:560px){.head{flex-direction:column;gap:6px}.bar i{width:7px}}`;

// Buttons post the choice; the page reloads with the answer in place.
const JS = `
const post=(u,b)=>fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json());
const toast=t=>{const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),2200)};
document.addEventListener('click',async e=>{
  const o=e.target.closest('.opt[data-value]');
  if(o){o.disabled=true;const r=await post('/answer',{file:o.dataset.file,index:+o.dataset.index,value:o.dataset.value});if(r.ok)location.reload();else{o.disabled=false;toast(r.error)}return}
  if(e.target.closest('[data-show-other]')){const f=e.target.closest('.q').querySelector('form.other');f.hidden=false;f.querySelector('input').focus();return}
  if(e.target.closest('[data-show-album]')){const f=e.target.closest('.photos').querySelector('form.album');f.hidden=!f.hidden;if(!f.hidden)f.querySelector('input').focus();return}
  const ro=e.target.closest('[data-reopen]');if(ro){const r=ro.parentElement.querySelector('.reopen');r.hidden=!r.hidden;return}
  const op=e.target.closest('a[data-open]');if(op){e.preventDefault();fetch(op.getAttribute('href')).then(()=>toast('Opened in Finder'));return}
  const s=e.target.closest('[data-sort]');if(s){try{localStorage.setItem('magSort',s.dataset.sort)}catch(_){};sortCards(s.dataset.sort)}
});
document.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target;
  if(f.classList.contains('upload'))return;
  const v=f.querySelector('input').value.trim();if(!v)return;
  if(f.classList.contains('other')){const r=await post('/answer',{file:f.dataset.file,index:+f.dataset.index,value:v});if(r.ok)location.reload();else toast(r.error)}
  if(f.classList.contains('album')){const r=await post('/album',{story:f.dataset.story,link:v});toast(r.ok?'Album linked. Downloading the photos now…':r.error);if(r.ok)setTimeout(()=>location.reload(),4000)}
});
// Uploads: one at a time, each with its own row and bar; the page refreshes when the last one lands.
function uploadAll(files){
  const form=document.querySelector('form.upload');if(!form||!files.length)return;
  const story=files.length===1?form.story.value.trim():'';
  const queue=form.querySelector('.queue');
  const rows=[...files].map(file=>{const r=document.createElement('div');r.className='up';r.innerHTML='<span></span><em>waiting</em><div class="progress"><i></i></div>';r.querySelector('span').textContent=file.name;queue.appendChild(r);return {file,r}});
  let failed=0;
  const next=i=>{
    if(i>=rows.length){toast(failed?failed+' did not upload':(story?'Uploaded. Taking it in now.':'Uploaded. They are in the drop folder.'));if(!failed)setTimeout(()=>location.reload(),1200);return}
    const {file,r}=rows[i];const fill=r.querySelector('i');const st=r.querySelector('em');st.textContent='uploading';
    const x=new XMLHttpRequest();
    x.open('POST','/upload?name='+encodeURIComponent(file.name)+'&story='+encodeURIComponent(story));
    x.upload.onprogress=ev=>{if(ev.lengthComputable)fill.style.width=(100*ev.loaded/ev.total)+'%'};
    x.onload=()=>{let res={};try{res=JSON.parse(x.responseText)}catch(_){}
      if(res.ok){st.textContent='done';fill.style.width='100%'}else{failed++;st.textContent=res.error||'failed';r.classList.add('bad')}next(i+1)};
    x.onerror=()=>{failed++;st.textContent='failed: is the Mac awake?';r.classList.add('bad');next(i+1)};
    x.send(file);
  };
  next(0);
}
document.addEventListener('change',e=>{if(e.target.matches('form.upload input[type=file]')){uploadAll(e.target.files);e.target.value=''}});
const zone=document.querySelector('.zone');
if(zone){
  ['dragenter','dragover'].forEach(t=>document.addEventListener(t,e=>{e.preventDefault();zone.classList.add('over')}));
  ['dragleave','drop'].forEach(t=>document.addEventListener(t,e=>{e.preventDefault();if(t==='drop'||!e.relatedTarget)zone.classList.remove('over')}));
  document.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('over');uploadAll(e.dataTransfer.files)});
}
function sortCards(k){
  document.querySelectorAll('[data-sort]').forEach(b=>b.classList.toggle('on',b.dataset.sort===k));
  document.querySelectorAll('section[data-group]').forEach(sec=>{[...sec.querySelectorAll('.card')].sort((a,b)=>(k==='done'?-1:1)*(a.dataset.step-b.dataset.step)).forEach(c=>sec.appendChild(c))});
}
let k='done';try{k=localStorage.getItem('magSort')||'done'}catch(_){}
if(document.querySelector('[data-sort]'))sortCards(k);

// Click any paragraph of a draft to edit it in place. You type straight into the paragraph: same
// width, same lines, nothing moves. The buttons float just under it. Words wrapped in /slashes/ are
// marked for Claude to rework. Removing every word removes the paragraph.
document.addEventListener('click',e=>{
  const el=e.target.closest('.editable [data-b]');
  if(!el||e.target.closest('a')||el.isContentEditable)return;
  if(document.querySelector('.edit-bar'))return;
  const file=el.closest('.editable').dataset.file;
  const html=el.innerHTML,x=e.clientX,y=e.clientY;
  const h0=el.getBoundingClientRect().height;el.style.minHeight=h0+'px';
  el.textContent=el.dataset.plain;el.contentEditable='plaintext-only';el.classList.add('editing');el.focus({preventScroll:true});
  const r0=document.caretRangeFromPoint&&document.caretRangeFromPoint(x,y);
  if(r0&&el.contains(r0.startContainer)){const sel=getSelection();sel.removeAllRanges();sel.addRange(r0)}
  const bar=document.createElement('div');bar.className='edit-bar';
  const mk=(t,c)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.className=c;bar.appendChild(b);return b};
  const save=mk('Save','opt chosen'),cancel=mk('Cancel','opt'),del=mk('Remove','opt');
  const hint=document.createElement('span');hint.className='edit-hint';hint.textContent='/words/ = rework · ⌘↩ save · Esc cancel';bar.appendChild(hint);
  document.body.appendChild(bar);
  const place=()=>{const r=el.getBoundingClientRect(),g=document.createRange();g.selectNodeContents(el);const t=g.getBoundingClientRect();bar.style.top=((t.height?t.bottom:r.bottom)+scrollY+2)+'px';bar.style.left=(r.left+scrollX-4)+'px'};
  place();const ro=new ResizeObserver(place);ro.observe(el);
  bar.addEventListener('mousedown',ev=>ev.preventDefault());
  const end=()=>{ro.disconnect();bar.remove();el.style.minHeight='';el.contentEditable='false';el.removeAttribute('contenteditable');el.classList.remove('editing')};
  const cancelIt=()=>{el.innerHTML=html;end()};
  const send=async text=>{save.disabled=del.disabled=true;
    const r=await post('/edit',{file,b:+el.dataset.b,h:el.dataset.h,text});
    if(!r.ok){save.disabled=del.disabled=false;toast(r.error);return}
    end();
    if(r.removed){const n=+el.dataset.b;document.querySelectorAll('.editable [data-b]').forEach(q=>{if(+q.dataset.b>n)q.dataset.b=+q.dataset.b-1});el.remove();toast('Removed');return}
    if(r.html!==undefined){el.innerHTML=r.html;el.dataset.h=r.h;el.dataset.plain=r.plain}else el.innerHTML=html;
    el.classList.remove('just-saved');void el.offsetWidth;el.classList.add('just-saved');toast(r.changed?'Saved':'No change')};
  save.onclick=()=>send(el.innerText);cancel.onclick=cancelIt;
  del.onclick=()=>{if(confirm('Remove this paragraph from the draft?'))send('')};
  el.addEventListener('keydown',function k(ev){if(!el.isContentEditable){el.removeEventListener('keydown',k);return}
    if(ev.key==='Escape'){ev.preventDefault();cancelIt()}
    if(ev.key==='Enter'&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();send(el.innerText)}});
});
`;

const page = (title, body, doc = false) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><div class="col${doc ? ' doc' : ''}">${body}</div><script>${JS}</script></body></html>`;

function readBody(req) {
  return new Promise((ok, no) => { let d = ''; req.on('data', c => { d += c; if (d.length > 20000) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(d)); } catch (e) { no(e); } }); });
}
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

const app = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  // Same-origin only for anything that writes: a page on another site can't post here.
  // Reached over Tailscale (the phone) rather than on this Mac: hide what only works at the Mac.
  const remote = !/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(req.socket.localAddress || '');
  if (req.method === 'POST') {
    // Only this page may write: the browser's Origin must be the address the page was opened at.
    const origin = req.headers.origin || '';
    if (origin && origin !== `http://${req.headers.host}`) return json(res, 403, { ok: false, error: 'not from this page' });
    if (url.pathname === '/upload') {
      // The body is the file itself; its name and the story come in the address.
      const name = path.basename(String(url.searchParams.get('name') || '')).replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 120);
      const story = String(url.searchParams.get('story') || '').trim().replace(/[\/\\]/g, '-').slice(0, 80);
      if (!name || name.startsWith('.')) return json(res, 400, { ok: false, error: 'no file name' });
      if (Number(req.headers['content-length'] || 0) > MAX_UPLOAD) return json(res, 413, { ok: false, error: 'That file is over 4 GB' });
      const drop = DROPS[0];
      fs.mkdirSync(drop, { recursive: true });
      let dest = path.join(drop, name);
      for (let n = 2; fs.existsSync(dest); n++) dest = path.join(drop, name.replace(/(\.[^.]*)?$/, ` ${n}$1`));
      const part = dest + '.part';
      const out = fs.createWriteStream(part);
      let size = 0;
      req.on('data', c => { size += c.length; if (size > MAX_UPLOAD) req.destroy(); });
      req.pipe(out);
      out.on('finish', () => {
        if (size === 0) { fs.rmSync(part, { force: true }); return json(res, 400, { ok: false, error: 'the file was empty' }); }
        fs.renameSync(part, dest);
        const job = story ? startIntake(story, dest) : '';
        json(res, 200, { ok: true, file: path.basename(dest), job });
      });
      req.on('error', () => fs.rmSync(part, { force: true }));
      req.on('aborted', () => fs.rmSync(part, { force: true }));
      return;
    }
    try {
      const b = await readBody(req);
      if (url.pathname === '/edit') { const r = edit(MAG, String(b.file || ''), Number(b.b), String(b.h || ''), String(b.text ?? '')); return json(res, 200, r.raw ? { ok: true, changed: r.changed, html: blockHtml(r.raw), h: hash(r.raw), plain: plain(r.raw) } : { ok: true, changed: r.changed, removed: !!r.removed }); }
      if (url.pathname === '/answer') { answer(MAG, String(b.file || ''), Number(b.index), String(b.value || '')); return json(res, 200, { ok: true }); }
      if (url.pathname === '/album') {
        const story = String(b.story || ''); const link = String(b.link || '').trim();
        if (!FILES || !story || story.includes('/') || story.startsWith('.')) return json(res, 400, { ok: false, error: 'unknown story' });
        if (!/^https:\/\/(www\.)?icloud\.com\/sharedalbum\/#[A-Za-z0-9]+$/.test(link)) return json(res, 400, { ok: false, error: 'That is not a shared album link (it starts https://www.icloud.com/sharedalbum/#)' });
        fs.mkdirSync(path.join(FILES, story, 'Photos'), { recursive: true });
        fs.writeFileSync(path.join(FILES, story, 'album-link.txt'), link + '\n');
        const p = spawn('node', [path.join(HOME, 'builds/mag-photos.mjs'), story], { detached: true, stdio: ['ignore', fs.openSync('/tmp/mag-photos.log', 'a'), fs.openSync('/tmp/mag-photos.log', 'a')] });
        p.unref();
        return json(res, 200, { ok: true });
      }
    } catch (e) { return json(res, 400, { ok: false, error: e.message }); }
    return json(res, 404, { ok: false, error: 'not found' });
  }

  let html;
  if (url.pathname === '/') {
    html = page('Teajia Magazine', frontPage(remote));
  } else if (url.pathname === '/read' || url.pathname.startsWith('/read/')) {
    const rel = url.pathname === '/read' ? (url.searchParams.get('f') || '') : decodeURIComponent(url.pathname.slice('/read/'.length));
    const abs = path.resolve(MAG, rel);
    if (!abs.startsWith(path.resolve(MAG) + path.sep) || !abs.endsWith('.md') || !fs.existsSync(abs)) { res.writeHead(404); return res.end('Not found'); }
    // At the bottom of a map or draft: the questions that ask about it, as buttons, so reading ends in deciding.
    const here = listAsks(MAG).flatMap(a => a.questions.filter(q => q.read && (q.reads || [q.read]).some(r => path.resolve(MAG, r.file) === abs)).map(q => questionHtml({ ...q, read: null, reads: null }, a.file)));
    const decide = here.length ? `<section class="decide"><h3>Decide</h3><div class="card you">${here.join('')}</div></section>` : '';
    html = page(path.basename(rel, '.md'), `<div class="top"><a href="/">← Stories</a></div>` + render(fs.readFileSync(abs, 'utf8'), /^Workflow\/3-Develop\/DEV - .*\.md$/.test(path.relative(MAG, abs)) ? path.relative(MAG, abs) : '') + decide, true);
  } else if (url.pathname.startsWith('/photos/') || url.pathname === '/drop') {
    if (remote) { res.writeHead(404); return res.end('Not on the phone: this opens Finder on the Mac.'); }
    const name = url.pathname === '/drop' ? 'Drop' : decodeURIComponent(url.pathname.slice('/photos/'.length));
    if (!FILES || !name || name.includes('/') || name.startsWith('.')) { res.writeHead(404); return res.end('Not found'); }
    const dir = url.pathname === '/drop' ? path.join(FILES, 'Drop') : path.join(FILES, name, 'Photos');
    fs.mkdirSync(dir, { recursive: true });
    if (!process.env.MAG_NO_FINDER) execFile('open', [dir], () => {});
    html = page(name, `<div class="top"><a href="/">← Stories</a></div><p>Opened in Finder: ${esc(dir.replace(HOME + '/', ''))}</p>`);
  } else { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
});

// This Mac, and its Tailscale address (100.64.0.0/10) so the phone can open the page on the tailnet.
// Nothing else: no other network can reach it. MAG_TAILNET=0 turns the tailnet address off.
const handler = app.listeners('request')[0];
app.listen(PORT, '127.0.0.1', () => console.log(`Magazine page: http://localhost:${PORT}/`));
// Tailscale may connect after this starts (at login it usually does), so look again every minute
// and serve any tailnet address that has appeared.
const served = new Set();
function bindTailnet() {
  if (process.env.MAG_TAILNET === '0') return;
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter(a => a && a.family === 'IPv4' && /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(a.address)).map(a => a.address);
  for (const ip of ips) {
    if (served.has(ip)) continue;
    served.add(ip);
    http.createServer(handler).listen(PORT, ip, () => console.log(`On your phone (Tailscale): http://${ip}:${PORT}/`))
      .on('error', e => { served.delete(ip); console.log(`Tailscale address ${ip} not served yet: ${e.message}`); });
  }
}
bindTailnet();
setInterval(bindTailnet, 60000).unref?.();
