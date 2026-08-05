import { TERM_MAP } from '../../data/tastingTaxonomy';

/**
 * One answer to "can this word be followed?", for every block that prints one.
 *
 * A product page prints the same taxonomy term in two places. In the tasting
 * block it was a link to `/shop?flavor=<id>`; twenty rows lower, in a review,
 * the identical term was plain caption text. Both blocks were right about
 * themselves and wrong together: a reader who taps "stone fruit" under Adrian's
 * note and then cannot tap "stone fruit" under someone else's has been taught
 * that the underline means something about the *sentence* rather than about the
 * word, which is the one thing a link may not be ambiguous about.
 *
 * The reason the review block gave for setting them plain ("terms a reader
 * cannot tap are a caption") was sound. It was just untrue: the terms are
 * taxonomy ids, and the shop hydrates its filters from `?flavor=` and `?feel=`,
 * so they can be tapped. The rule is now stated once, here, and it answers per
 * term rather than per block.
 *
 * Categories the shop cannot filter on (body, finish, liquor colour) return
 * null and are printed plain everywhere, which is the same promise honestly
 * kept in the other direction.
 */
export function shopTermHref(termId: string): string | null {
  const categoryId = TERM_MAP.get(termId)?.categoryId;
  if (categoryId === 'flavor') return `/shop?flavor=${encodeURIComponent(termId)}`;
  if (categoryId === 'feeling') return `/shop?feel=${encodeURIComponent(termId)}`;
  return null;
}
