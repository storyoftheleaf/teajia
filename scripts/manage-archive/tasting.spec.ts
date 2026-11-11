import { test } from '../../tests/fixtures';
import { installCompassHarness } from '../../tests/helpers/compassHarness';
import { ENTRIES, VENDORS, PRODUCTS, RATES } from './data';
import { fresh, warm, snap, SIZES } from './lib';

const ROOM = 'tasting';
const LIBRARY = '/admin/compass?tab=library';
const SOURCE = '/admin/compass?tab=sourcing';

// One tea already tasted, so the saved-profile views have something to show.
const TASTED = {
  quality: 8, impression: 'love', wantToPurchase: true, body: ['silky', 'thick'], feeling: ['calming'], flavor: ['rose', 'honey'], aroma: ['rose'],
  storageCharacter: 2, storageNotes: ['Clean'], notes: 'Floral, soft and quietly uplifting.',
};
const ENTRIES_WITH_TASTING = ENTRIES.map((e) => (e.id === 'e3' ? { ...e, tasting: TASTED } : e));

const click = async (page: any, loc: any, wait = 700) => {
  const target = loc.filter({ visible: true }).first();
  await target.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
  if (!(await target.count())) { console.log('MISS', String(loc)); return false; }
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(wait);
  return true;
};

for (const s of SIZES) {
  test(`tasting flow ${s.n}`, async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS, compassEntries: ENTRIES_WITH_TASTING, products: PRODUCTS, rates: RATES });
    await page.setViewportSize({ width: s.w, height: s.h });
    const shot = (state: string, route: string, note: string, full = false) => snap(page, s, { room: ROOM, state, route, note, full });
    const nav = () => page.getByRole('navigation', { name: /tasting sections/i }).filter({ visible: true }).first();
    const zone = (name: string) => click(page, nav().getByRole('button', { name, exact: true }), 900);
    const btn = (name: string | RegExp, exact = true) => click(page, page.getByRole('button', { name, exact }), 600);

    /** Open the tasting from the Library card of a tea. */
    const openFromCard = async (id: string, name: string) => {
      await fresh(page, LIBRARY);
      await page.getByTestId(`library-entry-${id}`).filter({ visible: true }).scrollIntoViewIfNeeded().catch(() => {});
      await click(page, page.getByRole('button', { name: `Taste ${name}` }), 1800);
    };

    await warm(page, LIBRARY);
    await fresh(page, LIBRARY);
    await shot('0-library-taste-button', LIBRARY, 'The Taste (cup) button on a Library tea card, where a tasting begins.');

    // First opening on an untasted tea
    await openFromCard('e4', 'Alishan High Mountain');
    await page.waitForTimeout(1500);
    await shot('1-opens-empty', LIBRARY, 'Tasting opened from the Library card of an untasted tea: first screen, nothing chosen.');
    await zone('Texture'); await shot('2-texture-empty', LIBRARY, 'Texture zone, nothing chosen.', true);
    await zone('Effect'); await shot('3-effect-empty', LIBRARY, 'Effect zone, nothing chosen.', true);
    await zone('Taste'); await shot('4-taste-empty', LIBRARY, 'Taste zone: the taste wheel, nothing chosen.', true);
    await zone('Storage'); await shot('5-storage-empty', LIBRARY, 'Storage zone (storage character and appearance), nothing chosen.', true);
    await btn('Open your impression'); await shot('6-impression-empty', LIBRARY, 'Your impression, nothing entered.', true);

    // Same tea with selections made
    await zone('Texture');
    await btn('Silky'); await btn('Smooth');
    await shot('2b-texture-selected', LIBRARY, 'Texture zone with Silky selected.', true);
    await zone('Effect');
    await btn('Calm'); await btn('Grounded').catch(() => {});
    await shot('3b-effect-selected', LIBRARY, 'Effect zone with Calm selected.', true);
    await zone('Taste');
    const press = async (name: string) => {
      // The wheel's wedges have clipped hit regions; drive them from the keyboard.
      const b = page.getByRole('button', { name, exact: true }).first();
      if (!(await b.count())) { console.log('MISS', name); return; }
      await b.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
    };
    await press('Explore Floral');
    await shot('4b-taste-wheel-family-open', LIBRARY, 'Taste wheel after opening the Floral family.', true);
    await press('Rose · Taste');
    await press('Rose · Aroma');
    await shot('4c-taste-wheel-selected', LIBRARY, 'Taste wheel with Rose chosen as taste and aroma.', true);
    await zone('Storage');
    const slider = page.getByRole('slider', { name: /Storage character/ }).filter({ visible: true }).first();
    if (await slider.count()) { await slider.focus(); await slider.press('Home'); }
    await btn('Musty');
    await shot('5b-storage-selected', LIBRARY, 'Storage zone with a character and a note chosen.', true);
    await btn('Open your impression');
    await btn('Love'); await btn('Want to purchase this'); await btn('Rate 8 out of 10');
    await page.getByLabel('Your notes', { exact: true }).filter({ visible: true }).first().fill('Floral, soft and quietly uplifting.').catch(() => {});
    await page.waitForTimeout(500);
    await shot('6b-impression-filled', LIBRARY, 'Your impression filled in, with the recap of every selection.', true);
    await click(page, page.getByRole('button', { name: /^(Leave tasting|Close)$/ }), 900);
    await shot('7-leave-prompt', LIBRARY, 'Leaving with unsaved edits: Save and close / discard prompt.');
    await click(page, page.getByRole('button', { name: 'Save and close', exact: true }), 1500);
    await shot('8-after-save-library', LIBRARY, 'The Library right after saving a tasting.');

    // A tea that already has a tasting
    await openFromCard('e3', 'Yiwu Gushu Spring');
    await shot('9-reopened-impression', LIBRARY, 'Reopening a tea that was already tasted: opens with the impression and recap.', true);
    await zone('Texture'); await shot('9b-reopened-texture', LIBRARY, 'Reopened tasting, Texture zone with saved choices.', true);
    await zone('Taste'); await shot('9c-reopened-taste', LIBRARY, 'Reopened tasting, Taste wheel with saved choices.', true);

    // From the capture form
    await fresh(page, SOURCE);
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Complete tasting').catch(() => {});
    await shot('10-capture-before', SOURCE, 'The capture form (Source) before opening a tasting.');
    await click(page, page.getByRole('button', { name: /tasting profile/i }), 1800);
    await shot('10b-capture-tasting-open', SOURCE, 'Tasting opened from the capture form (Add tasting profile).');
    await btn('Open your impression');
    await btn('Love');
    await zone('Texture'); await btn('Silky');
    await click(page, page.getByRole('button', { name: /^(Leave tasting|Close)$/ }), 900);
    await click(page, page.getByRole('button', { name: 'Save and close', exact: true }), 1500);
    await shot('10c-capture-profile-strip', SOURCE, 'Capture form after saving a tasting: the tasting profile strip.', true);
  });
}
