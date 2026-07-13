import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const deploymentConfigModule = await import('./check-required-deployment-config.mjs').catch(() => ({}));
const scriptPath = fileURLToPath(new URL('./check-required-deployment-config.mjs', import.meta.url));
const { CF_PAGES: _cfPages, WORKER_ORIGIN: _workerOrigin, ...cleanEnv } = process.env;

test('exports a deployment configuration validator', () => {
  assert.equal(typeof deploymentConfigModule.validateDeploymentConfig, 'function');
});

test('accepts an HTTPS WORKER_ORIGIN', () => {
  assert.deepEqual(
    deploymentConfigModule.validateDeploymentConfig({
      WORKER_ORIGIN: 'https://teajia-api.lightcodes.workers.dev',
    }),
    [],
  );
});

test('rejects a missing WORKER_ORIGIN', () => {
  assert.deepEqual(
    deploymentConfigModule.validateDeploymentConfig({}),
    ['WORKER_ORIGIN is required.'],
  );
});

test('rejects a malformed WORKER_ORIGIN', () => {
  assert.deepEqual(
    deploymentConfigModule.validateDeploymentConfig({ WORKER_ORIGIN: 'not-a-url' }),
    ['WORKER_ORIGIN must be a valid HTTPS URL.'],
  );
});

test('rejects an HTTP WORKER_ORIGIN', () => {
  assert.deepEqual(
    deploymentConfigModule.validateDeploymentConfig({ WORKER_ORIGIN: 'http://worker.example.com' }),
    ['WORKER_ORIGIN must use HTTPS.'],
  );
});

test('CLI fails safely without printing the configured value', () => {
  const configuredValue = 'http://do-not-print.example.test/private-path';
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: { ...process.env, WORKER_ORIGIN: configuredValue },
  });
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.status, 1);
  assert.match(output, /WORKER_ORIGIN must use HTTPS/);
  assert.doesNotMatch(output, new RegExp(configuredValue));
});

test('Pages-only CLI mode skips validation outside Cloudflare Pages', () => {
  const result = spawnSync(process.execPath, [scriptPath, '--if-cloudflare-pages'], {
    encoding: 'utf8',
    env: cleanEnv,
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Skipped outside Cloudflare Pages/);
});

test('Pages-only CLI mode rejects a missing binding during a Cloudflare Pages build', () => {
  const result = spawnSync(process.execPath, [scriptPath, '--if-cloudflare-pages'], {
    encoding: 'utf8',
    env: { ...cleanEnv, CF_PAGES: '1' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /WORKER_ORIGIN is required/);
});
