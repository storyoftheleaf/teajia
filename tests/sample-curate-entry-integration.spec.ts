import { expect as browserExpect, test, type Page } from './fixtures';
import { fulfillHoldings } from './helpers/curateHoldings';
import { COMPASS_TOKEN, installCompassHarness } from './helpers/compassHarness';

const expect = browserExpect.configure({ timeout: 15_000 });
const source = {
  id: 'original-curate-entry',
  account_id: 'acct-bali',
  user_id: 'test-admin-uid',
  name: 'Original oolong in Library',
  type: 'Oolong',
  category: 'tea',
  status: 'noted',
  sample_state: 'received',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};
const curatePath = '/admin/compass?tab=sourcing&entry=' + source.id;
const holdings = [
  { id: 'received-sample', stock_grams: 20, inventory_purpose: 'sample', is_sample: 1 },
  { id: 'working-holding', stock_grams: 100, inventory_purpose: 'working', is_sample: 0 },
].map(holding => ({
  ...holding, account_id: 'acct-bali', source_compass_entry_id: source.id, product_name: source.name,
  type: source.type, status: 'Active', shown_in_shop: 0, is_public: 0,
}));

const checkEntry = (page: Page) => expect.poll(() => page.evaluate(async () => {
  // @ts-expect-error Vite serves source modules to the browser.
  const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
  const { activeEntryId, entries } = useTeaCompassStore.getState();
  return { activeEntryId, entries: entries.map((entry: { id: string }) => entry.id) };
})).toEqual({ activeEntryId: source.id, entries: [source.id] });

test.setTimeout(60_000);

test('the supported Sample action reopens the original Curate identity with both holdings present', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installCompassHarness(page, { compassEntries: [source], products: holdings });
  await page.route('**/api/samples/*', route => route.fulfill({ json: {
    id: new URL(route.request().url()).pathname.split('/').at(-1),
    name: 'Favorite sample portion',
    account_id: 'acct-bali',
    status: 'favorite',
    compass_entry_id: source.id,
    product_id: route.request().url().endsWith('/stock-linked') ? 'received-sample' : null,
  } }));
  await page.route('**/api/curate/holdings**', route => fulfillHoldings(route, [{
    entry: source,
    stock_grams: 120,
    sample_grams: 20,
    samples: [{ id: 'stock-linked', compass_entry_id: source.id, grams: 20, status: 'favorite' }],
  }]));
  const action = page.getByRole('button', { name: 'Promote to Curate' });

  await page.goto('/s/stock-linked');
  await expect(page.getByText('Favorite sample portion', { exact: true }).first()).toBeVisible();
  await expect(action).toHaveCount(0);

  await page.goto('/s/curate-linked');
  await action.click();
  await expect(page).toHaveURL(url => url.pathname + url.search === curatePath);
  await checkEntry(page);
  await expect(page.getByRole('textbox', { name: 'Tea name', exact: true })).toHaveValue(source.name);
  await page.reload();
  await checkEntry(page);
  await expect(page.getByRole('textbox', { name: 'Tea name', exact: true })).toHaveValue(source.name);
});

test('a cold original Curate URL does not open another shop’s entry', async ({ page }) => {
  const [header, payload, signature] = COMPASS_TOKEN.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  const membership = { ...claims.memberships[0], account_id: 'acct-other' };
  const scope = { active_account_id: 'acct-other', memberships: [membership] };
  const token = [header, Buffer.from(JSON.stringify({ ...claims, ...scope })).toString('base64url'), signature].join('.');

  await installCompassHarness(page, { compassEntries: [source], products: holdings });
  await page.addInitScript(value => localStorage.setItem('teajia_token', value), token);
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { token } }));
  await page.route('**/api/accounts/me', route => route.fulfill({ json: scope }));
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: claims.sub, email: claims.email, role: 'owner', ...scope } }));
  await page.route('**/api/compass/entries**', route => route.fulfill({ json: {
    entries: route.request().headers()['x-teajia-account'] === source.account_id ? [source] : [],
  } }));
  await page.route('**/api/products', route => route.fulfill({ json:
    route.request().headers()['x-teajia-account'] === source.account_id ? holdings : [],
  }));
  await page.route('**/api/accounts/acct-other', route => route.fulfill({ json: {
    id: 'acct-other', name: 'Other shop', slug: 'other-shop',
  } }));

  const scopedEntries = page.waitForResponse(response => new URL(response.url()).pathname === '/api/compass/entries');
  await page.goto(curatePath);
  expect((await scopedEntries).request().headers()['x-teajia-account']).toBe('acct-other');
  await expect(page.getByText('Original oolong in Library', { exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => {
    // @ts-expect-error Vite serves source modules to the browser.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    const { hydrationStatus, activeEntryId } = useTeaCompassStore.getState();
    return { hydrationStatus, activeEntryId };
  })).toEqual({ hydrationStatus: 'ready', activeEntryId: null });
});
