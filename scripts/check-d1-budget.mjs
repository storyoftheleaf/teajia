import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

// Account-wide: every database shares the free daily allowance. Omitting
// databaseId and dimensions asks Cloudflare to aggregate the complete account.
// https://developers.cloudflare.com/d1/observability/metrics-analytics/
export const BUDGET_QUERY = `query D1DailyBudget($accountTag: string!, $start: Date!, $end: Date!) {
  viewer { accounts(filter: { accountTag: $accountTag }) {
    d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date_geq: $start, date_leq: $end }) {
      sum { rowsRead rowsWritten readQueries writeQueries }
    }
  } }
}`;

export function budgetConfig(env = process.env) {
  const positive = (name, fallback) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
    return value;
  };
  const config = {
    reads: positive('D1_DAILY_READ_BUDGET', 5_000_000),
    writes: positive('D1_DAILY_WRITE_BUDGET', 100_000),
    warning: positive('D1_WARNING_FRACTION', 0.7),
    critical: positive('D1_CRITICAL_FRACTION', 0.9),
  };
  if (config.warning >= config.critical || config.critical > 1) {
    throw new Error('D1 thresholds must satisfy 0 < warning < critical <= 1');
  }
  return config;
}

export function assessUsage(payload, config) {
  if (payload?.errors?.length) throw new Error('Cloudflare GraphQL rejected the metrics query; check Analytics Read permission and dataset access');
  const accounts = payload?.data?.viewer?.accounts;
  if (!Array.isArray(accounts) || accounts.length !== 1) throw new Error('Cloudflare did not return the requested account');
  const groups = accounts[0]?.d1AnalyticsAdaptiveGroups;
  if (!Array.isArray(groups) || groups.length === 0) throw new Error('No D1 metrics returned; usage is unknown, not zero');
  if (groups.length >= 10000) throw new Error('D1 metrics may be truncated; refusing an incomplete total');
  const totals = { rowsRead: 0, rowsWritten: 0, readQueries: 0, writeQueries: 0 };
  for (const group of groups) {
    for (const key of Object.keys(totals)) {
      const value = group?.sum?.[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`D1 metrics missing or invalid: ${key}`);
      totals[key] += value;
    }
  }
  const readFraction = totals.rowsRead / config.reads;
  const writeFraction = totals.rowsWritten / config.writes;
  const highest = Math.max(readFraction, writeFraction);
  return { status: highest >= config.critical ? 'critical' : highest >= config.warning ? 'warning' : 'ok', ...totals, readFraction, writeFraction, budgets: config };
}

export async function checkBudget({ env = process.env, now = new Date(), fetchImpl = fetch } = {}) {
  const checkedAt = now.toISOString();
  const utcDay = checkedAt.slice(0, 10);
  try {
    const config = budgetConfig(env);
    if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required');
    const response = await fetchImpl('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: BUDGET_QUERY, variables: { accountTag: env.CLOUDFLARE_ACCOUNT_ID, start: utcDay, end: utcDay } }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Cloudflare metrics HTTP ${response.status}; check credentials and Analytics Read permission`);
    let payload;
    try { payload = await response.json(); } catch { throw new Error('Cloudflare metrics response was not JSON'); }
    return { checkedAt, utcDay, ...assessUsage(payload, config) };
  } catch (error) {
    // Do not persist the request, headers, or provider body (which can contain
    // credentials or query details). Unknown is a failing monitor state.
    const safe = error instanceof Error && /^(D1 |Cloudflare |No D1 |CLOUDFLARE_)/.test(error.message);
    return { checkedAt, utcDay, status: 'unknown', error: safe ? error.message : 'Unable to retrieve D1 metrics (network, timeout, or unexpected failure)' };
  }
}

export function summary(report) {
  const lines = [`# D1 daily budget: ${report.status}`, '', `Checked: ${report.checkedAt}`, `UTC day: ${report.utcDay}`, ''];
  if (report.status === 'unknown') lines.push(report.error);
  else {
    lines.push(`Rows read: ${report.rowsRead.toLocaleString('en-US')} / ${report.budgets.reads.toLocaleString('en-US')} (${(report.readFraction * 100).toFixed(1)}%)`,
      `Rows written: ${report.rowsWritten.toLocaleString('en-US')} / ${report.budgets.writes.toLocaleString('en-US')} (${(report.writeFraction * 100).toFixed(1)}%)`,
      `Queries: ${report.readQueries.toLocaleString('en-US')} read, ${report.writeQueries.toLocaleString('en-US')} write`);
  }
  lines.push('', 'Account-wide Cloudflare analytics; no application database query was issued.',
    'Analytics may lag. A successful check is not a guarantee of remaining capacity.',
    'Warning/critical: inspect D1 Metrics and query Insights, contain the source of excess usage, and review the plan before changing budgets.',
    'Unknown: repair monitor access; do not assume usage is healthy.', '');
  return lines.join('\n');
}

export async function main(env = process.env) {
  const report = await checkBudget({ env });
  const outputDir = resolve(env.D1_BUDGET_OUTPUT_DIR || 'outputs/d1-budget');
  await mkdir(outputDir, { recursive: true });
  const readable = summary(report);
  await writeFile(resolve(outputDir, 'usage.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(resolve(outputDir, 'usage.md'), readable);
  if (env.GITHUB_STEP_SUMMARY) {
    await mkdir(dirname(env.GITHUB_STEP_SUMMARY), { recursive: true });
    await appendFile(env.GITHUB_STEP_SUMMARY, readable);
  }
  console.log(readable);
  return { ok: 0, warning: 1, critical: 2, unknown: 3 }[report.status];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
