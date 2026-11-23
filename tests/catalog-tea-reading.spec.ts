import { expect, test } from './fixtures';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

const root = '/admin/catalog-review/teas';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/HwAAAABJRU5ErkJggg==';
const items = [
  { id: 'tea-10', title: 'Private loose tea', status: 'Confirmed Stock lot' },
  { id: 'tea-21', title: 'Handwritten bag', status: 'Identity under review' },
];

test('owner can read each intake description next to its leaf or labelled reference', async ({ page }) => {
  await injectAuth(page);
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await mockInventoryApi(page);
  await page.route('**/api/admin/catalog-review/teas**', route => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    if (id === 'teas') return route.fulfill({ json: items });
    const entry = items.find(item => item.id === id)!;
    const isPackage = entry.id === 'tea-21';
    return route.fulfill({ json: { ...entry, packageOnly: isPackage, type: isPackage ? '' : 'Dark',
      introduction: 'Introduction for ' + entry.title + '.', nextCheck: 'Verify the count.', evidence: 'Recorded from the label.',
      photos: [image], facts: [], stockId: isPackage ? undefined : 'confirmed-product',
    } });
  });
  await page.goto(root);
  for (const entry of items) {
    await page.getByRole('link', { name: new RegExp(entry.title) }).click();
    const intro = page.getByText('Introduction for ' + entry.title + '.', { exact: true });
    await expect(intro).toBeVisible();
    const photo = page.getByRole('img', { name: (entry.id === 'tea-21' ? 'Package for ' : '') + entry.title, exact: true });
    await expect(photo).toBeVisible();
    expect(await photo.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect(await photo.evaluate((img, text) => Array.from(document.querySelectorAll('p')).some(p =>
      p.textContent === text && Boolean(img.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING)), await intro.textContent())).toBeTruthy();
    await expect(page.getByText('Private package reference', { exact: true })).toHaveCount(entry.id === 'tea-21' ? 1 : 0);
    await expect(page.getByRole('link', { name: 'Open Stock record' })).toHaveCount(entry.id === 'tea-10' ? 1 : 0);
    await page.getByRole('link', { name: 'All tea write-ups' }).click();
  }
});
