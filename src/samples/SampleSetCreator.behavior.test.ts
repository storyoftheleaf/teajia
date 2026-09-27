import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

/**
 * Item 4: a cost refusal must reach the operator in plain words, and nothing
 * catches it if that call is quietly removed. This drives the real
 * "Graduate to inventory" click in a real browser (the confirm dialog, the
 * server's rejection, the resulting alert) and asserts on the alert text, so
 * deleting the `plainCostWords(...)` call in `runGraduation`'s catch block
 * fails this test.
 */
let server: ViteDevServer; let browser: Browser; let page: Page; let origin: string;

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'silent', server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'sample-set-creator-test-page',
      configureServer(vite) {
        vite.middlewares.use('/__sample-set-creator-test', async (_req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(await vite.transformIndexHtml('/__sample-set-creator-test',
            '<div id="root"></div><script type="module" src="/src/samples/SampleSetCreator.behavior.harness.tsx"></script>'));
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
  await page.goto(`${origin}/__sample-set-creator-test`);
  await page.waitForFunction(() => Boolean((window as any).sampleSetCreatorTest));
  await page.evaluate(() => (window as any).sampleSetCreatorTest.mount());
}

describe('SampleSetCreator cost refusal in plain words', () => {
  it('shows the operator plain words, not the raw server marker, when graduation is refused', async () => {
    await open();
    await page.evaluate(() => (window as any).sampleSetCreatorTest.setCreateError('cost_amount (missing: amount)'));

    const dialogMessages: string[] = [];
    page.on('dialog', async (dialog) => { dialogMessages.push(dialog.message()); await dialog.accept(); });

    // The component opens on the batches list; open the seeded batch to reach
    // its sample cards, where the Graduate action lives.
    await expect.poll(() => page.getByRole('button', { name: /Test batch/ }).count(),
      { message: 'the seeded batch card never rendered' }).toBeGreaterThan(0);
    await page.getByRole('button', { name: /Test batch/ }).first().click();

    await expect.poll(() => page.locator('button[title="Graduate to inventory"]').count(),
      { message: 'the seeded sample never rendered a Graduate action' }).toBeGreaterThan(0);
    await page.locator('button[title="Graduate to inventory"]').first().click();

    // Two dialogs: the window.confirm prompt, then the window.alert with the
    // refusal. Wait for both before reading them back.
    await expect.poll(() => dialogMessages.length,
      { message: 'the alert with the refusal never appeared' }).toBeGreaterThanOrEqual(2);

    const alertMessage = dialogMessages[1];
    expect(alertMessage, 'the operator-facing plain-words sentence never reached the alert')
      .toContain('What did this cost? Enter the price, or 0 if it was a gift.');
    expect(alertMessage, 'the raw server marker leaked into the alert instead of the plain-words sentence')
      .not.toContain('(missing: amount)');
  });
});
