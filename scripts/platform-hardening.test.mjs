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

test('workbook intake uses patched dependencies and excludes SheetJS', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies?.xlsx, undefined);
  assert.match(pkg.dependencies?.exceljs ?? '', /^\^?4\./);
  assert.match(pkg.devDependencies?.vite ?? '', /^\^?6\.(?:4\.[3-9]|[5-9]\.)/);
  assert.doesNotMatch(read('package-lock.json'), /node_modules\/xlsx/);
  const intake = read('src/admin/views/IntakeWorkspace.tsx');
  assert.doesNotMatch(intake, /accept=[^\n]*\.xls(?:,|")/);
  assert.doesNotMatch(intake, /label="Excel"/);
  assert.doesNotMatch(read('src/vite-env.d.ts'), /VITE_GEMINI_API_KEY/);
  assert.doesNotMatch(read('.env.example'), /VITE_GEMINI_API_KEY/);
});

test('external GitHub Actions are pinned to immutable commits with version comments', () => {
  const workflowDir = new URL('../.github/workflows/', import.meta.url);
  for (const filename of readdirSync(workflowDir).filter((name) => name.endsWith('.yml'))) {
    const workflow = read(`.github/workflows/${filename}`);
    for (const line of workflow.split('\n')) {
      if (!/^\s*-?\s*uses:\s*[^.\/][^\s]*@/.test(line)) continue;
      assert.match(
        line,
        /@[0-9a-f]{40}\s+#\s+v\d+(?:\.\d+(?:\.\d+)?)?\s*$/,
        `${filename}: external action must use a full commit SHA and version comment`,
      );
    }
  }
});
