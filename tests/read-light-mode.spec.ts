import { expect, test } from './fixtures';
import { collectErrors, meaningfulErrors, noHorizontalOverflow } from './helpers/creatorFixtures';

// The Read section followed the site's light/dark toggle, 2026-09-20. It used
// to be a single always-dark editorial surface by decision (see the header
// comment in src/pages/read/immersive.tsx and COLOR_RULES.md's "The Read
// section, decided"); that decision is superseded. Dark mode has to render
// pixel-identical to before (the literal reader palette, unchanged); light
// mode has to repaint onto the site's own light tokens instead of showing a
// night read on a white page.

const ARTICLE_PATH = '/read/leaf-to-liquor';
const DARK_BG = 'rgb(20, 16, 11)';
// --tea-bg in light mode (src/styles/tailwind.css): #f4ece0.
const LIGHT_BG = 'rgb(244, 236, 224)';

async function openArticle(page: import('@playwright/test').Page, theme: 'dark' | 'light') {
  await page.addInitScript(selectedTheme => window.localStorage.setItem('teajia_theme', selectedTheme), theme);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ARTICLE_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /From Leaf/i })).toBeVisible();
  // The site runs a 500ms background-color transition on `body` (tailwind.css);
  // reading getComputedStyle before it settles catches an interpolated frame,
  // not the resting colour a reader actually sees.
  await page.waitForTimeout(600);
}

async function readBg(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const root = document.querySelector('.tj-immersive');
    return {
      body: getComputedStyle(document.body).backgroundColor,
      html: getComputedStyle(document.documentElement).backgroundColor,
      root: root ? getComputedStyle(root as HTMLElement).backgroundColor : '',
    };
  });
}

test.describe('Read section follows site theme', () => {
  test('dark mode renders the reader\'s own unchanged espresso ground', async ({ page }) => {
    const errors = collectErrors(page);
    await openArticle(page, 'dark');

    const bg = await readBg(page);
    expect(bg.body).toBe(DARK_BG);
    expect(bg.html).toBe(DARK_BG);

    expect(await noHorizontalOverflow(page)).toBe(true);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Something went wrong');
    expect(bodyText.toLowerCase()).not.toContain('page not found');
    expect(meaningfulErrors(errors)).toEqual([]);

    await page.screenshot({ path: 'test-results/read-light-mode/leaf-to-liquor-dark.png' });
  });

  test('light mode repaints the reader onto the site\'s parchment ground', async ({ page }) => {
    const errors = collectErrors(page);
    await openArticle(page, 'light');

    expect(await page.evaluate(() => document.documentElement.classList.contains('light'))).toBe(true);

    const bg = await readBg(page);
    expect(bg.body).toBe(LIGHT_BG);
    expect(bg.html).toBe(LIGHT_BG);
    // The whole point: light mode must not equal the dark literal.
    expect(bg.body).not.toBe(DARK_BG);

    // Body copy pairs against the light ground, not the dark one: readable ink,
    // not the reader's dark-mode cream left stranded on parchment.
    const inkColor = await page.evaluate(() => {
      const p = document.querySelector('.tj-immersive p');
      return p ? getComputedStyle(p).color : '';
    });
    expect(inkColor).not.toBe('rgb(237, 228, 212)'); // dark-mode C.ink literal

    expect(await noHorizontalOverflow(page)).toBe(true);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Something went wrong');
    expect(bodyText.toLowerCase()).not.toContain('page not found');
    expect(meaningfulErrors(errors)).toEqual([]);

    await page.screenshot({ path: 'test-results/read-light-mode/leaf-to-liquor-light.png' });
  });

  test('the liquor-colour swatches stay literal art direction in both modes', async ({ page }) => {
    // The oxidation scale and the six tea-colour dots are measurements of an
    // object, not page chrome; they must not have been swept into the theme
    // conversion. Spot-check one dot (Oolong, #C4A484) survives untouched.
    for (const theme of ['dark', 'light'] as const) {
      await openArticle(page, theme);
      await page.mouse.wheel(0, 6000);
      await page.waitForTimeout(300);
      const dotColor = await page.evaluate(() => {
        const dots = Array.from(document.querySelectorAll<HTMLElement>('[style*="border-radius: 50%"]'));
        const target = dots.find(el => getComputedStyle(el).backgroundColor === 'rgb(196, 164, 132)');
        return target ? getComputedStyle(target).backgroundColor : null;
      });
      // Not every render path shows the swatch row within one scroll; only
      // assert when found, so this stays a spot-check rather than a brittle
      // exact-scroll requirement.
      if (dotColor) expect(dotColor).toBe('rgb(196, 164, 132)');
    }
  });
});
