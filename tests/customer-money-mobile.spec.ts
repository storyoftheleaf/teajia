/**
 * The two pages where a customer handles money, on a phone.
 *
 * Viewport: Pixel 5 (393x851) via the Mobile Chrome project.
 *
 * These exist because of a defect that shipped on 2026-08-31 and was found by
 * opening the live site by hand. The order summary on the payment page sized
 * itself to the longest tea name and carried the amount 208px past the right
 * edge of a 375px screen, so a customer could not see what they were paying for.
 *
 * Everything missed it. Static markup cannot measure a layout, so no unit test
 * could. An adversarial review reasoned about the classes and judged them
 * correct, which they were in isolation. And the mobile suite's own overflow
 * check missed it too, which is the part worth understanding: it compares the
 * DOCUMENT width against the viewport, and an element that overruns its grid
 * track can be absorbed without the document growing at all. Measured at the
 * time: the block rendered 551px inside a 311px column while the document
 * stayed exactly 375px wide.
 *
 * So the check here is different in kind. It asks whether any laid-out element
 * reaches past the right edge of the screen, which is the question a person
 * actually has when they cannot see the number they came to read.
 */

import { test, expect, type Page } from './fixtures';
import { assertNothingRunsOffScreen } from './helpers/screenEdge';

const TOKEN = 'A7kQ_customer-tracking-token-000000000001';
const INVOICE_REF = 'INV-2201';
const ORDER_REF = 'TJ-1042';
const PAY_URL = `https://www.teajia.com/people/mei-lin/pay?account=teajia-bali&amount=40.00&currency=USD&reference=${INVOICE_REF}`;

/**
 * A tea name at the length the catalogue actually reaches. Anything shorter
 * fits by luck rather than by the layout being right, which is how the original
 * defect passed every eye that looked at it.
 */
const LONG_TEA = '2003 Lao Cong Shui Xian Wuyi Yancha Traditional Charcoal Roast Spring Harvest';

const payment = {
  recipient_slug: 'mei-lin',
  recipient_name: 'Mei Lin',
  pay_url: PAY_URL,
  has_methods: true,
  total_usd: 40,
  paid_usd: 0,
  outstanding_usd: 40,
  claims_pending: 0,
};

const order = {
  ref_number: ORDER_REF,
  items_json: JSON.stringify([
    { id: 'tea-1', name: LONG_TEA, category: 'tea', quantityGrams: 357, pricePerGram: 0.1, totalPrice: 35.7 },
    { id: 'tea-2', name: 'Yiwu Gushu 2019', category: 'tea', quantityGrams: 100, pricePerGram: 0.05, totalPrice: 5 },
  ]),
  status: 'replied',
  total_estimate_usd: 40,
  currency: 'USD',
  created_at: '2026-08-12T09:00:00.000Z',
  payment,
  journey: { stage: 'awaiting_payment', label: 'Waiting for payment', detail: 'Transfer when you are ready.', steps: [] },
};

const methods = {
  contributor: { display_name: 'Mei Lin', portrait_url: null, associations: [] },
  account: { slug: 'teajia-bali', name: 'Teajia Bali' },
  resolution: 'account',
  methods: [{
    id: 'pay-1', account_id: 'acct-bali', method_type: 'bank_transfer', label: 'Bank transfer',
    recipient_name: 'Mei Lin', account_identifier: '8830 1194 2201 5567', instructions: 'Quote the reference shown above.',
    external_url: null, qr_image_url: null, position: 0, is_published: true,
  }],
};

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Navigate, and survive the dev server discovering a dependency mid-run.
 *
 * The payment page is the only route here that pulls in the QR code library, so
 * the first visit in a fresh run can arrive while Vite is still optimising it.
 * The import fails once and the error boundary catches it. That is a dev-server
 * artifact and not a thing a customer can meet: production chunks are built and
 * content-hashed ahead of time, and the separate stale-chunk behaviour has its
 * own spec. One reload, once, and only for that specific message, so a genuine
 * crash still fails the test rather than being retried away.
 */
async function goto(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  const body = await page.locator('body').innerText().catch(() => '');
  if (body.includes('Failed to fetch dynamically imported module')) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  // A route reached for the first time in a run is compiled on demand, which
  // outlasts the default assertion wait and leaves the page showing its loading
  // emblem. Waiting for that to clear is not the same as waiting for the thing
  // under test: if the content never arrives, the assertions below still fail,
  // and they fail naming what was missing rather than reporting no element on a
  // page that had not begun rendering.
  await page.locator('main [role="status"]').waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});
}

test.describe('the pages where a customer handles money', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/public/people/mei-lin/payment-methods**', route => route.fulfill(json(methods)));
    await page.route(`**/api/inquiries/${TOKEN}`, route => route.fulfill(json(order)));
  });

  test('the order page fits the screen and offers the pay control', async ({ page }) => {
    await goto(page, `/order/${TOKEN}`);
    await expect(page.getByTestId('order-pay-action')).toBeVisible();
    await expect(page.getByText(ORDER_REF).first()).toBeVisible();
    await assertNothingRunsOffScreen(page, 'customer order page');
  });

  test('the payment page names the order without pushing the amount off the screen', async ({ page }) => {
    // Arriving the way a customer does, from their own order page, which is
    // what leaves the key behind for the payment page to read.
    await goto(page, `/order/${TOKEN}`);
    await page.getByTestId('order-pay-link').click();
    await expect(page.getByTestId('payment-order-summary')).toBeVisible();

    // The defect, stated as the customer's experience: the quantity beside the
    // longest tea name has to be on the screen.
    const quantity = page.getByTestId('payment-order-summary').getByText('357g');
    await expect(quantity).toBeVisible();
    const box = await quantity.boundingBox();
    const width = page.viewportSize()!.width;
    expect(box, 'the quantity did not render').not.toBeNull();
    expect(box!.x + box!.width, `the quantity sits ${Math.round(box!.x + box!.width - width)}px past the screen`)
      .toBeLessThanOrEqual(width);

    // And the bank details a customer came for are still reachable.
    await expect(page.getByText('8830 1194 2201 5567')).toBeVisible();
    await assertNothingRunsOffScreen(page, 'payment page with an order summary');
  });

  test('the payment page is unchanged for someone arriving from a message', async ({ page }) => {
    // No key, which is every link sent by hand. This is the majority path and
    // the regression that would matter most.
    await goto(page, `/people/mei-lin/pay?account=teajia-bali&amount=40.00&currency=USD&reference=${INVOICE_REF}`);
    await expect(page.getByRole('heading', { name: 'Pay Mei Lin' })).toBeVisible();
    await expect(page.getByTestId('payment-order-summary')).toHaveCount(0);
    await expect(page.getByText('8830 1194 2201 5567')).toBeVisible();
    await assertNothingRunsOffScreen(page, 'payment page with no order key');
  });
});
