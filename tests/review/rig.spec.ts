/** The rig itself: the three fixture people sign in, the site loads, the counter counts. */
import { expect, test } from '../fixtures';
import { call, login, noSideScroll, readSteps, signIn, task, PEOPLE } from './helpers';

test('the three people sign in, and Home loads without side scroll', async ({ page }, info) => {
  for (const who of Object.keys(PEOPLE)) {
    const s = await login(page, who);
    expect(s.token).toBeTruthy();
  }
  await signIn(page, 'host');
  await task(page, 'rig: open Home', 0, async () => { await page.goto('/'); }, info);
  await expect(page.locator('body')).toBeVisible();
  await noSideScroll(page, 'Home');
  const row = readSteps().filter(r => r.task === 'rig: open Home' && r.project === info.project.name).pop();
  expect(row?.clicks).toBe(0);
});

test('the counter counts one click and one field', async ({ page }, info) => {
  await page.goto('/');
  await page.setContent('<button id=b>b</button><input id=i>');
  await task(page, 'rig: count', 1, async () => {
    await page.click('#b');
    await page.fill('#i', 'tea');
    await page.fill('#i', 'tea again');
  }, info);
  const row = readSteps().filter(r => r.task === 'rig: count' && r.project === info.project.name).pop();
  expect(row).toMatchObject({ clicks: 1, fields: 1 });
  // A second task on the same page counts its own clicks, not into the first.
  await task(page, 'rig: count again', 2, async () => { await page.click('#b'); await page.click('#b'); }, info);
  const again = readSteps().filter(r => r.task === 'rig: count again' && r.project === info.project.name).pop();
  expect(again).toMatchObject({ clicks: 2, fields: 0 });
});

test('the on-now table is there for the host', async ({ page }) => {
  const ana = await login(page, 'host');
  const tables = await call(page, ana, '/api/me/tables');
  if (tables.status === 404) test.skip(true, 'FEW_HOSTS is closed in this set');
  const ids = (tables.body.tables ?? tables.body).map((t: { id: string }) => t.id);
  expect(ids).toEqual(expect.arrayContaining(['fh-event', 'rv-event-now', 'fh-event-next']));
});
