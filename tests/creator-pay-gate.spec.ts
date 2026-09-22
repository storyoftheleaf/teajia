import { expect, test } from './fixtures';
import { KENJI_BANK_DETAIL, KENJI_SHARE_TOKEN, collectErrors, meaningfulErrors, mockCreatorApi, noHorizontalOverflow, signInAs } from './helpers/creatorFixtures';

// Pay is private, and approval is permanent. Three viewers, three answers:
// the public meets the gate and never a bank number; an approved account
// opens the sheet; a link opens the sheet with no gate and no pasting.
// The worker's side of the same rule is pinned in worker/tests/pay-is-private.test.ts.

test.describe('the pay gate', () => {
  test('a stranger pressing Pay sees the gate, one action, and no bank detail, and is never sent the methods', async ({ page }) => {
    const errors = collectErrors(page);
    const { calls } = await mockCreatorApi(page, { viewer: 'stranger' });
    await page.goto('/people/kenji-tanaka');
    await page.getByTestId('profile-hub').getByRole('link', { name: 'Pay' }).click();
    await expect(page).toHaveURL(/\/people\/kenji-tanaka\/pay$/);

    const gate = page.getByTestId('pay-gate');
    await expect(gate).toContainText('I share my payment details privately');
    await expect(gate).toContainText('They go only to people I have sold tea to.');
    // Canvas version 25: the head is the close mark alone, no caps line.
    await expect(gate).not.toContainText('Pay · Kenji Tanaka');
    const ask = gate.getByTestId('pay-gate-ask');
    await expect(ask).toHaveText('Ask Kenji');
    await expect(gate.getByRole('button')).toHaveCount(1);
    // Canvas version 27: plain text in the reading gold with a line under it. No box, no fill, no caps.
    const style = await ask.evaluate(element => { const c = getComputedStyle(element); return { bg: c.backgroundColor, top: c.borderTopWidth, bottom: c.borderBottomWidth, caps: c.textTransform, height: element.getBoundingClientRect().height }; });
    expect(style.bg).toBe('rgba(0, 0, 0, 0)');
    expect(style.top).toBe('0px');
    expect(style.bottom).toBe('1px');
    expect(style.caps).toBe('none');
    expect(style.height).toBeGreaterThanOrEqual(52);
    await expect(gate.getByRole('link', { name: 'Close' })).toHaveAttribute('href', '/people/kenji-tanaka');

    const body = await page.locator('body').innerText();
    expect(body).not.toContain(KENJI_BANK_DETAIL);
    expect(body).not.toContain('0092');
    expect(body.toLowerCase()).not.toContain('i have a link');
    expect(calls.some(call => call.includes('/payment-methods'))).toBe(false);

    // Asking needs an account: the button sends a stranger to sign in, and back here with the ask remembered.
    await ask.click();
    await expect(page).toHaveURL(/\/signin\?returnTo=/);
    const returnTo = decodeURIComponent(new URL(page.url()).searchParams.get('returnTo') ?? '');
    expect(returnTo).toBe('/people/kenji-tanaka/pay?ask=1');

    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(meaningfulErrors(errors), 'console errors on the gate').toHaveLength(0);
  });

  test('a signed-in account that is not approved asks once and sees it recorded', async ({ page }) => {
    const { calls } = await mockCreatorApi(page, { viewer: 'signed-in' });
    await signInAs(page);
    await page.goto('/people/kenji-tanaka/pay');
    const gate = page.getByTestId('pay-gate');
    await expect(gate.getByTestId('pay-gate-ask')).toBeVisible();
    expect(await page.locator('body').innerText()).not.toContain('0092');
    await gate.getByTestId('pay-gate-ask').click();
    await expect.poll(() => calls.filter(call => call.startsWith('POST /api/public/people/kenji-tanaka/pay-access/request')).length).toBe(1);
    expect(calls.some(call => call.includes('/payment-methods'))).toBe(false);
  });

  test('back from sign-in with the ask remembered, the request fires without another press', async ({ page }) => {
    const { calls } = await mockCreatorApi(page, { viewer: 'signed-in' });
    await signInAs(page);
    await page.goto('/people/kenji-tanaka/pay?ask=1');
    await expect.poll(() => calls.filter(call => call.startsWith('POST /api/public/people/kenji-tanaka/pay-access/request')).length).toBe(1);
    await expect(page).not.toHaveURL(/ask=1/);
  });

  test('a pending request is shown as asked, with no second ask', async ({ page }) => {
    await mockCreatorApi(page, { viewer: 'pending' });
    await signInAs(page);
    await page.goto('/people/kenji-tanaka/pay');
    await expect(page.getByTestId('pay-gate-asked')).toContainText('Asked. It opens here once I approve.');
    await expect(page.getByTestId('pay-gate-ask')).toHaveCount(0);
  });

  test('an approval made after the ask shows on the next open, with nothing cleared', async ({ page }) => {
    // The asked state must never be served from the persisted query cache: a
    // person who asked, was approved a minute later, and reopens the page has
    // to see the sheet, not yesterday's gate. Found on the sandbox 2026-09-20.
    await mockCreatorApi(page, { viewer: 'pending' });
    await signInAs(page);
    await page.goto('/people/kenji-tanaka/pay');
    await expect(page.getByTestId('pay-gate-asked')).toBeVisible();
    // Let the persister's throttle write whatever it is going to write.
    await page.waitForTimeout(1500);
    // Kenji approves: the API now answers open. Later routes win in Playwright.
    await mockCreatorApi(page, { viewer: 'approved' });
    await page.reload();
    await expect(page.getByTestId('pay-sheet')).toBeVisible();
    await expect(page.getByTestId('pay-gate-asked')).toHaveCount(0);
  });

  test('an approved account opens the sheet and sees the bank detail, with copy beside it', async ({ page }) => {
    const errors = collectErrors(page);
    await mockCreatorApi(page, { viewer: 'approved' });
    await signInAs(page);
    await page.goto('/people/kenji-tanaka/pay');
    const sheet = page.getByTestId('pay-sheet');
    await expect(sheet).toContainText('For tea bought at Tanaka Tea House');
    await expect(sheet).toContainText('Two ways. Both come straight to me.');
    await expect(sheet).toContainText(KENJI_BANK_DETAIL);
    // Canvas version 25: a divider per method, plain rows under it, no labels beside the values.
    await expect(sheet.getByRole('heading', { name: 'Bank transfer' })).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Payment link' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Copy recipient name' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Copy Bank transfer (Kyoto) details' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: /Open Pay online/ })).toHaveAttribute('href', 'https://example.com/pay/tanaka-tea-house');
    await expect(sheet).toContainText('Card or wallet, any currency.');
    const open = sheet.getByRole('link', { name: /Open Pay online/ });
    const openStyle = await open.evaluate(element => { const c = getComputedStyle(element); return { bottom: c.borderBottomWidth, top: c.borderTopWidth, caps: c.textTransform, height: element.getBoundingClientRect().height }; });
    expect(openStyle).toMatchObject({ bottom: '1px', top: '0px', caps: 'none' });
    expect(openStyle.height).toBeGreaterThanOrEqual(44);
    const sheetText = await sheet.innerText();
    for (const label of ['Recipient', 'Account', 'Choose a transfer method', 'External transfer', 'Share this payment page', 'Pay · ']) expect(sheetText).not.toContain(label);
    await expect(page.getByTestId('pay-gate')).toHaveCount(0);
    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(meaningfulErrors(errors), 'console errors on the sheet').toHaveLength(0);
    await page.screenshot({ path: 'test-results/creator-pay-sheet-approved.png', fullPage: true });
  });

  test('a link simply opens: no gate, no pasting, the token carried on every read', async ({ page }) => {
    const { calls } = await mockCreatorApi(page, { viewer: 'stranger' });
    await page.goto(`/people/kenji-tanaka/pay?t=${KENJI_SHARE_TOKEN}`);
    const sheet = page.getByTestId('pay-sheet');
    await expect(sheet).toContainText(KENJI_BANK_DETAIL);
    await expect(sheet).toContainText('You opened this from my link.');
    await expect(page.getByTestId('pay-gate')).toHaveCount(0);
    expect(calls.some(call => call.startsWith('GET /api/public/people/kenji-tanaka/pay-access') && call.includes(`t=${KENJI_SHARE_TOKEN}`))).toBe(true);
    expect(calls.some(call => call.startsWith('GET /api/public/people/kenji-tanaka/payment-methods') && call.includes(`t=${KENJI_SHARE_TOKEN}`))).toBe(true);
    expect((await page.locator('body').innerText()).toLowerCase()).not.toContain('i have a link');
  });

  test('a wrong token is the gate again, and still no bank detail', async ({ page }) => {
    await mockCreatorApi(page, { viewer: 'stranger' });
    await page.goto('/people/kenji-tanaka/pay?t=00000000000000000000000000000000');
    await expect(page.getByTestId('pay-gate')).toBeVisible();
    expect(await page.locator('body').innerText()).not.toContain('0092');
  });
});
