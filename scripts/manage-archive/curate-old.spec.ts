import { test } from '../../tests/fixtures';
import { installCompassHarness } from '../../tests/helpers/compassHarness';
import { ENTRIES, VENDORS, PRODUCTS, RATES } from './data';
import { fresh, warm, snap, SIZES } from './lib';

const ROOM = 'curate-old';
const SOURCE = '/admin/compass?tab=sourcing';
const LIBRARY = '/admin/compass?tab=library';

const click = async (page: any, loc: any, wait = 900) => {
  const target = loc.filter({ visible: true }).first();
  await target.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
  if (!(await target.count())) { console.log('MISS', String(loc)); return false; }
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(wait);
  return true;
};

for (const s of SIZES) {
  test(`curate old ${s.n}`, async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS, compassEntries: ENTRIES, products: PRODUCTS, rates: RATES });
    await page.setViewportSize({ width: s.w, height: s.h });
    const shot = (state: string, route: string, note: string, full = false) => snap(page, s, { room: ROOM, state, route, note, full });
    /** Open a route clean, run an optional step, and take the picture when the step found its control. */
    const at = async (route: string, state: string, note: string, step?: () => Promise<boolean | void>, full = false) => {
      await fresh(page, route);
      if (step) {
        try { if ((await step()) === false) return; } catch (e) { console.log('STEP FAILED', state, String(e).split('\n')[0]); return; }
      }
      await shot(state, route, note, full);
    };

    await warm(page, SOURCE);

    // Source: Tea, Teaware, Import
    await at(SOURCE, 'source-tea-empty', 'Source tab, the Tea capture form, empty.', undefined, true);
    await at(SOURCE, 'source-tea-filled', 'Source tab, capture form with name, origin, price and grams typed.', async () => {
      await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Dahongpao Reserve');
      await page.getByPlaceholder('e.g. Yiwu').filter({ visible: true }).fill('Wuyi');
      await page.getByPlaceholder('Price').filter({ visible: true }).first().fill('420').catch(() => {});
      await page.getByPlaceholder('Grams').filter({ visible: true }).first().fill('250').catch(() => {});
      await page.waitForTimeout(600);
    }, true);
    await at(SOURCE, 'source-tea-type-menu', 'Capture form with the tea type menu open.', () => click(page, page.getByRole('button', { name: 'Tea type' })));
    await at(SOURCE, 'source-form-menu', 'Capture form with the Form (leaf, cake, brick...) menu open.', () => click(page, page.getByRole('button', { name: 'Tea form' })));
    await at(SOURCE, 'source-journey-visit', 'Journey / visit context picker opened from the capture form.', () => click(page, page.getByRole('button', { name: 'Add journey or visit context' })));
    await at(SOURCE, 'source-vendor-menu', 'Vendor picker opened from the capture form.', () => click(page, page.getByRole('button', { name: 'VENDOR' })));
    await at(SOURCE, 'source-run-menu', 'Run (trip batch) picker opened from the capture form.', () => click(page, page.getByRole('button', { name: 'RUN' })));
    await at(SOURCE, 'source-share', 'Share control on the capture form.', () => click(page, page.getByRole('button', { name: 'Share' })));
    await at(SOURCE, 'source-scan', 'Scan label control on the capture form.', () => click(page, page.getByRole('button', { name: 'Scan label' })));
    await at(SOURCE, 'source-details-open', 'Capture form with Tea details and sourcing expanded.', () => click(page, page.getByText('Tea details & sourcing', { exact: false })), true);
    await at(SOURCE, 'source-taste-profile-add', 'Capture form after pressing Add tasting profile (opens the tasting flow, see the tasting room).', () => click(page, page.getByRole('button', { name: 'Add tasting profile' }), 1500));
    await at(SOURCE, 'source-buy', 'After pressing Buy on a filled capture form (the purchase step).', async () => {
      await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Dahongpao Reserve');
      await page.getByPlaceholder('Price').filter({ visible: true }).first().fill('420').catch(() => {});
      await page.getByPlaceholder('Grams').filter({ visible: true }).first().fill('250').catch(() => {});
      return click(page, page.getByRole('button', { name: 'Buy', exact: true }), 1500);
    });
    await at(SOURCE, 'source-done', 'After pressing Done on a filled capture form (commit the entry).', async () => {
      await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Dahongpao Reserve');
      return click(page, page.getByRole('button', { name: /Done, commit/ }), 1500);
    });
    await at(SOURCE, 'source-sample', 'After pressing Sample on a filled capture form.', async () => {
      await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Dahongpao Reserve');
      return click(page, page.getByRole('button', { name: 'Sample', exact: true }), 1500);
    });
    await at(SOURCE, 'source-teaware', 'Source tab, Teaware capture form.', () => click(page, page.getByRole('tab', { name: 'Teaware' })), true);
    await at(SOURCE, 'source-import', 'Source tab, Import (paste or upload a supplier price list or invoice).', () => click(page, page.getByRole('tab', { name: 'Import' })), true);

    // Library
    await at(LIBRARY, 'library', 'Library: teas grouped by supplier.');
    await at(LIBRARY, 'library-full', 'Library, whole list.', undefined, true);
    await at(LIBRARY, 'library-supplier-collapsed', 'Library with one supplier section collapsed.', () => click(page, page.getByRole('button', { name: /^Chen Family\s*\d/ })));
    await at(LIBRARY, 'library-tea-card-quick-actions', 'A tea card in the Library with its quick actions (Taste, quote, grams, Choose, Reject, Add information).', async () => {
      await page.getByTestId('library-entry-e3').filter({ visible: true }).scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(600);
    });
    await at(LIBRARY, 'library-tea-opened', 'A Library tea opened for detail (Edit details).', () => click(page, page.getByTestId('library-entry-e3').filter({ visible: true }).getByRole('button', { name: /Edit details for/ }), 1500));
    await at('/admin/compass?tab=library&entry=e3', 'library-tea-deeplink', 'Library tea opened by link (?entry=).');
    await at(LIBRARY, 'library-add-information', 'Add information on a tea card.', () => click(page, page.getByTestId('library-entry-e3').filter({ visible: true }).getByRole('button', { name: /^Add information/ }), 1500));
    await at(LIBRARY, 'library-filters-open', 'Library with the filters panel open.', () => click(page, page.getByRole('button', { name: 'Filters' })));
    await at(LIBRARY, 'library-sort-menu', 'Library with the sort menu (Recent) open.', () => click(page, page.getByRole('button', { name: /^Recent/ })));
    await at(LIBRARY, 'library-to-taste', 'Library filtered to To taste.', () => click(page, page.getByRole('button', { name: /^To taste/ })));
    await at(LIBRARY, 'library-chosen', 'Library filtered to Chosen.', () => click(page, page.getByRole('button', { name: /^Chosen/ })));
    await at(LIBRARY, 'library-price-settings', 'Price display settings opened from the Library.', () => click(page, page.getByRole('button', { name: 'Price display settings' })));
    await at(LIBRARY, 'library-add', 'Add to Library.', () => click(page, page.getByRole('button', { name: 'Add to Library' })));
    await at(LIBRARY, 'library-choose', 'After pressing Choose on a tea.', () => click(page, page.getByRole('button', { name: /^Choose$/ }), 1500));
    await at(LIBRARY, 'library-reject', 'After pressing Reject on a tea.', () => click(page, page.getByRole('button', { name: /^Reject$/ }), 1500));
    await at(LIBRARY, 'library-edit-supplier', 'Edit supplier pencil on a supplier section.', () => click(page, page.getByRole('button', { name: /Edit supplier Chen Family/ })));
    await at(LIBRARY, 'library-search', 'Library search with a query typed.', async () => {
      await page.getByPlaceholder('Search Library').filter({ visible: true }).fill('oolong');
      await page.waitForTimeout(700);
    });

    // Ledger, purchase order builder, samples
    await at('/admin/compass?tab=ledger', 'ledger', 'Ledger tab.', undefined, true);
    await at('/admin/compass?tab=ledger', 'ledger-purchase-order-builder', 'Purchase order builder opened from the Ledger.', () => click(page, page.getByRole('button', { name: /Purchase order builder/i }), 1800), true);
    await at('/admin/compass?tab=ledger', 'ledger-quick-note', 'Quick note opened from the Ledger.', () => click(page, page.getByRole('button', { name: /Quick note/i }), 1500));
    await at('/admin/compass?tab=ledger', 'ledger-quick-sale', 'Quick sale opened from the Ledger.', () => click(page, page.getByRole('button', { name: /Quick sale/i }), 1500));
    await at('/admin/compass?tab=ledger', 'ledger-new-entry', 'New entry opened from the Ledger.', () => click(page, page.getByRole('button', { name: /New entry/i }), 1500));
    await at('/admin/compass?sampleOrder=manage', 'samples', 'Samples workspace.', undefined, true);
    await at('/admin/compass?sampleOrder=manage', 'samples-new-batch', 'New sample batch from the Samples workspace.', () => click(page, page.getByRole('button', { name: /New batch/i }), 1500));
    await at(SOURCE, 'samples-list-open', 'The sample list opened from the header.', () => click(page, page.getByRole('button', { name: /Sample list/ })));
  });
}
