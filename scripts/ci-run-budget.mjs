/**
 * Report GitHub Actions workflow-run volume for the current UTC month.
 *
 * This check reads only the Actions API run count. It does not measure billed
 * Actions minutes or Cloudflare Pages builds. A run-count alert is enabled
 * only when CI_RUN_COUNT_BUDGET is explicitly configured. Missing API data
 * stays visible and never blocks the change that triggered this check.
 */
import { pathToFileURL } from 'node:url';

export const CI_RUN_BUDGET = {
  warnAtFraction: 0.8,
  projectFromDay: 7,
};

export function parseMonthlyRunLimit(value) {
  if (value === undefined || value === null || String(value).trim() === '') return { value: null };
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    return { error: 'CI_RUN_COUNT_BUDGET must be a positive whole number when configured.' };
  }
  return { value: limit };
}

/**
 * @param {{ runs: number, day: number, daysInMonth: number,
 *           monthlyRunLimit?: number|null, warnAtFraction?: number,
 *           projectFromDay?: number }} input
 * @returns {{ level: 'observed'|'warn'|'limit', runs: number, projected: number,
 *             monthlyRunLimit: number|null, message: string }}
 */
export function decideCiRunVolume({
  runs,
  day,
  daysInMonth,
  monthlyRunLimit = null,
  warnAtFraction = CI_RUN_BUDGET.warnAtFraction,
  projectFromDay = CI_RUN_BUDGET.projectFromDay,
}) {
  if (!Number.isInteger(runs) || runs < 0) throw new TypeError('runs must be a non-negative integer');
  if (!Number.isInteger(day) || day < 1) throw new TypeError('day must be a calendar day, 1 or more');
  if (!Number.isInteger(daysInMonth) || daysInMonth < day) {
    throw new TypeError('daysInMonth must be an integer no smaller than day');
  }
  if (monthlyRunLimit !== null && (!Number.isSafeInteger(monthlyRunLimit) || monthlyRunLimit < 1)) {
    throw new TypeError('monthlyRunLimit must be a positive whole number when configured');
  }
  if (!Number.isFinite(warnAtFraction) || warnAtFraction <= 0 || warnAtFraction >= 1) {
    throw new TypeError('warnAtFraction must be between zero and one');
  }

  const projected = Math.ceil((runs / day) * daysInMonth);
  const base = { runs, projected, monthlyRunLimit };

  if (monthlyRunLimit === null) {
    return {
      ...base,
      level: 'observed',
      message:
        `${runs} GitHub Actions workflow runs recorded this month (projected ${projected}). No run-count ` +
        `threshold is configured. This does not measure billed Actions minutes or Cloudflare Pages builds.`,
    };
  }

  const left = monthlyRunLimit - runs;

  if (runs >= monthlyRunLimit) {
    return {
      ...base,
      level: 'limit',
      message:
        `${runs} GitHub Actions workflow runs this month reached the configured run-count threshold of ` +
        `${monthlyRunLimit}. This is an alert on run volume, not billed Actions minutes or Cloudflare Pages builds.`,
    };
  }

  if (runs >= monthlyRunLimit * warnAtFraction) {
    return {
      ...base,
      level: 'warn',
      message:
        `${runs} GitHub Actions workflow runs this month, ${left} left of the configured run-count threshold ` +
        `of ${monthlyRunLimit}. This is run volume only; it does not measure billed minutes or Pages builds.`,
    };
  }

  if (day >= projectFromDay && projected >= monthlyRunLimit) {
    return {
      ...base,
      level: 'warn',
      message:
        `${runs} GitHub Actions workflow runs by day ${day} is on pace for ${projected}, past the configured ` +
        `run-count threshold of ${monthlyRunLimit}. This is run volume only; it does not measure billed minutes or Pages builds.`,
    };
  }

  return {
    ...base,
    level: 'ok',
    message:
      `${runs} GitHub Actions workflow runs this month, on pace for ${projected} of the configured run-count ` +
      `threshold of ${monthlyRunLimit}. Cloudflare Pages usage is not measured by this check.`,
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

export async function countWorkflowRunsThisMonth({ repo, token, since, fetchImpl = fetch }) {
  const url = `https://api.github.com/repos/${repo}/actions/runs?per_page=1&created=%3E%3D${since}`;
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`GitHub Actions API answered ${response.status}`);
  const body = await response.json();
  if (!Number.isInteger(body?.total_count) || body.total_count < 0) {
    throw new Error('GitHub Actions API returned no valid total_count');
  }
  return body.total_count;
}

export async function inspectCiRunVolume({
  repo,
  token,
  runLimitSetting,
  now = new Date(),
  fetchImpl = fetch,
}) {
  const { since, day, daysInMonth } = monthWindow(now);
  const runLimit = parseMonthlyRunLimit(runLimitSetting);
  if (runLimit.error) return { level: 'unknown', message: runLimit.error };
  if (!repo || !token) {
    return { level: 'unknown', message: 'GitHub Actions run count unavailable: repository or token is missing.' };
  }

  try {
    const runs = await countWorkflowRunsThisMonth({ repo, token, since, fetchImpl });
    return { since, ...decideCiRunVolume({ runs, day, daysInMonth, monthlyRunLimit: runLimit.value }) };
  } catch (error) {
    return {
      level: 'unknown',
      message: `GitHub Actions run count unavailable (${error.message}); no level assigned.`,
    };
  }
}

async function runCli() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const verdict = await inspectCiRunVolume({ repo, token, runLimitSetting: process.env.CI_RUN_COUNT_BUDGET });
  if (verdict.level === 'unknown') {
    console.warn(`::warning::${verdict.message}`);
    return;
  }
  const line = `Actions run-volume alert (${verdict.level}): ${verdict.message}`;
  if (verdict.level === 'ok' || verdict.level === 'observed') console.log(line);
  else console.warn(`::warning::${line}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
