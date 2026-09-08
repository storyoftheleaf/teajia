import { test, expect, type Page } from '@playwright/test';

/**
 * The cost prompt a sample passes through on its way to the shelf.
 *
 * A sample record holds a name, a weight and a source, and nothing about what
 * was paid. Graduating one used to send `cost_amount: 0, cost_currency: 'NT'`,
 * so the tea landed free and priced at zero times three. Sending nothing is
 * honest and the server refuses it by name, which on its own would make every
 * graduation fail, so the screen asks once, here, and only when the capture
 * card does not already hold the answer.
 *
 * Not part of `npm run test:mobile`: it needs a local API and a signed-in
 * admin. Run it against a sandbox you started yourself:
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:7791 npx playwright test tests/graduation-cost-prompt.spec.ts --project=Desktop
 */

const TOKEN_PAYLOAD = {
  sub: 'sandbox-operator',
  email: 'sandbox@localhost',
  name: 'Sandbox Operator',
  role: 'owner',
  platform_role: 'platform_owner',
  memberships: [{
    account_id: 'acc_teajia_bali', account_name: 'Teajia Bali', account_slug: 'bali',
    role: 'owner', bundles: ['stock', 'sell', 'publish', 'curate'],
  }],
  active_account_id: 'acc_teajia_bali',
  session_version: 0,
};

async function signIn(page: Page) {
  await page.addInitScript((payload) => {
    const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const now = Math.floor(Date.now() / 1000);
    const token = [
      b64({ alg: 'HS256', typ: 'JWT' }),
      b64({ ...(payload as Record<string, unknown>), iat: now, exp: now + 86400 }),
      'local-sandbox-only',
    ].join('.');
    localStorage.setItem('teajia_token', token);
    localStorage.setItem('teajia_active_account', 'acc_teajia_bali');
  }, TOKEN_PAYLOAD);
}

/* Skipped unless you point it at a sandbox you started. The managed dev server
   the rest of the suite uses answers every API call from a mock, and this walk
   needs a signed-in admin and a real local worker, so running it there would
   fail for the environment rather than for the behaviour. A test that goes red
   for the wrong reason gets ignored, and then so do the others. */
const sandbox = process.env.PLAYWRIGHT_BASE_URL;
test.skip(!sandbox, 'needs a local sandbox: set PLAYWRIGHT_BASE_URL');

test('a sample cannot reach the shelf without saying what it cost', async ({ page }) => {
  await signIn(page);
  page.on('dialog', dialog => dialog.accept());

  await page.goto('/admin/compass?sampleOrder=manage');

  await page.getByRole('button', { name: 'New batch' }).click();
  await page.getByPlaceholder('e.g. July Wuyi samples').fill('Wuyi envelope samples');
  await page.getByRole('button', { name: 'Create batch' }).click();

  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByPlaceholder('e.g. Tie Guan Yin, Da Hong Pao…').fill('Shui Xian');
  await page.getByRole('button', { name: 'Add sample' }).click();
  // The sheet stays open for the next sample; close it to reach the list.
  await page.getByRole('button', { name: 'Close' }).last().click();
  await expect(page.getByRole('button', { name: 'Add sample' })).toHaveCount(0);

  // The graduate control only appears once a sample is worth ordering, so walk
  // the status button round to Favorite.
  const statusButton = page.getByTitle('Click to change status').first();
  for (let i = 0; i < 8; i++) {
    if ((await statusButton.innerText()).trim().toLowerCase().startsWith('favorite')) break;
    await statusButton.click();
  }

  await page.getByTitle('Graduate to inventory').first().click();

  // The prompt: a question, a currency, a price, and what a zero means.
  const prompt = page.getByText('What did this cost?');
  await expect(prompt).toBeVisible();
  await expect(page.getByText('Enter 0 if it was a gift.')).toBeVisible();
  await expect(page.getByLabel('Price paid')).toBeVisible();

  // Yuan by default, because nobody chose a currency on this entry.
  await expect(page.getByLabel('Currency').last()).toHaveValue('Yuan');

  /* Let the sheet finish arriving before the picture is taken, and prove it is
     ON TOP rather than merely present: an element behind another one passes
     every check a test usually makes and is still unreadable. */
  await page.waitForTimeout(600);
  const box = await prompt.boundingBox();
  expect(box, 'the prompt has no box on screen').not.toBeNull();
  const onTop = await prompt.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el.contains(hit) || (hit ? hit.contains(el) : false);
  });
  expect(onTop, 'something is drawn over the prompt').toBe(true);

  await page.screenshot({ path: 'test-results/graduation-cost-prompt/asks.png', fullPage: false });

  // Empty is not an answer, and saying so is the point.
  await page.getByRole('button', { name: 'Add to inventory' }).click();
  await expect(page.getByText('Leaving it empty is not an answer.')).toBeVisible();
  await page.screenshot({ path: 'test-results/graduation-cost-prompt/empty-refused.png', fullPage: false });

  // A gift is a real tea.
  await page.getByLabel('Price paid').fill('0');
  await page.screenshot({ path: 'test-results/graduation-cost-prompt/zero-is-an-answer.png', fullPage: false });
});
