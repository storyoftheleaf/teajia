import { test } from '../../tests/fixtures';
import { installCompassHarness } from '../../tests/helpers/compassHarness';
import { ENTRIES, VENDORS, PRODUCTS, RATES } from './data';
import { warm, SIZES } from './lib';
import { click, room } from './steps';

const V2 = '/admin/compass/v2';
const PO = [{ id: 'po-1', vendor_name: 'Huang Wei', vendor_id: 'vendor-huang', display_currency: 'Yuan', status: 'pending', total_usd: 194.37,
  items_json: JSON.stringify([{ name: 'Oil-Paper Tea Brick', quantity: 500, priceIsPerGram: false, pricePerUnit: 500, currency: 'Yuan', compassEntryId: 'e1' }]) }];

for (const s of SIZES) {
  test(`curate new ${s.n}`, async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS, compassEntries: ENTRIES, products: PRODUCTS, rates: RATES, purchaseOrders: PO });
    await page.setViewportSize({ width: s.w, height: s.h });
    const { at } = room(page, s, 'curate-new');
    await warm(page, V2);
    await at(V2, 'today', 'Curate v2, Today tab.', undefined, true);
    await at(`${V2}?tab=table`, 'table', 'Curate v2, Table tab.', undefined, true);
    await at(`${V2}?tab=teas`, 'teas', 'Curate v2, Teas tab.', undefined, true);
    const vendorsTab = () => click(page, page.getByRole('tab', { name: 'Vendors', exact: true }), 1500);
    await at(V2, 'vendors', 'Curate v2, Vendors tab (not addressable by link, opened by tapping the tab).', vendorsTab, true);
    await at(`${V2}?tab=orders`, 'orders', 'Curate v2, Orders tab.', undefined, true);
    await at(`${V2}?tab=teas&entry=e3`, 'tea-opened', 'A tea opened (tea face) in Curate v2.', undefined, true);
    await at(`${V2}?tab=teas&entry=e1`, 'tea-opened-stocked', 'A tea that is already on the shelf, opened.', undefined, true);
    await at(`${V2}?tab=teas&entry=e5`, 'tea-opened-unpriced', 'A tea with no price, opened.', undefined, true);
    await at(`${V2}?tab=teas`, 'filters', 'Teas tab with filters open.', () => click(page, page.getByRole('button', { name: /Filters/ })));
    await at(`${V2}?tab=teas`, 'add-tea', 'Add a tea (the plus / new entry control).', () => click(page, page.getByText(/^\+ ?Tea$/), 1200), true);
    await at(`${V2}?tab=teas`, 'search', 'Teas search with a query typed.', async () => { await page.getByPlaceholder('Search teas').filter({ visible: true }).first().fill('oolong'); await page.waitForTimeout(600); });
    await at(V2, 'vendor-opened', 'A vendor opened in Vendors.', async () => { await vendorsTab(); return click(page, page.getByText('Huang Wei'), 1500); }, true);
    await at(`${V2}?tab=orders`, 'order-opened', 'An order opened in Orders.', () => click(page, page.getByText('Huang Wei'), 1500), true);
    await at(`${V2}?tab=table`, 'table-start', 'Table tab, Start a table (whose?).', () => click(page, page.getByText('whose?'), 1500), true);
    await at(`${V2}?tab=teas`, 'tea-row-tapped', 'A tea row tapped in the Teas tab.', () => click(page, page.getByText('Yiwu Gushu Spring'), 1500), true);
  });
}
