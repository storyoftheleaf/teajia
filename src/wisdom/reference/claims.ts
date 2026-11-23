// Tea Wisdom claim contract v2. Spec: docs/_notes/tea-wisdom-claims.md
// One Markdown section is one claim, identified as `pageId:sectionKey`.
// Generated modules: generatedClaims.ts (GENERATED_CLAIMS, approved only) and
// generatedDraftClaims.ts (GENERATED_DRAFT_CLAIMS, every state; preview-only dynamic import).

export type ClaimAxis =
  | 'named_tea_history'
  | 'grade'
  | 'place'
  | 'type'
  | 'process'
  | 'maker_history'
  | 'sensory_observation'
  | 'terminology';

/** Listing ranking order. Axes not listed here never lead a listing. */
export const LISTING_AXIS_ORDER: readonly ClaimAxis[] = ['grade', 'place', 'type', 'process'];

export type ClaimSourceRole =
  | 'standard'
  | 'producer'
  | 'seller_own_batch'
  | 'study'
  | 'specialist_editorial'
  | 'taster';

export interface ClaimTerm {
  original: string; // Han script
  pinyin: string;
  gloss: string;
}

export interface ClaimAttribution {
  sourceId: string;
  sourceRole: ClaimSourceRole;
  sample: string;
}

/**
 * Deliberately snake_case: copied verbatim from claims.json.
 * Keys are ANDed; an empty object never matches.
 */
export interface ClaimAppliesWhen {
  /** Stable id of the named tea associated with the Stock lot. */
  named_tea?: string;
  /** normalizeTeaType output, e.g. 'Shou'. */
  type?: string;
  /** A leaf_grade page id, e.g. 'gong-ting'. */
  grade?: string;
  /** Whole-part equality against ListingFacts.originParts. */
  origin_includes?: readonly string[];
  /** Only valid together with origin_includes: a name may corroborate a recorded place, never supply one. */
  name_includes?: readonly string[];
  /** normalizeTeaForm output. */
  form?: string;
}

export type ClaimRevisionOrigin = 'approved' | 'legacy_import';

export interface ClaimRevision {
  rev: number;
  origin: ClaimRevisionOrigin;
  legacyRef?: string; // e.g. 'marks:gong-ting'
  scope: string;
  text: string;
  approvedAt: string;
  reason: string;
  /** Empty only for legacy_import. */
  evidenceIds: readonly string[];
}

export type ClaimReviewState = 'approved' | 'pending' | 'draft' | 'withdrawn';

/** What the public and preview builds project for one claim. */
export interface PublicClaim {
  claimId: string; // pageId:sectionKey
  pageId: string;
  sectionKey: string;
  label: string;
  axis: ClaimAxis;
  /** 'trade_knowledge' claims are written in our own words and carry no citation. */
  basis: 'sourced' | 'trade_knowledge';
  listingEligible: boolean;
  appliesWhen: ClaimAppliesWhen;
  attribution?: ClaimAttribution;
  terms: readonly ClaimTerm[];
  /** Current approved revision; null only for drafts (preview builds). */
  rev: number | null;
  scope: string;
  text: string;
  /** May be empty for a legacy_import revision. */
  sourceIds: readonly string[];
  /** Public builds emit 'approved' only. */
  reviewState: ClaimReviewState;
  /** Preview builds only. */
  pendingText?: string;
  previousRevisions?: readonly ClaimRevision[];
  withdrawn?: { at: string; reason: string };
}

/** Recorded product facts the listing resolver may use. Built only from product fields, never inferred. */
export interface ListingFacts {
  namedTeaId?: string;
  type?: string;
  grade?: string;
  /** originRegion split on ',' and passed through normalizedWords. */
  originParts: readonly string[];
  /** normalizedWords(name).split(' '). Used only to corroborate a recorded place. */
  nameTokens: readonly string[];
  form?: string;
}

export interface ListingPassage {
  claim: PublicClaim;
  /** The grid row this passage explains, so the row can link to it. */
  gridField?: 'region' | 'location' | 'type' | 'grade' | 'format';
  wisdomHref: string;
}

export interface ListingPassages {
  /** At most two. The second has a different axis from the first. */
  passages: readonly ListingPassage[];
  /** Attributed sensory observations, shown last under "Style reference". */
  styleReferences: readonly PublicClaim[];
}

export interface ArticleClaimUse {
  articleId: string;
  blockIndex: number;
  claimId: string;
  revUsed: number;
  useKind: 'prose' | 'live_block';
}

/** `claim` is looked up in the claims set in use; undefined means it is not public (withdrawn or missing). */
export function articleUseNeedsReview(
  use: ArticleClaimUse,
  claim: Pick<PublicClaim, 'rev' | 'reviewState'> | undefined,
): boolean {
  if (use.useKind === 'live_block') return false;
  if (!claim || claim.reviewState === 'withdrawn' || claim.rev === null) return true;
  return claim.rev > use.revUsed;
}

export type { PublicTeaReferenceSource } from './types';

/** A claim as the preview build sees it (generatedDraftClaims.ts). */
export interface DraftClaim extends PublicClaim {
  pageVisibility?: 'public' | 'draft';
  /** Citations on a draft page whose evidence capture is still pending. */
  unresolvedSourceIds?: readonly string[];
}

export interface DraftReferencePage {
  id: string;
  slug: string;
  kind: 'named_tea' | 'tea_family' | 'tea_type' | 'major_region' | 'tea_area' | 'leaf_grade' | 'reference_topic';
  label: string;
  visibility: 'public' | 'draft';
  nativeName?: string;
  parentId?: string;
  sourceIds: readonly string[];
  sections: readonly { key: string; label: string; sourceIds: readonly string[]; unresolvedSourceIds?: readonly string[] }[];
}
