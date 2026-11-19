/**
 * Teajia family: the contract between the phone and the upload door.
 *
 * Shared by the worker (worker/src/familyRoutes.ts) and the site
 * (src/lib/api.ts `familyApi`, src/lib/familyPhotographSizes.ts), so a limit
 * is stated once and the browser and the server cannot drift apart.
 * Plain TypeScript only: the worker compiles this file without DOM types.
 *
 * Decisions behind the numbers: todo/plans/teajia-family.md, decision 16.
 */

/** Six photographs per tea per person. Removing one from your page frees its place. */
export const FAMILY_PHOTOS_PER_TEA = 6;
/** Photographs one person may add across all teas in a day. */
export const FAMILY_PHOTOS_PER_DAY = 24;
/** Voice notes one member may send in a day. Shop staff keep their own limits. */
export const FAMILY_VOICE_NOTES_PER_DAY = 20;
/** Two minutes of speech. */
export const FAMILY_VOICE_MAX_SECONDS = 120;
/** Two minutes at the highest bitrate a phone records speech (256 kbit/s is 3.84 MB). */
export const FAMILY_VOICE_MAX_BYTES = 4 * 1024 * 1024;

/** The large copy: long edge at most 2000px, stored under one megabyte. */
export const FAMILY_FULL_LONG_EDGE = 2000;
export const FAMILY_FULL_MAX_BYTES = 1_000_000;
/** The small copy every grid asks for. */
export const FAMILY_SMALL_LONG_EDGE = 480;
export const FAMILY_SMALL_MAX_BYTES = 150_000;
/** Anything smaller than this on its long edge is not a photograph of a tea. */
export const FAMILY_MIN_LONG_EDGE = 64;
/** The only type the door accepts. The phone re-encodes every picture to it. */
export const FAMILY_PHOTO_TYPE = 'image/jpeg';

/** Who can see a photograph or a tasting. Keep private is the default. */
export type FamilyShareState = 'private' | 'page' | 'offered';
export const FAMILY_SHARE_STATES: readonly FamilyShareState[] = ['private', 'page', 'offered'];

/** What the shop has done with an offered photograph. */
export type FamilyShopUse = 'none' | 'placed' | 'lead' | 'passed';

/** What a visitor may report and the owner may hide. A page is addressed by its contributor id. */
export type FamilyTargetKind = 'page' | 'photograph' | 'tasting';
export const FAMILY_TARGET_KINDS: readonly FamilyTargetKind[] = ['page', 'photograph', 'tasting'];

/** The tasting page a photograph was taken on, when the phone says. */
export type FamilyPhotoPage = 'impression' | 'texture' | 'effect' | 'taste' | 'storage' | 'notes' | 'other';
export const FAMILY_PHOTO_PAGES: readonly FamilyPhotoPage[] = ['impression', 'texture', 'effect', 'taste', 'storage', 'notes', 'other'];

/** One photograph as its author sees it. */
export interface FamilyPhotograph {
  id: string;
  product_id: string;
  journal_entry_id: string | null;
  page: FamilyPhotoPage | null;
  full_url: string;
  small_url: string;
  full_width: number;
  full_height: number;
  small_width: number;
  small_height: number;
  share_state: FamilyShareState;
  created_at: string;
}

/** Everything the member's own tea shop needs for one tea. */
export interface FamilyMyTea {
  product_id: string;
  photographs: FamilyPhotograph[];
  cover_photograph_id: string | null;
  /** The tasting's share state, or null when the tasting has not been saved to the server yet. */
  tasting_share_state: FamilyShareState | null;
  /** How many more photographs this person may add to this tea. */
  remaining: number;
}

/** The name a photograph is credited to, and the page it links to when there is one. */
export interface FamilyAuthor {
  name: string;
  /** The contributor id of the person's page, or null when they have no page yet. */
  page_id: string | null;
}

/** A shared photograph on a public tea page. Never carries a score. */
export interface FamilySharedPhotograph {
  id: string;
  full_url: string;
  small_url: string;
  full_width: number;
  full_height: number;
  small_width: number;
  small_height: number;
  author: FamilyAuthor;
}

/** What a public tea page shows from the family. */
export interface FamilyTeaPhotographs {
  product_id: string;
  /** The shop's chosen lead picture, credited. Null keeps the tea's own picture. */
  lead: FamilySharedPhotograph | null;
  /** Photographs the shop placed on the tea page. */
  placed: FamilySharedPhotograph[];
  /** "From the family": photographs their authors shared. */
  family: FamilySharedPhotograph[];
}

/** One photograph in the shop's offered pile. */
export interface FamilyOfferedPhotograph extends FamilySharedPhotograph {
  product_id: string;
  product_name: string | null;
  share_state: FamilyShareState;
  shop_use: FamilyShopUse;
  /** True when the author has removed it from their own page. The shop may still use it. */
  removed_by_author: boolean;
  offered_at: string;
}

export interface FamilyRestockRequest {
  id: string;
  product_id: string;
  product_name: string | null;
  requester_name: string;
  requester_email: string | null;
  note: string | null;
  status: 'open' | 'answered' | 'closed';
  created_at: string;
}

export interface FamilyReport {
  id: string;
  target_kind: FamilyTargetKind;
  target_id: string;
  reason: string | null;
  status: 'open' | 'acted' | 'dismissed';
  created_at: string;
  /** What was reported, in words the shop can read: a person's name, or a tea and who made it. */
  label?: string | null;
  /** The small copy of a reported photograph. */
  small_url?: string | null;
  /** Whether the shop has already hidden the thing reported. */
  hidden?: boolean;
}

/** The impression a member chose for a tea. Owner only: it never reaches a page. */
export type FamilyImpression = 'love' | 'like' | 'neutral' | 'pass';

/**
 * One note a member wrote, as the shop reads it. The impression and the score
 * are the member's own and are sent to the shop's screens only.
 */
export interface FamilyFeedbackNote {
  journal_entry_id: string;
  note_key: string;
  product_id: string;
  product_name: string | null;
  author_name: string;
  /** The person's live page, or null when they have none. */
  page_id: string | null;
  text: string;
  written_at: string | null;
  status: 'open' | 'promoted' | 'dismissed';
  impression: FamilyImpression | null;
  /** Out of ten, or null when the member gave none. */
  rating: number | null;
  /** True when the member shared this tasting, which is what a tasting hide needs. */
  shared: boolean;
  tasting_hidden: boolean;
  page_hidden: boolean;
}

/** A moment range for the owner's day sheet: instants, so the worker needs no time zone. */
export interface FamilySheetRange {
  /** The calendar day shown in the file name, YYYY-MM-DD. */
  day: string;
  from: string;
  to: string;
}

/** A refusal from the door: a plain sentence plus a code the screen can branch on. */
export interface FamilyRefusal {
  error: string;
  code: string;
}

// ── The word on a person's page ───────────────────────────────────────────

/** Who a person is on Teajia. Only the owner grants the last two. */
export type FamilyPageTier = 'family' | 'creator' | 'master';
export const FAMILY_PAGE_TIERS: readonly FamilyPageTier[] = ['family', 'creator', 'master'];

/** The word printed on the page for each. The address and the content never change with it. */
export const FAMILY_PAGE_WORDS: Record<FamilyPageTier, string> = {
  family: 'Teajia family',
  creator: 'Tea creator',
  master: 'Tea master',
};

/**
 * Pay shows for tea masters only. A page from before the family (no word
 * stored) keeps its Pay exactly as it was.
 */
export function familyPageAllowsPay(tier: FamilyPageTier | null | undefined): boolean {
  return tier == null || tier === 'master';
}

/** Family pages go live without review. Every other page keeps the draft-and-approve gate. */
export function familyPageNeedsReview(tier: FamilyPageTier | null | undefined): boolean {
  return tier !== 'family';
}

export function familyPageTierOf(value: unknown): FamilyPageTier | null {
  return value === 'family' || value === 'creator' || value === 'master' ? value : null;
}

// ── A person's page: shared tastings ──────────────────────────────────────

/** One dated note from a shared tasting. Words only: never a score, verdict or private note. */
export interface FamilyPersonWord {
  /** ISO date the note was written, or null when none was kept. */
  date: string | null;
  text: string;
}

/** A photograph on a person's page. Grids ask for the small copy. */
export interface FamilyPersonPhotograph {
  id: string;
  small_url: string;
  small_width: number;
  small_height: number;
  full_url: string;
}

/**
 * One tea on a person's page: the words and photographs they chose to share.
 * A tea that has sold out stays, with `sold_out` true and one action: ask
 * Teajia to find more (`familyApi.requestRestock`).
 */
export interface FamilyPersonTasting {
  product_id: string;
  name: string;
  chinese_name: string | null;
  public_path: string;
  sold_out: boolean;
  words: FamilyPersonWord[];
  photographs: FamilyPersonPhotograph[];
}
