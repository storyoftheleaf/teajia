import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* Every Playwright spec takes `test` from tests/fixtures.ts, which answers
   all production media requests locally. A spec that imports '@playwright/test'
   directly bypasses that and spends metered R2 operations. This is the tripwire;
   it lives here because worker/tests is the vitest set CI runs. */
const specsDir = fileURLToPath(new URL('../../tests/', import.meta.url));

describe('the browser suite stays off production media', () => {
  it('every spec imports test from the shared fixtures, never from @playwright/test', () => {
    const specs = readdirSync(specsDir).filter((f) => f.endsWith('.spec.ts'));
    expect(specs.length).toBeGreaterThan(0);
    const offenders = specs.filter((f) =>
      /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*'@playwright\/test'/.test(readFileSync(specsDir + f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('the fixture answers /api/media itself', () => {
    const source = readFileSync(specsDir + 'fixtures.ts', 'utf8');
    expect(source).toContain('\\/api\\/media\\/');
    expect(source).toContain('route.fulfill');
  });
});
