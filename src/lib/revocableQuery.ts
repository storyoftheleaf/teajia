/**
 * How a view of something that can be taken back is read (A4 review, finding
 * 4, 2026-11-26): a person's page, a recap, a tea's family photographs, the
 * pieces someone kept from the Tea Table. A person can take their own item
 * off and the owner can hide any item, so a view never shows a copy kept from
 * before: it reads again whenever it opens and whenever the window comes back.
 * The worker answers these with no-store, so the browser keeps nothing either.
 */
export const REVOCABLE_QUERY = {
  staleTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
} as const;
