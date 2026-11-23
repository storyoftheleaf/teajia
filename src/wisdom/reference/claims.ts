// Tea Wisdom claim contract. Spec: docs/_notes/tea-wisdom-claims.md
// One Markdown section is one claim, identified as `pageId:sectionKey`.

export type ClaimAxis =
  | 'grade'
  | 'place'
  | 'type'
  | 'process'
  | 'maker_history'
  | 'sensory_observation'
  | 'terminology';

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

export interface ClaimAppliesWhen {
  type?: string;
  grade?: string;
  origin_includes?: readonly string[];
  /** Only valid together with origin_includes: a name may corroborate a recorded place, never supply one. */
  name_includes?: readonly string[];
  form?: string;
}

export interface ClaimRevision {
  rev: number;
  text: string;
  approvedAt: string;
  reason: string;
  evidenceIds: readonly string[];
}

/** What the public and preview builds project for one claim. */
export interface PublicClaim {
  claimId: string; // pageId:sectionKey
  pageId: string;
  sectionKey: string;
  label: string;
  axis: ClaimAxis;
  scope: string;
  listingEligible: boolean;
  appliesWhen: ClaimAppliesWhen;
  attribution?: ClaimAttribution;
  terms: readonly ClaimTerm[];
  rev: number;
  text: string;
  sourceIds: readonly string[];
  /** Preview builds only. Public builds emit 'approved' claims and nothing else. */
  reviewState: 'approved' | 'pending' | 'draft' | 'withdrawn';
  pendingText?: string;
  previousRevisions?: readonly ClaimRevision[];
}

/** Recorded product facts the listing resolver may use. Built only from product fields, never inferred. */
export interface ListingFacts {
  type?: string;
  grade?: string;
  originParts: readonly string[];
  /** Used only to corroborate a recorded place. */
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

export function articleUseNeedsReview(use: ArticleClaimUse, claim: Pick<PublicClaim, 'rev' | 'reviewState'> | undefined): boolean {
  if (use.useKind === 'live_block') return false;
  if (!claim || claim.reviewState === 'withdrawn') return true;
  return claim.rev > use.revUsed;
}
