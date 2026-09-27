// tests/article-editor-immersive.spec.ts
// AR.5 — block-stack authoring. Proves the two load-bearing claims:
//  1. The render-mode toggle persists: flipping to Immersive writes
//     layout_template === 'immersive_scroll' through the real save path.
//  2. The live preview renders the block stack through the REAL immersive
//     reader (renderBlock), with a phone/desktop width toggle.
// Runs against the dev server on :7777 via a dev-only harness route that mounts
// the real ArticleEditorModal, so no admin auth shell is required.
import { test, expect } from './fixtures';

const HARNESS = '/design/article-editor';

// Capture every article save payload the editor sends.
async function trackSaves(page: import('@playwright/test').Page) {
  const payloads: any[] = [];
  await page.route('**/api/admin/articles/**', async (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      try { payloads.push(req.postDataJSON()); } catch { /* ignore */ }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 'harness-article', ...(req.postDataJSON?.() ?? {}) }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return payloads;
}

test('render-mode toggle persists immersive_scroll and the reader preview renders', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const payloads = await trackSaves(page);

  await page.goto(HARNESS);
  await expect(page.getByTestId('article-editor-harness')).toBeVisible();

  // The header toggle is desktop-only; the mobile metadata panel carries the
  // same control. Use whichever is present so the test holds on both projects.
  const headerToggle = page.getByTestId('render-mode-immersive');
  const isDesktopUI = await headerToggle.isVisible().catch(() => false);

  if (isDesktopUI) {
    await expect(page.getByTestId('render-mode-carousel')).toHaveAttribute('aria-pressed', 'true');
    await headerToggle.click();
    await expect(headerToggle).toHaveAttribute('aria-pressed', 'true');
  } else {
    // Mobile: open the Article Metadata details, then flip the Reader toggle.
    await page.getByText('Article Metadata', { exact: true }).click();
    const mobileToggle = page.getByTestId('render-mode-immersive-mobile');
    await mobileToggle.scrollIntoViewIfNeeded();
    await mobileToggle.click();
    await expect(mobileToggle).toHaveAttribute('aria-pressed', 'true');
  }

  // The toggle schedules a debounced autosave (1.5s). Wait for the PUT to land
  // and assert it carried the immersive discriminator — this is the claim that
  // matters on every viewport: choosing the look persists.
  await expect.poll(() => payloads.some(p => p.layout_template === 'immersive_scroll'), { timeout: 6000 }).toBe(true);

  if (isDesktopUI) {
    // Per-block text-effect dial appears in the block list now that the article
    // is immersive (the dials are gated on the immersive render mode).
    const dial = page.getByText('Text effect', { exact: true }).first();
    await dial.scrollIntoViewIfNeeded();
    await expect(dial).toBeVisible();

    // The Reader tab renders the block stack through the real immersive reader.
    await page.getByRole('button', { name: 'Reader', exact: true }).click();
    await expect(page.getByTestId('immersive-preview-article')).toBeVisible();
    await expect(page.getByTestId('immersive-preview-article').getByText('The Rock Remembers').first()).toBeVisible();
    await expect(page.getByTestId('immersive-preview-article').getByText('You do not drink the leaf.')).toBeVisible();

    // Width toggle: phone -> desktop changes the framed width readout.
    await expect(page.getByText('390px')).toBeVisible();
    await page.getByRole('button', { name: 'Desktop', exact: true }).click();
    await expect(page.getByText('1024px')).toBeVisible();
  }

  // No horizontal overflow in the editor shell.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflow).toBe(false);

  await page.screenshot({ path: `test-results/article-editor-immersive-${test.info().project.name}.png`, fullPage: false });

  expect(errors.filter((e) => !e.includes('favicon') && !/40[13]/.test(e))).toEqual([]);
});
