import { expect, test, type Page } from '@playwright/test';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'curator-1', email: 'curator@test.dev', role: 'owner', platform_role: 'platform_owner',
  active_account_id: 'acct-bali', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner' }],
  exp: Math.floor(Date.now() / 1000) + 86_400,
})}.sig`;

const product = {
  id: 'product-1', type: 'Green', form: 'Loose', given_name: 'Spring Sencha', product_name: 'Spring Sencha',
  tea_key: 'green:spring-sencha', origin_country: 'Japan', origin_region: 'Shizuoka', retail_price_per_gram_usd: 0.4,
  stock_grams: 250, description: 'Early spring green tea.', tasting_notes: [], image_url: '', status: 'Active',
  is_public: 1, shown_in_shop: 1, can_reorder: 1, tasting_source: 'owner',
};

async function setup(page: Page, { failStar = false }: { failStar?: boolean } = {}) {
  let promoted = false;
  let candidate: Record<string, unknown> | null = null;
  const requestOrder: string[] = [];

  await page.addInitScript(({ jwt }) => {
    localStorage.clear();
    localStorage.setItem('teajia_token', jwt);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
      activeAccountId: 'acct-bali', activeUserId: 'curator-1', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner' }],
      tastingJournal: [{
        id: 'entry-1', productId: 'product-1', productName: 'Spring Sencha', productType: 'Green',
        note: { tasting: {}, updatedAt: '2026-07-12T00:00:00.000Z' },
        tastings: [{ id: 'tasting-1', createdAt: '2026-07-12T00:00:00.000Z', tasting: {} }],
        createdAt: '2026-07-12T00:00:00.000Z', synced: true,
      }],
    } }));
  }, { jwt: token });

  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === '/api/products/public') return route.fulfill({ json: [product] });
    if (path === '/api/tasting-journal' && request.method() === 'GET') return route.fulfill({ json: [] });
    if (path === '/api/tasting-journal/sync') {
      requestOrder.push('save-start');
      await new Promise(resolve => setTimeout(resolve, 50));
      requestOrder.push('save-complete');
      return route.fulfill({ json: { synced: 1 } });
    }
    if (path === '/api/tasting-journal/entry-1/candidates/tasting-1' && request.method() === 'PUT') {
      requestOrder.push('star');
      if (failStar) return route.fulfill({ status: 500, json: { error: 'Private review unavailable' } });
      const body = request.postDataJSON();
      candidate = {
        id: 'candidate-1', journalEntryId: 'entry-1', noteKey: 'tasting-1', productId: 'product-1', status: 'starred',
        sourceText: body.source_text, finalText: body.source_text, attributionName: null, attributionDetail: null,
        createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
      };
      return route.fulfill({ json: candidate });
    }
    if (path === '/api/tasting-journal/entry-1/candidates/tasting-1' && request.method() === 'DELETE') {
      candidate = null;
      return route.fulfill({ json: { success: true } });
    }
    if (path === '/api/admin/tasting-note-candidates/candidate-1' && request.method() === 'PUT') {
      const body = request.postDataJSON();
      candidate = { ...candidate, finalText: body.edited_text, attributionName: body.attribution_name, attributionDetail: body.attribution_detail || null };
      return route.fulfill({ json: candidate });
    }
    if (path === '/api/admin/tasting-note-candidates/candidate-1/promote' && request.method() === 'POST') {
      promoted = true;
      return route.fulfill({ status: 201, json: { id: 'impression-1', productId: 'product-1' } });
    }
    if (path === '/api/products/product-1/impressions') {
      return route.fulfill({ json: promoted ? [{
        id: 'impression-1', productId: 'product-1', text: candidate?.finalText,
        attributionName: candidate?.attributionName, attributionDetail: candidate?.attributionDetail,
        publishedAt: '2026-07-12T00:00:00.000Z',
      }] : [] });
    }
    if (path === '/api/tea-reviews') return route.fulfill({ json: [] });
    if (path === '/api/products/product-1/events') return route.fulfill({ json: [] });
    if (path === '/api/user/favorites') return route.fulfill({ json: { favorites: [] } });
    return route.fulfill({ json: {} });
  });
  return () => requestOrder;
}

test('a private section note appears publicly only after edited promotion', async ({ page }) => {
  const requestOrder = await setup(page);

  await page.goto('/shop/product/product-1');
  await expect(page.locator('h1', { hasText: 'Spring Sencha' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Apricot over warm stone')).toHaveCount(0);
  await expect(page.getByText(/— A\. · Spring table/)).toHaveCount(0);

  await page.goto('/account/journal');
  await page.locator('button.w-full.text-left').filter({ hasText: 'Spring Sencha' }).click();
  await page.getByRole('textbox', { name: 'Note for this tasting' }).fill('Long mineral finish');
  await page.getByRole('button', { name: 'Star this note for private review' }).click();
  await expect(page.getByRole('button', { name: 'Remove private review star' })).toBeVisible();
  await expect.poll(() => requestOrder().slice(0, 3)).toEqual(['save-start', 'save-complete', 'star']);
  await page.getByRole('button', { name: 'Remove private review star' }).click();
  await expect(page.getByRole('button', { name: 'Star this note for private review' })).toBeVisible();
  await page.getByRole('button', { name: 'Star this note for private review' }).click();
  await expect(page.getByRole('button', { name: 'Remove private review star' })).toBeVisible();

  await page.evaluate(async () => {
    await fetch('/api/admin/tasting-note-candidates/candidate-1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edited_text: 'Apricot over warm stone', attribution_name: 'A.', attribution_detail: 'Spring table' }),
    });
    await fetch('/api/admin/tasting-note-candidates/candidate-1/promote', { method: 'POST' });
  });

  await page.goto('/shop/product/product-1');
  await expect(page.locator('h1', { hasText: 'Spring Sencha' })).toBeVisible();
  await expect(page.getByText('Apricot over warm stone')).toBeVisible();
  await expect(page.getByText('— A. · Spring table')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test('a failed private star rolls the pressed state back beside its section', async ({ page }) => {
  await setup(page, { failStar: true });
  await page.goto('/account/journal');
  await page.locator('button.w-full.text-left').filter({ hasText: 'Spring Sencha' }).click();
  await page.getByRole('textbox', { name: 'Note for this tasting' }).fill('Long mineral finish');
  await page.getByRole('button', { name: 'Star this note for private review' }).click();
  await expect(page.getByRole('button', { name: 'Star this note for private review' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('alert')).toContainText('Private review unavailable');
});
