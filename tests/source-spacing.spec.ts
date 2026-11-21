import { test, expect } from './fixtures';
import { installCompassHarness, openCompass } from './helpers/compassHarness';

test('Source controls fit, currency keeps the quote, and any quoted weight can be entered', async ({ page }, info) => {
  await installCompassHarness(page, { rates: [{ currency: 'USD', rate_to_usd: 1 }, { currency: 'Yuan', rate_to_usd: 7.1 }, { currency: 'NT', rate_to_usd: 32 }] });
  const widths = info.project.name === 'Mobile Chrome' ? [320, 370, 390] : [1280];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await openCompass(page);
    const visible = <T extends import('@playwright/test').Locator>(locator: T) => locator.filter({ visible: true }).first();
    await visible(page.getByPlaceholder('Tea name')).fill('Spacing verification tea');
    const save = visible(page.getByRole('button', { name: 'Save changes to this tea', exact: true }));
    await expect(save).toHaveText('Save');
    const currency = visible(page.getByRole('button', { name: 'Currency', exact: true }));
    const price = visible(page.getByRole('spinbutton', { name: 'Price', exact: true }));
    await price.fill('1250');
    await currency.click();
    const picker = page.getByRole('dialog', { name: 'Quote currency', exact: true });
    await expect(picker).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`currency-${width}.png`) });
    await picker.getByRole('button', { name: '$ · USD', exact: true }).click();
    await expect(currency).toHaveText('$');
    await expect(price).toHaveValue('1250');
    await visible(page.getByRole('button', { name: 'Choose preset weight', exact: true })).click();
    const weight = page.getByRole('dialog', { name: 'Quoted weight', exact: true });
    await weight.getByLabel('Other weight', { exact: true }).fill('1250');
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`other-weight-${width}.png`) });
    await weight.getByRole('button', { name: 'Use weight', exact: true }).click();
    const grams = visible(page.getByRole('spinbutton', { name: 'Grams', exact: true }));
    await expect(grams).toHaveValue('1250');
    // Inputs must have room for four digits, and all top controls stay in bounds.
    for (const input of [grams, price]) {
      expect(await input.evaluate((e: HTMLInputElement) => {
        const style = getComputedStyle(e); const canvas = document.createElement('canvas'); const context = canvas.getContext('2d')!;
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const fits = e.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) >= context.measureText(e.value).width;
        return fits;
      })).toBe(true);
    }
    const bounds = await page.locator('[data-testid="curate-supplier-header"] button, [aria-label="Screen"] button').evaluateAll(elements => elements.filter(e => e.getBoundingClientRect().width).map(e => { const r = e.getBoundingClientRect(); return { text: e.textContent, left: r.left, right: r.right, width: r.width }; }));
    for (const box of bounds) { expect(box.left, box.text ?? '').toBeGreaterThanOrEqual(0); expect(box.right, box.text ?? '').toBeLessThanOrEqual(width); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`source-${width}.png`), fullPage: true });
    await visible(page.getByRole('tab', { name: 'Orders', exact: true })).click();
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`orders-${width}.png`), fullPage: true });
    await expect(visible(page.getByRole('button', { name: /^Sample list/ }))).toBeInViewport();
  }
});
