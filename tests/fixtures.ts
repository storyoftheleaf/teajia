/**
 * The suite's `test`, with one standing rule: no spec ever reads metered R2
 * media from the deployed service.
 *
 * Tea and article images are delivered by the same-origin /api/media route.
 * A fresh
 * browser context (which is every Playwright test) has no cache, so each of
 * the suite's ~48 specs pulls the shelf's artwork again from the origin. In
 * September 2026 the sister suites on mandalacodes and Adrian-Website
 * delivered 70 GB this way in one day and the shared account ran out of free
 * credits. Same rule here, before it happens on this one.
 *
 * So every media request is answered here with a 1x1 transparent
 * PNG (so `<img>` still fires `load` and naturalWidth is 1), and every video
 * request with an empty body, without either leaving the machine. Nothing in the
 * suite asserts on the pixels of the artwork itself.
 *
 * Specs import `test` and `expect` from here, never from '@playwright/test'
 * directly; that is what makes the rule impossible to forget.
 */
import { test as base } from '@playwright/test';

export * from '@playwright/test';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/* crossOrigin="anonymous" images are CORS requests; a stub without this
   header is refused by the browser and logged as ERR_FAILED, which the
   "no console errors" checks would then count. */
const CORS = { 'access-control-allow-origin': '*' };

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(/\/api\/media\//, (route) => {
      /* Decided by what the page asked for, not by the URL: a poster frame is
         an <img> under /video/upload/, and it has to load like any image. An
         empty body for a <video> makes it report an unsupported source and
         stop, with no network error in the console. */
      if (route.request().resourceType() === 'media') {
        return route.fulfill({ status: 204, headers: CORS });
      }
      return route.fulfill({ status: 200, contentType: 'image/png', headers: CORS, body: ONE_PIXEL_PNG });
    });
    await use(context);
  },
});
