/**
 * Draws the link-preview card for every published Read piece: the picture a
 * chat app shows under a pasted teajia.com/read/... link.
 *
 *   npm run share:cards
 *
 * It is the same drawing the Share button sends (renderShareCard in the share
 * sheet), in its wide 1200x630 shape, so a pasted link and a shared card look
 * alike. Run it after publishing a piece or changing its share line or photo;
 * functions/shareCards.test.ts fails until you do, naming the piece.
 *
 * Starts its own Vite server on a free port and its own headless browser, and
 * points the app's API at nowhere, so nothing it does reaches the live shop.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.VITE_API_URL ??= 'http://127.0.0.1:9';

const server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'silent' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const { shareCardInputs, readShareCardPath } = await server.ssrLoadModule('/functions/shareCardInputs.ts');
const inputs = shareCardInputs();

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  for (const [route, input] of Object.entries(inputs)) {
    await page.goto(base + route, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const b64 = await page.evaluate(async (card) => {
      await document.fonts.ready;
      const m = await import('/src/components/article/SharePanel.tsx');
      const blob = await m.renderShareCard({ id: 'card', slug: 'card', kicker: 'Teajia · Read', ...card }, 'landscape');
      if (!blob) throw new Error('the card did not draw');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (const b of bytes) s += String.fromCharCode(b);
      return btoa(s);
    }, input);
    const out = path.join('public', readShareCardPath(route));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log(`drew ${out}`);
  }
  // What each card was drawn from. The test compares it with what the piece
  // says now, which is how a card that has fallen behind its piece is caught.
  fs.writeFileSync('functions/share-cards.generated.json', JSON.stringify(inputs, null, 2) + '\n');
} finally {
  await browser.close();
  await server.close();
}
