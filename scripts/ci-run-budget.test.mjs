import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CI_RUN_BUDGET,
  countWorkflowRunsThisMonth,
  decideCiRunVolume,
  inspectCiRunVolume,
  monthWindow,
  parseMonthlyRunLimit,
} from './ci-run-budget.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readCode = (path) =>
  read(path)
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

test('run-volume alert is inactive until an explicit threshold is configured', () => {
  assert.deepEqual(parseMonthlyRunLimit(undefined), { value: null });
  assert.deepEqual(parseMonthlyRunLimit(''), { value: null });
  assert.deepEqual(parseMonthlyRunLimit('100'), { value: 100 });
  assert.match(parseMonthlyRunLimit('4.5').error, /positive whole number/);
  assert.match(parseMonthlyRunLimit('0').error, /positive whole number/);

  const observed = decideCiRunVolume({ runs: 19, day: 4, daysInMonth: 30 });
  assert.equal(observed.level, 'observed');
  assert.equal(observed.monthlyRunLimit, null);
  assert.match(observed.message, /No run-count threshold is configured/);
});

test('configured run-volume alert distinguishes warning, projection, and limit', () => {
  assert.equal(CI_RUN_BUDGET.warnAtFraction, 0.8);

  const warning = decideCiRunVolume({ runs: 80, day: 24, daysInMonth: 30, monthlyRunLimit: 100 });
  assert.equal(warning.level, 'warn');
  assert.match(warning.message, /80 GitHub Actions workflow runs/);
  assert.match(warning.message, /does not measure billed minutes or Pages builds/);

  const onPace = decideCiRunVolume({ runs: 24, day: 7, daysInMonth: 30, monthlyRunLimit: 100 });
  assert.equal(onPace.level, 'warn');
  assert.equal(onPace.projected, 103);

  const reached = decideCiRunVolume({ runs: 100, day: 30, daysInMonth: 30, monthlyRunLimit: 100 });
  assert.equal(reached.level, 'limit');
  assert.match(reached.message, /configured run-count threshold/);
  assert.doesNotMatch(reached.message, /free plan has stopped|deployment until the month turns/);
});

test('the alert avoids projecting from a short early-month sample', () => {
  const early = decideCiRunVolume({ runs: 8, day: 2, daysInMonth: 30, monthlyRunLimit: 100 });
  assert.equal(early.projected, 120);
  assert.equal(early.level, 'ok');

  const quiet = decideCiRunVolume({ runs: 40, day: 29, daysInMonth: 30, monthlyRunLimit: 100 });
  assert.equal(quiet.level, 'ok');
  assert.equal(quiet.projected, 42);
  assert.match(quiet.message, /Cloudflare Pages usage is not measured/);
});

test('invalid counts and thresholds are refused', () => {
  assert.throws(() => decideCiRunVolume({ runs: -1, day: 3, daysInMonth: 30 }), TypeError);
  assert.throws(() => decideCiRunVolume({ runs: 1.5, day: 3, daysInMonth: 30 }), TypeError);
  assert.throws(() => decideCiRunVolume({ runs: 10, day: 0, daysInMonth: 30 }), TypeError);
  assert.throws(() => decideCiRunVolume({ runs: 10, day: 20, daysInMonth: 15 }), TypeError);
  assert.throws(() => decideCiRunVolume({ runs: 10, day: 2, daysInMonth: 30, monthlyRunLimit: 0 }), TypeError);
  assert.throws(() => decideCiRunVolume({ runs: 10, day: 2, daysInMonth: 30, warnAtFraction: 1 }), TypeError);
});

test('month window follows UTC calendar boundaries', () => {
  assert.deepEqual(monthWindow(new Date('2026-09-29T22:45:00Z')), {
    since: '2026-09-01',
    day: 29,
    daysInMonth: 30,
  });
  assert.equal(monthWindow(new Date('2026-02-10T00:00:00Z')).daysInMonth, 28);
});

test('the API reader requests Actions runs and accepts only a valid count', async () => {
  let request;
  const runs = await countWorkflowRunsThisMonth({
    repo: 'storyoftheleaf/teajia',
    token: 'test-token',
    since: '2026-10-01',
    fetchImpl: async (url, options) => {
      request = { url: new URL(url), options };
      return { ok: true, json: async () => ({ total_count: 37 }) };
    },
  });

  assert.equal(runs, 37);
  assert.equal(request.url.pathname, '/repos/storyoftheleaf/teajia/actions/runs');
  assert.equal(request.url.searchParams.get('created'), '>=2026-10-01');
  assert.equal(request.options.headers.authorization, 'Bearer test-token');

  await assert.rejects(
    countWorkflowRunsThisMonth({
      repo: 'storyoftheleaf/teajia',
      token: 'test-token',
      since: '2026-10-01',
      fetchImpl: async () => ({ ok: true, json: async () => ({ total_count: 'unknown' }) }),
    }),
    /no valid total_count/,
  );
});

test('API failures expose the status without exposing the response body', async () => {
  await assert.rejects(
    countWorkflowRunsThisMonth({
      repo: 'storyoftheleaf/teajia',
      token: 'test-token',
      since: '2026-10-01',
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        json: async () => ({ secret: 'must not leak' }),
      }),
    }),
    (error) => error.message === 'GitHub Actions API answered 403' && !error.message.includes('must not leak'),
  );
});

test('missing run-count inputs and API failures remain visible as unknown', async () => {
  const invalidThreshold = await inspectCiRunVolume({
    repo: 'storyoftheleaf/teajia',
    token: 'test-token',
    runLimitSetting: 'not-a-number',
    fetchImpl: async () => {
      throw new Error('API should not be queried for invalid settings');
    },
  });
  assert.equal(invalidThreshold.level, 'unknown');
  assert.match(invalidThreshold.message, /CI_RUN_COUNT_BUDGET must be/);

  const missing = await inspectCiRunVolume({ repo: '', token: '' });
  assert.equal(missing.level, 'unknown');
  assert.match(missing.message, /repository or token is missing/);

  const unavailable = await inspectCiRunVolume({
    repo: 'storyoftheleaf/teajia',
    token: 'test-token',
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }),
  });
  assert.equal(unavailable.level, 'unknown');
  assert.match(unavailable.message, /answered 403/);
  assert.match(unavailable.message, /no level assigned/);
});

test('run-volume observation does not invent a default budget or claim provider spend', () => {
  const script = read('scripts/ci-run-budget.mjs');
  assert.match(script, /CI_RUN_COUNT_BUDGET/);
  assert.match(script, /does not measure billed Actions minutes or Cloudflare Pages builds/);
  assert.doesNotMatch(script, /monthlyRunLimit:\s*\d+|Cloudflare.*free plan|Pages.*ceiling|September 2026/);
  assert.doesNotMatch(script, /process\.exitCode/);
  assert.doesNotMatch(script, /500/);
});

test('budget job is a lightweight push-to-main Actions event', () => {
  const workflow = readCode('.github/workflows/playwright.yml');
  const budget = workflow.match(/\n  budget:\n([\s\S]*?)\n  checks:/)?.[1] ?? '';
  assert.match(budget, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(budget, /actions: read/);
  assert.match(budget, /CI_RUN_COUNT_BUDGET: \$\{\{ vars\.CI_RUN_COUNT_BUDGET \}\}/);
  assert.match(budget, /npm run ci:run-budget/);
  assert.doesNotMatch(budget, /npm ci|setup-node.*cache|playwright/);

  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['ci:run-budget'], 'node scripts/ci-run-budget.mjs');
  assert.match(pkg.scripts['test:platform-hardening'], /scripts\/ci-run-budget\.test\.mjs/);
});

test('deployment-config checks share Playwright and do not start a duplicate event run', () => {
  const deployConfig = read('.github/workflows/check-deployment-config.yml');
  assert.doesNotMatch(deployConfig, /^\s*push:/m);
  assert.doesNotMatch(deployConfig, /^\s*pull_request:/m);
  assert.match(deployConfig, /^\s*workflow_dispatch:/m);
  assert.doesNotMatch(deployConfig, /free plan counts|ci-spend-budget\.test\.mjs/);
  const workflow = read('.github/workflows/playwright.yml');
  assert.match(workflow, /npm run check:deploy-config/);
  assert.match(workflow, /scripts\/check-required-deployment-config\.test\.mjs/);
});

test('GitHub Actions path filters apply only to this workflow', () => {
  const workflow = readCode('.github/workflows/playwright.yml');
  const blocks = workflow.split(/^  (?=\S)/m).filter((block) => block.includes('paths-ignore:'));
  assert.equal(blocks.length, 2);
  for (const block of blocks) {
    const trigger = block.split('\n')[0].trim();
    for (const path of ['*.md', 'docs/**', 'todo/**', 'ops/**', '.claude/**']) {
      assert.ok(block.includes(`- '${path}'`), `${trigger} must ignore ${path}`);
    }
  }
  assert.doesNotMatch(workflow, /42 of September|225 pushes to main/);
});

test('incident bot commit starts with the Pages skip token and also skips Actions', () => {
  const incidents = readCode('.github/workflows/incident-queue.yml');
  assert.match(incidents, /git commit -m "\[CI Skip\][^"]*\[skip ci\][^"]*"/);
});
