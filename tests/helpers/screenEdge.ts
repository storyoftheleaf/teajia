import { expect, type Page } from '@playwright/test';

/**
 * Does anything a person can see reach past the right edge of the screen?
 *
 * This exists because the ordinary overflow check cannot answer that question.
 * That one compares the DOCUMENT width against the viewport, and an element
 * overrunning its grid track is absorbed without the document growing at all.
 * On 2026-08-31 an order summary on the payment page rendered 551px inside a
 * 311px column, carrying the amount 208px off a 375px phone, while the document
 * stayed exactly 375px wide. The page was swept, the assertion ran, and it was
 * blind to it by construction.
 *
 * What counts as visible is deliberately narrow, because the blunt version of
 * this check is noisy. Surveyed across the twenty routes the mobile suite
 * sweeps, testing every element box produced one hit, and it was not a defect:
 * a shop tab strip is exactly viewport-wide and carries a horizontal margin, so
 * its box overhangs by 12px while painting nothing there and clipping its own
 * content. Nobody can see it. A check that reports that teaches people to ignore
 * it, so only two things are asked about:
 *
 *   - a leaf carrying text, because text off the edge is text nobody can read
 *   - anything painting a background or a border, because that is ink on glass
 *
 * Skipped: descendants of a deliberate sideways scroller, where wide content is
 * the design, and anything fixed or absolute, because drawers and sheets park
 * off-screen until they are opened.
 */
export interface ScreenEdgeOverrun {
  tag: string;
  cls: string;
  text: string;
  past: number;
  why: 'text' | 'paint';
}

export async function findScreenEdgeOverruns(page: Page): Promise<ScreenEdgeOverrun[]> {
  return page.evaluate(() => {
    const viewport = window.innerWidth;
    const found: Array<{ tag: string; cls: string; text: string; past: number; why: 'text' | 'paint' }> = [];

    for (const el of Array.from(document.querySelectorAll('main *'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const past = Math.round(rect.right - viewport);
      if (past <= 2) continue;

      let node: Element | null = el;
      let excused = false;
      while (node) {
        const style = getComputedStyle(node);
        if (style.position === 'fixed' || style.position === 'absolute') { excused = true; break; }
        if (node !== el && (style.overflowX === 'auto' || style.overflowX === 'scroll')) { excused = true; break; }
        node = node.parentElement;
      }
      if (excused) continue;

      const style = getComputedStyle(el);
      const ownText = el.children.length === 0 && (el.textContent || '').trim().length > 0;
      const paints =
        !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(style.backgroundColor) ||
        style.backgroundImage !== 'none' ||
        parseFloat(style.borderRightWidth) > 0 ||
        parseFloat(style.borderTopWidth) > 0 ||
        parseFloat(style.borderBottomWidth) > 0;
      if (!ownText && !paints) continue;

      found.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute('class') || '').slice(0, 80),
        text: (el.textContent || '').trim().slice(0, 50),
        past,
        why: ownText ? 'text' : 'paint',
      });
    }

    found.sort((a, b) => b.past - a.past);
    return found;
  });
}

export async function assertNothingRunsOffScreen(page: Page, label: string): Promise<void> {
  const overruns = await findScreenEdgeOverruns(page);
  const worst = overruns[0] ?? null;
  expect(
    worst,
    worst
      ? `${label}: <${worst.tag} class="${worst.cls}"> reaches ${worst.past}px past the right edge (${worst.why}), showing "${worst.text}"`
      : '',
  ).toBeNull();
}
