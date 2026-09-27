import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A `/* … *\/` comment in JSX CHILD position is not a comment. It is text, and
 * React renders it onto the page.
 *
 * This shipped. On 2026-09-04 a four-line note about tab gutters was written
 * directly under `<LayoutGroup>` in PageHeaderTabs, where everything is
 * children, and the whole paragraph appeared on the live shop between the
 * title and the tabs, in Cormorant, at reading size, above the first tea.
 *
 * Nothing caught it. It is valid JSX, so `tsc` compiles it and the Cloudflare
 * build succeeds. It throws no console error and causes no overflow, so the
 * mobile Playwright audit passes. It only fails in the one place nobody was
 * looking: the rendering.
 *
 * The trap is that the SAME characters are correct one line away. Inside a JS
 * expression the comment is a comment:
 *
 *   {cond && (
 *     \/* fine: this is inside the parens of an expression *\/
 *     <div />
 *   )}
 *
 * and between attributes of an opening tag it is a comment too. Only child
 * position turns it into prose. In children you must write `{\/* … *\/}`, or
 * lift the note above the `return`.
 *
 * The scan is structural rather than a list of known files, so a comment
 * dropped into children on any surface is caught the moment it is added.
 */

/** Every .tsx under src, so a new surface is covered without being registered. */
function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(path));
    else if (entry.name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

// fileURLToPath, not .pathname: .pathname keeps %20, so on a checkout whose
// path has a space in it the guard found no folder and never ran.
const SRC = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Child position, detected by what comes BEFORE the comment.
 *
 * A line that closes a JSX tag ends in `>`, and anything after it is children
 * until the next tag opens. The one `>` ending that is not a tag is a fat
 * arrow, which is why `=>` is excluded: a comment under `=>` is inside a
 * function body and perfectly ordinary.
 */
function offendingLines(source: string): string[] {
  const lines = source.split('\n');
  const hits: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('/*')) continue;

    let prev = i - 1;
    while (prev >= 0 && lines[prev].trim() === '') prev--;
    if (prev < 0) continue;

    const before = lines[prev].trim();
    if (before.endsWith('>') && !before.endsWith('=>')) {
      hits.push(`line ${i + 1}, under \`${before.slice(-48)}\``);
    }
  }

  return hits;
}

describe('a comment in JSX children is text, and text renders', () => {
  it.each(tsxFiles(SRC).map(f => f.slice(SRC.length)))('%s', file => {
    const offenders = offendingLines(readFileSync(join(SRC, file), 'utf8'));
    expect(offenders).toEqual([]);
  });
});
