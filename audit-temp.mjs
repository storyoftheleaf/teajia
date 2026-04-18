import pkg from './node_modules/playwright/index.js';
const { chromium } = pkg;
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const BASE = 'http://localhost:3000';
const OUT = process.env.TMPDIR + '/teajia-audit';
mkdirSync(OUT, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });

  // MOBILE
  const mob = await browser.newPage();
  await mob.setViewportSize({ width: 390, height: 844 });

  await mob.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await mob.screenshot({ path: `${OUT}/01-home-mobile.png`, fullPage: true });
  console.log('01 home mobile done');

  await mob.goto(`${BASE}/shop`, { waitUntil: 'networkidle', timeout: 20000 });
  await mob.screenshot({ path: `${OUT}/03-shop-mobile.png`, fullPage: false });
  console.log('03 shop mobile done');

  const allLinks = await mob.$$eval('a[href]', els => els.map(e => e.getAttribute('href')));
  const prodLink = allLinks.find(h => h && (h.includes('/product') || h.includes('/shop/')));
  if (prodLink) {
    await mob.goto(BASE + prodLink, { waitUntil: 'networkidle', timeout: 20000 });
    await mob.screenshot({ path: `${OUT}/05-product-mobile.png`, fullPage: true });
    console.log('05 product mobile done, url:', mob.url());
  }

  await mob.goto(`${BASE}/magazine`, { waitUntil: 'networkidle', timeout: 20000 });
  await mob.screenshot({ path: `${OUT}/08-magazine-mobile.png`, fullPage: false });

  await mob.goto(`${BASE}/learn`, { waitUntil: 'networkidle', timeout: 20000 });
  await mob.screenshot({ path: `${OUT}/09-learn-mobile.png`, fullPage: false });

  await mob.goto(`${BASE}/consult`, { waitUntil: 'networkidle', timeout: 20000 });
  await mob.screenshot({ path: `${OUT}/10-consult-mobile.png`, fullPage: false });

  await mob.goto(`${BASE}/about`, { waitUntil: 'networkidle', timeout: 20000 });
  await mob.screenshot({ path: `${OUT}/11-about-mobile.png`, fullPage: false });

  // DESKTOP
  const desk = await browser.newPage();
  await desk.setViewportSize({ width: 1440, height: 900 });

  await desk.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await desk.screenshot({ path: `${OUT}/20-home-desktop.png`, fullPage: false });
  await desk.evaluate(() => window.scrollTo(0, 900));
  await desk.waitForTimeout(400);
  await desk.screenshot({ path: `${OUT}/21-home-desktop-mid.png`, fullPage: false });
  await desk.evaluate(() => window.scrollTo(0, 99999));
  await desk.waitForTimeout(400);
  await desk.screenshot({ path: `${OUT}/22-home-desktop-bottom.png`, fullPage: false });
  console.log('home desktop done');

  await desk.goto(`${BASE}/shop`, { waitUntil: 'networkidle', timeout: 20000 });
  await desk.screenshot({ path: `${OUT}/23-shop-desktop.png`, fullPage: false });
  await desk.evaluate(() => window.scrollTo(0, 1200));
  await desk.waitForTimeout(400);
  await desk.screenshot({ path: `${OUT}/24-shop-scroll-desktop.png`, fullPage: false });
  console.log('shop desktop done');

  const prodDesk = await desk.$$eval('a[href]', els => els.map(e => e.getAttribute('href')));
  const pLink = prodDesk.find(h => h && (h.includes('/product') || h.includes('/shop/')));
  if (pLink) {
    await desk.goto(BASE + pLink, { waitUntil: 'networkidle', timeout: 20000 });
    await desk.screenshot({ path: `${OUT}/25-product-desktop.png`, fullPage: true });
    console.log('25 product desktop done, url:', desk.url());
  }

  await desk.goto(`${BASE}/magazine`, { waitUntil: 'networkidle', timeout: 20000 });
  await desk.screenshot({ path: `${OUT}/26-magazine-desktop.png`, fullPage: false });

  await desk.goto(`${BASE}/learn`, { waitUntil: 'networkidle', timeout: 20000 });
  await desk.screenshot({ path: `${OUT}/27-learn-desktop.png`, fullPage: false });

  await desk.goto(`${BASE}/consult`, { waitUntil: 'networkidle', timeout: 20000 });
  await desk.screenshot({ path: `${OUT}/28-consult-desktop.png`, fullPage: false });

  // Collect headings
  const h = await desk.$$eval('h1, h2', els => els.map(e => `${e.tagName}: ${e.textContent?.trim()}`));
  writeFileSync(`${OUT}/headings.json`, JSON.stringify(h, null, 2));

  console.log('All done. Files at:', OUT);
  await browser.close();
}
run().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
