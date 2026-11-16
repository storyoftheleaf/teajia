import { test } from '../../tests/fixtures';
import { warm, SIZES } from './lib';
import { click, room } from './steps';
import { installAdmin, purchaseHandlers } from './mock';

const STOCK = '/admin/stock';

for (const s of SIZES) {
  test(`stock ${s.n}`, async ({ page }) => {
    await installAdmin(page, purchaseHandlers);
    await page.setViewportSize({ width: s.w, height: s.h });
    const { at } = room(page, s, 'stock');
    await warm(page, STOCK);
    await at(STOCK, 'list', 'Stock list as it opens.');
    await at(STOCK, 'list-scrolled', 'Stock list scrolled down, to show the row layout deeper in.', async () => { await page.mouse.move(s.w / 2, s.h / 2); await page.mouse.wheel(0, 1400); await page.waitForTimeout(700); });
    await at(`${STOCK}?panel=test-product-2`, 'row-panel', 'A tea row opened in its panel (?panel=).');
    await at(`${STOCK}?panel=test-product-1`, 'row-panel-hidden', 'Panel of a tea held back from the shop.');
    await at(`${STOCK}?panel=test-product-3`, 'row-panel-out-of-stock', 'Panel of a tea with zero stock and stock in transit.');
    await at(STOCK, 'view-options', 'Stock "View options" (arrange the list) dialog.', () => click(page, page.getByRole('button', { name: 'View options' }), 1000));
    await at(STOCK, 'inventory-actions', 'Stock "Open inventory actions" menu (the ... control).', () => click(page, page.getByRole('button', { name: 'Open inventory actions' }), 1000));
    await at(STOCK, 'edit-table', 'Edit table mode (type down a column).', async () => {
      if (!(await click(page, page.getByRole('button', { name: 'Open inventory actions' }), 800))) return false;
      return click(page, page.getByRole('button', { name: /Edit table/ }), 1500);
    });
    await at(STOCK, 'filter-type', 'Stock filtered by Type (Oolong).', async () => {
      await page.locator('select').first().selectOption({ label: 'Oolong' }, { timeout: 5000 });
      await page.waitForTimeout(900);
    });
    await at(STOCK, 'collapsed', 'Stock with every group collapsed (Collapse all).', () => click(page, page.getByRole('button', { name: 'Collapse all' }), 1000));
    await at(STOCK, 'add-tea', 'Add new tea.', () => click(page, page.getByRole('button', { name: 'Add new tea' }), 1500));
    await at(STOCK, 'wares', 'Stock, Wares (teaware) tab.', () => click(page, page.getByRole('tab', { name: 'Wares' }).or(page.getByRole('button', { name: 'Wares' })), 1500));
    await at(STOCK, 'selected', 'Rows selected (Ctrl+A selects the list), with the selection bar showing.', async () => {
      await page.locator('[data-product-id]').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 7000 });
      await page.mouse.click(s.w - 5, s.h / 2).catch(() => {});
      await page.keyboard.press('Control+a');
      await page.waitForTimeout(1000);
    });
    for (const [state, label] of [['menu-incoming', 'Incoming'], ['menu-tasting-library', 'Tasting library'], ['menu-glossary-view', 'Glossary view'], ['menu-import-csv', 'Import CSV'], ['menu-maintenance', 'Maintenance']] as const) {
      await at(STOCK, state, `Stock actions menu, ${label}.`, async () => {
        if (!(await click(page, page.getByRole('button', { name: 'Open inventory actions' }), 800))) return false;
        return click(page, page.getByText(label, { exact: true }), 1500);
      });
    }
    await at(STOCK, 'search', 'Stock searched for a name.', async () => {
      await click(page, page.getByRole('button', { name: 'Search inventory' }), 500);
      await page.getByPlaceholder(/Search/).filter({ visible: true }).first().fill('Oolong');
      await page.waitForTimeout(900);
    });
    await at(`${STOCK}?search=Green`, 'search-link', 'Stock opened with a search in the link.');
    await at('/admin/capture', 'drafts', 'Drafts view: teas still being written up.', undefined, true);
    await at('/admin/intake', 'intake', 'Intake workspace.', undefined, true);
    await at('/admin/catalog', 'tea-glossary', 'Tea Glossary.', undefined, true);
    await at('/admin/products/test-product-2/story', 'product-story', 'A tea\'s story editor.', undefined, true);
    await at('/admin/network?tab=catalog', 'network-catalog', 'Network catalog (other houses\' teas).', undefined, true);

    // Purchases
    const P = room(page, s, 'purchases');
    const PO = '/admin/purchase-orders';
    await P.at(PO, 'all', 'Purchases, all.', undefined, true);
    await P.at(`${PO}?view=attention`, 'attention', 'Purchases with the attention filter.', undefined, true);
    await P.at(PO, 'identify-items', 'Identify items on a purchase that needs matching.', () => click(page, page.getByRole('button', { name: /Identify items/ }), 1500),);
    await P.at(PO, 'arrived', 'Arrived (receive) action on a parcel.', () => click(page, page.getByRole('button', { name: /^Arrived$/ }), 1500), true);
    await P.at(PO, 'new-purchase', 'New purchase (the plus control).', () => click(page, page.getByRole('button', { name: /^\+$|New purchase|Add purchase/ }), 1500),);
    await P.at(PO, 'services', 'Logistics services.', () => click(page, page.getByRole('button', { name: /^Services/ }), 1500), true);
    await P.at(PO, 'addresses', 'Logistics addresses.', () => click(page, page.getByRole('button', { name: /^Addresses/ }), 1500), true);
    await P.at(PO, 'history', 'Purchases, History tab.', () => click(page, page.getByRole('button', { name: /^History/ }).or(page.getByRole('tab', { name: /^History/ })), 1500), true);
    await P.at(PO, 'edit-costs-shipment', 'Edit costs and shipment on a shipment.', () => click(page, page.getByRole('button', { name: /Edit costs/ }), 1500), true);
    await P.at(PO, 'message', 'Message to the logistics company.', () => click(page, page.getByRole('button', { name: /^Message$/ }), 1500), true);
    await P.at(PO, 'prepare-shipment', 'Prepare shipment from logistics.', () => click(page, page.getByRole('button', { name: /Prepare shipment from logistics/ }), 1500), true);
  });
}
