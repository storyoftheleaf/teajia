import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';
import type { TeaConnection, TeaConnectionEdit } from '../shared/catalog/teaConnection';

const root = '/admin/catalog-review/teas';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/HwAAAABJRU5ErkJggg==';
const items = [
  { id: 'tea-10', title: 'Private loose tea', status: 'Confirmed Stock lot' },
  { id: 'tea-21', title: 'Handwritten bag', status: 'Identity under review' },
];
const hold = { title: 'Northern Vietnam ripe pu’er', url: '/shop/product/vietnam', locator: 'Ask the supplier for the growing province.' };
const passage = { id: 'history-basket', revision: 'source-revision', kind: 'Shared history', title: 'River packing',
  text: 'Packers lined baskets.', scope: 'Historical trade in Wuzhou.',
  sources: [{ title: 'Oral history', url: 'https://example.org/source' }],
  lots: [{ title: 'Basket tea', url: '/shop/product/basket' }] };
const history = { title: 'Y562', url: '/shop/product/y562', wisdom: '/wisdom/named/y562' };

async function openQueue(page: Page) {
  const mobileLink = page.getByRole('link', { name: 'Tea queue', exact: true });
  if (await mobileLink.isVisible()) await mobileLink.click();
  return page.getByRole('complementary', { name: 'Tea queue' });
}

async function fakeReview(page: Page) {
  await injectAuth(page);
  await mockInventoryApi(page);
  const vendors = [
    { id: 'supplier-one', name: 'Current supplier', tags: ['vendor'], face_photo: image },
    { id: 'supplier-two', name: 'Second supplier with a long name', tags: ['vendor'] },
    { id: 'vendor-three', name: 'Third supplier', tags: ['vendor'] },
    { id: 'buyer', name: 'Buyer only', tags: ['buyer'] },
  ];
  await page.route('**/api/customers', route => route.fulfill({ json: vendors }));
  await page.route('**/api/customers/*', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    const vendor = vendors.find(item => item.id === id);
    return route.fulfill({ status: vendor ? 200 : 404, json: vendor ?? {} });
  });
  let verdicts: Record<string, { decision: string; version: number }> = {};
  let writes = 0;
  const states = new Map<string, TeaConnection>();
  await page.route(/\/api\/admin\/catalog-review\/teas(?:[/?]|$)/, async route => {
    const request = route.request();
    expect(request.headers().authorization).toMatch(/^Bearer /);
    const url = new URL(request.url());
    const suffix = url.pathname.split('/teas')[1];
    if (!suffix) return route.fulfill({ json: items });
    if (suffix === '/decisions') return route.fulfill({ json: { passages: [passage], holds: [hold], histories: [history],
      intake: { 'tea-10': { nextCheck: 'Count the tea.' } }, verdicts } });
    if (suffix.startsWith('/decisions/')) {
      expect(request.method()).toBe('PUT');
      const { decision, revision, version } = request.postDataJSON();
      expect(revision).toBe(passage.revision);
      const verdict = { decision, version: version + 1 };
      verdicts = { ...verdicts, [passage.id]: verdict };
      return route.fulfill({ json: verdict });
    }
    if (suffix === '/connection') {
      if (url.searchParams.get('queue') === '1') return route.fulfill({ json: { matchedIntake: [], resolvedHolds: [] } });
      if (url.searchParams.has('stockSearch')) return route.fulfill({ json: [] });
      const id = url.searchParams.get('id')!;
      const view = url.searchParams.get('view');
      if (view === 'editorial') return route.fulfill({ status: 404 });
      const matched = id === 'tea-10' || id === hold.url;
      const key = matched ? 'stock' : id;
      let state = states.get(key) ?? { revision: 'approved-page', stockId: matched ? 'confirmed-product' : null,
        vendorId: matched ? vendors[0].id : null, vendor: matched ? { id: vendors[0].id, name: vendors[0].name } : null,
        canAssignVendor: true, finding: null, version: 0 };
      if (request.method() === 'PUT') {
        const body = request.postDataJSON() as TeaConnectionEdit;
        expect(body.expected).toEqual({ revision: state.revision, stockId: state.stockId, vendorId: state.vendorId, version: state.version });
        if (body.action === 'vendor') {
          const vendor = vendors.find(item => item.id === body.vendorId);
          state = { ...state, vendorId: body.vendorId, vendor: vendor ? { id: vendor.id, name: vendor.name } : null, version: state.version + 1 };
        } else if (body.action === 'finding') {
          state = { ...state, finding: { text: body.text, resolved: body.resolved }, version: state.version + 1 };
        }
        states.set(key, state);
        writes++;
      }
      return route.fulfill({ json: state });
    }
    const entry = items.find(item => '/' + item.id === suffix)!;
    const isPackage = entry.id === 'tea-21';
    return route.fulfill({ json: { ...entry, packageOnly: isPackage, type: isPackage ? '' : 'Dark',
      introduction: 'Introduction for ' + entry.title + '.', nextCheck: 'Verify the count.',
      evidence: isPackage ? 'The package says 100 grams and the order says 60 grams. '.repeat(7) : 'Recorded from the label.',
      photos: [image], facts: [], stockId: isPackage ? undefined : 'confirmed-product' } });
  });
  return () => writes;
}

test('one queue opens approved intake photos and preserves direct links', async ({ page }) => {
  await fakeReview(page);
  await page.goto(root + '/tea-10');
  await expect(page.getByRole('heading', { name: 'Private loose tea' })).toBeVisible();
  for (const entry of items) {
    const queue = await openQueue(page);
    await queue.getByRole('link', { name: new RegExp(entry.title) }).click();
    const intro = page.getByText('Introduction for ' + entry.title + '.', { exact: true });
    const photo = page.getByRole('img', { name: (entry.id === 'tea-21' ? 'Package for ' : '') + entry.title, exact: true });
    await expect(intro).toBeVisible();
    await expect(photo).toBeVisible();
    expect(await photo.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByText('Private package reference', { exact: true })).toHaveCount(entry.id === 'tea-21' ? 1 : 0);
    await expect(page.getByRole('link', { name: 'Open Stock record' })).toHaveCount(entry.id === 'tea-10' ? 1 : 0);
  }
});

test('one searchable queue keeps editorial verdicts, identity findings and named histories together', async ({ page }) => {
  await fakeReview(page);
  await page.goto(root + '?view=editorial');
  await expect(page.getByText(passage.text)).toBeVisible();
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Declined' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Decline', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Approve wording' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Approved' })).toBeVisible();

  const queue = await openQueue(page);
  await queue.getByRole('searchbox', { name: 'Search teas' }).fill('Northern Vietnam');
  await queue.getByRole('link', { name: /Northern Vietnam/ }).click();
  await expect(page.getByRole('button', { name: 'Review evidence' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Record supplier answer' }).click();
  await page.getByRole('textbox', { name: 'Supplier answer', exact: true }).fill('The supplier confirmed the commune.');
  await page.getByLabel('This resolves the check').check();
  await page.getByRole('button', { name: 'Save finding' }).click();
  await expect(page.getByText('The supplier confirmed the commune.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Update finding' })).toBeVisible();

  await openQueue(page);
  await queue.getByRole('searchbox', { name: 'Search teas' }).fill('Y562');
  await queue.getByRole('link', { name: /Y562/ }).click();
  await expect(page.getByRole('link', { name: 'Tea Wisdom' })).toHaveAttribute('href', '/wisdom/named/y562');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('owner can stage either picker, cancel, save and clear without changing an unresolved Stock match', async ({ page, isMobile }) => {
  const writes = await fakeReview(page);
  await page.goto(root + '?view=holds');
  const editor = page.getByRole('dialog', { name: 'Vendor for this tea' });
  const open = () => page.getByRole('button', { name: 'Change vendor' }).click();
  await open();
  const faceButton = editor.getByTestId('vendor-faces-button');
  const field = editor.getByRole('button', { name: /Proposed vendor/ });
  const [fieldBox, faceBox] = await Promise.all([field.boundingBox(), faceButton.boundingBox()]);
  expect(faceBox!.x).toBeGreaterThan(fieldBox!.x + fieldBox!.width - 1);
  expect(Math.abs(faceBox!.y + faceBox!.height / 2 - fieldBox!.y - fieldBox!.height / 2)).toBeLessThan(1);
  if (isMobile) expect(await faceButton.evaluate(button => button.offsetHeight)).toBeGreaterThanOrEqual(44);
  await faceButton.click();
  const faces = page.getByRole('dialog', { name: 'Pick a vendor by face' });
  await expect(faces.getByTestId('vendor-face-option')).toHaveCount(3);
  await expect(faces.locator('img')).toBeVisible();
  await faces.getByRole('button', { name: 'Third supplier' }).click();
  await expect(editor.getByRole('button', { name: /Proposed vendor Third supplier/ })).toBeVisible();
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(writes()).toBe(0);

  await open();
  await field.click();
  await editor.getByRole('searchbox', { name: 'Search vendors' }).fill('long name');
  await editor.getByRole('button', { name: /Second supplier/ }).click();
  await editor.getByRole('button', { name: 'Save vendor' }).click();
  await expect(page.getByRole('button', { name: 'Change vendor: Second supplier with a long name' })).toBeVisible();
  await open();
  await editor.getByRole('button', { name: 'Clear link' }).click();
  expect(writes()).toBe(1);
  await editor.getByRole('button', { name: 'Confirm clear' }).click();
  await expect(page.getByText('No vendor linked')).toBeVisible();
  await page.goto(root + '/tea-21');
  await expect(page.getByText('Vendor links here belong to this intake. The Stock match is still open.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Stock record/ })).toHaveCount(0);
});

test('the private finding footer stays above mobile navigation and saves without resolving the lot', async ({ page, isMobile }) => {
  await fakeReview(page);
  await page.goto(root + '/tea-21');
  const source = page.getByRole('region', { name: 'Intake evidence' });
  const open = source.getByRole('button', { name: 'Compare with Stock' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Find Stock match' });
  const save = dialog.getByRole('button', { name: 'Save private finding' });
  const cancel = dialog.getByRole('button', { name: 'Cancel' });
  await dialog.getByRole('textbox', { name: 'Private finding' }).fill('Find the order photo.');
  await expect(save).toBeEnabled();
  if (isMobile) {
    for (const button of [save, cancel]) {
      await expect.poll(() => button.evaluate(node => {
        const box = node.getBoundingClientRect();
        const bottomNav = document.querySelector('[data-testid="bottom-tab-bar"]')!.getBoundingClientRect();
        return box.bottom < bottomNav.top && node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
    }
    await save.tap();
  } else {
    await save.click();
  }
  await expect(open).toBeFocused();
  await expect(page.getByRole('button', { name: 'Edit private Stock finding' })).toContainText('Find the order photo.');
  await expect(page.getByRole('link', { name: 'Open Stock record' })).toHaveCount(0);
});
