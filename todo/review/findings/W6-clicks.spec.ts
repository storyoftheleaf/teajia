/**
 * W6: tap counts for the entering tasks. Not part of any config; run with
 *   set -a; . test-results/review/slot-8.env; set +a
 *   npx playwright test todo/review/findings/W6-clicks.spec.ts --config todo/review/findings/W6-clicks.config.ts --project desktop-1280 --trace off
 * Each walk records the counts to test-results/review/steps.json and prints them.
 */
import { test, expect } from '../../../tests/fixtures';
import { signIn, task, readSteps } from '../../../tests/review/helpers';
import { writeFileSync } from 'node:fs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC', 'base64');
const note = (name: string, v: unknown) => console.log(`W6 ${name}: ${JSON.stringify(v)}`);
const last = (name: string, info: any) => readSteps().filter(r => r.task === name && r.project === info.project.name).pop();

test('W6-a host a table from Home', async ({ page }, info) => {
  await signIn(page, 'host');
  await page.goto('/');
  await task(page, 'W6 host a table from Home', 2, async () => {
    await page.getByRole('link', { name: /Host a table/ }).first().click();
    await page.locator('input[name=date]').fill('2027-03-05');
    await page.locator('input[name=time]').fill('16:00');
    await page.getByRole('button', { name: 'Make the table' }).click();
    await expect(page.getByText('Your table is ready')).toBeVisible();
  }, info);
  note('host a table', last('W6 host a table from Home', info));
});

test('W6-b ask about a tea', async ({ page }, info) => {
  await signIn(page, 'guest');
  await page.goto('/');
  await task(page, 'W6 ask about a tea', 3, async () => {
    await page.getByRole('link', { name: /Tea table/i }).first().click();
    await page.getByTestId('know-this-tea-ask').click();
    await page.getByTestId('know-this-tea-file').setInputFiles({ name: 't.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: /Use photo/ }).click();
    await page.getByTestId('know-this-tea-where-from').fill('A friend gave it to me');
    await page.getByTestId('know-this-tea-put').click();
    await page.waitForTimeout(800);
  }, info);
  note('ask about a tea', last('W6 ask about a tea', info));
});

test('W6-c make a circle and put a table in it', async ({ page }, info) => {
  await signIn(page, 'host');
  await page.goto('/account/host');
  await task(page, 'W6 circle with a table', 2, async () => {
    await page.getByRole('button', { name: 'Make a circle or series' }).click();
    await page.locator('[data-testid=host-circle-new] input[type=text]').fill('Thursday tea');
    await page.getByRole('button', { name: 'Make it' }).click();
    await page.getByTestId('host-circle').first().locator('select').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Put it in' }).first().click();
    await page.waitForTimeout(500);
  }, info);
  note('circle', last('W6 circle with a table', info));
});

test('W6-d make an assistant key', async ({ page }, info) => {
  await signIn(page, 'host');
  await page.goto('/account/host');
  await task(page, 'W6 assistant key', 2, async () => {
    await page.getByTestId('host-assistant').getByRole('button').first().click();
    await page.getByTestId('host-assistant-new').locator('input').fill('My assistant');
    await page.getByRole('button', { name: 'Make the key' }).click();
    await expect(page.getByTestId('host-assistant-secret')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
  }, info);
  note('assistant key', last('W6 assistant key', info));
});

test('W6-e keep a piece on the Tea Table', async ({ page }, info) => {
  await signIn(page, 'guest');
  await page.goto('/');
  await task(page, 'W6 keep a piece', 2, async () => {
    await page.getByRole('link', { name: /Tea table/i }).first().click();
    await page.getByTestId('tea-table-keep').first().click();
    await page.waitForTimeout(600);
  }, info);
  note('keep', last('W6 keep a piece', info));
});

test('W6-f Back on Favourites reached directly', async ({ page }) => {
  await signIn(page, 'guest');
  await page.goto('/account/favourites');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.waitForTimeout(800);
  note('favourites back, address after Back', page.url());
});

test('W6-g choose your table place', async ({ page }, info) => {
  await signIn(page, 'host');
  await page.goto('/');
  await task(page, 'W6 your table place', 3, async () => {
    await page.getByRole('link', { name: /Host a table/ }).first().click();
    await page.getByRole('button', { name: 'Add your table' }).click();
    await page.locator('[data-testid=your-table-choose] input[type=text]').fill('Ubud');
    await page.getByRole('button', { name: 'Make this my table' }).click();
    await page.waitForTimeout(600);
  }, info);
  note('place', last('W6 your table place', info));
});
