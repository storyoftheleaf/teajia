import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const store = (contact: { whatsapp_number?: string; contact_email?: string }) => ({
  id: 'acc_china_fixture', slug: 'china-fixture', name: 'China Fixture', public_enabled: true, ...contact,
});

async function mockStore(page: import('@playwright/test').Page, contact: { whatsapp_number?: string; contact_email?: string }) {
  await page.route('**/api/s/china-fixture**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/products')) return route.fulfill({ json: { products: [] } });
    if (pathname.endsWith('/events')) return route.fulfill({ json: { events: [] } });
    return route.fulfill({ json: store(contact) });
  });
}

test('built service worker and headers retain the China-safe policy', async () => {
  const [headers, sw] = await Promise.all([
    readFile(path.resolve('dist/_headers'), 'utf8'),
    readFile(path.resolve('dist/sw.js'), 'utf8'),
  ]);
  expect(headers).not.toContain('teajia-api.lightcodes.workers.dev');
  expect(headers).toContain('/api/verify/request');
  expect(headers).toContain('Cache-Control: no-store');
  expect(sw).toContain('/api/');
  expect(sw).toContain('/media/');
  expect(sw).toMatch(/startsWith\(["']\/api\/["']\)[\s\S]{0,500}["']GET["']/);
  expect(sw).not.toMatch(/fonts\.(?:googleapis|gstatic)/);
});

test('email-only store exposes an addressed mail handoff on mobile', async ({ page }) => {
  await mockStore(page, { contact_email: 'tea@example.com' });
  await page.goto('/store/china-fixture');
  await page.getByRole('button', { name: 'Contact' }).click();
  await expect(page.getByRole('link', { name: 'tea@example.com' })).toHaveAttribute('href', /^mailto:tea@example\.com/);
  await expect(page.getByText('WhatsApp')).toHaveCount(0);
});

test('store without a reachable channel shows an explicit unavailable state on mobile', async ({ page }) => {
  await mockStore(page, {});
  await page.goto('/store/china-fixture');
  await page.getByRole('button', { name: 'Contact' }).click();
  await expect(page.getByText('Contact options are not configured for this store yet.')).toBeVisible();
});
