// Which approved Wisdom claims a shop listing may show, and in what order.
// Contract: docs/_notes/tea-wisdom-claims.md, "What a listing may match on".
import {
  LISTING_AXIS_ORDER,
  type ClaimAppliesWhen,
  type ClaimAxis,
  type ListingFacts,
  type ListingPassage,
  type ListingPassages,
  type PublicClaim,
} from './claims';

/** Axes that never appear on a listing, whatever a ledger entry says. */
const NEVER_ON_A_LISTING: ReadonlySet<ClaimAxis> = new Set(['maker_history', 'terminology']);

export const EMPTY_LISTING_PASSAGES: ListingPassages = Object.freeze({
  passages: Object.freeze([]) as readonly ListingPassage[],
  styleReferences: Object.freeze([]) as readonly PublicClaim[],
});

function codePointCompare(left: string, right: string): number {
  const a = [...left];
  const b = [...right];
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const diff = a[index].codePointAt(0)! - b[index].codePointAt(0)!;
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
}

function hasValues(values: readonly string[] | undefined): values is readonly string[] {
  return Array.isArray(values) && values.length > 0;
}

/**
 * Keys are ANDed. An empty object never matches. `name_includes` is only valid
 * beside `origin_includes`: a name may corroborate a recorded place, never
 * supply one. An empty list counts as a malformed condition and never matches.
 */
export function appliesTo(when: ClaimAppliesWhen, facts: ListingFacts): boolean {
  const keys = (Object.keys(when) as (keyof ClaimAppliesWhen)[]).filter(key => when[key] !== undefined);
  if (keys.length === 0) return false;
  if (when.name_includes !== undefined && when.origin_includes === undefined) return false;

  if (when.type !== undefined && when.type !== facts.type) return false;
  if (when.grade !== undefined && when.grade !== facts.grade) return false;
  if (when.form !== undefined && when.form !== facts.form) return false;
  if (when.origin_includes !== undefined) {
    if (!hasValues(when.origin_includes)) return false;
    if (!when.origin_includes.every(value => facts.originParts.includes(value))) return false;
  }
  if (when.name_includes !== undefined) {
    if (!hasValues(when.name_includes)) return false;
    if (!when.name_includes.every(value => facts.nameTokens.includes(value))) return false;
  }
  return true;
}

/** Scalar keys count once; each listed origin or name value counts once. */
export function conditionCount(when: ClaimAppliesWhen): number {
  return (when.type !== undefined ? 1 : 0)
    + (when.grade !== undefined ? 1 : 0)
    + (when.form !== undefined ? 1 : 0)
    + (when.origin_includes?.length ?? 0)
    + (when.name_includes?.length ?? 0);
}

function isPublic(claim: PublicClaim): boolean {
  return claim.reviewState === 'approved' && claim.rev !== null && !claim.withdrawn;
}

function axisRank(axis: ClaimAxis): number {
  const rank = LISTING_AXIS_ORDER.indexOf(axis);
  return rank === -1 ? Number.POSITIVE_INFINITY : rank;
}

function compareForListing(left: PublicClaim, right: PublicClaim): number {
  return axisRank(left.axis) - axisRank(right.axis)
    || conditionCount(right.appliesWhen) - conditionCount(left.appliesWhen)
    || codePointCompare(left.claimId, right.claimId);
}

const GRID_FIELD: Partial<Record<ClaimAxis, ListingPassage['gridField']>> = {
  grade: 'grade',
  place: 'location',
  type: 'type',
  process: 'type',
};

/** Where "Read more in Wisdom" goes for a claim. */
export function wisdomHrefFor(claim: Pick<PublicClaim, 'axis' | 'pageId' | 'sectionKey'>): string {
  const anchor = `#${encodeURIComponent(claim.sectionKey)}`;
  const page = encodeURIComponent(claim.pageId);
  switch (claim.axis) {
    case 'grade': return `/wisdom/grade/${page}${anchor}`;
    case 'place': return `/wisdom/region/${page}${anchor}`;
    default: return `/wisdom/type/${page}${anchor}`;
  }
}

/** The DOM id a grid row links to, so a reader can jump to the passage it explains. */
export function passageAnchorId(claimId: string): string {
  return `wisdom-passage-${claimId.replace(/[^A-Za-z0-9_-]+/g, '-')}`;
}

/**
 * At most two passages, ranked grade > place > type > process, the second on a
 * different axis from the first. Only approved, listing-eligible claims lead.
 * Sensory claims (what people often notice in the style or grade) come back
 * separately as style references, and never describe the lot.
 *
 * `claims` is the claim set in use: GENERATED_CLAIMS in production, a fixture
 * or an overridden draft set on the pilot preview.
 */
function styleSpecificity(claim: PublicClaim): number {
  const when = claim.appliesWhen;
  if (when.grade) return 4;
  if (when.origin_includes) return 3;
  if (when.type) return 2;
  return when.form ? 1 : 0;
}

export function resolveListingPassages(
  facts: ListingFacts,
  claims: readonly PublicClaim[],
): ListingPassages {
  const live = claims.filter(isPublic);

  const candidates = live
    .filter(claim => claim.listingEligible
      && !NEVER_ON_A_LISTING.has(claim.axis)
      && LISTING_AXIS_ORDER.includes(claim.axis)
      && appliesTo(claim.appliesWhen, facts))
    .sort(compareForListing);

  const chosen: PublicClaim[] = [];
  for (const claim of candidates) {
    if (chosen.length === 2) break;
    if (chosen.some(existing => existing.axis === claim.axis)) continue;
    chosen.push(claim);
  }

  // One style reference only: the most specific that applies (grade > place > type > form).
  const styleReferences = live
    .filter(claim => claim.axis === 'sensory_observation' && appliesTo(claim.appliesWhen, facts))
    .sort((left, right) => (styleSpecificity(right) - styleSpecificity(left)) || codePointCompare(left.claimId, right.claimId))
    .slice(0, 1);

  if (chosen.length === 0 && styleReferences.length === 0) return EMPTY_LISTING_PASSAGES;

  return {
    passages: chosen.map(claim => ({
      claim,
      gridField: GRID_FIELD[claim.axis],
      wisdomHref: wisdomHrefFor(claim),
    })),
    styleReferences,
  };
}
