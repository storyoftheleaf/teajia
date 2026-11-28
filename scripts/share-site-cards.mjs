/**
 * Draws the site's link-preview pictures (1200x630), the cards a chat app
 * shows under a pasted link:
 *
 *   public/share/teajia.png  the whole site (src/lib/siteMeta.ts), and every
 *                            page that has no picture of its own
 *   public/share/mcp.png     teajia.com/mcp (MCP_PAGE_META)
 *
 *   npm run share:site        draws them all
 *   npm run share:mcp         draws only mcp.png
 *
 * Uses the site's own fonts and emblem from public/, so it needs no server.
 * A new card is one more entry in CARDS, never a second script.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const pub = path.resolve('public');
// Inlined: a page set from a string may not load file:// fonts.
const font = (file) => `data:font/${file.endsWith('.ttf') ? 'ttf' : 'woff2'};base64,${fs.readFileSync(path.join(pub, 'fonts', file)).toString('base64')}`;
const emblem = fs.readFileSync(path.join(pub, 'logos', 'emblem.svg'), 'utf8');
const wordmark = fs.readFileSync(path.join(pub, 'logos', 'wordmark.svg'), 'utf8').replace('fill:#231f20', 'fill:currentColor');

const CARDS = [
  {
    // The mark in the middle, so a chat app that crops the picture square
    // still shows the whole of it. The line is Home's core line.
    file: 'teajia.png',
    mark: true,
    line: 'Tea deepens with what you bring to the table<br>and what you leave behind.',
  },
  {
    file: 'mcp.png',
    kicker: 'The Teajia connector',
    headline: 'Run your tea shop<br>from <em>a conversation.</em>',
    headlineSize: 92,
    line: 'Claude, ChatGPT or your own agent brings teas in, prices, invoices and sends. Every change waits for your yes.',
    foot: ['teajia.com/mcp', 'Preview first · Confirm to write'],
  },
];

const markBody = (card) => `<div class="frame"></div>
<div class="mark">
  <div class="emblem">${emblem}</div>
  <div class="wordmark">${wordmark}</div>
  <div class="motto">${card.line}</div>
</div>`;

const cardBody = (card) => `<div class="frame"></div>
<div class="wrap">
  <div class="kicker">${emblem}<span>${card.kicker}</span></div>
  <h1>${card.headline}</h1>
  ${card.line ? `<p>${card.line}</p>` : ''}
  <div class="foot"><span><b>${card.foot[0]}</b></span><span>${card.foot[1]}</span></div>
</div>`;

const page = (card) => `<!doctype html><html><head><meta charset="utf-8"><style>

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
h1 { font-family: 'Cormorant Garamond', serif; font-weight: 400; font-size: ${card.headlineSize}px; line-height: 1.02; margin-top: 46px; letter-spacing: 0.005em; }
h1 em { font-style: italic; font-weight: 500; color: #bfa06a; }
p { font-size: 27px; line-height: 1.5; color: #ddd2bd; margin-top: 30px; max-width: 900px; }
.foot { margin-top: auto; display: flex; justify-content: space-between; align-items: baseline; font-family: 'Jakarta', sans-serif; font-size: 19px; color: #b3a283; letter-spacing: 0.04em; }
.foot b { font-weight: 400; color: #ede4d4; }
.mark { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.mark .emblem { width: 210px; height: 210px; color: #bfa06a; }
.mark .emblem svg, .mark .wordmark svg { width: 100%; height: 100%; display: block; }
.mark .wordmark { width: 300px; height: 119px; margin-top: 26px; color: #ede4d4; }
.mark .motto { font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 500; font-size: 31px; line-height: 1.3; text-align: center; color: #ddd2bd; margin-top: 16px; letter-spacing: 0.01em; }
</style></head><body>
${card.mark ? markBody(card) : cardBody(card)}
</body></html>`;

const only = process.argv[2];
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const card of CARDS.filter((c) => !only || c.file === only)) {
    await tab.setContent(page(card), { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    const out = path.join(pub, 'share', card.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await tab.screenshot({ path: out });
    console.log(`drew ${out}`);
  }
} finally {
  await browser.close();
}
