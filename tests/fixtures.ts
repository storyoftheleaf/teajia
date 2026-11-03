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
 * So every media request is answered, by the shared stub in
 * tests/shared/media-stub.ts, with a 1x1 transparent PNG (so `<img>` still fires `load` and naturalWidth is 1), and every video
 * request with an empty body, without either leaving the machine. Nothing in the
 * suite asserts on the pixels of the artwork itself.
 *
 * Specs import `test` and `expect` from here, never from '@playwright/test'
 * directly; that is what makes the rule impossible to forget.
 */
import { test as base } from '@playwright/test';
import { CORS, stubMeteredMedia } from './shared/media-stub';

export * from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, use) => {
    await stubMeteredMedia(context, /\/api\/media\//);
    /* Every /read page asks which stories were published or taken down from
       their own page (migration 0030). The default answer is "none", so the
       ARTICLE_LIVE map decides exactly as it did before that existed; a spec
       about publishing registers its own page.route, which wins over this. */
    await context.route(/\/api\/public\/read\/publish-state$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ states: {} }) }));
    await use(context);
  },
});
