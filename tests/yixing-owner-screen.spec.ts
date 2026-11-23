import { expect, test } from './fixtures';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

const base = '/admin/yixing';
const photo = { role: 'Main view', sha256: 'a'.repeat(64), originalSha256: 'b'.repeat(64) };
const shape = { id: 'shape-example', kind: 'shape', name: 'Example form', summary: 'A sourced comparison.',
  status: 'Descriptive form', sources: [{ title: 'Museum specimen', url: 'https://example.org/object' }] };
const pot = { id: 'pots-example', name: 'Example teapot', listing: { name: 'Example teapot' },
  photos: [photo], observation: 'Example observation.', comparisonIds: [shape.id] };
const board = { version: 1, reference: { title: 'Yixing teapots', scope: '', entries: [shape] }, pots: [pot] };

test('login returns to the private pot address', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.goto(base + '/' + pot.id);
  await expect(page).toHaveURL(/\/signin\?/);
  expect([...new URL(page.url()).searchParams.values()]).toContain(base + '/' + pot.id);
});

test('review, protected photographs and the shared listing follow the saved decision', async ({ page }) => {
  await injectAuth(page);
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await mockInventoryApi(page);
  let decision = { shape: '', color: '', clay: '', note: '', revision: 0 };
  const requested = new Set<string>();
  await page.route('**/api/admin/yixing**', async route => {
    const request = route.request();
    expect(request.headers().authorization).toMatch(/^Bearer /);
    const path = new URL(request.url()).pathname;
    if (path.includes('/media/')) {
      requested.add(path.split('/').pop()!);
      return route.fulfill({ body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/HwAAAABJRU5ErkJggg==', 'base64'), contentType: 'image/png' });
    }
    if (request.method() === 'PUT') {
      decision = { ...request.postDataJSON(), revision: decision.revision + 1 };
      return route.fulfill({ json: decision });
    }
    return route.fulfill({ json: { ...board, decisions: { [pot.id]: decision } } });
  });
  await page.goto(base + '/' + pot.id);
  await expect(page.getByRole('heading', { name: pot.name })).toBeVisible();
  await page.getByRole('button', { name: 'Compare original photos' }).click();
  await expect.poll(() => requested.has(photo.originalSha256 + '.jpg')).toBeTruthy();
  await page.getByRole('link', { name: shape.name }).click();
  await expect(page.getByRole('heading', { name: shape.name })).toBeInViewport();
  await page.getByRole('link', { name: /Back to Example teapot/ }).last().click();
  await page.getByRole('combobox', { name: 'Shape', exact: true }).selectOption(shape.id);
  await page.getByLabel('Private evidence note').fill('Private observation.');
  await page.evaluate(() => window.dispatchEvent(new Event('teajia:auth-token-changed')));
  await expect(page.getByLabel('Private evidence note')).toHaveValue('Private observation.');
  await expect(page.getByRole('combobox', { name: 'Shape', exact: true })).toHaveValue(shape.id);
  await page.getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Review saved.' })).toBeVisible();
  await page.getByRole('link', { name: 'Listing preview' }).click();
  await expect(page.getByText(shape.summary, { exact: true })).toBeAttached();
  await expect(page.getByText('Private observation.', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: shape.name, exact: true }).click();
  await page.getByRole('link', { name: /Back to Example teapot/ }).last().click();
  await expect(page).toHaveURL(/\/listing$/);
  await page.getByRole('link', { name: 'Back to review' }).click();
  await page.getByRole('combobox', { name: 'Shape', exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Review saved.' })).toBeVisible();
  await page.getByRole('link', { name: 'Listing preview' }).click();
  await expect(page.getByRole('heading', { name: pot.listing.name })).toBeAttached();
  await expect(page.getByText(shape.summary, { exact: true })).toHaveCount(0);
});
