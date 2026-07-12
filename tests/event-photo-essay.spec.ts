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

async function install(page: Page, existing: boolean) {
  let publishCalls = 0;
  await page.addInitScript(jwt => {
    localStorage.clear();
    localStorage.setItem('teajia_token', jwt);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: { activeAccountId: 'acct-bali', activeUserId: 'editor-1', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner' }] } }));
  }, token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/admin/events/event-1/article-draft') return route.fulfill({ status: existing ? 200 : 201, json: { existing, article } });
    if (path === '/api/admin/events/event-1') return route.fulfill({ json: { id: 'event-1', slug: 'cliff-tea-evening', title: 'Cliff Tea Evening', subtitle: 'Wuyi after rain', event_date: '2026-07-12T10:00:00.000Z', status: 'completed', total_capacity: 12, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-12T00:00:00.000Z' } });
    if (path === '/api/admin/events') return route.fulfill({ json: [] });
    if (path === '/api/admin/events/event-1/attendees' || path === '/api/admin/events/event-1/tasting-notes') return route.fulfill({ json: [] });
    if (path === '/api/admin/events/event-1/interest') return route.fulfill({ json: { signups: [] } });
    if (path === '/api/admin/venues' || path === '/api/products' || path === '/api/rates') return route.fulfill({ json: [] });
    if (path === '/api/compass/incoming') return route.fulfill({ json: { shares: [] } });
    if (path === '/api/articles/article-event-1/publish') { publishCalls += 1; return route.fulfill({ json: { success: true } }); }
    return route.fulfill({ json: {} });
  });
  return () => publishCalls;
}

for (const existing of [false, true]) {
  test(`${existing ? 'existing' : 'new'} event draft opens in the editor without publishing`, async ({ page }) => {
    const publishCalls = await install(page, existing);
    await page.goto('/admin/events/event-1?tab=post-session');
    await page.getByRole('button', { name: 'Create photo essay draft' }).click();

    await expect(page.getByPlaceholder('Article title')).toHaveValue('Cliff Tea Evening');
    await expect(page.getByText('draft', { exact: true })).toBeVisible();
    await expect.poll(() => page.getByRole('textbox').evaluateAll(nodes => nodes.map(node => (node as HTMLInputElement).value))).toContain('A quiet table that opened slowly.');
    await expect(page.getByTestId('render-mode-immersive')).toHaveAttribute('aria-pressed', 'true');
    if (existing) {
      await expect(page.getByText('An article draft already exists for this event. Open existing draft.')).toBeAttached();
    }
    expect(publishCalls()).toBe(0);
  });
}
