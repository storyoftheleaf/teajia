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

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(), cacheDir:`/tmp/teajia-intake-test-${process.pid}`, logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false },
    plugins: [{
      name: 'intake-workspace-test-page',
      configureServer(vite) {
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
  page = await browser.newPage();
  await page.goto(`${origin}/__intake-workspace-test`);
  await page.waitForFunction(() => Boolean((window as any).intakeWorkspaceTest));
  await page.evaluate(() => (window as any).intakeWorkspaceTest.mount());
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
    expect(await page.getByRole('button', {name:/Add 1 to inventory/}).count()).toBe(1);
    expect(await page.evaluate(() => (window as any).intakeWorkspaceTest.abandonCalls())).toBe(0);
    expect(await page.getByText('(missing: amount)').count(),
      'the raw server marker leaked onto the screen instead of the plain-words sentence').toBe(0);
  });

  it('retries a failed purchase record without creating inventory products again or closing the draft early', async () => {
    await open();
    await page.evaluate(() => {
      (window as any).intakeWorkspaceTest.setBulkCreateResult({ inserted: 1, skipped: 0, results: [] });
      (window as any).intakeWorkspaceTest.failPurchase();
    });
    const csv = 'Product Name,Type,Cost Amount,Cost Currency,Vendor,Quantity Purchased\nTest Tea,Oolong,5,USD,Lin,10\n';
    await page.setInputFiles('input[type="file"]', { name: 'intake.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: /Add 1 to inventory/ }).click();
    await page.getByRole('button', { name: /Retry 1 purchase record/ }).waitFor();
    expect(await page.evaluate(() => (window as any).intakeWorkspaceTest.bulkCalls())).toBe(1);
    expect(await page.evaluate(() => (window as any).intakeWorkspaceTest.purchaseCalls().length)).toBe(1);
    expect(await page.evaluate(() => (window as any).intakeWorkspaceTest.abandonCalls())).toBe(0);
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect.poll(() => page.getByRole('button', { name: /Retry 1 purchase record/ }).isEnabled()).toBe(true);
    await page.getByRole('button', { name: /Retry 1 purchase record/ }).click();
    await expect.poll(() => page.evaluate(() => (window as any).intakeWorkspaceTest.purchaseCalls().length)).toBe(2);
    expect(await page.evaluate(() => (window as any).intakeWorkspaceTest.bulkCalls())).toBe(1);
    await expect.poll(() => page.evaluate(() => (window as any).intakeWorkspaceTest.abandonCalls())).toBe(1);
  });
  it('restores spreadsheet fields and shipping metadata after remounting the saved draft', async()=>{
    await open();
    await page.setInputFiles('input[type="file"]',{name:'costs.csv',mimeType:'text/csv',buffer:Buffer.from('Product Name,Type,Cost Amount,Cost Currency,Vendor,Quantity Purchased,Stock\nSaved Tea,Oolong,40,USD,Lin,100,100\n')});
    await page.getByPlaceholder('Unnamed item').fill('Corrected Tea');
    await page.getByPlaceholder('Total',{exact:true}).fill('12');
    await page.getByRole('button',{name:'Save now'}).click();
    await expect.poll(()=>page.evaluate(()=>(window as any).intakeWorkspaceTest.savedDraft()?.items?.[0]?.givenName)).toBe('Corrected Tea');
    await page.evaluate(()=>(window as any).intakeWorkspaceTest.mount(false));
    await expect.poll(()=>page.getByPlaceholder('Unnamed item').inputValue()).toBe('Corrected Tea');
    expect(await page.getByPlaceholder('Total',{exact:true}).inputValue()).toBe('12');
    const saved=await page.evaluate(()=>(window as any).intakeWorkspaceTest.savedDraft());
    expect(saved.items[0]).toMatchObject({costAmount:40,costCurrency:'USD',vendor:'Lin',quantityPurchased:100});
  });
  it('restores pending purchase follow-ups without re-adding inventory', async()=>{
    await open();
    await page.evaluate(()=>(window as any).intakeWorkspaceTest.failPurchase());
    await page.setInputFiles('input[type="file"]',{name:'costs.csv',mimeType:'text/csv',buffer:Buffer.from('Product Name,Type,Cost Amount,Cost Currency,Vendor,Quantity Purchased,Stock\nSaved Tea,Oolong,40,USD,Lin,100,100\n')});
    await page.getByRole('button',{name:/Add 1 to inventory/}).click();
    await page.getByRole('button',{name:/Retry 1 purchase record/}).waitFor();
    await page.evaluate(()=>(window as any).intakeWorkspaceTest.mount(false));
    await page.getByRole('button',{name:/Retry 1 purchase record/}).click();
    await expect.poll(()=>page.evaluate(()=>(window as any).intakeWorkspaceTest.purchaseCalls().length)).toBe(1);
    expect(await page.evaluate(()=>(window as any).intakeWorkspaceTest.bulkCalls())).toBe(0);
    const purchase=await page.evaluate(()=>(window as any).intakeWorkspaceTest.purchaseCalls()[0]);
    expect(purchase.total_usd).toBe(40);
    expect(JSON.parse(purchase.items_json)[0]).toMatchObject({product_id:'product-0',quantity:100,unit:'g',total_cost:40,source_movement_id:'ledger-0'});
  });

  it('keeps caret navigation inside an edited product and retains a failed field for retry',async()=>{
    await open();
    await page.evaluate(()=>(window as any).intakeWorkspaceTest.mountEditor());
    const field=page.getByRole('textbox',{name:'Given name',exact:true});
    await field.fill('Clear Sky');await field.press('ArrowLeft');
    expect(await field.inputValue()).toBe('Clear Sky');
    await page.evaluate(()=>(window as any).intakeWorkspaceTest.failSave());
    await field.press('Tab');
    await page.getByRole('button',{name:'Retry save',exact:true}).waitFor();
    expect(await field.inputValue()).toBe('Clear Sky');
    await page.getByRole('button',{name:'Retry save',exact:true}).click();
    await expect.poll(()=>page.getByRole('button',{name:'Retry save',exact:true}).count()).toBe(0);
    expect(await field.inputValue()).toBe('Clear Sky');
  });

});
