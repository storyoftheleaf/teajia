import { expect, test } from './fixtures';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

const root = '/admin/yixing';
const apiRoot = '/api/admin/yixing';
const pot = {
  id: 'pots-04',
  name: 'Pot 04',
  listing: { name: 'Pot 04' },
  photos: [{ role: 'Main view', sha256: 'a'.repeat(64), originalSha256: 'b'.repeat(64) }],
  observation: 'Six flat sides and an inscribed face.',
  comparisonIds: [],
};
const clay = { id: 'clay-duanni', kind: 'clay', name: 'Duanni', status: 'Clay family', summary: 'A clay reference.', sources: [] };
const color = { id: 'color-brown', kind: 'color', name: 'Brown', status: 'Fired color', summary: 'Observed brown.', sources: [] };
const shape = {
  id: 'liufangjing', chinese: '六方井壺（長樂刻字）', pinyin: 'liùfāng jǐng hú',
  kind: 'Named form', silhouette: 'Faceted or geometric', variants: '六方井壶', nearNeighbors: 'Compare other six-sided forms.',
  features: { profile: 'Six tapered planes', foot: 'Recessed hexagonal foot', lid: 'Inset hexagonal lid',
    knob: 'Faceted post', spout: 'Straight angular spout', handle: 'Angular loop' },
  exemplar: { title: '早期收藏 紫砂壺 刻長樂', credit: 'Yahoo Taiwan auction listing',
    recordUrl: 'https://tw.bid.yahoo.com/item/100697521476', asset: 'assets/liufangjing-changle.jpg', rights: 'Private comparison' },
  supportingSources: [],
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/HwAAAABJRU5ErkJggg==', 'base64');

type ShapeVerdict = {
  formId: string; asset: string; chinese: string; pinyin: string; title: string; recordUrl: string;
  verdict: 'confirmed' | 'rejected';
};
const priorRejection: ShapeVerdict = {
  formId: 'banyue', asset: 'assets/banyue.jpg', chinese: '半月壺', pinyin: 'bànyuè hú',
  title: 'Half-moon comparison', recordUrl: 'https://example.org/half-moon', verdict: 'rejected',
};
const matchingExample = {
  formId: shape.id, asset: shape.exemplar.asset, chinese: shape.chinese, pinyin: shape.pinyin,
  title: shape.exemplar.title, recordUrl: shape.exemplar.recordUrl,
};
type VerdictRequest = {
  formId: string; asset: string; action: 'confirm' | 'reject' | 'withdraw'; revision: number;
};
const otherDecisions = {
  clay: clay.id, color: color.id, shape: '', note: 'Saved private observation.',
  rejectedClays: ['clay-zini'],
};
type Decision = typeof otherDecisions & {
  revision: number; confirmedShape?: ShapeVerdict; rejectedShapes: Record<string, ShapeVerdict>;
};

test('Pot 04 can reject, confirm and withdraw a library shape without changing its other review decisions', async ({ page }) => {
  await injectAuth(page);
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await mockInventoryApi(page);

  const writes: VerdictRequest[] = [];
  let decision: Decision = { ...otherDecisions, revision: 7, rejectedShapes: { banyue: priorRejection } };
  await page.route('**/api/admin/yixing**', async route => {
    const request = route.request();
    expect(request.headers().authorization).toMatch(/^Bearer /);
    const path = new URL(request.url()).pathname;
    if (path.includes('/media/')) return route.fulfill({ body: png, contentType: 'image/png' });
    if (path === apiRoot + '/shapes') return route.fulfill({ json: { schemaVersion: 1, libraryVersion: '4.0.0', forms: [shape] } });
    if (request.method() === 'PUT') {
      expect(path).toBe(apiRoot + '/pots/' + pot.id + '/shape-verdict');
      const change: VerdictRequest = request.postDataJSON();
      expect(change).toEqual({ formId: shape.id, asset: shape.exemplar.asset, action: expect.any(String), revision: decision.revision });
      writes.push(change);
      const rejectedShapes = { ...decision.rejectedShapes };
      let confirmedShape = decision.confirmedShape;
      if (change.action === 'reject') rejectedShapes[shape.id] = { ...matchingExample, verdict: 'rejected' };
      if (change.action === 'confirm') {
        delete rejectedShapes[shape.id];
        confirmedShape = { ...matchingExample, verdict: 'confirmed' };
      }
      if (change.action === 'withdraw') {
        expect(confirmedShape?.formId).toBe(shape.id);
        confirmedShape = undefined;
      }
      decision = { ...decision, revision: decision.revision + 1, confirmedShape, rejectedShapes };
      return route.fulfill({ json: decision });
    }
    return route.fulfill({ json: {
      version: 1, reference: { title: 'Yixing teapots', scope: '', entries: [clay, color] },
      pots: [pot], decisions: { [pot.id]: decision },
    } });
  });

  const reviewPath = root + '/' + pot.id;
  const selectReference = async () => {
    await page.getByRole('link', { name: 'Compare shapes', exact: true }).click();
    await page.getByRole('link', { name: new RegExp(shape.chinese.slice(0, 4)) }).click();
    await expect(page.getByRole('heading', { name: shape.chinese, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Source record' })).toHaveAttribute('href', shape.exemplar.recordUrl);
  };
  const compare = async (action: string, status: string) => {
    await page.getByRole('button', { name: action, exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: status })).toBeVisible();
  };

  await page.goto(reviewPath);
  await selectReference();
  await compare('Reject shape', 'Shape rejected.');
  await expect(page.getByRole('button', { name: 'Undo rejection', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Undo rejection', exact: true })).toBeVisible();
  expect(decision.rejectedShapes).toEqual({ banyue: priorRejection, [shape.id]: { ...matchingExample, verdict: 'rejected' } });

  await page.getByRole('link', { name: /Back to Pot 04/ }).click();
  await page.getByRole('link', { name: 'Listing preview' }).click();
  await expect(page.getByRole('navigation', { name: 'Private listing preview' })).toBeVisible();
  await expect(page.getByText(shape.chinese, { exact: false })).toHaveCount(0);
  await expect(page.getByText(priorRejection.chinese, { exact: false })).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to review' }).click();
  const note = page.getByLabel('Private evidence note');
  await expect(note).toHaveValue(otherDecisions.note);
  await note.fill('Unsaved shape comparison note.');
  await selectReference();
  await compare('Confirm shape', 'Shape confirmed.');
  expect(decision.rejectedShapes).toEqual({ banyue: priorRejection });
  await page.getByRole('link', { name: /Back to Pot 04/ }).click();
  await expect(note).toHaveValue('Unsaved shape comparison note.');
  await expect(page.getByRole('combobox', { name: 'Clay', exact: true })).toHaveValue(clay.id);
  await expect(page.getByRole('combobox', { name: 'Observed fired color' })).toHaveValue(color.id);
  await page.getByRole('link', { name: 'Listing preview' }).click();
  const confirmedFact = page.getByRole('link', { name: shape.chinese + ' · ' + shape.pinyin, exact: true });
  await expect(confirmedFact).toBeVisible();
  await expect(page.getByText(priorRejection.chinese, { exact: false })).toHaveCount(0);
  await expect(page.getByText(otherDecisions.note, { exact: true })).toHaveCount(0);
  await confirmedFact.click();
  await expect(page).toHaveURL(url => url.pathname === root + '/wisdom/shapes/' + shape.id
    && url.searchParams.get('pot') === pot.id && url.searchParams.get('ref') === shape.exemplar.asset);
  await compare('Withdraw confirmation', 'Confirmation withdrawn.');

  await page.getByRole('link', { name: /Back to Pot 04/ }).click();
  await expect(page).toHaveURL(url => url.pathname === reviewPath + '/listing');
  await expect(page.getByRole('navigation', { name: 'Private listing preview' })).toBeVisible();
  await expect(confirmedFact).toHaveCount(0);
  await expect(page.getByRole('link', { name: clay.name, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: color.name, exact: true })).toBeVisible();
  expect(writes.map(write => [write.action, write.revision])).toEqual([['reject', 7], ['confirm', 8], ['withdraw', 9]]);
  expect(decision).toMatchObject({ ...otherDecisions, revision: 10, rejectedShapes: { banyue: priorRejection } });
  expect(decision.confirmedShape).toBeUndefined();
});
