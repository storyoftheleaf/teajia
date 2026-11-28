/**
 * What a pasted teajia.com link says about the site: the title, the line under
 * it and the picture a chat app shows. One place, read by the tab title, the
 * home page, the edge (functions/_middleware.ts) and the manifest test.
 * index.html carries the same words for scrapers that read the bare shell;
 * src/lib/siteMeta.test.ts fails when the two drift.
 *
 * The words are Home's own two lines, the core line and the house line, which
 * Adrian kept on 2026-11-27 ("4 yes"), so the preview says what the page
 * says. A placeholder until he picks (2026-11-28, thread "Update the site's
 * link preview"). The picture is drawn by
 * `npm run share:site` (scripts/share-site-cards.mjs).
 */
import type { Section } from '../types';

export const SITE_TITLE = 'Teajia · A home for tea';

export const SITE_DESCRIPTION =
  'Tea deepens with what you bring to the table and what you leave behind. Source, study and share with those who gather around the leaf.';

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
