import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const worker = dirname(dirname(fileURLToPath(import.meta.url)));
const required = ['PAYPAL_SANDBOX_CLIENT_ID', 'PAYPAL_SANDBOX_CLIENT_SECRET', 'PAYPAL_SANDBOX_MERCHANT_ID'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error(`Missing sandbox configuration: ${missing.join(', ')}. Load these securely through Infisical; do not paste credentials into chat.`);
  process.exit(1);
}
const cache = join(worker, '.wrangler', 'paypal-sandbox-runtime');
mkdirSync(cache, { recursive: true });
const runtime = join(cache, 'server.cjs');
await build({
  entryPoints: [join(worker, 'sandbox', 'paypalRuntime.ts')], outfile: runtime,
  bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
  define: { 'import.meta.url': JSON.stringify(pathToFileURL(join(worker, 'tests/helpers/migratedSqlite.ts')).href) },
});
// The generated bundle contains code only. Credentials remain in process memory.
const child = spawn(process.execPath, ['--experimental-sqlite', runtime], { cwd: dirname(worker), env: process.env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 1; });
