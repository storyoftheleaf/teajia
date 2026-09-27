import { expect, test } from './fixtures';
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
  // The caching service worker is gone. It was replaced by a self-destroying
  // one (vite.config VitePWA selfDestroying) because a stale shell could
  // reference an AdminApp chunk from a superseded deploy and loop. So the
  // China-safe policy is no longer "the worker must not cache the API": there
  // is nothing doing any caching, which is a stronger version of the same
  // promise. What still has to hold is that the worker actively clears what
  // earlier ones left behind, and that nothing in it reaches a blocked host.
  expect(sw).toContain('self.registration.unregister()');
  expect(sw).toContain('self.caches.keys()');
  expect(sw).not.toMatch(/fonts\.(?:googleapis|gstatic)/);
  expect(sw).not.toContain('teajia-api.lightcodes.workers.dev');
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
