import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
  ignoreHTTPSErrors: true,
});

await ctx.addInitScript(() => {
  const seed = { state: { isDevAdmin: true, activeAccountId: 'demo-account' }, version: 0 };
  try { localStorage.setItem('teajia-storage', JSON.stringify(seed)); } catch {}
});

await ctx.route('**/api/**', (route) => {
  const url = route.request().url();
  let body = [];
  if (url.includes('/api/products')) body = [];
  else if (url.includes('/api/accounts')) body = { id: 'demo-account', name: 'Demo' };
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});

const page = await ctx.newPage();
let renderCount = 0;
let layoutShiftCount = 0;
const errs = [];

page.on('console', m => {
  if (m.type() === 'error') errs.push('[ERR] ' + m.text().slice(0, 200));
});
page.on('pageerror', e => errs.push('[PAGE ERR] ' + e.message));

await page.goto('http://localhost:7777/admin/inventory', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// Watch for layout shifts and re-renders over 8 seconds
await page.evaluate(() => {
  let mutations = 0;
  let shifts = 0;
  const obs = new MutationObserver((muts) => {
    mutations += muts.length;
    window.__MUT_COUNT = mutations;
  });
  obs.observe(document.body, { attributes: true, childList: true, subtree: true, characterData: false });

  if ('LayoutShift' in window || typeof PerformanceObserver !== 'undefined') {
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift') shifts += entry.value;
        }
        window.__SHIFT_SCORE = shifts;
      });
      po.observe({ type: 'layout-shift', buffered: true });
    } catch {}
  }
});

console.log('observing inventory for 8 seconds...');
await page.waitForTimeout(8000);

const result = await page.evaluate(() => ({
  mutations: window.__MUT_COUNT || 0,
  shifts: window.__SHIFT_SCORE || 0,
}));

console.log('mutations in 8s:', result.mutations);
console.log('cumulative layout shift:', result.shifts);
console.log('\nconsole errors:');
errs.slice(0, 15).forEach(e => console.log(e));
await browser.close();
