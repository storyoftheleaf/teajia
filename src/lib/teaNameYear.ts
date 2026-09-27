/**
 * A tea's year belongs in the vintage box beside its name, never in the name.
 *
 * Adrian's rule, 2026-09-24: the shop list already prints the year in its own
 * block at the head of every row, so "1990 Bamboo Leaf Old Tea" read the year
 * twice and cost the name its width on a phone ("1990 Bamboo Le..."). Many
 * records were typed with the year folded into the name, some with the year
 * field left empty, so the name was the only place the year lived.
 *
 * This runs once, where the public product payload is mapped, so every public
 * surface (shop list, product page, homepage, cart) reads the same answer. The
 * stored record is left alone: the admin still shows the name as it was typed.
 *
 * - A leading or trailing year ("1990", "1990s") is lifted out of the name.
 * - A short decade ("80s") is lifted only when the record's year says which
 *   century it is ("1980s"); on its own it is left in the name.
 * - Teas only. Teaware has no year box, and on an antique piece the date is
 *   part of what the piece is, so the caller does not run this for teaware.
 * - If the record has no year, the lifted one fills the box.
 * - If the record's year DISAGREES with the one in the name, the name is left
 *   as typed. Hiding one of two conflicting years would publish a guess.
 */

const YEAR = '((?:19|20)\\d{2}s?|\\d0s)';
const LEADING = new RegExp(`^${YEAR}\\s+(.+)$`);
const TRAILING = new RegExp(`^(.+?)\\s+\\(?${YEAR}\\)?$`);

export function splitNameYear(
  name: string,
  year: string | number | null | undefined,
): { name: string; year: string } {
  const stored = year == null ? '' : String(year).trim();
  const trimmed = (name || '').trim();

  let found = '';
  let rest = trimmed;
  const lead = LEADING.exec(trimmed);
  const trail = lead ? null : TRAILING.exec(trimmed);
  if (lead) {
    found = lead[1];
    rest = lead[2];
  } else if (trail) {
    found = trail[2];
    rest = trail[1];
  }

  if (!found || !rest.trim()) return { name: trimmed, year: stored };
  const shortDecade = found.length === 3;
  if (shortDecade) {
    // "80s" means nothing without a century; strip it only when the record's
    // own year is that decade.
    return stored.length === 5 && stored.endsWith(found) ? { name: rest.trim(), year: stored } : { name: trimmed, year: stored };
  }
  if (stored && stored !== found) return { name: trimmed, year: stored };
  return { name: rest.trim(), year: stored || found };
}
