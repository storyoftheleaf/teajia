import type { Page } from '@playwright/test';

/**
 * Serve one of Launch 4's switches open to the page, the way
 * tests/session-tasting.spec.ts serves Launch 3's: the dev server's copy of the
 * switch module is answered with one that says yes, so a walk of the open
 * pages does not depend on how the site was started. Each body keeps every
 * export of the real module.
 */
export async function openTeaHouses(page: Page) {
  await page.route(/\/src\/lib\/teaHouses\.ts(?:\?|$)/, route => route.fulfill({
    contentType: 'application/javascript',
    body: "export const TEA_HOUSES_OPEN = true; export const TEA_HOUSES_TITLE = 'Tea Houses'; export const teaHousesOpen = () => true;",
  }));
}

export async function openTeaTable(page: Page) {
  await page.route(/\/src\/lib\/teaTable\.ts(?:\?|$)/, route => route.fulfill({
    contentType: 'application/javascript',
    body: 'export const TEA_TABLE_OPEN = true; export const teaTableOpen = () => true; export const teaTableConsent = asked => asked;',
  }));
}
