import { expect, test, type Page } from './fixtures';

const eventPath = '/api/admin/events/ordinary-fixture';

async function install(page: Page, gather: boolean) {
  const memberships = [{
    account_id: 'fixture-shop',
    account_name: 'Fixture shop',
    role: gather ? 'staff' : 'viewer',
    bundles: gather ? ['gather'] : [],
  }];
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({
      sub: 'fixture-user', email: 'host@test.invalid', role: 'user',
      active_account_id: 'fixture-shop', memberships, exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    'fixture-signature',
  ].join('.');
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);

  let lifecycle = 'published';
  const writes: unknown[] = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    if (new URL(request.url()).pathname !== eventPath) return route.fulfill({ json: [] });
    if (request.method() === 'PUT') {
      const payload = request.postDataJSON();
      writes.push(payload);
      if (payload.status === 'closed') {
        lifecycle = 'registration_closed';
      } else {
        expect(payload).toEqual({ lifecycle_status: 'completed' });
        const responseWasLost = lifecycle !== 'completed';
        lifecycle = 'completed';
        if (responseWasLost) return route.abort();
      }
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: {
      id: 'ordinary-fixture', slug: 'ordinary-fixture', title: 'Cliff Tea Evening',
      event_date: '2026-11-16T10:00:00Z', lifecycle_status: lifecycle,
      status: lifecycle === 'published' ? 'active' : 'closed', total_capacity: 8,
    } });
  });
  return writes;
}

test('host finishes a closed session and can retry a lost completion response', async ({ page }, testInfo) => {
  const writes = await install(page, true);
  await page.goto('/admin/events/ordinary-fixture');
  await expect(page.getByRole('heading', { name: 'Cliff Tea Evening' })).toBeVisible();
  const finish = page.getByRole('button', { name: 'Finish session', exact: true });
  await expect(finish).toHaveCount(0);
  await page.getByRole('button', { name: 'Close RSVP', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(finish).toBeVisible();
  await finish.click();
  const dialog = page.getByRole('dialog', { name: 'Finish session?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([{ status: 'closed' }]);
  await finish.click();
  await page.screenshot({ path: testInfo.outputPath('finish-session.png'), animations: 'disabled', scale: 'css' });
  const confirm = dialog.getByRole('button', { name: 'Finish session', exact: true });
  await confirm.click();
  await expect(page.getByText('Session finished', { exact: true })).toBeVisible();
  await expect(finish).toHaveCount(0);
  expect(writes).toEqual([
    { status: 'closed' },
    { lifecycle_status: 'completed' },
    { lifecycle_status: 'completed' },
  ]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cliff Tea Evening' })).toBeVisible();
  await expect(finish).toHaveCount(0);
});

test('viewer does not see the host action', async ({ page }) => {
  const writes = await install(page, false);
  await page.goto('/admin/events/ordinary-fixture');
  await expect(page.getByText('Access Restricted', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish session', exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
});
