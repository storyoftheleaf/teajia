// Shared module "media-stub", owned by mandalacodes (tests/shared/media-stub.ts). Do not edit this copy: change it there, then run modules-sync.
/**
 * Answers metered media requests locally, so no Playwright test ever pulls
 * production media.
 *
 * A fresh browser context (which is every Playwright test) has no cache, so
 * each test that opens a page pulls that page's media again from the origin.
 * On 2026-09-12 one suite, running ~35 times in CI, delivered 200K images and
 * 70 GB in a day and the free plan's account locked. This stub is the rule
 * that stops it, shared by every project with a Playwright suite.
 *
 * Every matching request is answered with a 1x1 transparent PNG (so `<img>`
 * still fires `load` and naturalWidth is 1), and every video request with an
 * empty body, without either leaving the machine. Nothing a suite asserts on
 * should depend on the pixels of the real media.
 *
 * Each project passes the address its media is served from, from its own
 * tests/fixtures.ts.
 */
import type { BrowserContext } from '@playwright/test';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/* crossOrigin="anonymous" images are CORS requests; a stub without this
   header is refused by the browser and logged as ERR_FAILED, which the
   "no console errors" checks would then count. */
export const CORS = { 'access-control-allow-origin': '*' };

export async function stubMeteredMedia(context: BrowserContext, mediaUrl: RegExp): Promise<void> {
  await context.route(mediaUrl, (route) => {
    /* Decided by what the page asked for, not by the URL: a poster frame is
       an <img> under /video/upload/, and it has to load like any image. An
       empty body for a <video> makes it report an unsupported source and
       stop, with no network error in the console. */
    if (route.request().resourceType() === 'media') {
      return route.fulfill({ status: 204, headers: CORS });
    }
    return route.fulfill({ status: 200, contentType: 'image/png', headers: CORS, body: ONE_PIXEL_PNG });
  });
}
