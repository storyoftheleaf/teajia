import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('dedicated browser verification is explicit, private-fixture gated, and outside the default suite', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(
    pkg.scripts['test:tea-reference-browser'],
    'playwright test --config=playwright.tea-reference.config.ts',
  );
  assert.doesNotMatch(pkg.scripts['test:tea-reference-receiving'], /tea-reference-preview\.spec|tea-reference-browser/);

  const config = read('playwright.tea-reference.config.ts');
  assert.match(config, /TEA_REFERENCE_HANDOFF_PATH is required/);
  assert.match(config, /npm run tea-reference:teajia:preview -- --handoff \"\$TEA_REFERENCE_HANDOFF_PATH\"/);
  assert.match(config, /Desktop Chrome/);
  assert.match(config, /Mobile Chrome/);
  assert.match(config, /tea-reference-preview\.spec\.ts/);

  const browserSpec = read('tests/tea-reference-preview.spec.ts');
  assert.match(browserSpec, /route\('\*\*\/api\/\*\*'/);
  assert.match(browserSpec, /route\.abort\(/);
  assert.match(browserSpec, /page\.on\('pageerror'/);
  assert.match(browserSpec, /message\.type\(\) === 'error'/);
  assert.match(browserSpec, /page\.on\('requestfailed'/);
  assert.match(browserSpec, /__tea-reference-preview/);
  assert.match(browserSpec, /testInfo\.attach\(/);
  assert.match(browserSpec, /import \{ normalizeTeaType \} from '\.\.\/src\/wisdom\/vocabulary'/);
  assert.match(browserSpec, /normalizeTeaType\(entry\.label\) === 'Sheng'/);
  assert.match(browserSpec, /a cited Sheng-compatible tea_style entry with matching public source metadata is required/);
  assert.match(browserSpec, /page\.goto\('\/wisdom\/type\/sheng'\)/);
  assert.match(browserSpec, /type: 'Sheng'/);
  assert.doesNotMatch(browserSpec, /Lincang|MarshalN|teadb\.org/i);
});
