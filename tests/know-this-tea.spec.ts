// "Does anyone know this tea?" on the Tea Table (Launch 5, M8), with mocked
// routes, at 390 by 844 and 1280 by 800.
//
//   npx playwright test -c tests/know-this-tea.config.ts
//
// That config starts its own Vite with the Tea Table and this slice open.
// Under any other config the slice is closed, and the one closed test proves
// nothing of it shows.
import { expect, test, type Page, type Route } from './fixtures';

const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGNoSHDAihgGUgIA33c2AWgCUREAAAAASUVORK5CYII=',
  'base64',
);

const identities = {
  asker: { sub: 'lin', username: 'lin', name: 'Lin Wei', email: 'lin@example.test' },
  knower: { sub: 'mei', username: 'mei', name: 'Mei Chen', email: 'mei@example.test' },
};

const TASTING = {
  kind: 'tasting', id: 'journal-1', at: '2026-11-25 09:00:00',
  person: { name: 'Mei', path: '/people/mei' },
  tea: { name: 'Old Tree Red', chinese_name: null, path: '/shop/product/old-tree-red?store=teajia-bali', type: 'Red' },
  words: [{ date: '2026-11-24T08:00:00Z', text: 'Honey on the lid.' }],
  photographs: [],
};
function question(named: unknown = null) {
  return {
    kind: 'question', id: 'q-1', at: '2026-11-25 10:00:00',
    person: { name: 'Lin', path: null },
    where_from: 'A market stall in Fuzhou, wrapped in plain paper.',
    photograph: {
      id: 'q-1', small_url: 'https://media.teajia.co/family-photos/tea-table-questions/q-1-small.jpg',
      full_url: 'https://media.teajia.co/family-photos/tea-table-questions/q-1-full.jpg',
      small_width: 480, small_height: 360, shape: 'across', frame: null,
    },
    named,
  };
}

type State = {
  named: unknown; thankedNote: string | null; takenOff: boolean;
  asked: Array<{ body: string; contentType: string }>; told: unknown[]; namedWith: unknown[]; thanks: unknown[];
};
const fresh = (): State => ({ named: null, thankedNote: null, takenOff: false, asked: [], told: [], namedWith: [], thanks: [] });

async function signIn(page: Page, actor: keyof typeof identities) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const claims = { ...identities[actor], role: 'user', exp: Math.floor(Date.now() / 1000) + 86400, memberships: [], active_account_id: null };
  const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode(claims), 'fixture'].join('.');
  await page.addInitScript(value => localStorage.setItem('teajia_token', value), token);
}

async function mock(page: Page, state: State, actor: keyof typeof identities | null) {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const notes = () => [
    { id: 'n-mei', at: '2026-11-25 11:00:00', by: 'Mei', words: 'Old Bush Shuixian. The shop has it.',
      tea: { name: 'Old Bush Shuixian', path: '/shop/product/old-bush-shuixian?store=teajia-bali' }, name_shown: true, thanked: state.thankedNote === 'n-mei' },
    { id: 'n-hana', at: '2026-11-25 12:00:00', by: 'Hana', words: 'A Wuyi rock tea, I think.', tea: null, name_shown: false, thanked: false },
  ];
  const current = () => {
    const named = state.named as { name: string; path: string | null } | null;
    return question(named ? { ...named, by: state.thankedNote ? 'Mei' : null } : null);
  };
  await page.route('**/*', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    const path = url.pathname;
    const method = request.method();
    if (!path.startsWith('/api/')) return route.continue();
    if (path.startsWith('/api/media/') || path === '/api/public/read/publish-state' || path === '/api/read/session') return route.fallback();
    if (path === '/api/auth/me') {
      return actor ? route.fulfill({ json: { ...identities[actor], id: identities[actor].sub } }) : route.fulfill({ status: 401, json: {} });
    }
    if (path === '/api/tea-table') {
      const show = url.searchParams.get('show') ?? 'all';
      const items = show === 'all' && !state.takenOff ? [current(), TASTING] : [TASTING];
      return route.fulfill({ json: { held: [], items, earlier: null } });
    }
    if (path === '/api/tea-table/me') {
      return route.fulfill({ json: { kept: [], mine: actor === 'asker' && !state.takenOff ? ['question:q-1'] : [] } });
    }
    if (path === '/api/tea-table/questions' && method === 'POST') {
      state.asked.push({ body: request.postDataBuffer()?.toString('latin1') ?? '', contentType: request.headers()['content-type'] ?? '' });
      return route.fulfill({ status: 201, json: { question: question() } });
    }
    if (path === '/api/tea-table/questions/q-1') {
      if (method === 'DELETE') { state.takenOff = true; return route.fulfill({ json: { kind: 'question', id: 'q-1', on_table: false } }); }
      return state.takenOff ? route.fulfill({ status: 404, json: { error: 'Not found', code: 'not_found' } }) : route.fulfill({ json: { question: current() } });
    }
    if (path === '/api/tea-table/questions/q-1/asked') {
      return actor === 'asker' ? route.fulfill({ json: { question: current(), notes: notes() } }) : route.fulfill({ status: 404, json: { error: 'Not found', code: 'not_found' } });
    }
    if (path === '/api/tea-table/questions/q-1/note' && method === 'PUT') {
      state.told.push(request.postDataJSON());
      return route.fulfill({ json: { told: true } });
    }
    if (path === '/api/tea-table/questions/q-1/named' && method === 'PUT') {
      const body = request.postDataJSON();
      state.namedWith.push(body);
      state.named = { name: body.name ?? 'Old Bush Shuixian', path: body.tea ?? null };
      return route.fulfill({ json: { question: current() } });
    }
    if (path === '/api/tea-table/questions/q-1/thanks' && method === 'PUT') {
      const body = request.postDataJSON();
      state.thanks.push(body);
      state.thankedNote = body.note_id;
      return route.fulfill({ json: { question: current() } });
    }
    if (method === 'GET') {
      if (path === '/api/events' || path === '/api/products/public' || path === '/api/network/stores') return route.fulfill({ json: [] });
      if (path === '/api/rates') return route.fulfill({ json: [{ currency: 'USD', rate_to_usd: 1 }] });
      if (path === '/api/user/favorites') return route.fulfill({ json: { favorites: [] } });
    }
    return route.fulfill({ status: 404, json: { error: 'Not found' } });
  });
}

async function expectQuietAndFitting(page: Page) {
  const text = await page.getByTestId('tea-table-page').innerText();
  expect(text).not.toMatch(/\b(likes?|comments?|repl(y|ies)|follow(ers?|ing)?|views?|trending|popular|for you|feed|answers?)\b/i);
  for (const piece of await page.getByTestId('tea-table-question').all()) expect(await piece.innerText()).not.toMatch(/\d/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe('closed', () => {
  test.beforeEach(({}, info) => { test.skip(Boolean(info.config.metadata.knowThisTeaOpen), 'Open in this run'); });
  test('nothing of it shows, and its steps lead nowhere', async ({ page }) => {
    await mock(page, fresh(), null);
    await page.goto('/tea-table?question=q-1');
    await expect(page.getByTestId('know-this-tea-page')).toHaveCount(0);
    await expect(page.getByTestId('know-this-tea-ask')).toHaveCount(0);
    await page.goto('/tea-table?ask=1');
    await expect(page.getByTestId('know-this-tea-ask-form')).toHaveCount(0);
  });
});

test.describe('open', () => {
  test.beforeEach(({}, info) => {
    test.skip(!info.config.metadata.knowThisTeaOpen, 'Run with tests/know-this-tea.config.ts');
  });

  test('a signed-out visitor sees the question in time order, with nothing counted, and is asked to sign in to tell', async ({ page }) => {
    await mock(page, fresh(), null);
    await page.goto('/tea-table');
    const pieces = page.locator('[data-testid="tea-table-question"], [data-testid="tea-table-piece"]');
    await expect(pieces).toHaveCount(2);
    await expect(pieces.nth(0)).toContainText('Does anyone know this tea?');
    await expect(pieces.nth(0)).toContainText('Asked by Lin');
    await expect(pieces.nth(0)).toContainText('A market stall in Fuzhou');
    await expect(pieces.nth(1)).toContainText('Old Tree Red');
    await expect(page.getByTestId('know-this-tea-ask')).toHaveAttribute('href', '/signin?returnTo=%2Ftea-table%3Fask%3D1');
    await expectQuietAndFitting(page);

    const before = page.url();
    await pieces.nth(0).getByRole('button', { name: 'I know this tea' }).click();
    await expect(page).toHaveURL(/\?question=q-1$/);
    await expect(page.getByTestId('know-this-tea-page')).toContainText('Sign in to tell Lin what it is.');
    await expect(page.getByTestId('know-this-tea-tell')).toHaveCount(0);
    await expectQuietAndFitting(page);
    await page.goBack();
    await expect(page).toHaveURL(before);
    await page.goForward();
    await expect(page.getByTestId('know-this-tea-page')).toBeVisible();
    await page.getByRole('button', { name: 'The Tea Table' }).click();
    await expect(page.getByTestId('tea-table-question')).toBeVisible();
  });

  test('someone who knows the tea tells the asker privately, and is told nobody else will read it', async ({ page }) => {
    const state = fresh();
    await signIn(page, 'knower');
    await mock(page, state, 'knower');
    await page.goto('/tea-table?question=q-1');
    const tell = page.getByTestId('know-this-tea-tell');
    await expect(tell).toContainText('Only Lin will read this. It is not shown on the table.');
    await expect(page.getByTestId('know-this-tea-asker')).toHaveCount(0);
    await tell.getByLabel('What you know about it').fill('Old Bush Shuixian. The shop has it.');
    await tell.getByLabel('Link to the tea in the shop, if it is there').fill('/shop/product/old-bush-shuixian?store=teajia-bali');
    await tell.getByLabel('If Lin thanks me, my first name may show on the question').check();
    await tell.getByRole('button', { name: 'Tell Lin' }).click();
    await expect(page.getByTestId('know-this-tea-told')).toHaveText('Thank you. Lin will read it on their question. Nobody else will.');
    expect(state.told).toEqual([{ words: 'Old Bush Shuixian. The shop has it.', tea: '/shop/product/old-bush-shuixian?store=teajia-bali', name_shown: true }]);
    await expectQuietAndFitting(page);
  });

  test('the asker reads what people told them, names it with the shop tea, and thanks the one who allowed their name', async ({ page }) => {
    const state = fresh();
    await signIn(page, 'asker');
    await mock(page, state, 'asker');
    await page.goto('/tea-table');
    const piece = page.getByTestId('tea-table-question');
    await expect(piece.getByRole('button', { name: 'I know this tea' })).toHaveCount(0);
    await piece.getByRole('button', { name: 'What people told you' }).click();
    await expect(page).toHaveURL(/\?question=q-1$/);
    const asker = page.getByTestId('know-this-tea-asker');
    await expect(asker).toContainText('Only you see this.');
    const notes = asker.getByTestId('know-this-tea-note');
    await expect(notes).toHaveCount(2);
    await expect(notes.nth(0)).toContainText('Old Bush Shuixian. The shop has it.');
    await expect(notes.nth(0).getByRole('link', { name: 'Old Bush Shuixian' })).toHaveAttribute('href', '/shop/product/old-bush-shuixian?store=teajia-bali');
    await expect(page.getByTestId('know-this-tea-tell')).toHaveCount(0);

    await notes.nth(0).getByRole('button', { name: 'That is it' }).click();
    await expect(asker.getByLabel('What the tea is')).toHaveValue('Old Bush Shuixian');
    await asker.getByRole('button', { name: 'Mark it named' }).click();
    await expect(page.getByTestId('know-this-tea-named')).toContainText('Named: Old Bush Shuixian');
    expect(state.namedWith).toEqual([{ name: 'Old Bush Shuixian', tea: '/shop/product/old-bush-shuixian?store=teajia-bali' }]);

    await expect(notes.nth(1)).toContainText('Hana asked for their name not to show.');
    await notes.nth(0).getByRole('button', { name: 'Thank Mei' }).click();
    await expect(page.getByTestId('know-this-tea-named')).toContainText('Named by Mei');
    await expect(notes.nth(0)).toContainText('You thanked Mei. Their first name shows on the question.');
    expect(state.thanks).toEqual([{ note_id: 'n-mei' }]);
    await expectQuietAndFitting(page);

    await page.getByRole('button', { name: 'The Tea Table' }).click();
    await expect(page.getByTestId('tea-table-question')).toContainText('Named: Old Bush Shuixian · Named by Mei');
  });

  test('a signed-in person asks: the photograph opens in the photo editor first, then goes on the table', async ({ page }) => {
    const state = fresh();
    await signIn(page, 'asker');
    await mock(page, state, 'asker');
    await page.goto('/tea-table');
    await page.getByTestId('know-this-tea-ask').click();
    await expect(page).toHaveURL(/\?ask=1$/);
    const form = page.getByTestId('know-this-tea-ask-form');
    await form.getByRole('button', { name: 'Put it on the table' }).click();
    await expect(form.getByRole('alert')).toHaveText('Add a photograph of the tea.');

    await page.getByTestId('know-this-tea-file').setInputFiles({ name: 'tea.png', mimeType: 'image/png', buffer: PHOTO });
    const editor = page.getByRole('dialog');
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: 'Use photo' }).click();
    await expect(page.getByTestId('know-this-tea-preview')).toBeVisible();
    await expect(form.getByRole('button', { name: 'Change photo' })).toBeVisible();
    await form.getByLabel('Where you got it').fill('A market stall in Fuzhou, wrapped in plain paper.');
    await expectQuietAndFitting(page);
    await form.getByRole('button', { name: 'Put it on the table' }).click();
    await expect(page).toHaveURL(/\?question=q-1$/);
    await expect(page.getByTestId('know-this-tea-page')).toContainText('A market stall in Fuzhou');
    expect(state.asked).toHaveLength(1);
    expect(state.asked[0].contentType).toContain('multipart/form-data');
    expect(state.asked[0].body).toContain('name="where_from"');
    expect(state.asked[0].body).toContain('name="full"; filename="full.jpg"');
    expect(state.asked[0].body).toContain('name="small"; filename="small.jpg"');
  });

  test('the asker takes it off the table', async ({ page }) => {
    const state = fresh();
    await signIn(page, 'asker');
    await mock(page, state, 'asker');
    await page.goto('/tea-table?question=q-1');
    await page.getByTestId('know-this-tea-take-off').click();
    await expect(page).toHaveURL(/\/tea-table$/);
    await expect(page.getByTestId('tea-table-question')).toHaveCount(0);
    await expect(page.getByTestId('tea-table-piece')).toHaveCount(1);
    expect(state.takenOff).toBe(true);
  });
});
