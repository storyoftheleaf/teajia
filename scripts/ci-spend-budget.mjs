/**
 * The month's CI spend, read out loud before the ceiling arrives.
 *
 * Every push to `main` costs one Cloudflare Pages production build (the Git
 * integration builds each push, and it has no path filter, so a docs-only
 * commit rebuilds and redeploys the site) plus at least one GitHub Actions
 * run. The free plans stop at 500 Pages builds a month, and in September 2026
 * this repo took 225 separate pushes to main and produced 520 Actions runs:
 * one push per commit, and a single change landing over three to six pushes
 * minutes apart. Nothing was looping. The shape of the work was the spend.
 *
 * The ceiling is a cliff and it arrives without a sound: the 500th build is
 * fine and the 501st simply does not deploy. So the month's count is read on
 * every push to main and the run goes RED while there is still room to change
 * how the work is landed — this repo's own rule, from the stale exchange rates:
 * a warning on screen, not just in a log.
 *
 * `decideCiSpend` is pure and is the whole decision; the CLI only counts. It
 * is deliberately not a blocker of anything: an over-budget month must never
 * be the reason a fix cannot land, so the CLI reports a red job and nothing
 * else, and a month it cannot count is an `unknown` that exits 0.
 */
import { pathToFileURL } from 'node:url';

export const CI_SPEND_BUDGET = {
  /* Cloudflare Pages, free plan: 500 builds a month. The GitHub run count is
     the number the meter reads and it tracks above the build count (one push
     can start Playwright, Deploy worker and Check deployment config), so
     budgeting the runs against the Pages ceiling keeps one number to watch
     and errs early. */
  ceiling: 500,
  /* Spend the first four fifths freely; the last fifth is the margin the end
     of a month needs. 400 runs is where the words change. */
  warnAtFraction: 0.8,
  /* A projection off two days of a fast week is noise. A week of a month is
     evidence. */
  projectFromDay: 7,
};

/**
 * @param {{ runs: number, day: number, daysInMonth: number, ceiling?: number,
 *           warnAtFraction?: number, projectFromDay?: number }} input
 * @returns {{ level: 'ok'|'warn'|'stop', runs: number, projected: number,
 *             ceiling: number, message: string }}
 */
export function decideCiSpend({
  runs,
  day,
  daysInMonth,
  ceiling = CI_SPEND_BUDGET.ceiling,
  warnAtFraction = CI_SPEND_BUDGET.warnAtFraction,
  projectFromDay = CI_SPEND_BUDGET.projectFromDay,
}) {
  if (!Number.isInteger(runs) || runs < 0) throw new TypeError('runs must be a non-negative integer');
  if (!Number.isInteger(day) || day < 1) throw new TypeError('day must be a calendar day, 1 or more');
  if (!Number.isInteger(daysInMonth) || daysInMonth < day) {
    throw new TypeError('daysInMonth must be an integer no smaller than day');
  }
  if (!Number.isFinite(ceiling) || ceiling <= 0) throw new TypeError('ceiling must be a positive number');

  const projected = Math.ceil((runs / day) * daysInMonth);
  const left = ceiling - runs;
  const base = { runs, projected, ceiling };

  if (runs >= ceiling) {
    return {
      ...base,
      level: 'stop',
      message:
        `${runs} CI runs this month against a ceiling of ${ceiling}. The free plan has already stopped ` +
        `building: a push to main will not produce a deployment until the month turns. Land the rest of ` +
        `today's work as ONE push per change.`,
    };
  }

  if (runs >= ceiling * warnAtFraction) {
    return {
      ...base,
      level: 'warn',
      message:
        `${runs} CI runs this month, ${left} left of ${ceiling}, day ${day} of ${daysInMonth}. ` +
        `Batch each change into one push to main; a work-in-progress push spends a build that deploys ` +
        `nothing anyone asked for.`,
    };
  }

  if (day >= projectFromDay && projected >= ceiling) {
    return {
      ...base,
      level: 'warn',
      message:
        `${runs} CI runs by day ${day} of ${daysInMonth} is on pace for ${projected}, past the ceiling of ` +
        `${ceiling}. Batch each change into one push to main while there is still room to.`,
    };
  }

  return {
    ...base,
    level: 'ok',
    message: `${runs} CI runs this month, on pace for ${projected} of ${ceiling}.`,
  };
}

/** First instant of the current UTC month, as the Actions API wants it. */
export function monthWindow(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const since = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return {
    since,
    day: now.getUTCDate(),
    daysInMonth: new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  };
}

async function countRunsThisMonth({ repo, token, since }) {
  /* per_page=1 because only total_count is wanted; the `created` filter is
     applied to total_count by the API, so this is one request for the month. */
  const url = `https://api.github.com/repos/${repo}/actions/runs?per_page=1&created=%3E%3D${since}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!response.ok) {
    /* The status, never the body: a token problem must not be described by
       something that could quote a header back. */
    throw new Error(`GitHub Actions API answered ${response.status}`);
  }
  const body = await response.json();
  if (!Number.isInteger(body?.total_count)) throw new Error('GitHub Actions API returned no total_count');
  return body.total_count;
}

async function runCli() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const { since, day, daysInMonth } = monthWindow();

  if (!repo || !token) {
    /* Outside CI there is nothing to count and nothing to say. A budget guard
       that fails a local checkout has become the leak it was written against. */
    console.log('CI spend budget: no repository or token in the environment; nothing counted.');
    return;
  }

  let runs;
  try {
    runs = await countRunsThisMonth({ repo, token, since });
  } catch (error) {
    console.log(`CI spend budget: could not read the month's run count (${error.message}); not counted.`);
    return;
  }

  const verdict = decideCiSpend({ runs, day, daysInMonth });
  if (verdict.level === 'ok') {
    console.log(`CI spend budget: ${verdict.message}`);
    return;
  }
  console.error(`CI spend budget (${verdict.level}): ${verdict.message}`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
