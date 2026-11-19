import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// GUARD: the master style file.
//
// src/styles/tokens.css owns every colour, font size, spacing step, corner,
// control height, shadow, transition and button style. This test does two
// things:
//
//   1. Ratchets. Each ceiling is today's count (2026-11-19) of a style value
//      written somewhere other than tokens.css. A count may fall and must not
//      rise. When it falls, lower the ceiling in the same commit.
//   2. Consistency. Every token a stylesheet or component reads is defined in
//      tokens.css, and the seven button variants are defined there and nowhere
//      else.
//
// Application source only: tests, harnesses and test kits are skipped, and so
// are lines that are only a comment.

const SRC = fileURLToPath(new URL('../', import.meta.url));
const ROOT = resolve(SRC, '..');
const TOKENS = 'src/styles/tokens.css';

interface F { rel: string; text: string }
const files: F[] = [];
(function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) { walk(abs); continue; }
    if (!/\.(tsx?|css)$/.test(name) || name.endsWith('.d.ts')) continue;
    const rel = relative(ROOT, abs).split('\\').join('/');
    if (/\.(test|spec|behavior|harness|testkit)\.(ts|tsx)$/.test(rel) || /(^|\/)(__tests__|__mocks__|test-utils)\//.test(rel)) continue;
    files.push({ rel, text: readFileSync(abs, 'utf8') });
  }
})(SRC);

const isComment = (l: string) => /^\s*(\/\/|\*|\/\*)/.test(l);
const code = files.filter(f => /\.tsx?$/.test(f.rel));
const css = files.filter(f => f.rel.endsWith('.css') && f.rel !== TOKENS);
const tokens = readFileSync(join(ROOT, TOKENS), 'utf8');

function count(source: F[], pattern: RegExp): number {
  let n = 0;
  for (const f of source) for (const line of f.text.split('\n')) {
    if (isComment(line)) continue;
    n += line.match(pattern)?.length ?? 0;
  }
  return n;
}

function atMost(n: number, ceiling: number, name: string, instead: string) {
  expect(n, `${name}: ${n} now, ceiling ${ceiling}. ${instead}`
    + (n < ceiling ? ` (The count has fallen: lower the ceiling to ${n}.)` : '')).toBeLessThanOrEqual(ceiling);
}

const COLOUR = 'Add the colour to src/styles/tokens.css (a palette entry in section 2 or 3, or a role in section 5) and read it with a tea-* class or var(--...).';
const SIZE = 'Use a role (text-body, text-card-title, type-* via TYPOGRAPHY_CLASSES) or a step (text-ui-N, var(--fs-ui-N)); add a new step to tokens.css if none fits.';
const FONT_SIZE_INLINE = 768;
const BUTTON_PAD = 103;

describe('hard-coded colours outside tokens.css', () => {
  it('hex colours in components and modules do not rise', () => {
    // Includes designTokens.ts (tea type colours, gradients) and the PDF
    // renderers, which cannot read CSS variables.
    atMost(count(code, /#[0-9a-fA-F]{3,8}\b(?![\w-])/g), 617, 'hex colours in src/**/*.ts(x)', COLOUR);
  });
  it('hex colours in other stylesheets do not rise', () => {
    // Most are the tasting wheel's own segment colours (approved-wheel.css).
    atMost(count(css, /#[0-9a-fA-F]{3,8}\b/g), 246, 'hex colours in src/**/*.css outside tokens.css', COLOUR);
  });
  it('rgb()/rgba() literals in other stylesheets do not rise', () => {
    atMost(count(css, /\brgba?\(\s*\d/g), 196, 'rgb literals in src/**/*.css outside tokens.css', COLOUR);
  });
  it('rgb()/rgba() literals in components do not rise', () => {
    atMost(count(code, /\brgba?\(\s*\d/g), 494, 'rgb literals in src/**/*.ts(x)', COLOUR);
  });
  it('stock Tailwind colours (text-white, bg-black, gray-500 ...) do not rise', () => {
    // Mostly photo letterboxing (bg-black behind media) and print: styles.
    atMost(count(code, /(?<![\w-])(text|bg|border|ring|from|to|via|fill|stroke)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})(?![\w-])/g),
      145, 'stock Tailwind colour classes', COLOUR);
  });
});

describe('raw font sizes outside tokens.css', () => {
  it('arbitrary text-[Npx] / text-[clamp(...)] classes do not rise', () => {
    atMost(count(code, /\btext-\[(\d|clamp)/g), 80, 'arbitrary text-[...] sizes', SIZE);
  });
  it('font-size in pixels or rem in other stylesheets does not rise', () => {
    atMost(count(css, /font-size:\s*[\d.]+(px|rem|em)\b/g), 71, 'raw font-size in src/**/*.css outside tokens.css', SIZE);
  });
  it('numeric fontSize in inline style objects does not rise', () => {
    // The magazine stories set most of these; S in src/pages/read/immersive.tsx
    // holds the reader's size roles.
    atMost(count(code, /\bfontSize:\s*(\d|'(?!var\()[^']*\d)/g), FONT_SIZE_INLINE, 'inline fontSize numbers', SIZE);
  });
});

describe('button padding outside tokens.css', () => {
  it('a btn-* class never carries its own padding, height, size or corner utilities', () => {
    const bad: string[] = [];
    const conflict = /^(p[xy]?-[\d.[]|h-[\d[]|h-control|text-ui-|text-\[|rounded|tracking-|uppercase$)/;
    for (const f of code) {
      for (const m of f.text.matchAll(/(["'`])([^"'`]*\bbtn-(?:primary|secondary|quiet|icon|tab|chip|field)\b[^"'`]*)\1/g)) {
        if (m[2].includes('${')) continue;
        const hit = m[2].split(/\s+/).filter(t => conflict.test(t));
        if (hit.length) bad.push(`${f.rel}: ${hit.join(' ')}`);
      }
    }
    expect(bad, 'Size and shape come from the btn-* class in tokens.css; add btn-sm or btn-lg instead.').toEqual([]);
  });
  it('raw <button> elements with their own padding utilities do not rise', () => {
    atMost(count(code.filter(f => f.rel.endsWith('.tsx')), /<button\b[^>]*\bp[xy]?-\d/g), BUTTON_PAD,
      'raw <button> with p-/px-/py- utilities',
      'Give the button a variant class (btn-primary, btn-secondary, btn-quiet, btn-icon, btn-tab, btn-chip, btn-field) or the shared <Button>.');
  });
});

describe('tokens.css is self-consistent', () => {
  const defined = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const FAMILIES = /^--(fs|lh|ls|fw|space|radius|shadow|dur|ease|control|btn|chip|tab)-|^--(text-(page|section|card|body|small|label|nav|link|price|error|on-|article)|page-(bg|text)|panel-bg|raised-bg|sunken-bg|field-bg|overlay-bg|admin-page-bg|admin-panel-bg|border-(w|hairline)|tap-min|font-(display|serif|body|sans|mono))\b/;

  it('every token family variable read anywhere is defined in tokens.css', () => {
    const missing = new Set<string>();
    for (const f of [...files, { rel: 'tailwind.config.ts', text: readFileSync(join(ROOT, 'tailwind.config.ts'), 'utf8') }]) {
      for (const m of f.text.matchAll(/var\((--[\w-]+)/g)) {
        if (FAMILIES.test(m[1]) && !defined.has(m[1])) missing.add(`${m[1]} (${f.rel})`);
      }
    }
    expect([...missing], 'Define the variable in src/styles/tokens.css or read an existing one.').toEqual([]);
  });

  it('the seven button variants are defined in tokens.css and nowhere else', () => {
    for (const v of ['primary', 'secondary', 'quiet', 'icon', 'tab', 'chip', 'field']) {
      expect(tokens, `.btn-${v} missing from tokens.css`).toMatch(new RegExp(`\\.btn-${v}\\b[^{]*\\{`));
    }
    const elsewhere = css.filter(f => /(^|[\s,}])\.btn-(primary|secondary|quiet|icon|tab|chip|field)\b[^{;]*\{/m.test(f.text)).map(f => f.rel);
    expect(elsewhere, 'Button variants are written only in tokens.css, section 6.').toEqual([]);
  });

  it('no other stylesheet declares a palette or size token', () => {
    const owned = /^\s*(--tea-(bg|surface|elevated|sunken|text|text-sec|text-dim|gold|gold-lt|readgold|error|warn|gold-solid|gold-solid-hover)|--admin-(bg|surface|elevated|input-bg|text|text-sec|text-dim|text-faint)|--fs-[\w-]+|--space-\d+|--radius-[\w-]+|--control-h[\w-]*|--font-(display|serif|body|sans|mono))\s*:/m;
    const offenders = css.filter(f => owned.test(f.text)).map(f => f.rel);
    // approved-wheel.css scopes its own --tea-* copies to the wheel; SourcesView
    // is a .tsx, not counted here.
    expect(offenders.filter(r => !r.endsWith('approved-wheel.css')), 'Declare tokens in src/styles/tokens.css only.').toEqual([]);
  });
});

describe('per-file ceilings (scripts/style-guard.mjs, shared with the other projects)', () => {
  it('no file holds more hard-coded colours, control sizes or font sizes than its frozen count', async () => {
    // Loaded by path so tsc does not type the plain-JS counter.
    const guardPath = join(ROOT, 'scripts/style-guard.mjs');
    const g = await import(/* @vite-ignore */ guardPath) as {
      countAll: () => Record<string, { colors: number; sizes: number; fonts: number }>;
      readBaseline: () => { files: Record<string, { colors: number; sizes: number; fonts: number }> } | Record<string, { colors: number; sizes: number; fonts: number }>;
    };
    const counts = g.countAll();
    const raw = g.readBaseline();
    const base = ('files' in raw ? raw.files : raw) as Record<string, { colors: number; sizes: number; fonts: number }>;
    const worse: string[] = [];
    for (const [file, c] of Object.entries(counts)) {
      const b = base[file] ?? { colors: 0, sizes: 0, fonts: 0 };
      for (const k of ['colors', 'sizes', 'fonts'] as const) {
        if (c[k] > b[k]) worse.push(`${file}: ${k} ${c[k]} > ${b[k]}`);
      }
    }
    expect(worse, 'Move the value into src/styles/tokens.css and read it from there. After cleaning a file, run `node scripts/style-guard.mjs --write` to lower its ceiling.').toEqual([]);
  });
});
