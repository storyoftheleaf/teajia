import type { Page } from '@playwright/test';
import { fresh, snap, type Size } from './lib';

/** Click the first visible match, waiting a few seconds for it; false (and a log line) when it never shows. */
export async function click(page: Page, loc: ReturnType<Page['locator']>, wait = 800) {
  const target = loc.filter({ visible: true }).first();
  await target.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
  if (!(await target.count())) { console.log('MISS', String(loc)); return false; }
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(wait);
  return true;
}

/** A room's pictures: `at` opens a route clean, runs an optional step, and shoots when the step found its control. */
export function room(page: Page, size: Size, name: string) {
  const shot = (state: string, route: string, note: string, full = false) => snap(page, size, { room: name, state, route, note, full });
  const at = async (route: string, state: string, note: string, step?: () => Promise<boolean | void>, full = false) => {
    await fresh(page, route);
    if (step) {
      try { if ((await step()) === false) return; } catch (e) { console.log('STEP FAILED', state, String(e).split('\n')[0]); return; }
    }
    await shot(state, route, note, full);
  };
  return { shot, at };
}
