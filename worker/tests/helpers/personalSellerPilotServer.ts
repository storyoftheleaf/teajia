/**
 * Serve the real Worker on loopback for the opt-in synthetic browser walk.
 * From the repository root, bundle with esbuild --bundle --platform=node --format=esm
 * and run the output with Node 22 and --experimental-sqlite.
 */
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import worker from '../../src/index';
import { SqliteD1 } from './sqliteD1';
import { createSeller, json, jun, mei, offer, pilotEnv, privateLabel, request } from './personalSellerPilot';

const host = '127.0.0.1';
const port = Number(process.env.PERSONAL_PILOT_API_PORT || 8843);
const origin = `http://${host}:${port}`;
const appUrl = process.env.PERSONAL_PILOT_APP_URL || 'http://127.0.0.1:7842';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(appUrl)) throw new Error('The pilot site must bind to loopback');

globalThis.fetch = async () => { throw new Error('The synthetic pilot cannot contact external services'); };
const db = new SqliteD1('migrations', undefined, resolve('worker/migrations'));
const env = pilotEnv(db, appUrl);

async function browserSeller(person: typeof mei) {
  const seller = await createSeller(db, person);
  const { token } = await json<{ token: string }>(await request(db, '/api/accounts/switch', {
    actor: seller.actor, method: 'POST', body: { account_id: seller.actor.accountId },
  }));
  return {
    name: person.name, profile: person.profile, destination: person.destination,
    slug: seller.slug, holdingId: seller.holdingId, accountId: seller.actor.accountId, token,
  };
}

const fixture = { seller: await browserSeller(mei), other: await browserSeller(jun), offer, privateLabel };

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/pilot-test-fixtures') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(fixture));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    const request = new Request(new URL(req.url || '/', origin), {
      method: req.method,
      headers: new Headers(Object.entries(req.headers).map(([name, value]) => [name, String(value ?? '')])),
      ...(body.length ? { body } : {}),
    });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end();
  }
});

server.listen(port, host, () => console.log(`Synthetic personal seller Worker ready at ${origin}`));
function close() {
  server.close(() => db.close());
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
