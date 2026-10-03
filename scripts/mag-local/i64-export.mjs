// Reuse i64 OS's authenticated client and Infisical launcher; never persist credentials.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
export async function callI64(config, request) {
  const repo = path.resolve(config.repoRoot);
  const launcher = fs.readFileSync(path.join(repo, 'apps/mcp/launch.sh'), 'utf8');
  const command = 'node --import tsx apps/mcp/src/index.ts';
  if (!launcher.includes(command)) throw Error('i64 OS launcher changed; export needs review.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mag-i64-'));
  const input = path.join(dir, 'request.json');
  fs.writeFileSync(input, JSON.stringify({ ...request, config }), { mode: 0o600 });
  // Keep launcher cwd and credential resolution exactly as i64 OS defines them.
  const script = launcher.replace('cd "$(dirname "$0")/../.."', 'cd ' + quote(repo))
    .replaceAll(command, 'node --import tsx ' + quote(path.join(here, 'i64-worker.mjs')) + ' ' + quote(input));
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn('/bin/sh', ['-c', script], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', bytes => { output += bytes; if (output.length > 100000) child.kill(); });
      // Infisical diagnostics can contain environment values; never log or return them.
      child.stderr.resume();
      const timer = setTimeout(() => child.kill(), 90000);
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('close', code => {
        clearTimeout(timer);
        const line = output.split('\n').findLast(line => line.startsWith('MAG_I64_RESULT '));
        if (!line) return reject(Error(`i64 OS export could not authenticate or connect (exit ${code}). Local transcript is safe; retry export.`));
        const result = JSON.parse(line.slice(15));
        if (result.error) reject(Error(result.error + (result.diagnostic ? ' ' + result.diagnostic : ''))); else resolve(result);
      });
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
export async function exportTranscript(config, job, { markdown, stateKey = 'i64-export' }) {
  if (!/^[a-zA-Z0-9.-]+$/.test(stateKey)) throw Error('Invalid export state key.');
  const stateFile = path.join(job.output, stateKey + '.json');
  const previous = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
  const result = await callI64(config.i64Export, { action: 'export', job: { id: job.id, story: job.story }, markdown, previous });
  const temp = stateFile + '.part';
  fs.writeFileSync(temp, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 }); fs.renameSync(temp, stateFile);
  return result;
}
