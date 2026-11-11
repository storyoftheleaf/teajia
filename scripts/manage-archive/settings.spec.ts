import { test } from '../../tests/fixtures';
import { go, warm, snap, slug, SIZES } from './lib';
import { installAdmin } from './mock';
import { ROUTES } from './rooms-data';

// Settings is one long page of sections. The full-page picture in rooms.spec.ts shows the top;
// this one scrolls to each section in turn so every section, shipping routes included, has its own picture.
test.describe.configure({ mode: 'serial' });

for (const s of SIZES) {
  test(`settings sections ${s.n}`, async ({ page }) => {
    await installAdmin(page, [
      (u) => (u.pathname === '/api/shipping-routes' ? ROUTES : undefined),
      (u) => (u.pathname === '/api/accounts/acct-bali' ? { id: 'acct-bali', name: 'Teajia Bali', slug: 'teajia-bali', location_city: 'Ubud', location_country: 'Indonesia', timezone: 'Asia/Makassar', currency_default: 'IDR', whatsapp_number: '+62 811 0000 000', contact_email: 'shop@example.invalid', public_enabled: true, default_shipping_rate_per_kg: 85, default_shipping_rate_currency: 'Yuan' } : undefined),
    ]);
    await page.setViewportSize({ width: s.w, height: s.h });
    await warm(page, '/admin/account-settings');
    await go(page, '/admin/account-settings', 3000);
    const heads = await page.locator('main h2, main section[aria-label], main [role=region]').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || (e as HTMLElement).innerText || '').trim().split('\n')[0].slice(0, 50)).filter(Boolean));
    const seen = new Set<string>();
    let n = 0;
    for (const h of heads) {
      if (seen.has(h) || n >= 14) continue;
      seen.add(h); n++;
      const target = page.locator('main h2, main section[aria-label], main [role=region]').filter({ hasText: h }).first();
      await target.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(600);
      await snap(page, s, { room: 'settings', state: `section-${String(n).padStart(2, '0')}-${slug(h)}`, route: '/admin/account-settings', note: `Settings, the "${h}" section scrolled into view.` });
    }
    console.log('SECTIONS', JSON.stringify([...seen]));
  });
}
