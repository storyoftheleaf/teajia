import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OPEN_STATUSES = new Set(['open', 'acknowledged', 'repairing', 'observing']);
const SEVERITIES = ['critical', 'high', 'medium', 'low'];

export function buildIncidentNotification({
  changedCount,
  incidents,
  deployment = 'unknown',
  repositoryPath = 'ops/incidents/OPEN.md',
}) {
  const totals = Object.fromEntries(SEVERITIES.map(severity => [severity, 0]));
  for (const incident of incidents) {
    if (OPEN_STATUSES.has(incident?.status) && incident.severity in totals) totals[incident.severity] += 1;
  }
  const changed = Number.isInteger(changedCount) && changedCount >= 0 ? changedCount : 0;
  const safeDeployment = String(deployment).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) || 'unknown';
  const safePath = String(repositoryPath).replace(/[^a-zA-Z0-9._/-]/g, '').slice(0, 160) || 'ops/incidents/OPEN.md';
  return [
    '# Teajia incidents ready',
    '',
    `${changed} changed signature${changed === 1 ? '' : 's'} · Critical: ${totals.critical} · High: ${totals.high} · Medium: ${totals.medium} · Low: ${totals.low}`,
    `Deployment: \`${safeDeployment}\` · Queue: \`${safePath}\``,
  ].join('\n');
}

export async function notifyI64OS({ message, endpoint, token, fetchImpl = fetch }) {
  if (!endpoint || !token) return { sent: false, reason: 'not-configured' };
  let url;
  try { url = new URL(endpoint); } catch { throw new Error('i64 OS capture endpoint is invalid'); }
  if (url.protocol !== 'https:') throw new Error('i64 OS capture endpoint must use HTTPS');

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ source: 'teajia', kind: 'system-incident', content: message }),
  });
  if (!response.ok) throw new Error(`i64 OS capture endpoint returned HTTP ${response.status}`);
  return { sent: true };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const changedIndex = args.indexOf('--changed-count');
  const deploymentIndex = args.indexOf('--deployment');
  const raw = await readStdin();
  const input = JSON.parse(raw);
  const incidents = Array.isArray(input) ? input : input?.incidents;
  if (!Array.isArray(incidents)) throw new TypeError('Incident input must contain an incidents array');

  const message = buildIncidentNotification({
    changedCount: Number(changedIndex >= 0 ? args[changedIndex + 1] : 0),
    incidents,
    deployment: deploymentIndex >= 0 ? args[deploymentIndex + 1] : process.env.GITHUB_SHA,
  });
  const result = await notifyI64OS({
    message,
    endpoint: process.env.I64OS_CAPTURE_ENDPOINT,
    token: process.env.I64OS_CAPTURE_TOKEN,
  });
  process.stdout.write(result.sent ? 'i64 OS incident notification sent\n' : 'i64 OS notification not configured; skipped\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch(error => {
  process.stderr.write(`i64 OS incident notification failed: ${error.message}\n`);
  process.exitCode = 1;
});
