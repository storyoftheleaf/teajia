import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* Every Playwright spec takes `test` from tests/fixtures.ts, which answers
   all Cloudinary requests locally. A spec that imports '@playwright/test'
   directly bypasses that and spends delivery credits on every run (the
   sister suites burned 70 GB in a day, 2026-09-12). This is the tripwire;
   it lives here because worker/tests is the vitest set CI runs. */
const specsDir = fileURLToPath(new URL('../../tests/', import.meta.url));

describe('the browser suite stays off Cloudinary', () => {
  it('every spec imports test from the shared fixtures, never from @playwright/test', () => {
    const specs = readdirSync(specsDir).filter((f) => f.endsWith('.spec.ts'));
    expect(specs.length).toBeGreaterThan(0);
    const offenders = specs.filter((f) =>
      /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*'@playwright\/test'/.test(readFileSync(specsDir + f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('the fixture answers res.cloudinary.com itself', () => {
    const source = readFileSync(specsDir + 'fixtures.ts', 'utf8');
    expect(source).toContain('res\\.cloudinary\\.com');
    expect(source).toContain('route.fulfill');
  });
});
