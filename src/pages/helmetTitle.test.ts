import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Every `<title>` handed to Helmet is one string.
 *
 * `react-helmet-async` sets `document.title` from the single text child of
 * `<title>`. Given two children it has nothing to set and empties the title
 * instead, with a console warning nobody sees in production.
 *
 * `<title>{item.name} · Teajia</title>` is two children: the expression and the
 * literal " · Teajia" beside it. It reads like a template and compiles to an
 * array. That shipped, and every product page on the live site served an empty
 * title: no tab label, no name in a search result, no name on a shared link,
 * on the pages most likely to be shared. The wisdom pages next to it were fine
 * because they happened to be written as one template literal.
 *
 * The difference is invisible in review and invisible in a render test, which
 * is why it is checked here, against the source, the way the shop's other
 * structural rule is.
 *
 * The fix is always the same shape: wrap the whole thing in one template
 * literal, `<title>{`${item.name} · Teajia`}</title>`.
 */

// fileURLToPath, not .pathname: a URL percent-encodes, so a checkout under a
// folder with a space in its name yields '/2%20Areas/' and every read fails with
// ENOENT. The test then reports as a failure of the source it never managed to
// open. That is where this actually lives, so it is where it is decoded.
const SRC = fileURLToPath(new URL('../', import.meta.url));

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

/** `<title>…</title>` on one line, which is how every one of them is written. */
const TITLE = /<title>(.*?)<\/title>/g;

/**
 * One child: either no braces at all, or a single `{…}` filling the whole slot.
 * `{a} · b` and `a {b}` are two children and are what this test exists for.
 */
function isSingleChild(inner: string): boolean {
  const trimmed = inner.trim();
  if (!trimmed.includes('{')) return true;
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  // Confirm the opening brace closes at the very end rather than mid-string,
  // so `{a} · {b}` is not mistaken for one expression.
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') depth++;
    else if (trimmed[i] === '}') {
      depth--;
      if (depth === 0) return i === trimmed.length - 1;
    }
  }
  return false;
}

describe('every Helmet title is a single string child', () => {
  it('has no multi-child titles anywhere in src', () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(TITLE)) {
        if (isSingleChild(match[1])) continue;
        const line = text.slice(0, match.index).split('\n').length;
        offenders.push(`${file.slice(SRC.length)}:${line}  <title>${match[1]}</title>`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('recognises the shapes it is meant to separate', () => {
    expect(isSingleChild('Teajia')).toBe(true);
    expect(isSingleChild('{`${name} · Teajia`}')).toBe(true);
    expect(isSingleChild('{title}')).toBe(true);
    expect(isSingleChild('{name} · Teajia')).toBe(false);
    expect(isSingleChild('Teajia · {name}')).toBe(false);
    expect(isSingleChild('{a} · {b}')).toBe(false);
  });
});
