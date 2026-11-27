/**
 * Draws the link-preview picture for teajia.com/mcp (public/share/mcp.png,
 * 1200x630), the card a chat app shows under a pasted "connect your assistant"
 * link. functions/_middleware.ts (MCP_PAGE_META) points scrapers at it.
 *
 *   npm run share:mcp
 *
 * Uses the site's own fonts and emblem from public/, so it needs no server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const pub = path.resolve('public');
// Inlined: a page set from a string may not load file:// fonts.
const font = (file) => `data:font/${file.endsWith('.ttf') ? 'ttf' : 'woff2'};base64,${fs.readFileSync(path.join(pub, 'fonts', file)).toString('base64')}`;
const emblem = fs.readFileSync(path.join(pub, 'logos', 'emblem.svg'), 'utf8');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Cormorant Garamond'; font-weight: 400; src: url(${font('cormorant-garamond-400-normal-latin.woff2')}); }
@font-face { font-family: 'Cormorant Garamond'; font-weight: 500; font-style: italic; src: url(${font('cormorant-garamond-500-italic-latin.woff2')}); }
@font-face { font-family: 'Lora'; font-weight: 400; src: url(${font('lora-400-normal-latin.woff2')}); }
@font-face { font-family: 'Jakarta'; src: url(${font('PlusJakartaSans-Regular.ttf')}); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #22201c; color: #ede4d4; font-family: 'Lora', serif; position: relative; overflow: hidden; }
.frame { position: absolute; inset: 36px; border: 1px solid rgba(168,135,77,0.35); border-radius: 18px; }
.wrap { position: absolute; left: 96px; right: 96px; top: 92px; bottom: 84px; display: flex; flex-direction: column; }
.kicker { font-family: 'Jakarta', sans-serif; font-size: 20px; letter-spacing: 0.22em; text-transform: uppercase; color: #bfa06a; display: flex; align-items: center; gap: 18px; }
.kicker svg { width: 44px; height: 44px; }
.kicker svg { color: #bfa06a; }
h1 { font-family: 'Cormorant Garamond', serif; font-weight: 400; font-size: 92px; line-height: 1.02; margin-top: 46px; letter-spacing: 0.005em; }
h1 em { font-style: italic; font-weight: 500; color: #bfa06a; }
p { font-size: 27px; line-height: 1.5; color: #ddd2bd; margin-top: 30px; max-width: 900px; }
.foot { margin-top: auto; display: flex; justify-content: space-between; align-items: baseline; font-family: 'Jakarta', sans-serif; font-size: 19px; color: #b3a283; letter-spacing: 0.04em; }
.foot b { font-weight: 400; color: #ede4d4; }
</style></head><body>
<div class="frame"></div>
<div class="wrap">
  <div class="kicker">${emblem}<span>The Teajia connector</span></div>
  <h1>Run your tea shop<br>from <em>a conversation.</em></h1>
  <p>Claude, ChatGPT or your own agent brings teas in, prices, invoices and sends. Every change waits for your yes.</p>
  <div class="foot"><span><b>teajia.com/mcp</b></span><span>Preview first · Confirm to write</span></div>
</div>
</body></html>`;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(pub, 'share', 'mcp.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log(`drew ${out}`);
} finally {
  await browser.close();
}
