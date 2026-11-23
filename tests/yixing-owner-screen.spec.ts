import { expect, test, type Page } from './fixtures';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

const base = '/admin/yixing';
const photo = { role: 'Main view', sha256: 'a'.repeat(64), originalSha256: 'b'.repeat(64) };
const shape = { id: 'shape-example', kind: 'shape', name: 'Example form', summary: 'A sourced comparison.',
  status: 'Descriptive form', sources: [{ title: 'Museum specimen', url: 'https://example.org/object' }] };
const pot = { id: 'pots-example', name: 'Example teapot', listing: { name: 'Example teapot' },
  photos: [photo], observation: 'Example observation.', comparisonIds: [shape.id] };
const duanni = { id: 'clay-duanni', kind: 'clay', name: 'Duanni', summary: 'A clay reference for Duanni.',
  status: 'Clay family', sources: [] };
const zini = { ...duanni, id: 'clay-zini', name: 'Zini', summary: 'A clay reference for Zini.' };
const potWithLead = { ...pot, id: 'pots-with-lead', name: 'Example with a clay lead',
  clayLead: { label: 'Clay family unclear', note: 'Duanni is one lead to check.' },
  comparisonIds: [shape.id, duanni.id] };
const board = { version: 1, reference: { title: 'Yixing teapots', scope: '', entries: [shape, duanni, zini] },
  pots: [pot, potWithLead] };

test('login returns to the private pot address', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.goto(base + '/' + pot.id);
  await expect(page).toHaveURL(/\/signin\?/);
  expect([...new URL(page.url()).searchParams.values()]).toContain(base + '/' + pot.id);
});

async function mockOwnerBoard(page: Page) {
  await injectAuth(page);
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await mockInventoryApi(page);
  const decisions = new Map<string, { revision: number }>();
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
      const id = path.split('/').pop()!;
      expect(board.pots.some(item => item.id === id)).toBe(true);
      const decision = { ...request.postDataJSON(), revision: (decisions.get(id)?.revision ?? 0) + 1 };
      decisions.set(id, decision);
      return route.fulfill({ json: decision });
    }
    return route.fulfill({ json: { ...board, decisions: Object.fromEntries(decisions) } });
  });
  return requested;
}

test('review, protected photographs and the shared listing follow the saved decision', async ({ page }) => {
  const requested = await mockOwnerBoard(page);
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

test('a supplied clay lead can be denied, undone and approved across reloads', async ({ page }) => {
  await mockOwnerBoard(page);
  await page.goto(base + '/' + potWithLead.id);
  const clay = page.getByRole('combobox', { name: 'Clay', exact: true });
  await expect(clay).toHaveValue('');
  await page.getByRole('button', { name: 'Deny Duanni', exact: true }).click();
  const undo = page.getByRole('button', { name: 'Undo denial' });
  await expect(undo).toBeVisible();
  await page.reload();
  await expect(undo).toBeVisible();
  await expect(clay).toHaveValue('');
  await page.getByRole('link', { name: 'Listing preview' }).click();
  await expect(page.getByRole('heading', { name: potWithLead.listing.name })).toBeVisible();
  await expect(page.getByRole('link', { name: duanni.name, exact: true })).toHaveCount(0);
  await expect(page.getByText(duanni.summary, { exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to review' }).click();
  await undo.click();
  const approve = page.getByRole('button', { name: 'Approve Duanni', exact: true });
  await expect(approve).toBeEnabled();
  const note = page.getByLabel('Private evidence note');
  await note.fill('Unfinished note');
  await approve.click();
  await expect(clay).toHaveValue(duanni.id);
  await expect(note).toHaveValue('Unfinished note');
  await page.reload();
  await expect(note).toHaveValue('');
  await expect(clay).toHaveValue(duanni.id);
  await page.getByRole('link', { name: 'Listing preview' }).click();
  await expect(page.getByRole('link', { name: duanni.name, exact: true })).toBeVisible();
  await expect(page.getByText(duanni.summary, { exact: true })).toBeVisible();
});

test('a pot without a lead accepts manual clay and a different clay from its Wisdom guide', async ({ page }) => {
  await mockOwnerBoard(page);
  const potUrl = base + '/' + pot.id;
  await page.goto(potUrl);
  const clay = page.getByRole('combobox', { name: 'Clay', exact: true });
  await expect(clay).toHaveValue('');
  await expect(page.getByRole('button', { name: /^Approve / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Deny / })).toHaveCount(0);
  await clay.selectOption(zini.id);
  await expect(page.getByRole('status').filter({ hasText: 'Clay applied.' })).toBeVisible();
  await page.reload();
  await expect(clay).toHaveValue(zini.id);

  await page.getByLabel('Private evidence note').fill('An unfinished comparison');
  await page.getByRole('link', { name: 'Yixing Wisdom', exact: true }).click();
  await page.getByRole('button', { name: 'Apply Duanni', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === potUrl);
  await expect(page.getByLabel('Private evidence note')).toHaveValue('An unfinished comparison');
  await expect(clay).toHaveValue(duanni.id);
  await page.reload();
  await expect(clay).toHaveValue(duanni.id);
  await page.goto(base + '/' + potWithLead.id);
  await expect(clay).toHaveValue('');
});

test('a contextual clay reference can deny its suggestion for the originating pot', async ({ page }) => {
  await mockOwnerBoard(page);
  await page.goto(base + '/wisdom?pot=' + potWithLead.id + '#' + duanni.id);
  await expect(page.getByRole('button', { name: 'Use Duanni for this pot' })).toBeVisible();
  await page.getByRole('button', { name: 'Deny Duanni', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === base + '/' + potWithLead.id);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Undo denial' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Clay', exact: true })).toHaveValue('');
});

test('the guide without a current pot opens clay references for reading', async ({ page }) => {
  await mockOwnerBoard(page);
  await page.goto(base + '/wisdom');
  await page.getByRole('link', { name: duanni.name, exact: true }).click();
  await expect(page.getByRole('heading', { name: duanni.name, exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: /^(Apply |Use .* for this pot)/ })).toHaveCount(0);
});
