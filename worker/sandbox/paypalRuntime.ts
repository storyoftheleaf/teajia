/** Disposable local database + real PayPal Sandbox transport. Never connects to live D1 or PayPal. */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import worker from '../src/index';
import { SqliteD1 } from '../tests/helpers/sqliteD1';
import { sandboxOperatorStatements } from './operator-fixture.mjs';

const apiPort = Number(process.env.TEAJIA_PAYPAL_API_PORT || '18901');
const appPort = Number(process.env.TEAJIA_PAYPAL_APP_PORT || '17929');
for (const port of [apiPort, appPort]) if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use a local sandbox port between 1024 and 65535.');
const db = new SqliteD1('migrations');
db.exec(`INSERT INTO accounts(id,slug,name,status,public_enabled,owner_user_id,default_shipping_rate_per_kg,default_shipping_rate_currency)
  VALUES('acc_teajia_bali','teajia-bali','Teajia PayPal Sandbox','active',1,NULL,0,'USD'),('acc_teajia_australia','australia','Sandbox Australia','active',0,NULL,0,'USD');`);
for (const statement of sandboxOperatorStatements) db.exec(statement);
db.exec(`UPDATE accounts SET owner_user_id='sandbox-operator';
 INSERT OR REPLACE INTO exchange_rates(currency,rate_to_usd) VALUES('USD',1),('IDR',16000),('Yuan',7.1);
 INSERT INTO products(id,account_id,type,product_name,form,cost_amount,cost_currency,quantity_purchased,stock_grams,stock_known_at,status,is_public,shown_in_shop,shipping_rate_per_kg,markup_multiplier)
 VALUES('paypal-test-tea','acc_teajia_bali','Red','PayPal sandbox tea','Loose',20,'USD',300,1000,datetime('now'),'Active',1,1,NULL,NULL);`);
const env = {
 DB: db, JWT_SECRET: randomBytes(32).toString('hex'), APP_URL: `http://127.0.0.1:${appPort}`,
 PAYPAL_SANDBOX_ENABLED: 'true', PAYPAL_SANDBOX_ACCOUNT_ID: 'acc_teajia_bali',
 PAYPAL_SANDBOX_CLIENT_ID: process.env.PAYPAL_SANDBOX_CLIENT_ID,
 PAYPAL_SANDBOX_CLIENT_SECRET: process.env.PAYPAL_SANDBOX_CLIENT_SECRET,
 PAYPAL_SANDBOX_MERCHANT_ID: process.env.PAYPAL_SANDBOX_MERCHANT_ID,
 INQUIRY_LIMITER: { limit: async () => ({ success: true }) },
};
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input: any, init?: any) => {
 const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
 if (url.origin !== 'https://api-m.sandbox.paypal.com') throw new Error('The local sandbox blocks other external services.');
 return nativeFetch(input, { ...init, redirect: 'error' });
};
const server = createServer(async (request, response) => {
 try {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > 2_000_000) throw new Error('Request too large'); chunks.push(chunk); }
  const body = Buffer.concat(chunks);
  const result = await worker.fetch(new Request(`http://127.0.0.1:${apiPort}${request.url}`, {
   method: request.method, headers: request.headers as any, ...(body.length ? { body: body.toString() } : {}),
  }), env as any, {} as any);
  response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(Buffer.from(await result.arrayBuffer()));
 } catch { response.writeHead(503, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'The local sandbox request could not be completed.' })); }
});
server.listen(apiPort, '127.0.0.1', () => console.log(`Disposable PayPal Sandbox API: http://127.0.0.1:${apiPort}. Frontend: http://127.0.0.1:${appPort}. Sign in sandbox / sandbox. No live bank, shipping rate or database is loaded.`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
