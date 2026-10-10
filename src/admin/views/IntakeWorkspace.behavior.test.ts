import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

/**
 * Item 4: a cost refusal must reach the operator in plain words, and nothing
 * catches it if that call is quietly removed. This drives the actual bulk
 * intake flow in a real browser (file upload, "Add to inventory" click, the
 * server's skipped-row response) and asserts on the toast that lands, so
 * deleting the `plainCostWords(...)` call at this call site fails this test.
 */
let server: ViteDevServer; let browser: Browser; let page: Page; let origin: string;
let persistedPlan: any = null;
const operationCalls: Array<{ kind: string; payload: any }> = [];
let purchaseFailures = 0;
let getFailures = 0;
let bulkResult: any = { inserted: 1, skipped: 0, results: [] };

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false },
    plugins: [{
      name: 'intake-workspace-test-page',
      configureServer(vite) {
        vite.middlewares.use('/__intake-operations', (req, res) => {
          const send = (status: number, value: any) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
          if (req.method === 'GET') return send(200, { plan: persistedPlan, calls: operationCalls });
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            const { kind, payload } = JSON.parse(body);
            if (kind === 'reset') { persistedPlan = null; operationCalls.length = 0; purchaseFailures = 0; getFailures = 0; bulkResult = { inserted: 1, skipped: 0, results: [] }; return send(200, {}); }
            if (kind === 'configure') { purchaseFailures = payload.purchaseFailures ?? purchaseFailures; getFailures = payload.getFailures ?? getFailures; bulkResult = payload.bulkResult ?? bulkResult; return send(200, {}); }
            if (kind === 'get') { if (getFailures-- > 0) return send(503, { error: 'Lookup unavailable' }); return persistedPlan ? send(200, persistedPlan) : send(404, { error: 'No plan' }); }
            if (kind === 'save') { persistedPlan = { id: 'test-import', account_id: 'test-account', status: 'pending', ...payload }; operationCalls.push({ kind, payload }); return send(200, persistedPlan); }
            if (kind === 'bulk') { operationCalls.push({ kind, payload }); return send(200, bulkResult); }
            if (kind === 'purchase') { operationCalls.push({ kind, payload }); if (purchaseFailures-- > 0) return send(503, { error: 'Purchase record unavailable' }); return send(200, { id: 'purchase-1' }); }
            if (kind === 'complete') { operationCalls.push({ kind, payload }); persistedPlan.status = 'completed'; return send(200, { success: true }); }
            return send(400, { error: 'Unknown operation' });
          });
        });
        vite.middlewares.use('/__intake-workspace-test', async (_req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(await vite.transformIndexHtml('/__intake-workspace-test',
            '<div id="root"></div><script type="module" src="/src/admin/views/IntakeWorkspace.behavior.harness.tsx"></script>'));
        });
      },
    }],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
}, 30_000);

afterAll(async () => { await browser?.close(); await server?.close(); }, 30_000);
afterEach(async () => { await page?.close(); });

async function open() {
  await fetch(`${origin}/__intake-operations`, { method: 'POST', body: JSON.stringify({ kind: 'reset' }) });
  page = await browser.newPage();
  await page.goto(`${origin}/__intake-workspace-test`);
  await page.waitForFunction(() => Boolean((window as any).intakeWorkspaceTest));
  await page.evaluate(() => (window as any).intakeWorkspaceTest.mount());
}

async function calls() {
  const result = await fetch(`${origin}/__intake-operations`).then(response => response.json());
  return result.calls as Array<{ kind: string; payload: any }>;
}

describe('IntakeWorkspace cost refusal in plain words', () => {
  it('shows the operator plain words, not the raw server marker, when a line is skipped for its cost', async () => {
    await open();
    await page.evaluate(() => (window as any).intakeWorkspaceTest.setBulkCreateResult({
      inserted: 0, skipped: 1,
      results: [{ status: 'skipped', reason: 'cost_amount (missing: amount)' }],
    }));

    const csv = 'Product Name,Type\nTest Tea,Oolong\n';
    await page.setInputFiles('input[type="file"]', {
      name: 'intake.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
    });
    await expect.poll(() => page.getByRole('button', { name: /to inventory/ }).count(),
      { message: 'the row never staged, so the commit button never appeared' }).toBeGreaterThan(0);
    await page.getByRole('button', { name: /to inventory/ }).click();

    await expect.poll(() => page.getByText(
      'What did this cost? Enter the price, or 0 if it was a gift.', { exact: false },
    ).count(), { message: 'the operator-facing plain-words sentence never reached the toast' }).toBeGreaterThan(0);
    expect(await page.getByText('(missing: amount)').count(),
      'the raw server marker leaked onto the screen instead of the plain-words sentence').toBe(0);
  });

  it('resumes a saved import after reload with the same inventory label and purchase key', async () => {
    await open();
    await page.evaluate(async () => {
      await (window as any).intakeWorkspaceTest.setBulkCreateResult({ inserted: 1, skipped: 0, results: [] });
      await (window as any).intakeWorkspaceTest.failPurchase();
    });
    const csv = 'Product Name,Type,Cost Amount,Cost Currency,Vendor,Quantity Purchased\nTest Tea,Oolong,5,USD,Lin,10\n';
    await page.setInputFiles('input[type="file"]', { name: 'intake.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: /Add 1 to inventory/ }).click();
    await page.getByRole('button', { name: 'Resume import' }).waitFor();
    expect((await calls()).map(call => call.kind)).toEqual(['save', 'bulk', 'purchase']);
    expect(await page.evaluate(() => (window as any).intakeWorkspaceTest.abandonCalls())).toBe(0);
    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).intakeWorkspaceTest));
    await page.evaluate(() => (window as any).intakeWorkspaceTest.mount('/admin/intake?importId=test-import'));
    await page.getByRole('button', { name: 'Resume import' }).waitFor();
    expect(await page.getByRole('button', { name: 'Clear all' }).count()).toBe(0);
    await page.getByRole('button', { name: 'Resume import' }).click();
    await expect.poll(async () => (await calls()).filter(call => call.kind === 'complete').length).toBe(1);
    const all = await calls();
    expect(all.map(call => call.kind)).toEqual(['save', 'bulk', 'purchase', 'bulk', 'purchase', 'complete']);
    expect(all.filter(call => call.kind === 'bulk').map(call => call.payload.receiptLabel)).toEqual(['Intake test-import part 1', 'Intake test-import part 1']);
    expect(all.filter(call => call.kind === 'purchase').map(call => call.payload.idempotency_key)).toEqual(['intake:test-import:po:0', 'intake:test-import:po:0']);
    await expect.poll(() => page.evaluate(() => (window as any).intakeWorkspaceTest.abandonCalls())).toBe(1);
    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).intakeWorkspaceTest));
    await page.evaluate(() => (window as any).intakeWorkspaceTest.mount('/admin/intake?importId=test-import'));
    await expect.poll(() => page.evaluate(() => (window as any).intakeWorkspaceTest.abandonCalls())).toBe(1);
    expect(await page.getByRole('button', { name: /to inventory/ }).count()).toBe(0);
    expect((await calls()).filter(call => call.kind === 'save')).toHaveLength(1);
  });

  it('blocks a new commit when the saved plan lookup fails, then allows a retry', async () => {
    await open();
    await page.locator('[data-plan-lookup="ready"]').waitFor();
    await page.evaluate(() => (window as any).intakeWorkspaceTest.failLookup());
    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).intakeWorkspaceTest));
    await page.evaluate(() => (window as any).intakeWorkspaceTest.mount('/admin/intake?importId=test-import'));
    await page.getByRole('alert').filter({ hasText: 'Could not check this import' }).waitFor();
    expect(await page.getByRole('button', { name: /to inventory/ }).count()).toBe(0);
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('button', { name: 'Browse files' }).waitFor();
  });
});
