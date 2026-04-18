import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { mkdirSync } from 'fs';

const SCREENSHOT_DIR = process.env.TMPDIR + '/teajia-audit';

try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch(e) {}

const BASE = 'http://localhost:3000';

async function ss(page, name) {
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`[screenshot] ${name} → ${path}`);
  return path;
}

async function audit() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell'
  });

  const findings = [];
  const log = (section, msg) => {
    console.log(`[${section}] ${msg}`);
    findings.push({ section, msg });
  };

  // ── MOBILE PASS ──────────────────────────────────────────────────────────
  console.log('\n=== MOBILE PASS (390x844) ===\n');
  const mobile = await browser.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });

  // Homepage mobile
  await mobile.goto(BASE, { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(1500);
  await ss(mobile, 'home-mobile-top');
  // scroll down
  await mobile.evaluate(() => window.scrollTo(0, 400));
  await mobile.waitForTimeout(500);
  await ss(mobile, 'home-mobile-scroll1');
  await mobile.evaluate(() => window.scrollTo(0, 900));
  await mobile.waitForTimeout(500);
  await ss(mobile, 'home-mobile-scroll2');
  await mobile.evaluate(() => window.scrollTo(0, 1600));
  await mobile.waitForTimeout(500);
  await ss(mobile, 'home-mobile-scroll3');
  await mobile.evaluate(() => window.scrollTo(0, 99999));
  await mobile.waitForTimeout(500);
  await ss(mobile, 'home-mobile-bottom');

  // check bottom nav
  const bottomNav = await mobile.$('nav');
  log('mobile-nav', bottomNav ? 'Bottom nav element found' : 'No <nav> element found');

  // check for horizontal scroll
  const hasHScroll = await mobile.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
  log('mobile-layout', hasHScroll ? 'HORIZONTAL SCROLL DETECTED on homepage' : 'No horizontal scroll on homepage');

  // Shop / catalog
  await mobile.goto(`${BASE}/shop`, { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(1500);
  await ss(mobile, 'shop-mobile-top');
  await mobile.evaluate(() => window.scrollTo(0, 600));
  await mobile.waitForTimeout(500);
  await ss(mobile, 'shop-mobile-scroll1');
  await mobile.evaluate(() => window.scrollTo(0, 99999));
  await mobile.waitForTimeout(500);
  await ss(mobile, 'shop-mobile-bottom');

  const shopHScroll = await mobile.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
  log('mobile-shop', shopHScroll ? 'HORIZONTAL SCROLL on shop page' : 'No horizontal scroll on shop');

  // Try to click first product
  const productCard = await mobile.$('a[href*="/product"], a[href*="/shop/"], [class*="product"], [class*="card"]');
  if (productCard) {
    try {
      await productCard.click();
      await mobile.waitForTimeout(1500);
      const productUrl = mobile.url();
      log('mobile-product', `Navigated to product: ${productUrl}`);
      await ss(mobile, 'product-mobile-top');
      await mobile.evaluate(() => window.scrollTo(0, 600));
      await mobile.waitForTimeout(500);
      await ss(mobile, 'product-mobile-scroll1');
      await mobile.evaluate(() => window.scrollTo(0, 99999));
      await mobile.waitForTimeout(500);
      await ss(mobile, 'product-mobile-bottom');
    } catch(e) {
      log('mobile-product', `Could not click product card: ${e.message}`);
    }
  } else {
    log('mobile-product', 'No product card link found on shop page');
  }

  // Try navigating by URL patterns
  const pagesToTest = [
    ['tea-catalog', '/catalog'],
    ['tea-teas', '/teas'],
    ['tea-events', '/events'],
    ['tea-about', '/about'],
    ['tea-education', '/education'],
    ['tea-journal', '/journal'],
    ['tea-sessions', '/sessions'],
    ['tea-compass', '/compass'],
    ['tea-cart', '/cart'],
  ];

  for (const [name, path] of pagesToTest) {
    const resp = await mobile.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 8000 }).catch(() => null);
    if (resp && resp.status() < 400) {
      await mobile.waitForTimeout(1000);
      await ss(mobile, `${name}-mobile`);
      const hscroll = await mobile.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
      if (hscroll) log(`mobile-${name}`, `HORIZONTAL SCROLL on ${path}`);
      log(`pages`, `${path} → status ${resp.status()}`);
    } else {
      log(`pages`, `${path} → NOT FOUND or error`);
    }
  }

  // Admin
  await mobile.goto(`${BASE}/admin`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => null);
  await mobile.waitForTimeout(1500);
  await ss(mobile, 'admin-mobile');
  log('admin', `Admin URL: ${mobile.url()}`);

  // Get all links on homepage for route discovery
  await mobile.goto(BASE, { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(1000);
  const allLinks = await mobile.$$eval('a[href]', els =>
    [...new Set(els.map(el => el.getAttribute('href')))].filter(h => h && !h.startsWith('http') && !h.startsWith('mailto') && !h.startsWith('tel'))
  );
  log('routes', `Internal links on homepage: ${allLinks.join(', ')}`);

  // ── DESKTOP PASS ─────────────────────────────────────────────────────────
  console.log('\n=== DESKTOP PASS (1440x900) ===\n');
  const desktop = await browser.newPage();
  await desktop.setViewportSize({ width: 1440, height: 900 });

  await desktop.goto(BASE, { waitUntil: 'networkidle' });
  await desktop.waitForTimeout(1500);
  await ss(desktop, 'home-desktop-top');
  await desktop.evaluate(() => window.scrollTo(0, 700));
  await desktop.waitForTimeout(500);
  await ss(desktop, 'home-desktop-scroll1');
  await desktop.evaluate(() => window.scrollTo(0, 1500));
  await desktop.waitForTimeout(500);
  await ss(desktop, 'home-desktop-scroll2');
  await desktop.evaluate(() => window.scrollTo(0, 2500));
  await desktop.waitForTimeout(500);
  await ss(desktop, 'home-desktop-scroll3');
  await desktop.evaluate(() => window.scrollTo(0, 99999));
  await desktop.waitForTimeout(500);
  await ss(desktop, 'home-desktop-bottom');

  const desktopHScroll = await desktop.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
  log('desktop-layout', desktopHScroll ? 'HORIZONTAL SCROLL on desktop homepage' : 'No horizontal scroll on desktop homepage');

  await desktop.goto(`${BASE}/shop`, { waitUntil: 'networkidle' }).catch(() => null);
  await desktop.waitForTimeout(1500);
  await ss(desktop, 'shop-desktop');

  // Shop link discovery
  const shopLinks = await desktop.$$eval('a[href]', els =>
    [...new Set(els.map(el => el.getAttribute('href')))].filter(h => h && !h.startsWith('http'))
  );
  log('shop-routes', `Links on shop page: ${shopLinks.join(', ')}`);

  // Try to get a product page
  const firstProductLink = await desktop.$('a[href*="/product"], a[href*="/shop/"], a[href*="/tea/"]');
  if (firstProductLink) {
    const href = await firstProductLink.getAttribute('href');
    await desktop.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
    await desktop.waitForTimeout(1500);
    await ss(desktop, 'product-desktop');
    log('product', `Product page: ${desktop.url()}`);
  }

  // Test other routes on desktop
  for (const [name, path] of pagesToTest) {
    const resp = await desktop.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 8000 }).catch(() => null);
    if (resp && resp.status() < 400 && desktop.url().includes(path)) {
      await desktop.waitForTimeout(1000);
      await ss(desktop, `${name}-desktop`);
    }
  }

  await desktop.goto(`${BASE}/admin`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => null);
  await desktop.waitForTimeout(2000);
  await ss(desktop, 'admin-desktop');

  // Admin login attempt
  const adminUrl = desktop.url();
  log('admin-desktop', `Admin landing at: ${adminUrl}`);

  // Check login form
  const loginInput = await desktop.$('input[type="email"], input[type="text"], input[name="email"]');
  if (loginInput) {
    log('admin-desktop', 'Admin login form found');
    await ss(desktop, 'admin-login-desktop');
  }

  // ── DOM ANALYSIS ─────────────────────────────────────────────────────────
  console.log('\n=== DOM ANALYSIS ===\n');

  await mobile.goto(BASE, { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(1000);

  // Check font sizes
  const fontAudit = await mobile.evaluate(() => {
    const elements = document.querySelectorAll('h1, h2, h3, p, a, button, span');
    const sizes = {};
    elements.forEach(el => {
      const tag = el.tagName.toLowerCase();
      const fs = window.getComputedStyle(el).fontSize;
      if (!sizes[tag]) sizes[tag] = new Set();
      sizes[tag].add(fs);
    });
    const result = {};
    Object.entries(sizes).forEach(([k, v]) => result[k] = [...v]);
    return result;
  });
  log('typography', `Font sizes by tag: ${JSON.stringify(fontAudit)}`);

  // Check color contrast issues (simplified)
  const textColors = await mobile.evaluate(() => {
    const els = document.querySelectorAll('h1, h2, p, a, button');
    const colors = new Set();
    els.forEach(el => {
      const style = window.getComputedStyle(el);
      colors.add(`${el.tagName}:color=${style.color},bg=${style.backgroundColor}`);
    });
    return [...colors].slice(0, 20);
  });
  log('colors', `Sample text colors: ${JSON.stringify(textColors)}`);

  // Check images
  const images = await mobile.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    return [...imgs].map(img => ({
      src: img.src.substring(0, 80),
      alt: img.alt,
      hasAlt: img.alt !== '',
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight
    }));
  });
  log('images', `Images on homepage: ${JSON.stringify(images)}`);

  // Check for empty states / loading spinners
  const loadingEls = await mobile.evaluate(() => {
    const spinners = document.querySelectorAll('[class*="spin"], [class*="loading"], [class*="skeleton"], [class*="pulse"]');
    return spinners.length;
  });
  log('loading', `Loading/skeleton elements on homepage: ${loadingEls}`);

  // Accessibility: buttons without text
  const badButtons = await mobile.evaluate(() => {
    const btns = document.querySelectorAll('button');
    return [...btns].filter(b => !b.textContent.trim() && !b.getAttribute('aria-label')).map(b => b.outerHTML.substring(0, 100));
  });
  log('a11y', `Buttons without text or aria-label: ${JSON.stringify(badButtons)}`);

  // Check touch target sizes
  const smallTargets = await mobile.evaluate(() => {
    const interactive = document.querySelectorAll('button, a, [role="button"]');
    const small = [];
    interactive.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
        small.push({ tag: el.tagName, text: el.textContent.trim().substring(0, 30), w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    });
    return small.slice(0, 20);
  });
  log('touch-targets', `Small touch targets (<44px): ${JSON.stringify(smallTargets)}`);

  // Page title and meta
  const meta = await mobile.evaluate(() => ({
    title: document.title,
    metaDesc: document.querySelector('meta[name="description"]')?.content,
    metaViewport: document.querySelector('meta[name="viewport"]')?.content,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content,
  }));
  log('meta', `Page meta: ${JSON.stringify(meta)}`);

  // Check for console errors
  const errors = [];
  mobile.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await mobile.goto(BASE, { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(2000);
  log('console', `Console errors: ${JSON.stringify(errors)}`);

  // Shop page DOM analysis
  await mobile.goto(`${BASE}/shop`, { waitUntil: 'networkidle' }).catch(() => null);
  await mobile.waitForTimeout(1000);

  const shopItems = await mobile.evaluate(() => {
    // look for product cards
    const cards = document.querySelectorAll('[class*="product"], [class*="card"], [class*="item"], article');
    return { count: cards.length, firstHTML: cards[0]?.outerHTML?.substring(0, 300) };
  });
  log('shop-items', `Product cards on shop: ${JSON.stringify(shopItems)}`);

  // Check filter/sort UI
  const filterUI = await mobile.evaluate(() => {
    const filters = document.querySelectorAll('[class*="filter"], [class*="sort"], select, [role="listbox"]');
    return [...filters].map(f => ({ tag: f.tagName, class: f.className.substring(0, 50), text: f.textContent.trim().substring(0, 50) }));
  });
  log('filters', `Filter/sort elements: ${JSON.stringify(filterUI)}`);

  // ── INTERACTION TESTS ────────────────────────────────────────────────────
  console.log('\n=== INTERACTION TESTS ===\n');

  // Add to cart flow
  await mobile.goto(`${BASE}/shop`, { waitUntil: 'networkidle' }).catch(() => null);
  await mobile.waitForTimeout(1000);

  const addToCartBtn = await mobile.$('button:has-text("Add"), button:has-text("Cart"), button:has-text("Buy"), button:has-text("WhatsApp"), button:has-text("Order")');
  if (addToCartBtn) {
    const btnText = await addToCartBtn.textContent();
    log('cart-flow', `Add to cart button found: "${btnText.trim()}"`);
  } else {
    log('cart-flow', 'No obvious add-to-cart button on shop listing');
  }

  // ── WRITE FINDINGS ───────────────────────────────────────────────────────
  const reportPath = `${SCREENSHOT_DIR}/findings.json`;
  writeFileSync(reportPath, JSON.stringify(findings, null, 2));
  console.log(`\n\nFindings saved to ${reportPath}`);
  console.log(`Screenshots in ${SCREENSHOT_DIR}/`);
  console.log(`\nAll findings:\n`);
  findings.forEach(f => console.log(`  [${f.section}] ${f.msg}`));

  await browser.close();
}

audit().catch(e => {
  console.error('Audit failed:', e);
  process.exit(1);
});
