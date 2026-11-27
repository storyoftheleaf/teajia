import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const credential = '7'.repeat(64);
const thanksRef = 'a1b2c3d4e5f6071829';
const firstTableOpen = process.env.VITE_FIRST_TABLE_OPEN !== 'false';

type Recap = {
  event: { id: string; title: string; event_date: string };
  host_note: string | null;
  teas: Array<{ id: string; name: string; path: string | null; kept?: boolean }>;
  playlist_url: string | null;
  reading: { slug: string; title: string } | null;
  thanks_ref: string | null;
};

async function openRecap(page: Page, recap: Recap) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/after-sit/recap') {
      expect(route.request().method()).toBe('POST');
      expect(route.request().postDataJSON()).toEqual({ credential });
      expect(url.href).not.toContain(credential);
      return route.fulfill({ json: recap });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto(`/after-sit#${credential}`);
  await expect(page).toHaveURL(/\/after-sit$/);
  await expect(page.getByRole('heading', { level: 1, name: recap.event.title })).toBeVisible();
}

test('after-sit thank-you shows linked and plain teas, reading, and playlist without leaking its credential', async ({ page }) => {
  await openRecap(page, {
    event: { id: 'first-table', title: 'First table, a test sit', event_date: '2026-11-26' },
    host_note: 'Thank you for bringing your attention to the table.',
    teas: [
      { id: 'for-sale', name: 'Spring mountain oolong', path: '/tea/spring-mountain-oolong', kept: false },
      { id: 'plain', name: 'The host’s unnamed tea', path: null },
    ],
    playlist_url: 'https://example.test/first-table-playlist',
    reading: { slug: 'water-before-leaves', title: 'Water before leaves' },
    thanks_ref: thanksRef,
  });

  const teas = page.getByRole('region', { name: 'Teas served' });
  const linkedTea = teas.getByRole('link', { name: 'Spring mountain oolong' });
  await expect(linkedTea).toHaveAttribute('href', firstTableOpen
    ? `/tea/spring-mountain-oolong?via=${thanksRef}`
    : '/tea/spring-mountain-oolong');
  await linkedTea.evaluate(link => {
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.click();
  });
  const rememberedVia = await page.evaluate(() => localStorage.getItem('teajia-order-via'));
  if (firstTableOpen) expect(rememberedVia).toContain(thanksRef);
  else expect(rememberedVia).toBeNull();
  await expect(teas.getByText('The host’s unnamed tea', { exact: true })).toBeVisible();
  await expect(teas.getByRole('link', { name: 'The host’s unnamed tea' })).toHaveCount(0);
  await expect(page.getByText('To read').getByRole('link', { name: 'Water before leaves' }))
    .toHaveAttribute('href', '/article/water-before-leaves');
  await expect(page.getByRole('heading', { name: 'Session playlist' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Listen to the session playlist' }))
    .toHaveAttribute('href', 'https://example.test/first-table-playlist');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const href of await page.locator('a').evaluateAll(links => links.map(link => link.href))) {
    expect(href).not.toContain(credential);
  }
});

test('after-sit thank-you omits empty optional sections', async ({ page }) => {
  await openRecap(page, {
    event: { id: 'quiet-table', title: 'A quiet table', event_date: '2026-11-26' },
    host_note: 'Thank you for sitting with us.',
    teas: [],
    playlist_url: null,
    reading: null,
    thanks_ref: null,
  });

  await expect(page.getByText('Thank you for sitting with us.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Teas served' })).toHaveCount(0);
  await expect(page.getByText('To read', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Session playlist' })).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const href of await page.locator('a').evaluateAll(links => links.map(link => link.href))) {
    expect(href).not.toContain(credential);
  }
});
