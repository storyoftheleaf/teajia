import { describe, expect, it } from 'vitest';
import { appSourceFiles, isCommentLine, type SourceFile } from './sourceFiles.testkit';

// GUARD: ratchets that only go down.
//
// Each ceiling is a counted fact about the source, set to today's number
// (2026-11-11). It may fall and must not rise. When a count falls, lower the
// ceiling in this file in the same commit so the gain is kept. The failure
// message says what to do instead of adding to the count and prints the
// current number.
//
// Counted: application source only (no tests, harnesses or test kits), and
// lines that are only a comment are skipped. Every match counts, so two
// `<button` on one line are two.
//
// Not duplicated here: scripts/lint-colors.sh checks colour tokens, borders,
// gold-on-gold, hex literals and colour literals inside `style={{`. None of
// the counts below is in it, and no existing test holds them.

const files = appSourceFiles();
const inFolder = (folder: string) => files.filter(f => f.rel.startsWith(folder));

function countMatches(source: SourceFile[], pattern: RegExp): number {
  let total = 0;
  for (const f of source) {
    for (const line of f.text.split('\n')) {
      if (isCommentLine(line)) continue;
      total += line.match(pattern)?.length ?? 0;
    }
  }
  return total;
}

function expectAtMost(count: number, ceiling: number, name: string, instead: string) {
  expect(
    count,
    `${name}: ${count} now, ceiling ${ceiling}. ${instead}`
    + (count < ceiling ? ` (The count has fallen: lower the ceiling to ${count}.)` : ''),
  ).toBeLessThanOrEqual(ceiling);
}

describe('raw <button> elements', () => {
  const instead = 'Use the shared button, `Button` from src/components/shared/Button.tsx (variants primary, secondary, ghost, icon, danger), instead of a new raw <button>.';
  it('in src/admin do not rise', () => {
    expectAtMost(countMatches(inFolder('src/admin/'), /<button\b/g), 1216, 'raw <button in src/admin', instead);
  });
  it('in src/components do not rise', () => {
    expectAtMost(countMatches(inFolder('src/components/'), /<button\b/g), 1377, 'raw <button in src/components', instead);
  });
});

describe('browser dialogs', () => {
  it('window.confirm, window.alert, confirm( and alert( in src do not rise', () => {
    const count = countMatches(files, /\bwindow\.(?:confirm|alert)\(|(?<![.\w$])(?:confirm|alert)\(/g);
    expectAtMost(
      count, 19, 'confirm( and alert( calls in src',
      'Use `ConfirmDialog` (src/components/shared/ConfirmDialog.tsx) to ask and `Toast` (src/components/shared/Toast.tsx or src/admin/components/Toast.tsx) to tell, not a browser dialog.',
    );
  });
});

describe('z-50 in the admin', () => {
  it('does not rise', () => {
    expectAtMost(
      countMatches(inFolder('src/admin/'), /(?<![\w-])z-50(?![\w-])/g), 5, 'z-50 in src/admin',
      'Full-screen admin overlays use `z-modal`, not `z-50`, which blocks the account panel (CLAUDE.md, Layout).',
    );
  });
});

describe('inline style={{ in the admin', () => {
  it('does not rise', () => {
    expectAtMost(
      countMatches(inFolder('src/admin/'), /style=\{\{/g), 109, 'inline style={{ in src/admin',
      'Put the style in a class (Tailwind utility or src/styles/card-utilities.css) instead of an inline style object.',
    );
  });
});

describe('Number(...) || 0', () => {
  it('in src/admin and src/components does not rise', () => {
    const count = countMatches([...inFolder('src/admin/'), ...inFolder('src/components/')], /Number\([^\n]*\|\|\s*0\b/g);
    expectAtMost(
      count, 64, 'Number( ... || 0 in src/admin and src/components',
      'A blank is not a zero. For money use `enteredNumber()` or `enteredCostCell()` from src/admin/productUpdatePayload.ts; for other numbers keep the blank as a blank (CLAUDE.md, "Nothing entered is NULL").',
    );
  });
});

describe('very long files', () => {
  const LIMIT = 1500;
  const ALLOWANCE = 40;
  // Every file over the limit on 2026-11-11, with its line count then. A file
  // may grow by ALLOWANCE lines above its snapshot and no more. Lower an
  // entry when a file shrinks; delete it when the file drops under the limit.
  const SNAPSHOT: Record<string, number> = {
    'src/admin/components/AddProductModal.tsx': 1642,
    'src/admin/components/CustomersView.tsx': 2130,
    'src/admin/components/InventoryView.tsx': 3501,
    'src/admin/components/ProductEditPanel.tsx': 2106,
    'src/admin/components/SourcesView.tsx': 2334,
    'src/admin/components/wisdom/WisdomBrowser.tsx': 1747,
    'src/App.tsx': 1532,
    'src/components/CurateV2/CaptureCard.tsx': 1797,
    'src/components/CurateV2/index.tsx': 1713,
    'src/components/SinglePageRenderer.tsx': 2300,
    'src/components/TeaCompass/CaptureCard.tsx': 2196,
    'src/components/TeaCompass/index.tsx': 1803,
    'src/lib/api.ts': 5275,
    'src/pages/ArticlePage.tsx': 2969,
    'src/pages/DesignSystemShowcase.tsx': 2123,
    'src/samples/SampleSetCreator.tsx': 2009,
    'src/types.ts': 1664,
    'src/wisdom/receiving/previewImporter.ts': 1903,
  };

  const lineCount = (f: SourceFile) => f.text.split('\n').length - (f.text.endsWith('\n') ? 1 : 0);
  const over = files.map(f => ({ rel: f.rel, lines: lineCount(f) })).filter(f => f.lines > LIMIT);

  it('no file that is not in the snapshot crosses 1,500 lines', () => {
    const fresh = over.filter(f => !(f.rel in SNAPSHOT)).map(f => `${f.rel} (${f.lines} lines)`);
    expect(
      fresh,
      'These files are over 1,500 lines and are not on the snapshot. Split the file (move a part into its own module) instead of letting it grow; do not add it to SNAPSHOT.',
    ).toEqual([]);
  });

  it('no snapshotted file grows past its snapshot plus the allowance', () => {
    const grown = over
      .filter(f => f.rel in SNAPSHOT && f.lines > SNAPSHOT[f.rel] + ALLOWANCE)
      .map(f => `${f.rel}: ${f.lines} lines now, snapshot ${SNAPSHOT[f.rel]} (+${ALLOWANCE} allowed)`);
    expect(grown, 'These long files grew. Put the new code in a new module and import it instead of adding to the file.').toEqual([]);
  });
});
