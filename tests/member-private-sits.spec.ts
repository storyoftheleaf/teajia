import { expect, test, type Page } from './fixtures';

const endpoint = '/api/me/private-sits';
const journey = '/account/journey';
const sitId = 'a-private-sit';
const invite = '2'.repeat(64);

async function signedIn(page: Page, user: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
    sub: user, email: `${user}@example.test`,
    name: user, role: 'user', memberships: [], active_account_id: null,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }), 'signature'].join('.');
  await page.addInitScript(token => localStorage.setItem('teajia_token', token), token);
}

async function mockSits(page: Page, role: 'host' | 'guest') {
  let saved = false;
  let invitePending = false;
  let note: string | null = null;
  let title: string | null = null;
  let tea: { id: null; name: string } | null = null;
  const writes: string[] = [];
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path === '/api/me/journey') return route.fulfill({ status: 403, json: { error: 'Account access denied' } });
    if (path === endpoint && method === 'POST') {
      expect(request.postDataJSON()).toMatchObject({ requestId: expect.any(String), date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
      saved = true;
      writes.push('create');
      return route.fulfill({ status: 201, json: { id: sitId } });
    }
    if (path === `${endpoint}/accept` && method === 'POST') {
      expect(request.postDataJSON()).toEqual({ token: invite });
      saved = true;
      writes.push('accept');
      return route.fulfill({ json: { id: sitId } });
    }
    if (path === `${endpoint}/${sitId}/invite` && method === 'PUT') {
      invitePending = true;
      return route.fulfill({ status: 201, json: { token: invite } });
    }
    if (path === `${endpoint}/${sitId}/note` && method === 'PUT') {
      note = request.postDataJSON().note;
      return route.fulfill({ json: { note } });
    }
    if (path === `${endpoint}/${sitId}` && method === 'PUT') {
      const details = request.postDataJSON();
      title = details.title;
      tea = { id: null, name: details.teaName };
      return route.fulfill({ json: { title, tea, description: details.description } });
    }
    const sit = { id: sitId, role, date: '2026-11-23', title, description: null, tea, note, invitePending };
    if (path === endpoint) return route.fulfill({ json: { sits: saved ? [sit] : [] } });
    if (path === `${endpoint}/${sitId}`) return route.fulfill({ json: sit });
    if (path === `${endpoint}/${sitId}/photos`) return route.fulfill({ json: { photos: [] } });
    if (['/api/me/kept-setups', '/api/me/personal-kept-setups'].includes(path)) return route.fulfill({ json: { setups: [] } });
    return route.fulfill({ json: [] });
  });
  return writes;
}

test('a person with no shop membership can start one private sit and open it again from Journey', async ({ page }) => {
  await signedIn(page, 'host');
  const writes = await mockSits(page, 'host');
  await page.goto(journey);
  await page.getByRole('button', { name: 'Start a sit' }).click();
  await expect(page.getByRole('heading', { name: 'Tea sit' })).toBeVisible();
  await page.getByRole('button', { name: 'Invite someone' }).click();
  await expect(page.getByRole('textbox', { name: 'Invitation link' })).toHaveValue(new RegExp(`sit-invite#${invite}$`));
  await page.getByRole('textbox', { name: 'Your private note' }).fill('Steam against the window.');
  await page.getByRole('button', { name: 'Save private note' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Note saved' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Journey' }).click();
  await expect(page.getByRole('link', { name: 'Tea sit' })).toBeVisible();
  expect(writes).toEqual(['create']);
});

test('opening the invite does not join until a signed-in person accepts', async ({ page }) => {
  await signedIn(page, 'guest');
  const writes = await mockSits(page, 'guest');
  await page.goto(`${journey}/sit-invite#${invite}`);
  await expect(page.getByRole('button', { name: 'Join this sit' })).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Join this sit' }).click();
  await expect(page).toHaveURL(new RegExp(`/sits/${sitId}$`));
  await expect(page.getByRole('heading', { name: 'Tea sit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Invite someone' })).toHaveCount(0);
  expect(writes).toEqual(['accept']);
});

test('the sit opens the existing private tasting editor for the tea it serves', async ({ page }) => {
  await signedIn(page, 'host');
  await mockSits(page, 'host');
  await page.goto(`${journey}/sits/${sitId}`);
  await page.getByRole('button', { name: 'Edit sit details' }).click();
  await page.getByRole('textbox', { name: 'Tea', exact: true }).fill('Rock tea');
  await page.getByRole('button', { name: 'Save details' }).click();
  await page.getByRole('button', { name: 'Record a tasting' }).click();
  await expect(page.getByText('Rock tea', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
});
