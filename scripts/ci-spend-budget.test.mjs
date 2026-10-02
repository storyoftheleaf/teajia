import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { CI_SPEND_BUDGET, decideCiSpend, monthWindow } from './ci-spend-budget.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/* Comments first, because a guard that reads its own explanation can only be
   satisfied by deleting the reason it exists — the same rule the freight and
   cost-currency scans keep. Proven by mutation: removing `[CI Skip]` from the
   incident bot's commit line left this suite green until this existed. */
const readCode = (path) =>
  read(path)
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

test('September 2026 is the case this guard exists for', () => {
  /* The month that tripped the meter: 520 GitHub Actions runs by the 29th,
     against a Cloudflare Pages ceiling of 500 builds. The ceiling had already
     gone. */
  const blown = decideCiSpend({ runs: 520, day: 29, daysInMonth: 30 });
  assert.equal(blown.level, 'stop');
  assert.match(blown.message, /520 CI runs/);
  assert.match(blown.message, /500/);

  /* And it would have said so with days to spare. 400 runs is four fifths of
     the ceiling; on the real September curve that was around the 24th. */
  const eighty = decideCiSpend({ runs: 400, day: 24, daysInMonth: 30 });
  assert.equal(eighty.level, 'warn');
  assert.match(eighty.message, /100 left of 500/);

  /* Earlier still, on pace alone: 225 pushes to main produced 520 runs, so by
     mid-month the pace was already past the ceiling. */
  const onPace = decideCiSpend({ runs: 260, day: 15, daysInMonth: 30 });
  assert.equal(onPace.level, 'warn');
  assert.equal(onPace.projected, 520);
  assert.match(onPace.message, /on pace for 520/);
});

test('a quiet month says so and costs nothing', () => {
  const quiet = decideCiSpend({ runs: 120, day: 29, daysInMonth: 30 });
  assert.equal(quiet.level, 'ok');
  assert.match(quiet.message, /on pace for 125 of 500/);
});

test('a busy first day is not a projection', () => {
  /* 40 runs on the 2nd projects to 600, and means nothing: a day of landing a
     branch is not a month. A guard that cries wolf in week one gets muted, and
     a muted guard is the leak with a file next to it. */
  const early = decideCiSpend({ runs: 40, day: 2, daysInMonth: 30 });
  assert.equal(early.projected, 600);
  assert.equal(early.level, 'ok');

  /* The same pace a week in is evidence, and is reported. */
  const week = decideCiSpend({ runs: 140, day: 7, daysInMonth: 30 });
  assert.equal(week.level, 'warn');
  assert.match(week.message, /on pace for 600/);
});

test('the ceiling itself is the boundary, not a number near it', () => {
  assert.equal(decideCiSpend({ runs: 499, day: 30, daysInMonth: 30 }).level, 'warn');
  assert.equal(decideCiSpend({ runs: 500, day: 30, daysInMonth: 30 }).level, 'stop');
});

test('the budget is one number in one place', () => {
  assert.equal(CI_SPEND_BUDGET.ceiling, 500);
  /* A second ceiling declared somewhere else drifts from this one the first
     time a plan changes, which is this repo's oldest bug on a different
     number. The workflow calls the script and compares nothing itself. */
  const workflow = read('.github/workflows/playwright.yml');
  assert.doesNotMatch(workflow, /ceiling\s*[:=]/);
  assert.doesNotMatch(workflow, /CI_SPEND|SPEND_CEILING/);
});

test('nonsense is refused rather than answered', () => {
  assert.throws(() => decideCiSpend({ runs: 10, day: 0, daysInMonth: 30 }), TypeError);
  assert.throws(() => decideCiSpend({ runs: -1, day: 3, daysInMonth: 30 }), TypeError);
  assert.throws(() => decideCiSpend({ runs: 10, day: 20, daysInMonth: 15 }), TypeError);
});

test('the month window is the calendar month in UTC', () => {
  const window = monthWindow(new Date('2026-09-29T22:45:00Z'));
  assert.deepEqual(window, { since: '2026-09-01', day: 29, daysInMonth: 30 });
  assert.equal(monthWindow(new Date('2026-02-10T00:00:00Z')).daysInMonth, 28);
});

test('the guard is wired into the lane that runs on every push to main', () => {
  /* A guard nobody calls is a file. This is the same rule the freight and
     currency guards keep about themselves. */
  const workflow = readCode('.github/workflows/playwright.yml');
  const budget = workflow.match(/\n {2}budget:\n([\s\S]*?)\n {2}\w+:/)?.[1] ?? '';
  assert.match(budget, /npm run ci:spend-budget/);
  /* Inside the job, not merely somewhere in the file: `gate` carries the same
     permission, so a file-wide match stays green when this job loses it, and
     without it the API answers 403 and the guard reports nothing forever. */
  assert.match(budget, /actions: read/);
  assert.match(budget, /if: github\.event_name != 'pull_request'/);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['ci:spend-budget'], 'node scripts/ci-spend-budget.mjs');
  assert.match(pkg.scripts['test:platform-hardening'], /scripts\/ci-spend-budget\.test\.mjs/);
});

test('one push to main starts one run, and the deployment-config checks moved with it', () => {
  /* Three workflows used to answer the same push. `Check deployment config` is
     its own run per push for two commands that take seconds, so they live in
     the `checks` job now and that workflow no longer watches main. If the push
     trigger ever comes back, this fails rather than quietly costing a run and
     a Pages build per push. */
  const deployConfig = read('.github/workflows/check-deployment-config.yml');
  assert.doesNotMatch(deployConfig, /^\s*push:/m);
  const workflow = read('.github/workflows/playwright.yml');
  assert.match(workflow, /npm run check:deploy-config/);
  assert.match(workflow, /scripts\/check-required-deployment-config\.test\.mjs/);
});

test('a push that cannot change what ships is not tested again', () => {
  /* paths-ignore is the only lever this repo has over its own spend that costs
     no safety: prose and agent configuration are read by nobody the suite
     speaks for. `ops/**` is the incident bot's own output, which it writes to
     main once a day.
     Read per trigger, not across the file: both lists carry the same paths, so
     a single `includes` over the whole workflow stays green when one of the two
     loses an entry, which is the half of the guard that would matter. */
  const workflow = readCode('.github/workflows/playwright.yml');
  const blocks = workflow.split(/^  (?=\S)/m).filter((block) => block.includes('paths-ignore:'));
  assert.equal(blocks.length, 2, 'playwright.yml should carry a paths-ignore list for pull_request and for push');
  for (const block of blocks) {
    const trigger = block.split('\n')[0].trim();
    for (const path of ['*.md', 'docs/**', 'todo/**', 'ops/**', '.claude/**']) {
      assert.ok(
        block.includes(`- '${path}'`),
        `${trigger} must ignore ${path}: a push touching only prose spends a run and a Pages build`,
      );
    }
  }
});

test('the incident bot skips both builders, not just one', () => {
  /* GitHub honours `[skip ci]`. Cloudflare Pages documents its own tokens
     (`[CI Skip]`, `[Skip CI]`, `[No CI]`), and this bot pushes to main daily,
     so it carries one of each: a build for a file the site does not read is a
     build nobody gets back. */
  const incidents = readCode('.github/workflows/incident-queue.yml');
  assert.match(incidents, /git commit -m "[^"]*\[skip ci\][^"]*"/);
  assert.match(incidents, /git commit -m "[^"]*\[CI Skip\][^"]*"/);
});
