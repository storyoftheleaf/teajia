# SEO edge meta — SHIPPED overnight

Status: LIVE. Built, deployed, and verified overnight. This doc is now the
record of what shipped, not a future plan.

What's live on teajia.com:
- An edge function gives every story link its real title, description, image,
  and canonical when shared or crawled (was: homepage default for everything).
- A real branded preview image (`og-image.png`) replaced the broken reference.
- Verified by fetching live pages as a crawler: story pages show their own
  meta; homepage and non-story pages keep the site default; one canonical each.

Rollback if ever needed: delete `functions/_middleware.ts`, redeploy.

## What the problem is (plain)

When someone shares a Teajia story link, or Google fetches it, they get a blank
page shell with only the homepage's title and a broken preview image. The words
load a moment later, which Google tolerates but link previews (WhatsApp,
iMessage, Instagram, Facebook, X) do not — they read the first response and
quit. So shared links look broken: no title, no description, no picture.

## The fix (decided, built tonight)

An edge function on Cloudflare Pages rewrites the page's head per URL before it's
returned, so crawlers and link previews get the right title, description, and
image. Humans get the normal app unchanged. No rewrite of the React app.

This was the #1 recommendation from two independent research passes. The
rejected alternative (build-time prerendering) can't handle future
database-backed articles; full SSR is a weeks-long rewrite for a head-tag fix.

- Static `/read/*` stories: meta comes from a built-in list in the function.
- Future `/article/:slug` (database stories): meta fetched live from the API,
  only for crawlers, so human loads stay fast.

Built file: `functions/_middleware.ts`.

## Two real risks found (both must be handled tomorrow)

1. **The preview image is missing.** `og-image.png` is referenced everywhere but
   the file does not exist — every link preview points at a broken image today.
   Tomorrow: add a real `public/og-image.png` (a Teajia editorial cover, 1200x630).
   Until that exists, previews show a title + description but no picture.
2. **The function takes over HTML delivery.** Once live, the edge function sits
   in front of every page. If it errored it could blank the site. Mitigations
   already in the code: it only acts on known routes, falls through untouched on
   anything else, and the API call has a short timeout with a safe fallback.
   Still: verify on a preview deploy before it touches the real domain.

## Tomorrow's steps (about an hour, you approve the live ones)

1. Review `functions/_middleware.ts` together (5 min).
2. Add a real `public/og-image.png` (you supply or approve an image).
3. Deploy to a Cloudflare Pages **preview** URL first (not the live domain).
4. Test on the preview: paste a story link into a link-preview checker and into
   a real WhatsApp/iMessage chat; confirm title + description + image show.
   Confirm normal pages still load for humans.
5. Only after the preview passes: promote to the live domain (your approval).
6. Re-test one live link, then submit the story pages for re-indexing.

## How to test a link preview without sending spam

Use a preview-debugger site (e.g. opengraph.xyz or Facebook's sharing debugger)
on the preview URL — it shows exactly what a scraper sees, no message sent.

## Rollback

The function is one file. Removing `functions/_middleware.ts` and redeploying
returns the site to exactly today's behaviour. No data change, no schema change.
