import { expect, test } from './fixtures';

test.use({ serviceWorkers: 'block' });

/**
 * The shop corrects a customer's words (Adrian, 2026-11-25): a spelling or a
 * slip, before approving and after. The customer's original stays on file and
 * is shown beside the edit.
 */
const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const curator = {
  sub: 'curator-1', email: 'curator@test.dev', role: 'owner', platform_role: 'platform_owner',
  active_account_id: 'acct-bali', exp: Math.floor(Date.now() / 1000) + 86_400,
  memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' }],
};
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(curator)}.sig`;
const ORIGINAL = 'Orchid over warm stoen, then honey.';
const FIXED = 'Orchid over warm stone, then honey.';

test('the owner corrects a spelling on approval, then again after', async ({ page }) => {
  let offer: Record<string, any> = {
    id: 'candidate-1', productId: 'product-1', productName: 'Spring Sencha', status: 'starred',
    sourceText: ORIGINAL, attributionName: 'M.', impressionId: null, showOnListing: false, showOnMainPage: false,
  };
  const sent: Array<{ path: string; body: any }> = [];
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)
    ? route.fallback() : route.abort('blockedbyclient'));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });
    if (url.pathname === '/api/auth/me' || url.pathname === '/api/auth/refresh') return json({ ...curator, id: curator.sub, name: 'Curator', token });
    if (url.pathname === '/api/admin/tasting-note-candidates') return json(offer.status === url.searchParams.get('status') ? [offer] : []);
    if (url.pathname === '/api/admin/tasting-note-candidates/candidate-1/promote') {
      const body = request.postDataJSON();
      sent.push({ path: 'promote', body });
      offer = { ...offer, status: 'promoted', impressionId: 'impression-1', publishedText: body.edited_text, publishedName: body.attribution_name };
      return json({ id: 'impression-1' }, 201);
    }
    if (url.pathname === '/api/admin/tasting-impressions/impression-1/words') {
      const body = request.postDataJSON();
      sent.push({ path: 'words', body });
      offer = { ...offer, publishedText: body.edited_text, publishedName: body.attribution_name };
      return json({ id: 'impression-1', text: body.edited_text, attributionName: body.attribution_name });
    }
    if (url.pathname === '/api/rates') return json([{ currency: 'USD', rate_to_usd: 1 }]);
    return json([]);
  });

  await page.goto('/admin/tasting-notes');
  await expect(page.getByText(ORIGINAL)).toBeVisible();
  await page.getByRole('button', { name: 'Correct the words' }).click();
  const edit = page.getByTestId('excerpt-correction');
  await expect(edit.getByTestId('customer-original')).toContainText(ORIGINAL);
  await edit.getByLabel('Words').fill(FIXED);
  await edit.getByLabel('Signed').fill('Mei');
  await page.screenshot({ path: test.info().outputPath('excerpt-correction.png') });
  await edit.getByRole('button', { name: 'Approve with these words' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ path: 'promote', body: { edited_text: FIXED, attribution_name: 'Mei' } });

  await expect(page.getByText(FIXED)).toBeVisible();
  await expect(page.getByText('Mei · corrected by the shop')).toBeVisible();
  await page.getByRole('button', { name: 'Correct the words' }).click();
  const again = page.getByTestId('excerpt-correction');
  await expect(again.getByRole('button', { name: 'Save the words' })).toBeDisabled();
  await again.getByLabel('Words').fill(`${FIXED} Long finish.`);
  await again.getByRole('button', { name: 'Save the words' }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1]).toEqual({ path: 'words', body: { edited_text: `${FIXED} Long finish.`, attribution_name: 'Mei' } });
  await expect(page.getByText('Words saved.')).toBeVisible();
  await expect(page.getByText(`${FIXED} Long finish.`)).toBeVisible();
});
