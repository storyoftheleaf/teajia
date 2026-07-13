import { expect, test, type Page } from '@playwright/test';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'editor-1', email: 'editor@test.dev', role: 'owner', platform_role: 'platform_owner',
  active_account_id: 'acct-bali', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner' }],
  exp: Math.floor(Date.now() / 1000) + 86_400,
})}.sig`;

const article = {
  id: 'article-event-1', account_id: 'acct-bali', title: 'Cliff Tea Evening', subtitle: 'Wuyi after rain',
  author_id: 'editor-1', slug: 'cliff-tea-evening', status: 'draft', category: 'Field Notes', tags: ['event'],
  cover_image_url: 'https://media.teajia.co/cliff.jpg', layout_template: 'immersive_scroll', reading_time_mins: 2,
  blocks: [{ type: 'intro', text: 'A quiet table that opened slowly.' }, { type: 'quote', text: 'Warm rock and longan.' }],
  created_at: '2026-07-12T00:00:00.000Z', updated_at: '2026-07-12T00:00:00.000Z',
};

async function install(page: Page, existing: boolean, existingStatus: 'draft' | 'published' = 'published') {
  let publishCalls = 0;
  await page.addInitScript(jwt => {
    localStorage.clear();
    localStorage.setItem('teajia_token', jwt);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: { activeAccountId: 'acct-bali', activeUserId: 'editor-1', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner' }] } }));
  }, token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/admin/events/event-1/article-draft') return route.fulfill({ status: existing ? 200 : 201, json: { existing, article: { ...article, status: existing ? existingStatus : 'draft' } } });
    if (path === '/api/admin/events/event-2/article-draft') return route.fulfill({ status: 201, json: { existing: false, article: { ...article, id: 'article-event-2', title: 'Second Tea Evening', slug: 'second-tea-evening' } } });
    if (path === '/api/admin/events/event-1') return route.fulfill({ json: { id: 'event-1', slug: 'cliff-tea-evening', title: 'Cliff Tea Evening', subtitle: 'Wuyi after rain', event_date: '2026-07-12T10:00:00.000Z', status: 'completed', total_capacity: 12, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-12T00:00:00.000Z' } });
    if (path === '/api/admin/events/event-2') return route.fulfill({ json: { id: 'event-2', slug: 'second-tea-evening', title: 'Second Tea Evening', event_date: '2026-07-13T10:00:00.000Z', status: 'completed', total_capacity: 8, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-13T00:00:00.000Z' } });
    if (path === '/api/admin/events') return route.fulfill({ json: [] });
    if (/\/api\/admin\/events\/event-[12]\/(attendees|tasting-notes)$/.test(path)) return route.fulfill({ json: [] });
    if (/\/api\/admin\/events\/event-[12]\/interest$/.test(path)) return route.fulfill({ json: { signups: [] } });
    if (path === '/api/admin/venues' || path === '/api/products' || path === '/api/rates') return route.fulfill({ json: [] });
    if (path === '/api/compass/incoming') return route.fulfill({ json: { shares: [] } });
    if (/\/api\/admin\/articles\/[^/]+\/publish$/.test(path)) { publishCalls += 1; return route.fulfill({ status: 500, json: { error: 'Unexpected automatic publish' } }); }
    return route.fulfill({ json: {} });
  });
  return () => publishCalls;
}

for (const scenario of [
  { label: 'new event draft', existing: false, status: 'draft' as const },
  { label: 'existing event draft', existing: true, status: 'draft' as const },
  { label: 'existing published event article', existing: true, status: 'published' as const },
]) {
  test(`${scenario.label} opens in the editor without publishing`, async ({ page }) => {
    const publishCalls = await install(page, scenario.existing, scenario.status);
    await page.goto('/admin/events/event-1?tab=post-session');
    await page.getByRole('button', { name: 'Create photo essay draft' }).click();

    await expect(page.getByPlaceholder('Article title')).toHaveValue('Cliff Tea Evening');
    await expect(page.getByText(scenario.status, { exact: true })).toBeVisible();
    await expect.poll(() => page.getByRole('textbox').evaluateAll(nodes => nodes.map(node => (node as HTMLInputElement).value))).toContain('A quiet table that opened slowly.');
    await expect(page.getByTestId('render-mode-immersive')).toHaveAttribute('aria-pressed', 'true');
    if (scenario.existing) {
      await expect(page.getByText(scenario.status === 'draft'
        ? 'An article draft already exists for this event. Open existing draft.'
        : 'An article already exists for this event. Open existing article.')).toBeAttached();
    }
    expect(publishCalls()).toBe(0);
  });
}

test('route reuse clears the prior event editor and associated-article message', async ({ page }) => {
  const publishCalls = await install(page, true);
  await page.goto('/admin/events/event-1?tab=post-session');
  await page.getByRole('button', { name: 'Create photo essay draft' }).click();
  await expect(page.getByPlaceholder('Article title')).toHaveValue('Cliff Tea Evening');
  await expect(page.getByText('An article already exists for this event. Open existing article.')).toBeAttached();

  await page.evaluate(() => {
    history.pushState({}, '', '/admin/events/event-2?tab=post-session');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { name: 'Second Tea Evening' })).toBeVisible();
  await expect(page.getByPlaceholder('Article title')).toHaveCount(0);
  await expect(page.getByText(/already exists for this event/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create photo essay draft' })).toBeEnabled();
  expect(publishCalls()).toBe(0);
});
