import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { practiceToml } from './practice-config.mjs';

const real = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

test('practice copy drops only the allowance binding and turns the requirement off', () => {
  const out = practiceToml(real);
  assert.ok(!/SHARED_ALLOWANCE"/.test(out), 'binding removed');
  assert.ok(!/i64os-quota-guard/.test(out), 'script reference removed');
  assert.match(out, /SHARED_ALLOWANCE_REQUIRED = "false"/);
  assert.match(out, /\[\[d1_databases\]\]/);
  assert.match(out, /name = "LOGIN_LIMITER"/);
  assert.match(out, /binding = "MEDIA_BUCKET"/);
});

test('the committed config is never weakened', () => {
  assert.match(real, /SHARED_ALLOWANCE_REQUIRED = "true"/);
  assert.match(real, /name = "SHARED_ALLOWANCE"/);
});

test('refuses a config it does not understand', () => {
  assert.throws(() => practiceToml('name = "x"\n'));
});
