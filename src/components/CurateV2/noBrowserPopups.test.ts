import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Curate asks on the line it is about, never in a browser popup: confirm,
// alert and prompt are blocked in the app's browser pane and in many in-app
// browsers, where the button then silently did nothing (Delete on an order,
// 2026-10-09). Comments are stripped so the reason can stay written down.
const DIR = __dirname;
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('Curate v2 asks in place', () => {
  const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));

  it('scans the v2 sources', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)('%s uses no browser popup', (file) => {
    const src = stripComments(readFileSync(join(DIR, file), 'utf8'));
    expect(src).not.toMatch(/\bwindow\.(confirm|alert|prompt)\s*\(/);
    // A bare call is the global popup unless the file defines its own function
    // of that name (RecordTools has a local confirm() for its undo step).
    for (const name of ['confirm', 'alert', 'prompt']) {
      const ownsName = new RegExp(`(const|let|function)\\s+${name}\\b`).test(src);
      if (!ownsName) expect(src).not.toMatch(new RegExp(`(^|[^.\\w])${name}\\s*\\(`));
    }
  });
});
