// Which approved Wisdom claims a shop listing may show, and in what order.
// Contract: docs/_notes/tea-wisdom-claims.md, "What a listing may match on".
import type { PublicTeaReferencePage } from './types';
import { wisdomPageHref } from '../../pages/wisdom/articleClaimUses';
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
 * supply one; `name_any` likewise, matching when any one value is in the name. An empty list counts as a malformed condition and never matches.
 */
export function appliesTo(when: ClaimAppliesWhen, facts: ListingFacts): boolean {
  const keys = (Object.keys(when) as (keyof ClaimAppliesWhen)[]).filter(key => when[key] !== undefined);
  if (keys.length === 0) return false;
  if (when.name_includes !== undefined && when.origin_includes === undefined) return false;
  if (when.name_any !== undefined && when.origin_includes === undefined) return false;

  if (when.named_tea !== undefined && when.named_tea !== facts.namedTeaId) return false;
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
  if (when.name_any !== undefined) {
    if (!hasValues(when.name_any)) return false;
    if (!when.name_any.some(value => facts.nameTokens.includes(value))) return false;
  }
  return true;
}

/** Scalar keys count once; each listed origin or name value counts once. */
export function conditionCount(when: ClaimAppliesWhen): number {
  return (when.named_tea !== undefined ? 1 : 0)
    + (when.type !== undefined ? 1 : 0)
    + (when.grade !== undefined ? 1 : 0)
    + (when.form !== undefined ? 1 : 0)
    + (when.origin_includes?.length ?? 0)
    + (when.name_includes?.length ?? 0)
    + (when.name_any !== undefined ? 1 : 0);
}

function isPublic(claim: PublicClaim): boolean {
  return claim.reviewState === 'approved' && claim.rev !== null && !claim.withdrawn;
}

function axisRank(axis: ClaimAxis): number {
  const rank = LISTING_AXIS_ORDER.indexOf(axis);
  return rank === -1 ? Number.POSITIVE_INFINITY : rank;
}

function identifiesGradeOrPlace(when: ClaimAppliesWhen): number {
  return Number(Boolean(when.grade || when.origin_includes?.length));
}

function compareForListing(left: PublicClaim, right: PublicClaim): number {
  return identifiesGradeOrPlace(right.appliesWhen) - identifiesGradeOrPlace(left.appliesWhen)
    || conditionCount(right.appliesWhen) - conditionCount(left.appliesWhen)
    || axisRank(left.axis) - axisRank(right.axis)
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
    case 'named_tea_history': return `/wisdom/named/${page}${anchor}`;
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
 * After the named tea’s history, at most two general passages, most specific first; grade > place > type > process
 * settles equal specificity. The second is on a
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
  publicPages?: readonly PublicTeaReferencePage[],
): ListingPassages {
  // Public links follow the kind of the page that owns the section. A process
  // can be explained on a family page and a taste reference on a region page.
  const publicLinks = publicPages && new Map(publicPages.flatMap(page => {
    const href = wisdomPageHref(page.id, page.kind);
    return href ? page.sections.map(section =>
      [page.id + ':' + section.key, href + '#' + encodeURIComponent(section.key)] as const) : [];
  }));
  const live = claims.filter(claim =>
    isPublic(claim) && (!publicLinks || (publicLinks.has(claim.claimId)
      && (claim.axis !== 'sensory_observation' || claim.sourceIds.length > 0))));


  // Use the reference entry's published section order. Its history is a single
  // narrative, independent of the two general facts selected below.
  const namedPage = facts.namedTeaId && publicPages?.find(page =>
    page.kind === 'named_tea' && page.id === facts.namedTeaId);
  const namedClaims = namedPage ? namedPage.sections.flatMap(section => {
    const claim = live.find(candidate => candidate.axis === 'named_tea_history'
      && candidate.pageId === namedPage.id && candidate.sectionKey === section.key
      && candidate.claimId === namedPage.id + ':' + section.key
      && candidate.appliesWhen.named_tea === namedPage.id && appliesTo(candidate.appliesWhen, facts)
      && candidate.listingEligible && candidate.sourceIds.length > 0);
    return claim ? [claim] : [];
  }) : [];

  const candidates = live
    .filter(claim => claim.listingEligible && claim.axis !== 'named_tea_history'
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

  const passages = [...namedClaims, ...chosen];
  if (passages.length === 0 && styleReferences.length === 0) return EMPTY_LISTING_PASSAGES;

  return {
    passages: passages.map(claim => ({
      claim,
      gridField: GRID_FIELD[claim.axis],
      wisdomHref: publicLinks?.get(claim.claimId) ?? wisdomHrefFor(claim),
    })),
    styleReferences,
  };
}
