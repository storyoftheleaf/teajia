/**
 * The suite must never read metered production media. tests/fixtures.ts
 * answers every /api/media request locally. The
 * shelf shows no artwork until the API answers, so rather than depend on
 * data this asks for one image directly and checks it came back as the stub.
 */
import { test, expect } from './fixtures';

test('an R2 image requested from the page is answered locally', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const answered = page.waitForResponse((r) => /\/api\/media\//.test(r.url()));
  const width = await page.evaluate(() => new Promise<number>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth);
    img.onerror = () => resolve(-1);
    img.src = '/api/media/teajia/probe';
  }));
  const body = await (await answered).body();

  expect(width, 'the stub is a 1x1 image').toBe(1);
  /* The image stub is 70 bytes; a real delivery is kilobytes. */
  expect(body.length).toBeLessThan(200);
});
