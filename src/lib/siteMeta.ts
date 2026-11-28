/**
 * What a pasted teajia.com link says about the site: the title, the line under
 * it and the picture a chat app shows. One place, read by the tab title, the
 * home page, the edge (functions/_middleware.ts) and the manifest test.
 * index.html carries the same words for scrapers that read the bare shell;
 * src/lib/siteMeta.test.ts fails when the two drift.
 *
 * The words are Adrian's, from teajia-homepage-seo-and-meta.md (2026-11-28),
 * pasted exactly: they are counted letter by letter, so never reword them.
 * Locked for six weeks after they go live, then reviewed in Search Console
 * one phrase at a time. Home shows the description as the line under its
 * headline. The picture is drawn by
 * `npm run share:site` (scripts/share-site-cards.mjs).
 */
import type { Section } from '../types';

export const SITE_TITLE = 'Teajia · Tea Culture, Rare Tea and Tea House Design';

export const SITE_DESCRIPTION =
  'Tea is a living art. Learn from lasting teachings, shop and source fine teas old and new, keep your tea chest and journal, and create your tea space.';

/** Home's headline, which the edge also writes for crawlers that run no script. */
export const HOME_HEADLINE = 'Tea deepens with what you bring to the table and what you leave behind.';

/** A new file name, so chat apps that keep the old picture fetch this one. */
export const SITE_PREVIEW_IMAGE_PATH = '/share/teajia.png';

/** Teajia's Instagram (2026-11-28: the old @teajia.journal and @teajia.foundation addresses no longer open). */
export const INSTAGRAM_HANDLE = 'the.teajia';
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

const SECTION_TITLES: Record<Section, string> = {
  HOME: SITE_TITLE,
  MAGAZINE: 'Magazine · Teajia',
  SHOP: 'Shop · Teajia',
  OFFERINGS: 'Advise · Teajia',
  EVENTS: 'Sessions · Teajia',
  YOUR_TABLE: 'Your Table · Teajia',
  ABOUT: 'About · Teajia',
};

/** The browser tab's name while a section shows (App names it on each change). */
export function sectionTitle(section: Section): string {
  return SECTION_TITLES[section] ?? SITE_TITLE;
}
