import { expect, test, type Page } from './fixtures';

const editPath = '/admin/events/event-1';
const publicPath = '/event/contribution-test';
const adminApiPath = '/api/admin/events/event-1';
const publicApiPath = '/api/events/contribution-test/public';
const title = 'A courtyard session';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const membership = { account_id: 'shop-1', account_name: 'Fixture shop', role: 'owner', bundles: ['gather'] };
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'host-1', email: 'host@test.invalid', role: 'owner', platform_role: 'platform_owner',
  active_account_id: membership.account_id, memberships: [membership],
  exp: Math.floor(Date.now() / 1000) + 3600,
})}.fixture`;

async function installFixture(page: Page, flagOpen: boolean) {
  const start = Date.now() + 14 * 24 * 60 * 60 * 1000;
  let event = {
    id: 'event-1', slug: 'contribution-test', title,
    event_date: new Date(start).toISOString(), event_end_date: new Date(start + 2 * 60 * 60 * 1000).toISOString(),
    status: 'active', lifecycle_status: 'published', total_capacity: 8, seats_remaining: 8,
    claim_window_minutes: 30, timezone: 'Asia/Makassar',
    contribution_kind: flagOpen ? null : 'contribution',
    contribution_note: flagOpen ? null : 'Bring what you like',
  };
  const writes: Record<string, unknown>[] = [];
  await page.addInitScript(({ token, membership }) => {
    localStorage.setItem('teajia_token', token);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
      activeAccountId: membership.account_id, activeUserId: 'host-1', memberships: [membership],
    } }));
  }, { token, membership });
  // Toggle only the frontend module. The spec can cover both states in one Vite run.
  await page.route(/\/src\/lib\/anyoneHosts\.ts(?:\?|$)/, route => route.fulfill({
    contentType: 'application/javascript',
    body: `export const ANYONE_HOSTS_OPEN = ${flagOpen}; export const anyoneHostsOpen = () => ANYONE_HOSTS_OPEN;`,
  }));
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': request.headers()['access-control-request-headers'] ?? '*',
      } });
    }
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (path === adminApiPath && request.method() === 'PUT') {
      const patch = request.postDataJSON();
      writes.push(patch);
      event = { ...event, ...patch };
      return route.fulfill({ json: event, headers });
    }
    if (path === adminApiPath || path === publicApiPath) return route.fulfill({ json: event, headers });
    if (path === '/api/admin/events') return route.fulfill({ json: [event], headers });
    if (path.endsWith('/interest')) return route.fulfill({ json: { signups: [] }, headers });
    if (path.endsWith('/availability')) {
      return route.fulfill({ json: { totalCapacity: 8, confirmedCount: 0, seatsRemaining: 8, isFull: false }, headers });
    }
    return route.fulfill({ json: [], headers });
  });
  return writes;
}

async function openEditor(page: Page) {
  await page.goto(editPath, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
}

async function openPublicPage(page: Page) {
  await page.goto(publicPath, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

test('the host can set, reload, and clear the wording guests see', async ({ page }, info) => {
  test.slow();
  const writes = await installFixture(page, true);
  const choice = page.getByRole('combobox', { name: 'Contribution', exact: true });
  const note = page.getByRole('textbox', { name: 'Note (optional)' });
  const line = page.getByTestId('session-contribution');
  const save = async () => {
    const updated = page.waitForResponse(response =>
      response.request().method() === 'PUT' && new URL(response.url()).pathname === adminApiPath);
    await page.getByRole('button', { name: 'Update Event' }).click();
    expect((await updated).ok()).toBe(true);
  };

  await openEditor(page);
  await expect(choice).toBeEnabled();
  await expect(choice).toHaveValue('');
  await expect(choice.locator('option')).toHaveText(['Say nothing', 'Free', 'By contribution', 'Has a price']);
  await expect(note).toHaveCount(0);
  await openPublicPage(page);
  await expect(line).toHaveCount(0);

  for (const [kind, words, expected] of [
    ['free', '', 'Free.'],
    ['contribution', '', 'By contribution.'],
    ['contribution', 'Bring what you like', 'By contribution. Bring what you like'],
    ['price', '150k, paid to me on the day', '150k, paid to me on the day'],
    ['price', '', null],
  ] as const) {
    await openEditor(page);
    await choice.selectOption(kind);
    await note.fill(words);
    if (kind === 'contribution' && words) {
      await page.getByRole('group', { name: 'Contribution', exact: true })
        .screenshot({ path: info.outputPath('contribution-note.png'), animations: 'disabled' });
    }
    await save();
    expect(writes.at(-1)).toMatchObject({ contribution_kind: kind, contribution_note: words || null });
    await openPublicPage(page);
    if (expected) {
      await expect(line).toHaveText(expected);
      await expect(line.getByRole('link')).toHaveCount(0);
      if (kind === 'price') {
        await line.locator('..').screenshot({ path: info.outputPath('public-contribution.png'), animations: 'disabled' });
      }
    } else {
      await expect(line).toHaveCount(0);
    }
  }

  await openEditor(page);
  await expect(choice).toHaveValue('price');
  await expect(note).toHaveValue('');
  await choice.selectOption('');
  await save();
  expect(writes.at(-1)).toMatchObject({ contribution_kind: null, contribution_note: null });
  await openPublicPage(page);
  await expect(line).toHaveCount(0);
});

test('a 141-character note is refused before the event update', async ({ page }) => {
  const writes = await installFixture(page, true);
  await openEditor(page);
  await page.getByRole('combobox', { name: 'Contribution', exact: true }).selectOption('contribution');
  const note = page.getByRole('textbox', { name: 'Note (optional)' });
  await expect(note).toHaveAttribute('maxlength', '140');
  const limit = 'x'.repeat(140);
  await note.fill(limit);
  await note.press('End');
  await note.press('y');
  await expect(note).toHaveValue(limit);

  await note.evaluate(input => input.removeAttribute('maxlength'));
  await note.fill(limit + 'y');
  await page.getByRole('button', { name: 'Update Event' }).click();
  await expect(page.getByText('Keep the contribution note to 140 characters or fewer.')).toBeVisible();
  expect(writes).toHaveLength(0);
});

test('the launch flag hides the editor control and the saved public line', async ({ page }) => {
  const writes = await installFixture(page, false);
  await openEditor(page);
  await expect(page.getByRole('combobox', { name: 'Contribution', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Update Event' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).not.toHaveProperty('contribution_kind');
  expect(writes[0]).not.toHaveProperty('contribution_note');
  await openPublicPage(page);
  await expect(page.getByTestId('session-contribution')).toHaveCount(0);
  await expect(page.getByText('Bring what you like')).toHaveCount(0);
});
