import { expect, type Page } from '@playwright/test';

// On a phone Curate's header (the Source / Library / Ledger tabs) slides away
// as the page scrolls down and returns on the way back up. A person scrolls up
// to reach it; a test that clicks a tab without doing the same lands its tap
// on whatever content has slid over the tab. Scroll up until the named tab is
// both in view and the element actually under its centre, then return it.
export async function revealCurateTab(page: Page, name: string) {
  const tab = page.getByRole('tab', { name, exact: true });
  await expect(async () => {
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, -4000);
    await expect(tab).toBeInViewport({ ratio: 0.9, timeout: 1000 });
    expect(await tab.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })).toBe(true);
  }).toPass({ timeout: 10_000 });
  return tab;
}
