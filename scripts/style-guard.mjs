#!/usr/bin/env node
/**
 * design-master style guard — copy into a project as scripts/style-guard.mjs.
 *
 * Counts three kinds of hard-coded value outside the master style file:
 *   colours  hex, rgb(), hsl(), oklch() literals
 *   sizes    pixel height / min-height / padding in CSS, inline styles, or
 *            Tailwind arbitrary values (h-[46px], py-[13px], min-h-[44px])
 *   fonts    pixel/rem font sizes: font-size: 13px, fontSize: 13, text-[13px]
 *
 * Per-file counts are frozen in a baseline JSON. The paired test fails when any
 * file goes above its frozen count, so the numbers can only fall.
 *
 * Usage (from the project root, or pass --root):
 *   node scripts/style-guard.mjs              totals + worst 15 files
 *   node scripts/style-guard.mjs --list       every hit as file:line  kind  value
 *   node scripts/style-guard.mjs --write      freeze today's counts (first run),
 *                                             or LOWER ceilings after a migration.
 *                                             Refuses to raise a file unless --allow-raise.
 * Options: --root <dir>  --master <path>  --baseline <path>  --json
 *
 * Tune the CONFIG block per project; keep the three regex groups as they are so
 * numbers stay comparable across Adrian's projects.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

// ── CONFIG (edit per project) ────────────────────────────────────────────────
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(opt('--root', path.join(HERE, '..')));
export const MASTER = opt('--master', 'src/styles/tokens.css');
export const BASELINE_PATH = path.resolve(ROOT, opt('--baseline', 'src/styles/style-guard.baseline.json'));
const SCAN_DIRS = ['src'];
const SCAN_FILES = ['index.html'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.scss', '.html', '.svelte', '.vue']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', 'coverage', 'test-results',
  'playwright-report', 'tests', 'test', '__tests__', 'vendor', 'fonts', 'images', 'img', 'assets']);
// Generated / converter output and vendored sheets: listed in the PR, never rewritten. Glob-ish prefixes.
const EXEMPT_PREFIXES = ['**/generated/', '**/*.min.', '**/*.test.', '**/*.spec.', '**/*.d.ts'];
// ─────────────────────────────────────────────────────────────────────────────

const RES = {
  colors: [/#[0-9a-fA-F]{3,8}\b(?![-\w])/g, /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(\s*[\d.][^)\n]*\)?/g],
  sizes: [
    /\b(?:min-)?height\s*:\s*[^;{}\n'"`,]*?\d+(?:\.\d+)?px/g,
    /\bpadding(?:-[a-z]+)?\s*:\s*[^;{}\n'"`,]*?[1-9]\d*(?:\.\d+)?px/g,
    /\b(?:minHeight|height|padding(?:Top|Bottom|Left|Right|Inline|Block|Horizontal|Vertical)?)\s*:\s*(?:['"`][^'"`\n]*\d+px|[1-9]\d*\b)/g,
    /(?<![\w-])(?:h|min-h|p|px|py|pt|pb|pl|pr|ps|pe)-\[\d+(?:\.\d+)?(?:px|rem)\]/g,
  ],
  fonts: [
    /\bfont-size\s*:\s*[^;{}\n'"`]*?\d+(?:\.\d+)?(?:px|rem|pt)/g,
    /\bfontSize\s*:\s*(?:['"`]\d+(?:\.\d+)?(?:px|rem|pt)?['"`]|\d+\b)/g,
    /(?<![\w-])text-\[\d+(?:\.\d+)?(?:px|rem|pt)\]/g,
  ],
};

const isExempt = (rel) => EXEMPT_PREFIXES.some((p) => {
  const needle = p.replace(/^\*\*\//, '').replace(/\*/g, '');
  return p.startsWith('**/') ? rel.includes(needle) : rel.startsWith(needle);
});

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

export function scanFiles() {
  const files = [];
  for (const d of SCAN_DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d), files);
  for (const f of SCAN_FILES) if (fs.existsSync(path.join(ROOT, f))) files.push(path.join(ROOT, f));
  return [...new Set(files)]
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
    .filter((f) => f !== MASTER && !isExempt(f))
    .sort();
}

const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

export function hits(text) {
  const clean = stripComments(text);
  const out = [];
  for (const [kind, list] of Object.entries(RES)) {
    for (const re of list) for (const m of clean.matchAll(re)) {
      const line = clean.slice(0, m.index).split('\n').length;
      out.push({ kind, line, value: m[0].trim() });
    }
  }
  return out;
}

export function countText(text) {
  const c = { colors: 0, sizes: 0, fonts: 0 };
  for (const h of hits(text)) c[h.kind] += 1;
  return c;
}

export function countAll() {
  const result = {};
  for (const f of scanFiles()) {
    const c = countText(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    if (c.colors || c.sizes || c.fonts) result[f] = c;
  }
  return result;
}

export function totals(counts) {
  const t = { colors: 0, sizes: 0, fonts: 0 };
  for (const c of Object.values(counts)) for (const k of Object.keys(t)) t[k] += c[k] || 0;
  return t;
}

// ── realign: match every stray value to the master's tokens ──────────────────
const hexNorm = (h) => {
  let x = h.replace('#', '').toLowerCase();
  if (x.length === 3 || x.length === 4) x = [...x.slice(0, 3)].map((c) => c + c).join('');
  return x.slice(0, 6);
};
const toPx = (num, unit) => (unit === 'rem' ? Number(num) * 16 : unit === 'pt' ? Number(num) * 4 / 3 : Number(num));

export function masterTokens() {
  const css = stripComments(fs.readFileSync(path.join(ROOT, MASTER), 'utf8'));
  const colors = new Map(); const px = { sizes: [], fonts: [] };
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, raw] = m; const v = raw.trim();
    const hex = v.match(/^#([0-9a-fA-F]{3,8})$/);
    if (hex) { const k = hexNorm(v); if (!colors.has(k)) colors.set(k, name); continue; }
    const len = v.match(/^(\d+(?:\.\d+)?)(px|rem)$/);
    if (!len) continue;
    const value = toPx(len[1], len[2]);
    if (/text|font|type|fs-|-t-|^--t\d/.test(name)) px.fonts.push({ name, value });
    else if (/space|gap|pad|control|ctl|h-|height|^--s\d/.test(name)) px.sizes.push({ name, value });
  }
  return { colors, px };
}

function suggest(h, tokens) {
  if (h.kind === 'colors') {
    const hex = h.value.match(/#[0-9a-fA-F]{3,8}/);
    const rgbIn = h.value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
    if (!hex && !rgbIn) return { verdict: 'review', note: 'hsl/oklch or token-based colour: read by hand' };
    const k = hex ? hexNorm(hex[0]) : rgbIn.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    const alpha = /rgba|\/\s*[\d.]+%?\s*\)/.test(h.value) ? ' (keep the alpha: use the -rgb token or color-mix)' : '';
    if (tokens.colors.has(k)) return { verdict: 'exact', note: `var(${tokens.colors.get(k)})${alpha}` };
    const rgb = (s) => [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
    const [r, g, b] = rgb(k); let best = null;
    for (const [hk, name] of tokens.colors) {
      const [r2, g2, b2] = rgb(hk); const d = Math.hypot(r - r2, g - g2, b - b2);
      if (!best || d < best.d) best = { d, name };
    }
    return best && best.d <= 12 ? { verdict: 'near', note: `var(${best.name}) (off by ${Math.round(best.d)})` }
      : { verdict: 'none', note: best ? `closest ${best.name}, off by ${Math.round(best.d)}` : 'no colour tokens' };
  }
  const nums = [...h.value.matchAll(/(\d+(?:\.\d+)?)(px|rem|pt)?/g)].map((m) => toPx(m[1], m[2] || 'px')).filter((n) => n > 0);
  if (!nums.length) return { verdict: 'review', note: '' };
  if (h.kind === 'sizes' && nums.every((n) => n <= 4)) return { verdict: 'none', note: 'hairline or decoration: usually leave' };
  const isHeight = /height|Height|(?:^|-)h-\[/.test(h.value);
  const ctl = (t) => /control|ctl|h-|height|touch/.test(t.name);
  const narrowed = h.kind === 'sizes' ? tokens.px.sizes.filter((t) => (isHeight ? ctl(t) : !ctl(t))) : [];
  const pool = narrowed.length ? narrowed : tokens.px[h.kind];
  const per = nums.map((n) => {
    let best = null;
    for (const t of pool) { const d = Math.abs(t.value - n); if (!best || d < best.d) best = { d, ...t }; }
    return { n, best };
  });
  if (per.every((p) => p.best && p.best.d === 0)) return { verdict: 'exact', note: per.map((p) => `${p.n}->${p.best.name}`).join(' ') };
  if (per.every((p) => p.best && p.best.d <= 2)) return { verdict: 'near', note: per.map((p) => `${p.n}->${p.best.name}(${p.best.value})`).join(' ') };
  return { verdict: 'none', note: per.map((p) => (p.best ? `${p.n} (closest ${p.best.name} ${p.best.value})` : `${p.n}`)).join(' ') };
}

function realignReport() {
  const tokens = masterTokens();
  const rows = []; const tally = {};
  for (const f of scanFiles()) {
    for (const h of hits(fs.readFileSync(path.join(ROOT, f), 'utf8'))) {
      const s = suggest(h, tokens);
      rows.push({ file: f, ...h, ...s });
      const key = `${h.kind}:${s.verdict}`; tally[key] = (tally[key] || 0) + 1;
    }
  }
  console.log(`# realign report: ${rows.length} stray values outside ${MASTER}`);
  console.log(`# tokens read: ${tokens.colors.size} colours, ${tokens.px.sizes.length} size steps, ${tokens.px.fonts.length} font steps`);
  console.log('# exact = swap for the token as is · near = within 2px / 12 RGB, swap after a look · none = new role, art, or exempt · review = needs a human read');
  for (const k of Object.keys(tally).sort()) console.log(`#   ${k.padEnd(16)} ${tally[k]}`);
  const byFile = {};
  for (const r of rows) (byFile[r.file] ||= []).push(r);
  const order = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);
  for (const [f, list] of order) {
    console.log(`\n## ${f} (${list.length})`);
    for (const r of list.sort((a, b) => a.line - b.line)) console.log(`${r.line}\t${r.kind}\t${r.verdict}\t${r.value}\t${r.note}`);
  }
}

export function readBaseline() {
  return fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) : null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const counts = countAll();
  const t = totals(counts);
  if (args.includes('--list')) {
    for (const f of scanFiles()) {
      for (const h of hits(fs.readFileSync(path.join(ROOT, f), 'utf8')).sort((a, b) => a.line - b.line)) console.log(`${f}:${h.line}\t${h.kind}\t${h.value}`);
    }
  } else if (args.includes('--realign')) {
    realignReport();
  } else if (args.includes('--write')) {
    const old = readBaseline();
    if (old && !args.includes('--allow-raise')) {
      const raised = [];
      for (const [f, c] of Object.entries(counts)) {
        const was = old.files[f] || { colors: 0, sizes: 0, fonts: 0 };
        for (const k of Object.keys(c)) if (c[k] > (was[k] || 0)) raised.push(`${f} ${k} ${was[k] || 0} -> ${c[k]}`);
      }
      if (raised.length) {
        console.error(`Refusing to raise ceilings (fix these or pass --allow-raise):\n${raised.join('\n')}`);
        process.exit(1);
      }
    }
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({ master: MASTER, totals: t, files: counts }, null, 2) + '\n');
    console.log(`baseline: ${t.colors} colours, ${t.sizes} sizes, ${t.fonts} font sizes in ${Object.keys(counts).length} files`);
  } else if (args.includes('--json')) {
    console.log(JSON.stringify({ master: MASTER, totals: t, files: counts }, null, 2));
  } else {
    console.log(`${t.colors} colours, ${t.sizes} control sizes, ${t.fonts} font sizes outside ${MASTER}`);
    const worst = Object.entries(counts)
      .sort((a, b) => (b[1].colors + b[1].sizes + b[1].fonts) - (a[1].colors + a[1].sizes + a[1].fonts)).slice(0, 15);
    console.log('colours  sizes  fonts  file');
    for (const [f, c] of worst) console.log(`${String(c.colors).padStart(7)} ${String(c.sizes).padStart(6)} ${String(c.fonts).padStart(6)}  ${f}`);
  }
}
