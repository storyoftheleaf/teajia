import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import type { Page } from '@playwright/test';

// Pictures are never committed: they go to ARCHIVE_OUT, or a folder in the system temp directory.
export const OUT = process.env.ARCHIVE_OUT ?? path.join(os.tmpdir(), 'teajia-manage-archive');
export const SIZES = [{ n: 'phone', w: 390, h: 844 }, { n: 'laptop', w: 1440, h: 950 }] as const;
export type Size = (typeof SIZES)[number];

// Viewing order of the rooms in index.json.
export const ROOM_ORDER = [
  'today', 'curate-old', 'curate-new', 'tasting', 'stock', 'purchases', 'sales', 'people',
  'sessions', 'publish', 'settings', 'shop',
];

export interface ShotMeta { room: string; state: string; route: string; note: string; full?: boolean }

const MAX_CSS_HEIGHT = 7500; // WebP tops out at 16383 px; 2x scale

/** Load a page, let the network settle, and wait a beat for content. */
export async function go(page: Page, url: string, extra = 1800) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  // The cold first load shows only the loader: wait for real content (a tab, heading, field or button in main).
  await page.locator('main [role=tab], main h1, main h2, main input, main textarea, main button, [role=tab], h1, h2').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(extra);
}

/**
 * Load a page from a clean browser state: an overlay or a typed draft left open by
 * the previous picture would otherwise come back on reload and hide the page from
 * the next step. The sign-in token is kept.
 */
export async function fresh(page: Page, url: string, extra = 1500) {
  await page.goto(url);
  await page.evaluate(() => {
    const keep: Record<string, string> = {};
    for (const k of ['teajia_token']) { const v = localStorage.getItem(k); if (v) keep[k] = v; }
    localStorage.clear(); sessionStorage.clear();
    for (const [k, v] of Object.entries(keep)) localStorage.setItem(k, v);
  }).catch(() => {});
  await go(page, url, extra);
}

/** First load after a cold start shows only a loader: load once and discard. */
export async function warm(page: Page, url: string) {
  await go(page, url, 5000);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Take a picture, convert to WebP at quality 80, and record it for index.json. */
export async function snap(page: Page, size: Size, meta: ShotMeta) {
  fs.mkdirSync(OUT, { recursive: true });
  const base = `${slug(meta.room)}--${slug(meta.state)}--${size.n}`;
  const png = path.join(OUT, `.${base}.png`);
  const webp = path.join(OUT, `${base}.webp`);
  const opts: Parameters<Page['screenshot']>[0] = { path: png };
  const vp = page.viewportSize() ?? { width: size.w, height: size.h };
  let grew = false;
  if (meta.full) {
    // The admin scrolls inside its own container, so a full-page shot alone would
    // be one screen. Grow the window to the tallest scroller, shoot, put it back.
    // Only a scroller the person can actually see counts. A list lying under an
    // open sheet or a full-screen flow (the tasting, a dialog) must not grow the
    // window, or the thing on top is stretched into a shape nobody ever sees.
    const extra = await page.evaluate(() => {
      const onTop = (h: HTMLElement) => {
        if (h === document.documentElement || h === document.body) {
          const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2) as HTMLElement | null;
          let cur: HTMLElement | null = top;
          while (cur && cur !== document.body) {
            if (getComputedStyle(cur).position === 'fixed' && cur.clientHeight > innerHeight * 0.5 && cur.clientWidth > innerWidth * 0.5) return false;
            cur = cur.parentElement;
          }
          return true;
        }
        const r = h.getBoundingClientRect();
        const x0 = Math.max(r.left, 0), x1 = Math.min(r.right, innerWidth), y0 = Math.max(r.top, 0), y1 = Math.min(r.bottom, innerHeight);
        if (x1 - x0 < 8 || y1 - y0 < 8) return false;
        let hits = 0;
        for (const fx of [0.25, 0.5, 0.75]) for (const fy of [0.25, 0.5, 0.75]) {
          const at = document.elementFromPoint(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy);
          if (at && (at === h || h.contains(at))) hits += 1;
        }
        return hits >= 7;
      };
      let best = 0;
      for (const el of Array.from(document.querySelectorAll('*'))) {
        const h = el as HTMLElement;
        if (h.scrollHeight > h.clientHeight + 8 && h.clientHeight > innerHeight * 0.4) {
          const oy = getComputedStyle(h).overflowY;
          if ((h === document.documentElement || h === document.body || oy === 'auto' || oy === 'scroll') && onTop(h)) best = Math.max(best, h.scrollHeight - h.clientHeight);
        }
      }
      return best;
    });
    if (extra > 8) {
      await page.setViewportSize({ width: vp.width, height: Math.min(vp.height + extra + 4, MAX_CSS_HEIGHT) });
      await page.waitForTimeout(700);
      grew = true;
    }
    opts.fullPage = true;
  }
  await page.screenshot(opts);
  if (grew) { await page.setViewportSize(vp); await page.waitForTimeout(400); }
  execFileSync('convert', [png, '-quality', '80', webp]);
  fs.unlinkSync(png);
  fs.appendFileSync(path.join(OUT, 'index.jsonl'), JSON.stringify({ file: `${base}.webp`, room: meta.room, state: meta.state, size: size.n, route: meta.route, note: meta.note, t: Date.now() }) + '\n');
}
