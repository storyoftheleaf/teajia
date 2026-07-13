import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Playwright is pinned and uses the clean test server', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.devDependencies?.['@playwright/test'] ?? '', /^\^?\d+\.\d+\.\d+$/);
  assert.equal(pkg.scripts['dev:test'], 'VITE_API_URL=http://localhost:7777 vite');
  assert.match(pkg.scripts['test:mobile'], /^playwright test /);
  assert.doesNotMatch(pkg.scripts['test:mobile'], /\bnpx\b/);
  assert.match(read('playwright.config.ts'), /command: 'npm run dev:test'/);
});

test('Playwright browser installation and CI execution are documented', () => {
  assert.match(read('README.md'), /npx playwright install chromium/);
  const workflow = read('.github/workflows/playwright.yml');
  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /npm run test:mobile/);
});

test('action pills are removed and lint Rule 9 blocks regressions', () => {
  assert.doesNotMatch(read('src/admin/views/PlatformAdminView.tsx'), /pill-(primary|destructive)/);
  assert.match(read('scripts/lint-colors.sh'), /check_pattern_ere 'pill-\(primary\|destructive\)'/);
});

test('confirmed dead reference code is absent', () => {
  assert.equal(existsSync(new URL('../src/components/advise/ServiceContent.tsx', import.meta.url)), false);
  const databaseDir = new URL('../src/data/tea-database', import.meta.url);
  assert.equal(existsSync(databaseDir) ? readdirSync(databaseDir).length : 0, 0);
});
