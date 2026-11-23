import { expect, test, type Page } from './fixtures';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

import type { Decision } from '../src/admin/views/yixing/data';

const base = '/admin/yixing';
const photo = { role: 'Main view', sha256: 'a'.repeat(64), originalSha256: 'b'.repeat(64) };
const shape = { id: 'shape-example', kind: 'shape', name: 'Example form', summary: 'A sourced comparison.',
  status: 'Descriptive form', sources: [{ title: 'Museum specimen', url: 'https://example.org/object' }] };
const pot = { id: 'pots-example', name: 'Example teapot', listing: { name: 'Example teapot' },
  photos: [photo], observation: 'Example observation.', comparisonIds: [shape.id] };
const duanni = { id: 'clay-duanni', kind: 'clay', name: 'Duanni', summary: 'A clay reference for Duanni.',
  status: 'Clay family', sources: [] };
const firedColor = { ...duanni, id: 'color-brown', kind: 'color', name: 'Brown' };
const zini = { ...duanni, id: 'clay-zini', name: 'Zini', summary: 'A clay reference for Zini.' };
const potWithLead = { ...pot, id: 'pots-with-lead', name: 'Example with a clay lead',
  clayLead: { label: 'Clay family unclear', note: 'Duanni is one lead to check.' },
  comparisonIds: [shape.id, duanni.id] };
const board = { version: 1, reference: { title: 'Yixing teapots', scope: '', entries: [shape, duanni, zini, firedColor] },
  pots: [pot, potWithLead] };

test('login returns to the private pot address', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.goto(base + '/' + pot.id);
  await expect(page).toHaveURL(/\/signin\?/);
  expect([...new URL(page.url()).searchParams.values()]).toContain(base + '/' + pot.id);
});

interface BoardOptions {
  pots?: typeof board.pots;
  decisions?: Map<string, Decision>;
  writes?: string[];
  conflict?: (id: string) => boolean;
}

async function mockOwnerBoard(page: Page, options: BoardOptions = {}) {
  await injectAuth(page);
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await mockInventoryApi(page);
  const decisions = options.decisions ?? new Map<string, Decision>();
  const pots = options.pots ?? board.pots;
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
      expect(pots.some(item => item.id === id)).toBe(true);
      const data = request.postDataJSON();
      options.writes?.push(id);
      const revision = decisions.get(id)?.revision ?? 0;
      if (options.conflict?.(id) || data.revision !== revision) {
        return route.fulfill({ status: 409, json: { error: 'The review changed. Reopen this pot before saving.' } });
      }
      const decision = { ...data, revision: revision + 1 };
      decisions.set(id, decision);
      return route.fulfill({ json: decision });
    }
    return route.fulfill({ json: { ...board, pots, decisions: Object.fromEntries(decisions) } });
  });
  return requested;
}

const groupPots = ['One', 'Two', 'Three'].map(name => ({ ...potWithLead, id: 'pot-' + name, name }));
const priorDecision: Decision = { clay: '', color: firedColor.id, shape: shape.id, note: 'Recorded evidence', revision: 3, rejectedClays: [zini.id] };

for (const action of ['approve', 'deny'] as const) {
  test('grouped clay ' + action + ' saves only selected pots and persists across reload', async ({ page }) => {
    const [first, second, untouched] = groupPots;
    const decisions = new Map(groupPots.map(item => [item.id, { ...priorDecision }]));
    const writes: string[] = [];
    await mockOwnerBoard(page, { pots: [...groupPots, pot], decisions, writes });
    await page.goto(base);
    const group = page.getByRole('combobox', { name: 'Review by clay' });
    await group.selectOption(duanni.id);
    for (const item of [first, second]) await page.getByRole('checkbox', { name: 'Select ' + item.name }).check();
    await page.getByRole('button', { name: action === 'approve' ? 'Approve selected (2)' : 'Deny selected' }).click();
    await expect(page.getByText('2 decisions saved.')).toBeVisible();
    expect(writes).toEqual([first.id, second.id]);
    for (const item of [first, second]) {
      expect(decisions.get(item.id)).toEqual({ ...priorDecision, revision: 4,
        clay: action === 'approve' ? duanni.id : '',
        rejectedClays: action === 'approve' ? [zini.id] : [zini.id, duanni.id] });
    }
    expect(decisions.get(untouched.id)).toEqual(priorDecision);
    expect(decisions.has(pot.id)).toBe(false);
    await page.reload();
    await expect(group).toHaveValue(duanni.id);
    await expect(page.getByRole('checkbox')).toHaveCount(1);
    await expect(page.getByRole('checkbox', { name: 'Select ' + untouched.name })).not.toBeChecked();
    await group.selectOption('confirmed');
    const rows = page.getByRole('listitem').filter({ has: page.locator('a[href^="/admin/yixing/pot"]') });
    await expect(rows).toHaveCount(action === 'approve' ? 2 : 0);
    await group.selectOption('evidence');
    await expect(rows).toHaveCount(action === 'deny' ? 3 : 1);
    await expect(page.getByRole('link', { name: new RegExp(pot.name) })).toBeVisible();
  });
}

test('grouped clay stops on conflict, refreshes the board and retries outstanding work only', async ({ page }) => {
  const [first, second, third] = groupPots;
  const decisions = new Map(groupPots.map(item => [item.id, { ...priorDecision }]));
  const writes: string[] = [];
  const concurrent = { ...priorDecision, note: 'Updated elsewhere', revision: 4 };
  await mockOwnerBoard(page, { pots: groupPots, decisions, writes, conflict: id => {
    if (id !== second.id || decisions.get(id)?.revision !== priorDecision.revision) return false;
    decisions.set(id, concurrent);
    return true;
  } });
  await page.goto(base + '?clay=' + duanni.id);
  for (const item of groupPots) await page.getByRole('checkbox', { name: 'Select ' + item.name }).check();
  await page.getByRole('button', { name: 'Approve selected (3)' }).click();
  await expect(page.getByText(/1 of 3 saves confirmed/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve selected (0)' })).toBeDisabled();
  expect(writes).toEqual([first.id, second.id]);
  expect(decisions.get(second.id)).toEqual(concurrent);
  expect(decisions.get(third.id)).toEqual(priorDecision);
  await expect(page.getByRole('checkbox', { name: 'Select ' + first.name })).toHaveCount(0);
  for (const item of [second, third]) await page.getByRole('checkbox', { name: 'Select ' + item.name }).check();
  await page.getByRole('button', { name: 'Approve selected (2)' }).click();
  await expect(page.getByText('2 decisions saved.')).toBeVisible();
  expect(writes).toEqual([first.id, second.id, second.id, third.id]);
  expect(decisions.get(second.id)).toEqual({ ...concurrent, clay: duanni.id, revision: 5 });
});

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

test('shape library compares protected references with the current pot and preserves the review', async ({ page }) => {
  await injectAuth(page);
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await mockInventoryApi(page);
  const libraryPath = base + '/wisdom/shapes';
  const shapeForm = {
    id: 'shipiao', chinese: '石瓢壶', pinyin: 'shípiáo hú', kind: 'Named form', silhouette: 'Low or flattened',
    variants: '石瓢壺', nearNeighbors: 'Check the foot.', features: { profile: 'Low body', foot: 'Three feet',
      lid: 'Flat lid', knob: 'Bridge knob', spout: 'Straight spout', handle: 'Loop handle' },
    exemplar: { title: 'Xu Han Tang · 石瓢壶', credit: 'Museum', maker: '徐汉棠', asset: 'assets/shipiao.jpg',
      recordUrl: 'https://example.org/shipiao', rights: 'Private reference', views: [
        { label: 'Underside', asset: 'assets/shipiao-bottom.jpg', imageUrl: 'https://example.org/image.jpg' },
      ] },
    additionalExemplars: [
      { title: 'Second example', credit: 'Museum', asset: 'assets/shipiao-alternate.jpg',
        recordUrl: 'https://example.org/shipiao-alternate', rights: 'Private reference',
        reviewStatus: 'Owner addition awaiting source review' },
    ],
    supportingSources: [],
  };
  const forms = [shapeForm, ...Array.from({ length: 14 }, (_, index) => ({
    ...shapeForm, id: 'round-' + index, chinese: '圆壶 ' + index, pinyin: 'yuán hú',
    silhouette: 'Round', variants: '', additionalExemplars: [],
    exemplar: { ...shapeForm.exemplar, title: 'Round teapot', maker: '', asset: 'assets/round-' + index + '.jpg', views: [] },
  }))];
  const images = new Set<string>();
  await page.route('**/api/admin/yixing**', async route => {
    const request = route.request();
    expect(request.headers().authorization).toMatch(/^Bearer /);
    const path = new URL(request.url()).pathname;
    if (path.includes('/media/')) {
      images.add(path);
      return route.fulfill({ body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/HwAAAABJRU5ErkJggg==', 'base64'), contentType: 'image/png' });
    }
    if (path.endsWith('/shapes')) return route.fulfill({ json: { schemaVersion: 1, libraryVersion: '2.0.0', forms } });
    return route.fulfill({ json: { ...board, decisions: {} } });
  });

  await page.goto(base + '/' + pot.id + '?view=original');
  await page.getByLabel('Private evidence note').fill('Unsaved comparison note');
  await page.getByRole('link', { name: 'Compare shapes' }).click();
  await expect(page.getByRole('heading', { name: 'Shape Library', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '15 forms' })).toBeVisible();
  await expect(page.getByRole('img', { name: pot.name + ' · Main view' })).toHaveAttribute('src', /^blob:/);
  expect([...images].some(path => path.endsWith('/media/round-13.jpg'))).toBeFalsy();

  await page.getByRole('searchbox', { name: 'Search shapes' }).fill('shi piao');
  await expect(page.getByRole('status').filter({ hasText: '1 form' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Silhouette' }).selectOption('Round');
  await expect(page.getByText('No forms match these filters.')).toBeVisible();
  await page.getByRole('combobox', { name: 'Silhouette' }).selectOption('');
  await page.getByRole('searchbox', { name: 'Search shapes' }).fill('徐汉棠');
  await page.getByRole('link', { name: /石瓢壶/ }).click();
  await expect(page.getByRole('heading', { name: '石瓢壶', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Source record' })).toHaveAttribute('href', shapeForm.exemplar.recordUrl);
  await page.getByRole('button', { name: 'Underside', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Xu Han Tang · 石瓢壶 · Underside' })).toHaveAttribute('src', /^blob:/);
  expect([...images].some(path => path.endsWith('/shapes/media/shipiao-bottom.jpg'))).toBeTruthy();
  await page.getByRole('combobox', { name: 'Reference example' }).selectOption('assets/shipiao-alternate.jpg');
  await expect(page.getByRole('heading', { name: 'Second example', exact: true })).toBeVisible();
  await expect(page.getByText('Owner addition awaiting source review', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: /Back to Example teapot/ }).click();
  await expect(page).toHaveURL(base + '/' + pot.id + '?view=original');
  await expect(page.getByLabel('Private evidence note')).toHaveValue('Unsaved comparison note');

  await page.goto(libraryPath + '?pot=invalid');
  await expect(page.getByRole('link', { name: /Back to Yixing Wisdom/ })).toBeVisible();
  await expect(page.getByRole('region', { name: /Compare with/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Back to Yixing Wisdom/ }).click();
  await expect(page.getByRole('link', { name: 'Shape Library', exact: true })).toBeVisible();
});
