import type { Account, AccountApplication, AccountKind, AccountMember, AccountMembership, AccountRole, AdminContributor, Bundle, ContributorOption, ContributorWrite, CurateReceiptProposal, CustomerOrderDetail, DbArticle, PlatformRole, TastingData } from '../types';
import type {
  FavoriteWrite,
  PaymentMethod,
  PaymentMethodWrite,
  ProfileFavorite,
  PublicFavoritesResponse,
  PublicPaymentMethodsResponse,
  SelfProfileResponse,
  SelfProfileUpdate,
} from '../components/profile/types';
import type { CompassDecision, CurateJourney, CurateVisit } from '../components/TeaCompass/types';
import type { WisdomEntryKind } from '../wisdom/types';

export interface WisdomVerificationReceipt {
  entry_kind: WisdomEntryKind;
  entry_id: string;
  content_hash: string;
  verified_at: string;
}

import type {
  CreateTeaReferenceIssueInput,
  CreateTeaReferenceIssueResponse,
  ListTeaReferenceIssuesResponse,
  ResolveTeaReferenceIssuesResponse,
} from '../wisdom/reference/issues';

export type PublicWisdomNodeType = 'cultivar' | 'region' | 'tea_type' | 'producer' | 'mark' | 'style' | 'named_tea';
export interface PublicWisdomNodeState {
  node_type: PublicWisdomNodeType;
  node_id: string;
  public_state: 'hidden' | 'public' | 'inherit';
  is_public: boolean;
}

type CompassWrite = Record<string, unknown> & { decision?: CompassDecision | null };
export interface CompassSyncResult {
  synced: number;
  syncedIds: string[];
  conflicts: string[];
}

export type SalesOwnerShareType = 'percent' | 'fixed';
export interface SalesGrant {
  id: string;
  account_id: string;
  product_id: string;
  seller_user_id: string;
  seller_name?: string;
  granted_by_user_id: string;
  granted_by_name?: string;
  price_floor: number | null;
  owner_share_type: SalesOwnerShareType;
  owner_share_value: number;
  quantity_limit: number | null;
  starts_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface SalesGrantWrite {
  product_id: string;
  seller_user_id: string;
  price_floor?: number | null;
  owner_share_type?: SalesOwnerShareType;
  owner_share_value?: number;
  quantity_limit?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
}
export interface EligibleSalesProduct {
  product_id: string;
  product_name: string;
  owner_id: string | null;
  owner_name: string | null;
  physical_quantity: number;
  held_quantity: number;
  available_quantity: number;
  price_floor: number | null;
  grant_id: string | null;
  permission_reason: 'account_owner' | 'location_stock' | 'own_stock' | 'active_grant';
}
export interface SalesSettlement {
  id: string;
  account_id: string;
  invoice_id: string;
  invoice_number?: string | null;
  line_item_id: string;
  product_id: string | null;
  product_name?: string | null;
  stock_owner_user_id: string | null;
  stock_owner_name?: string | null;
  seller_user_id: string;
  seller_name?: string;
  grant_id: string | null;
  gross_amount: number;
  owner_amount: number;
  seller_amount: number;
  status: 'owed' | 'paid' | 'reversed';
  reversed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceAttribution {
  invoice_id: string;
  seller_name: string | null;
  payment_recipient_name: string | null;
  payment_recipient_kind: 'person' | 'account' | 'mixed' | 'none' | 'unrecorded';
  fulfilled_by_name: string | null;
  fulfilled_at: string | null;
  settlement_visibility: 'full' | 'participant' | 'restricted';
  items: Array<{
    line_item_id: string;
    product_id: string | null;
    stock_owner_name: string | null;
    settlement_status: 'owed' | 'paid' | 'reversed' | null;
  }>;
}

export type CurateImportSourceKind = 'wechat' | 'invoice' | 'vendor_list' | 'photo' | 'file' | 'paste';
export type CurateImportDisposition = 'received' | 'in_transit' | 'library_only';
export type CurateImportInventoryPurpose = 'working' | 'sample' | 'personal';
export type CurateImportProvenanceState = 'source_fact' | 'canonical_match' | 'ai_interpretation' | 'user_edit' | 'not_present' | 'uncertain';
export type CurateImportValidationState = 'source_fact' | 'ai_interpretation' | 'canonical_match' | 'validated' | 'not_present' | 'uncertain';
export type CurateImportCanonicalField =
  | 'originalName' | 'englishName' | 'chineseName' | 'category' | 'type' | 'classification' | 'cultivar' | 'producer' | 'form' | 'year'
  | 'originCountry' | 'originRegion' | 'description' | 'processingNotes' | 'tasting' | 'tastingSource' | 'packWeight' | 'weightUnit' | 'packCount' | 'priceAmountExact'
  | 'currency' | 'priceBasis' | 'lineCostExact' | 'unitCostExact' | 'totalQuantityGrams' | 'totalUnits'
  | 'disposition' | 'inventoryPurpose' | 'vendorResolution' | 'identityResolution' | 'holdingResolution';
export type CurateImportVendorResolution =
  | { kind: 'existing'; vendorId: string; vendorName: string | null }
  | { kind: 'new'; vendorName: string }
  | { kind: 'unresolved'; vendorName: string | null }
  | null;
export type CurateImportIdentityResolution = { kind: 'existing'; compassEntryId: string } | { kind: 'new' } | { kind: 'unresolved' };
export type CurateImportHoldingResolution = { kind: 'existing'; productId: string } | { kind: 'new' } | { kind: 'unresolved' } | null;
export interface CurateImportCanonicalRecord {
  sourceId?: string | null; sourceItemId?: string | null; evidenceRefs?: string[]; sourceExcerpt?: string | null; sourceLanguage?: string | null;
  englishName?: string | null; originalName?: string | null; chineseName?: string | null; category?: 'tea' | 'teaware';
  type?: string | null; classification?: string | null; cultivar?: string | null; producer?: string | null; form?: string | null; year?: number | null;
  originCountry?: string | null; originRegion?: string | null; description?: string | null; processingNotes?: string | null;
  tasting?: TastingData | null; tastingSource?: 'source' | 'common' | null;
  packWeight?: number | null; weightUnit?: 'g' | 'kg' | 'count' | null; packCount?: number | null;
  priceAmount?: number | string | null; priceAmountExact?: string | null; currency?: string | null;
  priceBasis?: 'per_pack' | 'line_total' | 'unknown'; lineCost?: number | null; lineCostExact?: string | null;
  unitCost?: number | null; unitCostExact?: string | null; totalQuantityGrams?: number | null; totalUnits?: number | null;
  disposition?: CurateImportDisposition | null; inventoryPurpose?: CurateImportInventoryPurpose | null;
  vendorResolution?: CurateImportVendorResolution; identityResolution?: CurateImportIdentityResolution; holdingResolution?: CurateImportHoldingResolution;
  provenance?: Partial<Record<CurateImportCanonicalField, CurateImportProvenanceState>>;
  fieldProvenance?: Partial<Record<CurateImportCanonicalField, CurateImportProvenanceState>>;
  validation?: Partial<Record<CurateImportCanonicalField | 'translation' | 'nameTranslation' | 'price' | 'priceAmount' | 'quantity' | 'acquisitionState' | 'acquired', CurateImportValidationState>>;
  confidence?: Partial<Record<CurateImportCanonicalField | 'translation' | 'materialIdentity', number | 'not_present' | 'uncertain'>> | number | null;
  uncertainty?: Partial<Record<CurateImportCanonicalField | 'translation' | 'materialIdentity', string>>;
  blockingFields?: string[];
  duplicateResolution?: 'new' | 'matched' | 'unresolved' | null;
  proposedCompassEntryId?: string | null; proposedProductId?: string | null;
  acquired?: boolean | null;
}
export interface CurateImportAnnotation {
  kind: 'supplier' | 'shipping_or_fee' | 'heading' | 'note' | 'subtotal' | 'total' | 'ignored_duplicate';
  sourceId?: string | null; sourceExcerpt?: string | null; label?: string | null; amountExact?: string | null; currency?: string | null;
}
export type LookupStatus = 'loading' | 'ready' | 'empty' | 'error';
export interface LookupState<T> { status: LookupStatus; options: T[]; error: string | null }
export interface CurateImportSource {
  id: string; batch_id: string; kind: CurateImportSourceKind;
  pasted_text: string | null; r2_object_key: string | null; metadata: Record<string, unknown>;
  analysis_status?: 'pending' | 'analyzed' | 'reference_only' | 'failed';
  analysis_error?: string | null;
  reference_metadata?: { references?: string[] };
}
export interface CurateImportItem {
  id: string; batch_id: string; source_id: string | null; position: number; category: 'tea' | 'teaware';
  name: string | null; raw_text: string | null; parsed_data: CurateImportCanonicalRecord & Record<string, unknown>;
  confidence: number | null; uncertainty: Record<string, unknown>;
  review_state: 'pending' | 'reviewing' | 'accepted' | 'merged' | 'abandoned';
  compass_entry_id: string | null; reserved_compass_entry_id: string;
  vendor_group_id?: string | null;
  original_name?: string | null; english_name?: string | null; chinese_name?: string | null;
  pack_weight?: number | null; weight_unit?: 'g' | 'kg' | 'count' | null; pack_count?: number | null;
  price_amount?: number | null; currency?: string | null; price_basis?: 'per_pack' | 'line_total' | 'unknown';
  price_amount_exact?: string | null;
  total_quantity_grams?: number | null; total_units?: number | null; line_cost?: number | null; unit_cost?: number | null;
  line_cost_exact?: string | null; unit_cost_exact?: string | null;
  blocking_fields?: string[]; manually_corrected_fields?: string[];
  proposed_compass_entry_id?: string | null; proposed_product_id?: string | null;
  acquired?: boolean | null; duplicate_resolution?: 'new' | 'matched' | 'unresolved' | null;
  disposition?: CurateImportDisposition | null;
}
export type CurateImportReviewedField = 'vendor' | 'identity' | 'englishName' | 'packWeight' | 'weightUnit' | 'packCount' | 'priceBasis' | 'priceAmount' | 'currency' | 'disposition' | 'inventoryPurpose' | 'acquired';
export type CurateImportItemUpdate = Partial<CurateImportItem> & { reviewed_fields?: CurateImportReviewedField[] };
export interface CurateImportBatch {
  id: string; title: string; review_state: 'pending' | 'reviewing' | 'completed' | 'abandoned';
  journey_id: string | null; visit_id: string | null;
  analysis_state?: 'pending' | 'analyzing' | 'complete' | 'completed' | 'failed' | null;
  analysis_overview?: string | null; analysis_language?: string | null; analysis_version?: string | null;
  analysis_model?: string | null; analysis_error?: string | null; completed_at?: string | null;
  analysis_annotations?: CurateImportAnnotation[];
  analysis_annotations_json?: string | null;
}
export interface CurateImportVendorGroup {
  id: string; batch_id: string; position: number; proposed_vendor_name: string | null;
  resolved_vendor_customer_id: string | null; resolved_vendor_name?: string | null;
  confidence?: number | null; vendor_confidence?: number | null; uncertainty: Record<string, unknown>;
}
export interface CurateImportFinalizeResult {
  batch?: CurateImportBatch;
  batchId?: string; idempotencyKey?: string;
  journey: { id: string; name: string } | null;
  receipts: Array<{ id: string; groupId: string; vendorId: string; vendorName: string; [key: string]: unknown }>;
  items: Array<{ id: string; compassEntryId: string; productId: string | null; movementId: string | null; identityDisposition: 'created' | 'reused'; holdingDisposition: 'created' | 'reused' | null }>;
}
export interface CurateImportDetail { batch: CurateImportBatch; sources: CurateImportSource[]; items: CurateImportItem[]; groups: CurateImportVendorGroup[] }

export interface AdminEventPostSession extends Record<string, unknown> {
  id: string | null;
  event_id: string;
  tea_ledger: unknown | null;
  playlist_url: string | null;
  gallery_images: string[];
  session_notes: string | null;
  host_notes: string | null;
  host_changes: string | null;
  energy: string | null;
  shared_tasting_notes: string[];
}

export type InquiryStatus = 'new' | 'seen' | 'replied' | 'closed';

export interface InquiryItem {
  id?: string;
  name: string;
  category?: string;
  storeSlug?: string;
  quantityGrams?: number;
  qty?: number;
  pricePerGram?: number;
  totalPrice?: number;
}

// Who this order is paid to, and the link that takes the customer to their
// transfer details. Resolved worker-side so every surface renders the same
// link. `pay_url` is null whenever `has_methods` is false: that tea master has
// published no transfer details, and no button should be rendered.
export interface InvoicePayment {
  recipient_slug: string | null;
  recipient_name: string | null;
  pay_url: string | null;
  has_methods: boolean;
  /** Line items plus shipping, in USD. There is no total column on invoices. */
  total_usd: number;
  /** Sum of CONFIRMED payments only. A customer's report is never counted here. */
  paid_usd: number;
  /**
   * Total minus paid, never below zero, and what `pay_url` now asks for. After
   * a confirmed part payment the link asks for the balance, not the total.
   * `pay_url` is null once this reaches zero.
   */
  outstanding_usd: number;
  /** Reports the customer has sent that are still waiting to be confirmed. */
  claims_pending: number;
}

/**
 * Where an order actually stands, in the words the customer reads.
 *
 * DERIVED worker-side from what is true (whether the request became an order,
 * that order's status, what the ledger says is outstanding, and whether it has
 * been sent), not read off a status word somebody has to remember to change.
 * The old tracking page read the operator's own filing column and so could say
 * "inquiry received" about a parcel already in the post.
 *
 * `label` and `detail` are written once, in the worker. No surface writes its
 * own words for a stage, and none falls back to a status word when `journey` is
 * missing: it renders no stage at all instead.
 */
export interface OrderJourney {
  stage: 'received' | 'confirmed' | 'awaiting_payment' | 'part_paid'
       | 'paid' | 'sent' | 'closed';
  /** What the customer reads. */
  label: string;
  /** One supporting line, or null. */
  detail: string | null;
  /** When this stage began, ISO. */
  at: string | null;
}

/**
 * One thing waiting on the tea master, from `GET /api/attention`.
 *
 * Four kinds in one list ordered by how long each has waited, so the surface
 * answers "who has waited longest" rather than "what exists". `href` is always
 * an app path, navigated with the router, never an absolute URL.
 */
export interface AttentionItem {
  kind: 'request' | 'unpriced' | 'claim' | 'unsent';
  id: string;
  /** Plain and human, and it names the person or the order. */
  label: string;
  /** How long it has waited. Lowercase, written to follow a comma. */
  meta: string | null;
  /** The sort key, ISO. A request waits from when it arrived, a claim from when
   *  it was reported, an unsent order from when it was fully paid. */
  waiting_since: string;
  href: string;
  /** What a person says back: the request reference or the order number. */
  reference?: string | null;
}

export interface AttentionResponse {
  items: AttentionItem[];
  counts: { requests: number; unpriced: number; claims: number; unsent: number };
}

/**
 * One row of `invoice_payments`, the record of a single payment against an order.
 *
 * Two kinds of row land here and the difference is the point of the feature.
 * `claimed_by: 'customer'` with `status: 'claimed'` is a REPORT: the customer
 * said they sent a transfer, and nothing about what the order is owed has
 * changed. `claimed_by: 'operator'` with `status: 'confirmed'` is money that
 * was seen to arrive. Only confirmed rows count toward `paid_usd`.
 */
export type InvoicePaymentStatus = 'claimed' | 'confirmed' | 'rejected';
export type InvoicePaymentSource = 'customer' | 'operator';

export interface InvoicePaymentRecord {
  id: string;
  invoice_id: string;
  account_id: string;
  amount_usd: number;
  amount_original?: number | null;
  currency?: string | null;
  payment_method_id?: string | null;
  method_label?: string | null;
  reference?: string | null;
  note?: string | null;
  status: InvoicePaymentStatus;
  claimed_by: InvoicePaymentSource;
  claimed_at: string;
  confirmed_by_user_id?: string | null;
  confirmed_at?: string | null;
  created_at: string;
}

/** What every ledger write hands back: the recomputed state of the invoice. */
export interface InvoicePaymentOutcome {
  payment_status: 'unpaid' | 'partial' | 'paid';
  total_usd: number;
  paid_usd: number;
  outstanding_usd: number;
  claims_pending: number;
}

/** Body of POST /api/invoices/:id/payments, an operator recording money by hand. */
export interface RecordPaymentInput {
  amount_usd: number;
  method_label?: string;
  reference?: string;
  note?: string;
}

/**
 * Body of the two payment-claim endpoints. Every field is optional: an omitted
 * amount defaults to the whole outstanding balance. An amount above the balance
 * by more than a cent is refused.
 */
export interface PaymentClaimInput {
  amount?: number;
  currency?: string;
  method?: string;
  reference?: string;
  note?: string;
}

export interface PaymentClaimResult {
  claim_id: string;
  claims_pending: number;
}

export interface InquiryRecord {
  id: string;
  account_id: string;
  name: string;
  email: string;
  phone: string | null;
  items: InquiryItem[];
  total_usd: number;
  currency: string;
  message: string | null;
  source: string;
  ref_number: string | null;
  status: InquiryStatus;
  created_at: string;
  updated_at?: string | null;
  // Set once the request has been turned into a Draft invoice.
  converted_invoice_id?: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_id: string;
  actor_email: string;
  target_type: string;
  target_id: string;
  details: string; // JSON string
  created_at: string;
  // account_id = the account the action targets (or NULL for platform-wide).
  // actor_account_id = the account context the actor was operating in when
  // the action fired. When these differ, the actor was acting cross-account.
  account_id?: string | null;
  actor_account_id?: string | null;
}

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  platform_role: PlatformRole;
  created_at: string;
  shelf_enabled?: boolean;   // stock spine step 5, public shelf granted
  shelf_slug?: string | null;
  memberships: { account_id: string; role: string }[];
}

export interface PlatformAccount {
  id: string;
  slug: string;
  name: string;
  location_city?: string;
  location_country?: string;
  is_platform_owner: boolean;
  public_enabled: boolean;
  status: 'active' | 'suspended';
  trust_tier: 'basic' | 'verified' | 'partner';
  member_count: number;
  features: Record<string, boolean>;
  kind?: 'platform' | 'location' | 'master';
  account_kind?: 'platform' | 'location' | 'master';
}

// Stock spine step 3: one row of the all-locations master view (the movement).
export interface PlatformStockRow {
  id: string;
  type: string;
  given_name: string | null;
  product_name: string | null;
  chinese_name: string | null;
  year: number | null;
  origin_country: string | null;
  origin_region: string | null;
  stock_grams: number | null;
  quantity_units: number | null;
  status: string;
  is_public: number;
  shown_in_shop: number;
  image_url: string | null;
  fixed_retail_price_usd: number | null;
  created_at: string;
  account_id: string;
  account_name: string;
  account_slug: string;
  location_city: string | null;
  location_country: string | null;
  is_platform_owner: number;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
}

// Stock spine step 4: one item in a user's personal cellar.
export interface CellarItem {
  id: string;
  name: string;
  type?: string | null;
  year?: number | null;
  origin?: string | null;
  notes?: string | null;
  grams: number;
  imageUrl?: string | null;
  placementStatus: 'private' | 'requested' | 'placed';
  placementAccountId?: string | null;
  linkedProductId?: string | null;
  shelfPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CellarPlacementRequest extends CellarItem {
  ownerName?: string | null;
  ownerEmail?: string | null;
}

// Stock spine step 5: the seller's own shelf settings (grant state + identity).
export interface ShelfSettings {
  enabled: boolean;
  slug: string | null;
  title: string | null;
  whatsapp: string | null;
}

// One item on a public shelf, public-safe fields only.
export interface PublicShelfItem {
  id: string;
  name: string;
  type: string | null;
  year: number | null;
  origin: string | null;
  grams: number;
  image_url: string | null;
}

export interface PublicShelf {
  slug: string;
  title: string | null;
  seller_name: string | null;
  whatsapp: string | null;
  contributor_slug?: string | null;
  items: PublicShelfItem[];
}

export interface PurchaseOrder {
  id: string;
  account_id: string;
  vendor_name: string;
  vendor_id?: string | null;
  vendor_contact?: string | null;
  items_json: string; // JSON string of line items
  total_usd: number;
  display_currency: string;
  status: string;
  notes?: string | null;
  message_text?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  product_id: string;
  product_name: string;
  quantity_grams: number;
  unit_price_usd?: number;
}

import { useAppStore } from './store';
import { classifyIncident } from './incidents';

// Production talks to the API on the app's OWN origin (teajia.com /
// www.teajia.com), NOT a dedicated api.* host. The custom domain api.teajia.com
//, like *.workers.dev, is blocked/reset by the Great Firewall, so anything
// pointed at it silently fails in mainland China (sign-in, photo upload,
// transcription, compass sync) even though the site itself loads fine. The
// `teajia.com/api/*` path is served by a Cloudflare Pages Function
// (functions/api/[[path]].ts) that forwards to the Worker edge-side, so calls
// ride the one hostname that stays reachable in China. Using the live origin
// (rather than a bare '') keeps API_URL truthy so the "Continue with Google"
// surfaces still render. Dev honors VITE_API_URL to target a local/workers.dev API.
export function getApiOrigin(): string {
  if (import.meta.env.PROD) {
    return typeof window !== 'undefined' ? window.location.origin : 'https://www.teajia.com';
  }
  return (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
}

export const API_URL = getApiOrigin();
const REQUEST_TIMEOUT_MS = 30_000;

// Public base URL for share links (collection links sent to recipients). These
// must point at the deployed customer site, NOT wherever the admin happens to be
// browsing, a `localhost` link is useless (and breaks over https in dev). In
// production window.location.origin is already correct; in local dev we fall
// back to the live site so a copied link actually works when sent.
const PUBLIC_SITE_URL: string = (() => {
  const configured = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, '');
  if (configured) return configured;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (/localhost|127\.0\.0\.1/.test(origin)) return 'https://teajia.com';
  return origin;
})();

/** Build a public collection share link from a publication slug. */
export function collectionShareUrl(slug: string): string {
  return `${PUBLIC_SITE_URL}/c/${slug}`;
}

// Once the token has less than this many seconds left, nudge a background
// refresh on the next authenticated call. Matches the server-side threshold
// (14 days) so slide refreshes land while there's still plenty of headroom.
const PROACTIVE_REFRESH_THRESHOLD_SECONDS = 60 * 60 * 24 * 14;

function getToken(): string | null {
  return localStorage.getItem('teajia_token') || sessionStorage.getItem('teajia_token');
}

export const AUTH_TOKEN_CHANGED_EVENT = 'teajia:auth-token-changed';

function announceTokenChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
}

export function setToken(token: string) {
  // Persist to localStorage so sessions survive browser restarts and deploys.
  // iOS Safari private mode / strict ITP can throw on localStorage.setItem, so
  // fall back to sessionStorage so the session at least survives the tab.
  try {
    localStorage.setItem('teajia_token', token);
    sessionStorage.removeItem('teajia_token');
  } catch {
    try {
      sessionStorage.setItem('teajia_token', token);
    } catch { /* storage fully blocked, session cannot be persisted */ }
  }
  _invalidateClaimsCache();
  announceTokenChange();
}

export function clearToken() {
  try { localStorage.removeItem('teajia_token'); } catch { /* ignore */ }
  try { sessionStorage.removeItem('teajia_token'); } catch { /* ignore */ }
  _invalidateClaimsCache();
  announceTokenChange();
}

export type PendingSignup = {
  email: string;
  signupToken: string;
  expiresAt: number;
  recoverableUntil: number;
};

const PENDING_SIGNUP_STORAGE_KEY = 'teajia_pending_signup';
const PENDING_SIGNUP_TTL_MS = 10 * 60 * 1000;
const PENDING_SIGNUP_RECOVERY_MS = 24 * 60 * 60 * 1000;

function persistPendingSignup(pending: PendingSignup): PendingSignup {
  try { sessionStorage.setItem(PENDING_SIGNUP_STORAGE_KEY, JSON.stringify(pending)); } catch { /* recovery remains in-memory */ }
  return pending;
}

export function clearPendingSignup() {
  try { sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY); } catch { /* ignore blocked storage */ }
}

export function restorePendingSignup(): PendingSignup | null {
  let raw: string | null = null;
  try { raw = sessionStorage.getItem(PENDING_SIGNUP_STORAGE_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingSignup>;
    if (typeof parsed.email !== 'string' || typeof parsed.signupToken !== 'string'
      || typeof parsed.expiresAt !== 'number' || typeof parsed.recoverableUntil !== 'number') {
      clearPendingSignup();
      return null;
    }
    const pending = parsed as PendingSignup;
    if (pending.recoverableUntil <= Date.now()) {
      clearPendingSignup();
      return null;
    }
    return pending;
  } catch {
    clearPendingSignup();
    return null;
  }
}

export function hasToken(): boolean {
  return !!getToken();
}

// ── Decoded-claims cache ──────────────────────────────────────────────────
// Decoding the JWT payload on every request (authHeaders is called for every
// authenticated fetch) is wasteful. We cache the decoded object in module
// scope and invalidate it whenever the token changes (setToken / clearToken /
// after a successful refresh). The cache is keyed implicitly, any token
// change calls _invalidateClaimsCache() so the next getDecodedClaims() call
// re-decodes from the new token.
let _cachedClaims: Record<string, unknown> | null = null;

function _invalidateClaimsCache() {
  _cachedClaims = null;
}

/** Return decoded JWT claims from the module-level cache (or decode on first call). */
function getDecodedClaims(): Record<string, unknown> | null {
  if (_cachedClaims !== null) return _cachedClaims;
  const token = getToken();
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    _cachedClaims = decoded;
    return decoded;
  } catch {
    return null;
  }
}

export const isConfigured = !!API_URL;

/** Check whether the stored JWT is expired (with 60s buffer). */
export function isTokenExpired(): boolean {
  const claims = getTokenClaims();
  if (!claims?.exp) return false; // No expiry claim, let server decide
  return Date.now() >= claims.exp * 1000 - 60_000;
}

/** True when the stored token is valid but within 14 days of expiry. */
export function shouldProactivelyRefreshToken(): boolean {
  const claims = getTokenClaims();
  if (!claims?.exp) return false;
  const secondsLeft = claims.exp - Math.floor(Date.now() / 1000);
  return secondsLeft > 0 && secondsLeft < PROACTIVE_REFRESH_THRESHOLD_SECONDS;
}

function authHeaders(): Record<string, string> {
  // NOTE: we intentionally do NOT clear the token preemptively here. Clearing
  // before we've actually tried the server means a brief clock skew or a
  // near-expiry call immediately logs the user out. Instead the request is
  // sent; if the server says 401 we attempt a refresh (authedFetch). If
  // the refresh also fails, only then do we clear. Background refreshes are
  // scheduled by `maybeScheduleBackgroundRefresh` when we're inside the
  // threshold.
  maybeScheduleBackgroundRefresh();
  const currentToken = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
    // Inject active account header from the JWT's active_account_id claim.
    // Reading directly from the decoded JWT avoids a Zustand hydration race:
    // if the store hasn't initialised yet the header would silently be absent,
    // causing every early API call to hit the wrong account context.
    const claims = getDecodedClaims();
    const activeAccountId = typeof claims?.active_account_id === 'string' ? claims.active_account_id : null;
    if (activeAccountId) {
      headers['X-Teajia-Account'] = activeAccountId;
    } else {
      // JWT doesn't carry active_account_id (e.g. very old token shape), so
      // fall back to Zustand state. Log so we know it happened.
      try {
        const storeAccountId = useAppStore.getState().activeAccountId;
        if (storeAccountId) {
          console.warn('[api] X-Teajia-Account: JWT claim absent, falling back to Zustand state');
          headers['X-Teajia-Account'] = storeAccountId;
        }
      } catch { /* store not ready, header omitted */ }
    }
  }
  return headers;
}

const PRODUCT_CATALOG_UPDATE_FIELDS = new Set([
  'product_name', 'given_name', 'chinese_name', 'type', 'form', 'origin', 'origin_country',
  'origin_region', 'year', 'harvest', 'altitude', 'cultivar', 'processing', 'format',
  'material', 'capacity_ml', 'teaware_category', 'description', 'notes', 'tags', 'moods',
  'tasting_notes', 'brewing_notes', 'tasting', 'tasting_source', 'lore', 'processing_notes',
  'terroir', 'mood', 'experience', 'image_url', 'additional_images', 'bag_photo_url', 'quantity_units',
  'tea_key', 'source_compass_entry_id',
]);

const PRODUCT_STOCK_UPDATE_FIELDS = new Set([
  'stock', 'stock_unit', 'stock_grams', 'low_stock_threshold', 'recheck_stock',
  'stock_verified_at', 'in_transit', 'in_transit_grams', 'in_transit_eta',
  'session_reserve_grams', 'inventory_purpose', 'stock_known_at',
]);

const PRODUCT_COMMERCIAL_UPDATE_FIELDS = new Set([
  'price', 'cost', 'cost_amount', 'cost_currency', 'shipping_rate_per_kg',
  'quantity_purchased', 'markup_multiplier', 'fixed_retail_price_usd',
  'price_per_gram_usd', 'wholesale_price', 'vendor', 'vendor_id', 'vendor_url',
  'can_reorder',
]);

const PRODUCT_PUBLICATION_UPDATE_FIELDS = new Set([
  'status', 'is_public', 'catalog_visible', 'is_featured', 'is_curated',
  'show_wisdom', 'is_custom_wisdom', 'is_personal', 'is_sample', 'sold_out_at',
]);

function splitProductUpdateByDomain(data: Record<string, any>): {
  catalog: Record<string, any>;
  stock: Record<string, any>;
  commercial: Record<string, any>;
  publication: Record<string, any>;
} {
  const groups = {
    catalog: {} as Record<string, any>,
    stock: {} as Record<string, any>,
    commercial: {} as Record<string, any>,
    publication: {} as Record<string, any>,
  };

  const unknown: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (PRODUCT_CATALOG_UPDATE_FIELDS.has(key)) groups.catalog[key] = value;
    else if (PRODUCT_STOCK_UPDATE_FIELDS.has(key)) groups.stock[key] = value;
    else if (PRODUCT_COMMERCIAL_UPDATE_FIELDS.has(key)) groups.commercial[key] = value;
    else if (PRODUCT_PUBLICATION_UPDATE_FIELDS.has(key)) groups.publication[key] = value;
    else unknown.push(key);
  }

  if (unknown.length > 0) {
    throw new ApiError('Unsupported fields for this product update', 400, {
      code: 'validation_failed', details: { fields: unknown },
    });
  }

  return groups;
}

async function putProductUpdate(id: string, suffix: string, data: Record<string, any>) {
  return authedFetch(`${API_URL}/api/products/${id}${suffix}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    retryTimeouts: true,
  });
}

async function updateProductByDomain(id: string, data: Record<string, any>) {
  const groups = splitProductUpdateByDomain(data);
  let result: any = { success: true };
  if (Object.keys(groups.catalog).length > 0) result = await putProductUpdate(id, '/catalog', groups.catalog);
  if (Object.keys(groups.stock).length > 0) result = await putProductUpdate(id, '/stock', groups.stock);
  if (Object.keys(groups.commercial).length > 0) result = await putProductUpdate(id, '/commercial', groups.commercial);
  if (Object.keys(groups.publication).length > 0) result = await putProductUpdate(id, '/publication', groups.publication);
  return result;
}

// ── Silent refresh machinery ──────────────────────────────────────────────
// Coordinates ongoing refresh calls so many concurrent requests don't each
// fire their own refresh when a page first loads a stale token.
//
// 'refreshed'    , new token issued and stored; retry the original call
// 'rejected'     , server explicitly rejected the token (non-2xx); log out
// 'network_error', couldn't reach the refresh endpoint; keep existing token
type RefreshResult = 'refreshed' | 'rejected' | 'network_error';

let inFlightRefresh: Promise<RefreshResult> | null = null;
let lastRefreshAttemptAt = 0;

async function refreshTokenNow(): Promise<RefreshResult> {
  const token = getToken();
  if (!token) return 'rejected';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    // 5xx = server temporarily unavailable (cold start, DB blip, deployment).
    // Do NOT log the user out for a transient infrastructure error, keep the
    // existing token and let the next API call retry.
    if (res.status >= 500) return 'network_error';
    if (!res.ok) return 'rejected'; // 4xx = token genuinely invalid/expired
    const data = await res.json().catch(() => null);
    if (data?.token && typeof data.token === 'string') {
      setToken(data.token);
      // Refresh the Zustand store so memberships stay aligned with the JWT.
      try { hydrateAccountStateFromToken(); } catch { /* ignore */ }
      return 'refreshed';
    }
    return 'rejected';
  } catch {
    // Network error or timeout, keep the old token; next success will retry.
    return 'network_error';
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Shared silent refresh; concurrent callers see the same promise. */
export function ensureTokenRefreshed(): Promise<RefreshResult> {
  if (!inFlightRefresh) {
    lastRefreshAttemptAt = Date.now();
    inFlightRefresh = refreshTokenNow().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

function maybeScheduleBackgroundRefresh() {
  if (!shouldProactivelyRefreshToken()) return;
  // Throttle, don't retry more than once per minute on failure, since the
  // refresh helper is best-effort and we don't want to hammer the API while
  // a Worker deploy is cycling.
  if (Date.now() - lastRefreshAttemptAt < 60_000) return;
  // Fire and forget; errors are tolerated.
  void ensureTokenRefreshed();
}

/** Fetch with an AbortController timeout.
 *
 *  Browsers throw a generic TypeError for any pre-response failure (DNS,
 *  CORS preflight rejection, offline, mixed-content). The .message is
 *  browser-specific and useless to surface in UI:
 *    - Safari (iOS / macOS): "Load failed"
 *    - Chrome:               "Failed to fetch"
 *    - Firefox:              "NetworkError when attempting to fetch resource"
 *  We rewrite all of those into a single clear message so the sign-in form
 *  (and every other call-site) shows something the user can act on.
 */
// Transient network failures surface as a `fetch` TypeError (DNS hiccup, TLS
// reset, momentary offline). In mainland China the most common cause is the
// GFW resetting a Cloudflare connection mid-handshake, the API is reachable
// only in short, jumpy windows. A single-shot request (or one fast retry) lands
// in a block window and turns into a hard "couldn't reach the server" even
// though the server is up. So we retry network errors several times with
// exponential backoff + jitter, and, when the browser reports itself offline,
// wait for the `online` event so the request fires the instant the connection
// returns instead of burning the attempt on a guaranteed failure.
// HTTP errors (4xx/5xx) are NOT retried, they come back as a resolved Response,
// never a thrown TypeError, so they skip this path entirely.
const NETWORK_RETRY_BACKOFF_MS = [600, 1800, 4000, 7000];

// The GFW's other failure mode is a BLACKHOLED connection: no reset, the
// request just hangs until our own abort fires. Those aborts used to surface
// immediately as "Request timed out" with no second chance, the dominant
// failure Adrian hit in China. Idempotent calls (GET/HEAD automatically, plus
// writes that opt in via `retryTimeouts`, e.g. compass sync/delete which are
// INSERT OR REPLACE / DELETE-by-id on the worker) now get a shorter
// per-attempt budget and up to two fresh connections instead of one 30s hang.
// Non-idempotent writes keep the old single-shot behavior, a timed-out
// request may still have reached the server, and e.g. invoice creation must
// not double-fire.
const TIMEOUT_RETRY_MAX = 2;
const TIMEOUT_RETRY_ATTEMPT_MS = 15_000;

/** RequestInit plus transport behavior that must not leak into fetch(). */
export interface ApiRequestInit extends RequestInit {
  retryTimeouts?: boolean;
  timeoutMs?: number;
  background?: boolean;
  reportIncident?: boolean;
}

type ApiBackgroundOptions = Pick<ApiRequestInit, 'background'>;
export type NetworkErrorKind = 'offline' | 'unstable' | 'slow';

/** Resolve once the browser reports it's back online, or after `maxMs` elapses. */
function waitForReconnect(maxMs: number): Promise<void> {
  if (typeof window === 'undefined' || navigator.onLine !== false) return Promise.resolve();
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('online', finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, maxMs);
    window.addEventListener('online', finish);
  });
}

interface RequestIncidentContext {
  route: string;
  method: string;
  reportIncident: boolean;
}

const responseIncidentContext = new WeakMap<Response, RequestIncidentContext>();

function routeFromUrl(url: string): string {
  try {
    const base = typeof window === 'undefined' ? 'https://teajia.com' : window.location.origin;
    return new URL(url, base).pathname;
  } catch {
    return url.split('?')[0] || '/unknown';
  }
}

export async function fetchWithTimeout(url: string, options: ApiRequestInit = {}): Promise<Response> {
  const {
    background = false,
    reportIncident = true,
    retryTimeouts: retryTimeoutOption,
    timeoutMs,
    ...requestInit
  } = options;
  const method = (requestInit.method || 'GET').toUpperCase();
  const retryTimeouts = retryTimeoutOption ?? (method === 'GET' || method === 'HEAD');
  // When timeouts are retryable, fail each attempt fast and try a fresh
  // connection; a blackholed socket never recovers by waiting longer.
  const attemptTimeoutMs = timeoutMs ?? (retryTimeouts ? TIMEOUT_RETRY_ATTEMPT_MS : REQUEST_TIMEOUT_MS);
  let timeoutRetries = 0;
  let lastErr: any;
  for (let attempt = 0; attempt <= NETWORK_RETRY_BACKOFF_MS.length; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), attemptTimeoutMs);
    try {
      const response = await fetch(url, { ...requestInit, signal: controller.signal });
      responseIncidentContext.set(response, {
        route: routeFromUrl(url),
        method,
        reportIncident,
      });
      return response;
    } catch (err: any) {
      lastErr = err;
      // Our own timeout aborts share the AbortError name.
      const isTimeout = err?.name === 'AbortError';
      if (isTimeout && (!retryTimeouts || timeoutRetries >= TIMEOUT_RETRY_MAX)) {
        const timeoutError = new Error('Request timed out. Please try again.');
        if (!background) await dispatchNetworkError(
          'slow', timeoutError, { route: routeFromUrl(url), method }, reportIncident,
        );
        throw timeoutError;
      }
      const isNetworkError = err?.name === 'TypeError';
      if ((isNetworkError || isTimeout) && attempt < NETWORK_RETRY_BACKOFF_MS.length) {
        clearTimeout(timeoutId);
        if (isTimeout) {
          // The old connection already burned 15s, retry near-immediately on
          // a fresh one rather than adding backoff on top.
          timeoutRetries++;
          await new Promise(resolve => setTimeout(resolve, 300));
          continue;
        }
        const base = NETWORK_RETRY_BACKOFF_MS[attempt];
        const delay = Math.round(base * (0.7 + Math.random() * 0.6)); // ±30% jitter
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          // Flat offline: wait (capped) for the connection to return, then
          // retry immediately rather than sleeping through a dead window.
          await waitForReconnect(Math.max(delay, 10_000));
        } else {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        continue;
      }
      if (!background) {
        const kind: NetworkErrorKind = isTimeout
          ? 'slow'
          : typeof navigator !== 'undefined' && navigator.onLine === false
            ? 'offline'
            : 'unstable';
        await dispatchNetworkError(
          kind, err, { route: routeFromUrl(url), method }, reportIncident,
        );
      }
      if (isTimeout) {
        throw new Error('Request timed out. Please try again.');
      }
      if (isNetworkError) {
        throw new Error("Couldn't reach the server. Check your connection and try again.");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  // Loop only exits via return/throw above; this satisfies the type checker.
  throw lastErr;
}

/** Custom event name dispatched when a 401 response indicates session expiry. */
export const SESSION_EXPIRED_EVENT = 'teajia:session-expired';

/** Dispatched when the server rejects the active account (e.g., membership revoked). */
export const ACCOUNT_MISMATCH_EVENT = 'teajia:account-mismatch';

/** Dispatched on a foreground transport failure. Debounced to 5s. */
export const NETWORK_ERROR_EVENT = 'teajia:network-error';
export const NETWORK_RECOVERED_EVENT = 'teajia:network-recovered';
let _lastNetworkErrorAt = 0;
let _networkErrorActive = false;
let _probeCache: { checkedAt: number; reachable: boolean } | null = null;
let _probeInFlight: Promise<boolean> | null = null;
const _incidentReportedAt = new Map<string, number>();
const INCIDENT_THROTTLE_MS = 60_000;

async function probeSiteReachability(): Promise<boolean> {
  const now = Date.now();
  if (_probeCache && now - _probeCache.checkedAt < 10_000) return _probeCache.reachable;
  if (_probeInFlight) return _probeInFlight;
  _probeInFlight = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3_000);
    try {
      await fetch('/version.json?probe=1', { cache: 'no-store', signal: controller.signal });
      _probeCache = { checkedAt: Date.now(), reachable: true };
      return true;
    } catch {
      _probeCache = { checkedAt: Date.now(), reachable: false };
      return false;
    } finally {
      clearTimeout(timeoutId);
      _probeInFlight = null;
    }
  })();
  return _probeInFlight;
}

function reportClientIncident(error: unknown, context: { route: string; method: string }): void {
  const incident = classifyIncident(error, context);
  const now = Date.now();
  const lastReportedAt = _incidentReportedAt.get(incident.signature) ?? 0;
  if (now - lastReportedAt < INCIDENT_THROTTLE_MS) return;
  _incidentReportedAt.set(incident.signature, now);
  void api.incidents.report({ ...incident }).catch(() => {});
}

async function dispatchNetworkError(
  kind: NetworkErrorKind,
  error: unknown,
  context: { route: string; method: string },
  shouldReport: boolean,
): Promise<void> {
  const now = Date.now();
  if (now - _lastNetworkErrorAt < 5000) return;
  _lastNetworkErrorAt = now;
  const resolvedKind = kind !== 'offline' && await probeSiteReachability() ? 'slow' : kind;
  _networkErrorActive = true;
  window.dispatchEvent(new CustomEvent(NETWORK_ERROR_EVENT, { detail: { kind: resolvedKind } }));
  if (shouldReport) reportClientIncident(error, context);
}

function dispatchNetworkRecovered(): void {
  if (!_networkErrorActive) return;
  _networkErrorActive = false;
  window.dispatchEvent(new CustomEvent(NETWORK_RECOVERED_EVENT));
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly data?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
  }
}

export class EmailDeliveryUnavailableError extends Error {
  constructor() {
    super('Email delivery is not configured');
    this.name = 'EmailDeliveryUnavailableError';
  }
}

/** Retry only failures that may succeed without changing the request. */
export function isTransientApiError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 408 || error.status === 429 || error.status >= 500;
  if (!(error instanceof Error)) return false;
  return /timed out|couldn.t reach the server|network|offline|failed to fetch/i.test(error.message);
}

async function handleResponse(res: Response) {
  const incidentContext = responseIncidentContext.get(res) ?? {
    route: routeFromUrl(res.url || '/unknown'),
    method: 'GET',
    reportIncident: true,
  };
  let data: any;
  try {
    data = await res.json();
  } catch {
    const error = new ApiError(`Request failed (${res.status})`, res.status);
    if (res.status >= 500 && incidentContext.reportIncident) {
      reportClientIncident(error, incidentContext);
    }
    throw error;
  }
  if (!res.ok) {
    // Detect account access denial, clear active account and prompt UI reload.
    // (401 refresh + retry is handled in authedFetch before this is called.)
    if (res.status === 403 && data?.code === 'account_access_denied') {
      try {
        useAppStore.getState().setActiveAccountId(null);
        useAppStore.getState().setActiveAccount(null);
      } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent(ACCOUNT_MISMATCH_EVENT));
    }
    const message = typeof data?.error === 'string' && data.error.length < 200
      ? data.error
      : `Request failed (${res.status})`;
    const error = new ApiError(message, res.status, data);
    if (res.status >= 500 && incidentContext.reportIncident) {
      reportClientIncident(error, incidentContext);
    }
    throw error;
  }
  dispatchNetworkRecovered();
  // Adopt any sliding-refresh token the server stapled onto the response
  // (currently /api/auth/me does this). Keeps the client JWT fresh without
  // an extra round-trip.
  if (data && typeof data === 'object' && typeof data.refreshed_token === 'string') {
    try {
      setToken(data.refreshed_token);
      hydrateAccountStateFromToken();
    } catch { /* ignore */ }
  }
  return data;
}

/**
 * Authenticated fetch wrapper, the standard path for all API calls that
 * require a JWT. Injects auth headers automatically (including
 * X-Teajia-Account derived from the JWT claim), and implements one-shot
 * retry on 401 so callers never see a "refresh succeeded but this call
 * failed" error.
 *
 * Retry flow:
 *   1. Send request with current token.
 *   2. On 401 (+ token present + not a 'no_token' bug): trigger
 *      ensureTokenRefreshed().
 *      - 'refreshed' → retry once with the new token. If the retry also
 *        401s, give up and surface SESSION_EXPIRED.
 *      - 'rejected'  → token is dead; clear it, fire SESSION_EXPIRED, throw.
 *      - 'network_error' → transient; keep token, throw the original error.
 *   3. On retry success → return result transparently.
 *
 * The retry is not recursive, on 401 the second attempt goes straight to
 * handleResponse, which throws if the fresh token is also rejected.
 */
/** Auth headers adjusted for the request body. FormData bodies MUST NOT carry
 *  our default `Content-Type: application/json`, with an explicit header the
 *  browser can't append the multipart boundary, and the worker hard-rejects
 *  non-multipart uploads with 400. This single header bug broke every
 *  `api.uploadImage` call (photo capture, vendor photos, teaware, ledger). */
function authHeadersFor(body: BodyInit | null | undefined, additional?: HeadersInit): Record<string, string> {
  const headers = new Headers(authHeaders());
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    headers.delete('Content-Type');
  }
  if (additional) new Headers(additional).forEach((value, key) => headers.set(key, value));
  return Object.fromEntries(headers.entries());
}

async function authenticatedResponse(url: string, init: ApiRequestInit = {}): Promise<Response> {
  const opts: ApiRequestInit = { ...init, headers: authHeadersFor(init.body, init.headers) };
  const res = await fetchWithTimeout(url, opts);

  if (res.status === 401 && hasToken()) {
    // Read the body once here, the Response body stream can only be consumed
    // once, so we capture it before branching on the refresh result.
    let bodyData: any;
    try { bodyData = JSON.parse(await res.text()); } catch { /* ignore */ }
    const reason = bodyData?.code as string | undefined;

    // 'no_token' means the server got no Authorization header, a client-side
    // bug, not an expired session. Refreshing would be pointless and could
    // falsely fire SESSION_EXPIRED.
    if (reason !== 'auth_no_token') {
      const refreshResult = await ensureTokenRefreshed();
      if (refreshResult === 'refreshed') {
        // New token stored, retry ONCE with fresh auth headers.
        // The second call goes straight to handleResponse; there is no further
        // retry (the retry itself throws on 401, which surfaces SESSION_EXPIRED
        // correctly if the fresh token is also rejected).
        const retryRes = await fetchWithTimeout(url, { ...init, headers: authHeadersFor(init.body, init.headers) });
        if (retryRes.status === 401) {
          clearToken(); window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
          throw new ApiError('Session expired', 401);
        }
        return retryRes;
      }
      if (refreshResult === 'rejected') {
        clearToken();
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
      // 'network_error': fall through and surface the original 401 error.
    }

    // Reconstruct a typed error from the already-consumed body so
    // handleResponse does not try to re-read the drained response stream.
    const message = typeof bodyData?.error === 'string' && bodyData.error.length < 200
      ? bodyData.error
      : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, bodyData);
  }

  return res;
}

async function authedFetch(url: string, init: ApiRequestInit = {}): Promise<any> {
  return handleResponse(await authenticatedResponse(url, init));
}

async function authedBlobFetch(url: string): Promise<Blob> {
  const response = await authenticatedResponse(url);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const body = await response.json(); if (typeof body?.error === 'string') message = body.error; } catch { /* use status */ }
    throw new Error(message);
  }
  return response.blob();
}

function normalizeProfileFavorite(row: any, publicResponse = false): ProfileFavorite {
  const statusPublic = publicResponse || (row?.profile_status === 'published' && Number(row?.network_visible) === 1);
  return {
    tea_profile_id: String(row?.tea_profile_id ?? row?.tea?.id ?? ''),
    source_account_id: row?.source_account_id ?? null,
    source_product_id: row?.source_product_id ?? null,
    source_listing_id: row?.source_listing_id ?? null,
    note: typeof row?.note === 'string' ? row.note : null,
    position: Number.isFinite(Number(row?.position)) ? Number(row.position) : 0,
    is_public: publicResponse || Boolean(row?.is_public),
    tea: {
      id: String(row?.tea_profile_id ?? row?.tea?.id ?? ''),
      name: String(row?.name ?? row?.tea?.name ?? 'Tea'),
      chinese_name: row?.chinese_name ?? row?.tea?.chinese_name ?? null,
      type: row?.type ?? row?.tea?.type ?? null,
      year: row?.harvest_year ?? row?.year ?? row?.tea?.year ?? null,
      origin: [row?.origin_region, row?.origin_country].filter(Boolean).join(', ') || row?.tea?.origin || null,
      image_url: row?.image_url ?? row?.tea?.image_url ?? null,
      public_path: row?.public_path ?? row?.tea?.public_path ?? null,
      is_public: publicResponse || Boolean(row?.tea?.is_public ?? statusPublic),
    },
  };
}

function normalizePaymentMethod(row: any): PaymentMethod {
  return {
    id: String(row?.id ?? ''),
    account_id: row?.account_id ?? null,
    method_type: row?.method_type,
    label: String(row?.label ?? ''),
    recipient_name: String(row?.recipient_name ?? ''),
    account_identifier: row?.account_identifier ?? null,
    instructions: row?.instructions ?? null,
    external_url: row?.external_url ?? null,
    qr_image_url: row?.qr_image_url ?? null,
    position: Number.isFinite(Number(row?.position)) ? Number(row.position) : 0,
    is_published: Boolean(row?.is_published),
  };
}

export interface TokenClaims {
  sub: string;
  email: string;
  role: string;
  platform_role?: import('../types').PlatformRole;
  name: string;
  username?: string | null;
  exp?: number;
  memberships?: AccountMembership[];
  active_account_id?: string;
}

/**
 * UTF-8 safe base64 decode. Plain `atob` returns a binary string whose code
 * units are the raw bytes, feeding that to JSON.parse corrupts any
 * non-ASCII character (e.g. a Chinese `name` claim). TextDecoder gives us
 * the original UTF-8 string back.
 */
function b64decodeUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function getTokenClaims(): TokenClaims | null {
  const token = getToken();
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(b64decodeUtf8(payload));
  } catch {
    return null;
  }
}

/** Remote account-scoped work is safe only after the JWT refreshed to the
 * same account as the optimistic UI selection. */
export function isTokenScopedToAccount(accountId: string | null): boolean {
  return !!accountId && getTokenClaims()?.active_account_id === accountId;
}

/**
 * Hydrate the Zustand store from the current JWT's memberships + active_account_id.
 * Safe to call multiple times. Returns the parsed claims (or null).
 */
export function hydrateAccountStateFromToken(): TokenClaims | null {
  const claims = getTokenClaims();
  if (!claims) return null;
  try {
    const store = useAppStore.getState();
    const rawMemberships = Array.isArray(claims.memberships) ? claims.memberships : [];
    // Normalize: older JWTs may contain 'name' instead of 'account_name'
    const memberships = rawMemberships.map((m: any) => ({
      ...m,
      account_name: m.account_name || m.name || '',
    }));
    store.setActiveUserId(claims.sub);
    store.setMemberships(memberships);
    store.setPlatformRole(claims.platform_role ?? null);
    if (claims.active_account_id) {
      store.setActiveAccountId(claims.active_account_id);
    } else if (memberships.length === 1) {
      store.setActiveAccountId(memberships[0].account_id);
    } else if (memberships.length === 0) {
      store.setActiveAccountId(null);
    }
  } catch { /* ignore */ }
  return claims;
}

export interface SampleSetApiWrite {
  id?: string;
  name?: string;
  source_id?: string;
  source_name?: string;
  purpose?: string;
  notes?: string;
  shared_with?: string[];
  panel_account_ids?: string[];
  archived?: boolean;
}

export interface SampleSetApiRow extends SampleSetApiWrite {
  id: string;
  account_id: string;
  name: string;
  purpose: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

export interface SampleApiWrite {
  id?: string;
  name?: string;
  chinese_name?: string;
  type?: string;
  form?: string;
  year?: number;
  origin_region?: string;
  source_id?: string;
  source_name?: string;
  source_contact?: Record<string, unknown>;
  product_id?: string;
  compass_entry_id?: string;
  set_id?: string;
  status?: string;
  grams?: number;
  notes?: string;
  photos?: string[];
  tea_key?: string;
  created_by?: string;
}

export interface SampleApiRow extends SampleApiWrite {
  id: string;
  account_id: string;
  name: string;
  set_id: string;
  status: string;
  grams: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  user_id?: string;
  tastings?: SampleTastingApiRow[];
}

export interface SampleTastingApiWrite {
  id?: string;
  tasting: TastingData;
  rating?: number;
  verdict: string;
  wouldBuy: boolean;
  personalNote?: string;
  tasterName?: string;
}

export interface SampleTastingApiRow {
  id: string;
  sample_id: string;
  taster_id: string;
  taster_name?: string;
  tasting: TastingData;
  rating?: number;
  verdict: string;
  would_buy: number | boolean;
  personal_note?: string;
  created_at: string;
}

export const api = {
  publicWisdom: {
    states: async (): Promise<{ states: PublicWisdomNodeState[] }> => {
      const response = await fetchWithTimeout(`${API_URL}/api/public/wisdom/states`);
      const data = await handleResponse(response);
      const rows = Array.isArray(data?.states) ? data.states : [];
      return {
        states: rows
          .filter((row: any) => row && typeof row.node_type === 'string' && typeof row.node_id === 'string')
          .map((row: any) => ({
            node_type: row.node_type as PublicWisdomNodeType,
            node_id: row.node_id,
            public_state: ['hidden', 'public', 'inherit'].includes(row.public_state) ? row.public_state : 'inherit',
            is_public: row.is_public !== false && row.public_state !== 'hidden',
          })),
      };
    },
  },
  teaReferenceIssues: {
    create: (input: CreateTeaReferenceIssueInput): Promise<CreateTeaReferenceIssueResponse> => authedFetch(
      `${API_URL}/api/admin/tea-reference/issues`,
      { method: 'POST', body: JSON.stringify(input), retryTimeouts: true },
    ),
    list: (): Promise<ListTeaReferenceIssuesResponse> => authedFetch(
      `${API_URL}/api/admin/tea-reference/issues`,
    ),
    exportBrief: (): Promise<Blob> => authedBlobFetch(
      `${API_URL}/api/admin/tea-reference/issues/export`,
    ),
    resolve: (ids: string[]): Promise<ResolveTeaReferenceIssuesResponse> => authedFetch(
      `${API_URL}/api/admin/tea-reference/issues/resolve`,
      { method: 'POST', body: JSON.stringify({ ids }), retryTimeouts: true },
    ),
  },
  incidents: {
    // Keep browser traffic on the public same-origin proxy. A direct Worker
    // fallback would bypass the China-reachable boundary and the CSP.
    report: (incident: Record<string, unknown>) => authedFetch(`${API_URL}/api/incidents`, {
      method: 'POST', body: JSON.stringify(incident), retryTimeouts: true,
      background: true, reportIncident: false,
    }),
    list: () => authedFetch(`${API_URL}/api/platform/incidents`),
    update: (id: string, patch: { status: string; resolution_ref?: string }) => authedFetch(`${API_URL}/api/platform/incidents/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify(patch), retryTimeouts: true,
    }),
  },
  sales: {
    listGrants: (productId?: string): Promise<SalesGrant[]> => {
      const query = productId ? `?product_id=${encodeURIComponent(productId)}` : '';
      return authedFetch(`${API_URL}/api/sales/grants${query}`);
    },
    createGrant: (data: SalesGrantWrite): Promise<SalesGrant> => authedFetch(`${API_URL}/api/sales/grants`, {
      method: 'POST', body: JSON.stringify(data),
    }),
    updateGrant: (id: string, data: Partial<SalesGrantWrite>): Promise<SalesGrant> => authedFetch(`${API_URL}/api/sales/grants/${encodeURIComponent(id)}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
    revokeGrant: (id: string): Promise<{ success: true }> => authedFetch(`${API_URL}/api/sales/grants/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
    eligibleProducts: (): Promise<EligibleSalesProduct[]> => authedFetch(`${API_URL}/api/sales/eligible-products`),
    listSettlements: (options?: { mine?: boolean }): Promise<SalesSettlement[]> => {
      const query = options?.mine ? '?mine=1' : '';
      return authedFetch(`${API_URL}/api/sales/settlements${query}`);
    },
    markSettlementPaid: (id: string): Promise<{ success: true }> => authedFetch(`${API_URL}/api/sales/settlements/${encodeURIComponent(id)}`, {
      method: 'PUT', body: JSON.stringify({ status: 'paid' }),
    }),
  },
  inventoryReceipts: {
    list: (includeClosed = false) => authedFetch(`${API_URL}/api/inventory/receipts?include_closed=${includeClosed ? '1' : '0'}`),
    create: (body: Record<string, unknown>, idempotencyKey = crypto.randomUUID()) => authedFetch(`${API_URL}/api/inventory/receipts`, { method: 'POST', body: JSON.stringify({ ...body, idempotency_key: idempotencyKey }), retryTimeouts: true }),
    updateState: (receiptId: string, state: 'ordered' | 'in_transit') => authedFetch(`${API_URL}/api/inventory/receipts/${receiptId}/state`, { method: 'PUT', body: JSON.stringify({ state }), retryTimeouts: true }),
    receive: (lineId: string, quantity: number, idempotencyKey = crypto.randomUUID()) => authedFetch(`${API_URL}/api/inventory/receipt-lines/${lineId}/receive`, { method: 'POST', body: JSON.stringify({ quantity, idempotency_key: idempotencyKey }), retryTimeouts: true }),
    cancelRemaining: (lineId: string) => authedFetch(`${API_URL}/api/inventory/receipt-lines/${lineId}/cancel-remaining`, { method: 'POST', retryTimeouts: true }),
  },
  inventorySummaries: {
    list: (): Promise<{ summaries: Array<{
      product_id: string;
      incoming_quantity: number;
      has_open_incoming: boolean;
      writing_count: number;
      published_writing_count: number;
      has_writing: boolean;
      personal_tasting_count: number;
      personally_tasted: boolean;
    }> }> => authedFetch(`${API_URL}/api/inventory/summaries`),
  },
  stockMovements: {
    create: (productId: string, body: {
      movement_type: 'receipt' | 'sale' | 'sample_use' | 'gift' | 'waste' | 'return' | 'recount' | 'transfer';
      unit: 'g' | 'unit'; expected_balance: number; idempotency_key: string;
      quantity?: number; balance?: number; destination_product_id?: string;
      note?: string; batch_id?: string; source_invoice_id?: string; source_invoice_number?: string; source_compass_entry_id?: string;
    }) => authedFetch(`${API_URL}/api/products/${productId}/movements`, { method: 'POST', body: JSON.stringify(body), retryTimeouts: true }),
  },
  // Working Feature Guide, admin-only internal build tracker.
  featureStatus: {
    /** Map of feature_id → { stage, works, tested, visual, notes, updated_at }. */
    list: async (): Promise<Record<string, {
      stage: string; works: string; tested: boolean; visual: string; notes: string; updated_at: string;
    }>> => authedFetch(`${API_URL}/api/admin/feature-status`),
    /** Partial upsert, only the fields you pass change. */
    save: async (feature_id: string, patch: {
      stage?: string; works?: string; tested?: boolean; visual?: string; notes?: string;
    }) => authedFetch(`${API_URL}/api/admin/feature-status`, {
      method: 'POST',
      body: JSON.stringify({ feature_id, ...patch }),
    }),
  },
  auth: {
    login: async (identifier: string, password: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      return handleResponse(res);
    },
    signup: async (email: string, password: string, name: string, username?: string | null): Promise<PendingSignup> => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, username: username || undefined }),
      });
      const result = await handleResponse(res) as { verification_required?: boolean; signup_token?: string };
      if (!result.verification_required || !result.signup_token) {
        throw new Error('Signup verification could not be started. Please try again.');
      }
      return persistPendingSignup({
        email,
        signupToken: result.signup_token,
        expiresAt: Date.now() + PENDING_SIGNUP_TTL_MS,
        recoverableUntil: Date.now() + PENDING_SIGNUP_RECOVERY_MS,
      });
    },
    verifySignup: async (pending: PendingSignup, code: string): Promise<{ token: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/signup/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pending.email,
          code,
          signup_token: pending.signupToken,
        }),
      });
      return handleResponse(res);
    },
    resendSignup: async (pending: PendingSignup): Promise<PendingSignup> => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/signup/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pending.email, signup_token: pending.signupToken }),
      });
      const result = await handleResponse(res) as { verification_required?: boolean; signup_token?: string };
      if (!result.verification_required || !result.signup_token) {
        throw new Error('A new verification code could not be sent. Please try again.');
      }
      return persistPendingSignup({
        email: pending.email,
        signupToken: result.signup_token,
        expiresAt: Date.now() + PENDING_SIGNUP_TTL_MS,
        // Resending rotates the proof and code, but the Worker recovery window
        // remains anchored to the original signup identity creation time.
        recoverableUntil: pending.recoverableUntil,
      });
    },
    /** Explicit refresh, rarely needed directly; prefer `ensureTokenRefreshed`. */
    refresh: async (): Promise<boolean> => ensureTokenRefreshed().then(r => r === 'refreshed'),
    me: async () => {
      return authedFetch(`${API_URL}/api/auth/me`)
    },
    changePassword: async (currentPassword: string, newPassword: string) => {
      return authedFetch(`${API_URL}/api/auth/change-password`, {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
    updateProfile: async (data: { name?: string; email?: string; username?: string | null; phone?: string }) => {
      return authedFetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    requestAdmin: async () => {
      return authedFetch(`${API_URL}/api/auth/request-admin`, {
        method: 'POST',
      });
    },
    forgotPassword: async (email: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return handleResponse(res);
    },
    resetPassword: async (token: string, newPassword: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      return handleResponse(res);
    },
    verifyPassword: async (password: string): Promise<{ verified: boolean }> => {
      return authedFetch(`${API_URL}/api/auth/verify-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    },
    deleteAccount: async (password: string): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/auth/account`, {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      });
    },
    redeemJoinCode: async (data: { code: string; first_name: string; email: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/join-code/redeem`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
  },

  users: {
    list: async () => {
      return authedFetch(`${API_URL}/api/admin/users`)
    },
    updateRole: async (userId: string, data: { role?: string; admin_request_status?: string }) => {
      return authedFetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (userId: string) => {
      return authedFetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
    },
    createResetToken: async (userId: string) => {
      return authedFetch(`${API_URL}/api/admin/reset-token`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
    },
  },

  products: {
    list: async () => {
      return authedFetch(`${API_URL}/api/products`)
    },
    listPublic: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/public`);
      return handleResponse(res);
    },
    create: async (data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/products`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    bulkCreate: async (products: Record<string, any>[], batchId?: string, receiptLabel?: string) => {
      return authedFetch(`${API_URL}/api/products/bulk`, {
        method: 'POST',
        body: JSON.stringify({ products, batch_id: batchId, receipt_label: receiptLabel }),
      });
    },
    updateByDomain: updateProductByDomain,
    updateCatalog: async (id: string, data: Record<string, any>) => {
      return putProductUpdate(id, '/catalog', data);
    },
    updateStock: async (id: string, data: Record<string, any>) => {
      return putProductUpdate(id, '/stock', data);
    },
    updateCommercial: async (id: string, data: Record<string, any>) => {
      return putProductUpdate(id, '/commercial', data);
    },
    updatePublication: async (id: string, data: Record<string, any>) => {
      return putProductUpdate(id, '/publication', data);
    },
    // Stock spine step 2: flip the location-owner curation gate. Owner-tier only
    // (server enforces requireOwnerTier); a staff seller cannot show their own tea.
    updateShown: async (id: string, shown: boolean) => {
      return putProductUpdate(id, '/shown', { shown_in_shop: shown });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
      });
    },
    getEvents: async (id: string) => {
      return authedFetch(`${API_URL}/api/products/${id}/events`)
    },
    setFeatured: async (id: string, featured: boolean) => {
      return authedFetch(`${API_URL}/api/products/${id}/featured`, {
        method: 'POST',
        body: JSON.stringify({ featured }),
      });
    },
    enhanceImage: async (
      id: string,
      slot: 'main' | '1' | '2' | 'bag',
      prompt?: string,
    ): Promise<{ url: string }> => {
      return authedFetch(`${API_URL}/api/products/${id}/enhance-image`, {
        method: 'POST',
        body: JSON.stringify({ slot, prompt }),
      });
    },
  },

  rates: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/rates`);
      return handleResponse(res);
    },
  },

  invoices: {
    list: async (limit = 50, offset = 0, includeDeleted = false): Promise<Array<Record<string, any> & { payment: InvoicePayment | null }>> => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (includeDeleted) params.set('include_deleted', '1');
      return authedFetch(`${API_URL}/api/invoices?${params}`)
    },
    create: async (invoice: Record<string, any>, lineItems: Record<string, any>[]) => {
      return authedFetch(`${API_URL}/api/invoices`, {
        method: 'POST',
        body: JSON.stringify({ invoice, lineItems }),
      });
    },
    getItems: async (id: string) => {
      return authedFetch(`${API_URL}/api/invoices/${id}/items`)
    },
    getAttribution: async (id: string): Promise<InvoiceAttribution> => {
      return authedFetch(`${API_URL}/api/invoices/${encodeURIComponent(id)}/attribution`)
    },
    // Every payment against this order, newest first: the operator's own
    // records and the reports customers have sent in, in one list.
    getPayments: async (id: string): Promise<InvoicePaymentRecord[]> => {
      return authedFetch(`${API_URL}/api/invoices/${encodeURIComponent(id)}/payments`)
    },
    // Money the operator has seen arrive. Lands confirmed in one step, and the
    // invoice's payment_status is recomputed from the ledger before returning.
    recordPayment: async (id: string, input: RecordPaymentInput): Promise<InvoicePaymentOutcome & { payment_id: string }> => {
      return authedFetch(`${API_URL}/api/invoices/${encodeURIComponent(id)}/payments`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    update: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/invoices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    updateItems: async (id: string, data: { lineItems?: { product_id?: string | null; custom_name?: string | null; quantity: number; price_at_sale: number }[]; shipping_cost_usd?: number; customer_name?: string; notes?: string }) => {
      return authedFetch(`${API_URL}/api/invoices/${id}/items`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/invoices/${id}`, {
        method: 'DELETE',
      });
    },
  },

  /**
   * Acting on one payment row. Both calls recompute the invoice's payment
   * status from the ledger and hand back the result, so a caller never has to
   * work out the new numbers itself.
   *
   * Both are idempotent. Confirming a payment that is already confirmed changes
   * nothing and counts nothing twice; `changed` says whether this call was the
   * one that moved it.
   */
  invoicePayments: {
    confirm: async (id: string): Promise<InvoicePaymentOutcome & { success: true; changed: boolean }> => {
      return authedFetch(`${API_URL}/api/invoice-payments/${encodeURIComponent(id)}/confirm`, {
        method: 'POST',
      });
    },
    reject: async (id: string): Promise<InvoicePaymentOutcome & { success: true; changed: boolean }> => {
      return authedFetch(`${API_URL}/api/invoice-payments/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
      });
    },
  },

  /**
   * What needs the tea master, across four kinds, oldest waiting first.
   *
   * Its own namespace because the resource is the queue, not any one invoice.
   * A successful empty list is a real answer and means the table is clear; a
   * failure throws rather than resolving to an empty list, so a surface can
   * never tell Adrian nothing is waiting because a read went wrong.
   */
  attention: {
    list: async (): Promise<AttentionResponse> => {
      return authedFetch(`${API_URL}/api/attention`);
    },
  },

  analytics: {
    revenue: async () => {
      return authedFetch(`${API_URL}/api/analytics/revenue`);
    },
    rfm: async () => {
      return authedFetch(`${API_URL}/api/customers/rfm`);
    },
  },

  customers: {
    list: async (type?: 'customer' | 'supplier', relationship?: string) => {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (relationship) params.set('relationship', relationship);
      const query = params.toString();
      const url = query ? `${API_URL}/api/customers?${query}` : `${API_URL}/api/customers`;
      return authedFetch(url)
    },
    get: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}`)
    },
    create: async (data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/customers`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: Record<string, any>) => {
      // PUT by id, idempotent, safe to retry through a GFW timeout (vendor
      // photo/location saves from the Compass ride this).
      return authedFetch(`${API_URL}/api/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        retryTimeouts: true,
      });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}`, {
        method: 'DELETE',
      });
    },
    getOrders: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/orders`)
    },
    getTeas: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/teas`)
    },
    getEvents: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/events`)
    },
    getSuppliedProducts: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/products`)
    },
    getRelationships: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/relationships`)
    },
    updateRelationships: async (id: string, relationshipKinds: string[]) => {
      return authedFetch(`${API_URL}/api/customers/${id}/relationships`, {
        method: 'PUT',
        body: JSON.stringify({ relationship_kinds: relationshipKinds }),
      });
    },
    getPrivateNotes: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/private-notes`)
    },
    updatePrivateNotes: async (id: string, body: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/private-notes`, {
        method: 'PUT',
        body: JSON.stringify({ body }),
      });
    },
    linkProduct: async (vendorId: string, productId: string) => {
      return authedFetch(`${API_URL}/api/customers/${vendorId}/products`, {
        method: 'POST',
        body: JSON.stringify({ product_id: productId }),
      });
    },
    unlinkProduct: async (vendorId: string, productId: string) => {
      return authedFetch(`${API_URL}/api/customers/${vendorId}/products/${productId}`, {
        method: 'DELETE',
      });
    },
    /** Contact tags (admin-only freeform). Storage is lowercase. */
    listTags: async (customerId: string): Promise<string[]> => {
      return authedFetch(`${API_URL}/api/customers/${customerId}/tags`)
    },
    addTag: async (customerId: string, tag: string): Promise<{ success: boolean; tags: string[] }> => {
      return authedFetch(`${API_URL}/api/customers/${customerId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tag }),
      });
    },
    addTags: async (customerId: string, tags: string[]): Promise<{ success: boolean; tags: string[] }> => {
      return authedFetch(`${API_URL}/api/customers/${customerId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tags }),
      });
    },
    removeTag: async (customerId: string, tag: string): Promise<{ success: boolean }> => {
      return authedFetch(`${API_URL}/api/customers/${customerId}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE',
      });
    },
    /** Fetch customers tagged as 'vendor' (legacy field on customers.tags, distinct from contact-tags). */
    fetchVendors: async (): Promise<Array<{ id: string; name: string; country?: string; tags?: string }>> => {
      const data = await authedFetch(`${API_URL}/api/customers`)
      const list = Array.isArray(data) ? data : (data?.customers ?? []);
      return list.filter((c: { tags?: string | string[] }) => {
        const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : []);
        return tags.includes('vendor') || tags.includes('Vendor');
      });
    },
  },

  rpc: {
    fulfillInvoice: async (invoiceId: string) => {
      return authedFetch(`${API_URL}/api/rpc/fulfill-invoice`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
    },
    voidInvoice: async (invoiceId: string) => {
      return authedFetch(`${API_URL}/api/rpc/void-invoice`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
    },
    splitInvoice: async (invoiceId: string, lineItemIds: string[]) => {
      return authedFetch(`${API_URL}/api/rpc/split-invoice`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId, line_item_ids: lineItemIds }),
      });
    },
    incrementStock: async (productId: string, amount: number, batchId?: string) => {
      return authedFetch(`${API_URL}/api/rpc/increment-stock`, {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, amount, batch_id: batchId }),
      });
    },
    truncateAll: async () => {
      if (!window.confirm('DANGER: This will permanently delete ALL data. This action cannot be undone. Are you sure?')) {
        throw new Error('Operation cancelled by user');
      }
      return authedFetch(`${API_URL}/api/rpc/truncate-all`, {
        method: 'POST',
      });
    },
    backfillCustomerLinks: async () => {
      return authedFetch(`${API_URL}/api/rpc/backfill-customer-links`, {
        method: 'POST',
      });
    },
    autoLinkVendors: async () => {
      return authedFetch(`${API_URL}/api/rpc/auto-link-vendors`, {
        method: 'POST',
      });
    },
    resetStockVerification: async () => {
      return authedFetch(`${API_URL}/api/rpc/reset-stock-verification`, {
        method: 'POST',
      });
    },
    linkLineItem: async (invoiceId: string, lineItemId: string, productId: string) => {
      return authedFetch(`${API_URL}/api/rpc/link-line-item`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId, line_item_id: lineItemId, product_id: productId }),
      });
    },
    reserveStock: async (invoiceId: string) => {
      return authedFetch(`${API_URL}/api/rpc/reserve-stock`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
    },
    releaseStock: async (invoiceId: string) => {
      return authedFetch(`${API_URL}/api/rpc/release-stock`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
    },
    giftSample: async (data: { customer_user_id: string; entry_ids: string[]; note?: string }) => {
      return authedFetch(`${API_URL}/api/rpc/gift-sample`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  stockHolds: {
    available: async (productId: string) => {
      return authedFetch(`${API_URL}/api/stock/available?product_id=${productId}`)
    },
  },

  purchaseOrders: {
    list: async (): Promise<PurchaseOrder[]> => {
      return authedFetch(`${API_URL}/api/purchase-orders`)
    },

    create: async (data: {
      vendor_name: string;
      vendor_id?: string;
      vendor_contact?: string;
      po_number?: string;
      items_json: string;
      total_usd?: number;
      display_currency?: string;
      status?: string;
      notes?: string;
      message_text?: string;
    }): Promise<{ id: string }> => {
      return authedFetch(`${API_URL}/api/purchase-orders`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateStatus: async (id: string, status: string): Promise<{ success: boolean }> => {
      return authedFetch(`${API_URL}/api/purchase-orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
    },
  },

  activityLogs: {
    list: async (params?: { limit?: number; offset?: number; action?: string; search?: string; entity_id?: string }) => {
      const qp = new URLSearchParams();
      if (params?.limit) qp.set('limit', String(params.limit));
      if (params?.offset) qp.set('offset', String(params.offset));
      if (params?.action) qp.set('action', params.action);
      if (params?.search) qp.set('search', params.search);
      if (params?.entity_id) qp.set('entity_id', params.entity_id);
      return authedFetch(`${API_URL}/api/activity-logs?${qp}`)
    },
  },

  stockLedger: {
    list: async (productId?: string, limit = 50, offset = 0) => {
      const qp = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (productId) qp.set('product_id', productId);
      return authedFetch(`${API_URL}/api/stock-ledger?${qp}`)
    },
  },

  batches: {
    list: async () => authedFetch(`${API_URL}/api/batches`),
    create: async (batch: { label: string; intake_date?: string | null; vendor?: string | null; note?: string | null }) => {
      return authedFetch(`${API_URL}/api/batches`, {
        method: 'POST',
        body: JSON.stringify(batch),
      });
    },
    products: async (batchId: string) => authedFetch(`${API_URL}/api/batches/${batchId}/products`),
  },

  generateWisdom: async (prompt: string) => {
    return authedFetch(`${API_URL}/api/generate-wisdom`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },

  // One-tap Chinese name for a captured tea (the operator can't type hanzi).
  // Returns { chineseName, confident }.
  generateChineseName: async (params: { name: string; type?: string; originRegion?: string; year?: number }) => {
    return authedFetch(`${API_URL}/api/generate-chinese-name`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  extractFromImage: async (file: File, opts?: { skipUpload?: boolean }) => {
    const formData = new FormData();
    formData.append('file', file);
    // Callers that already uploaded the photo themselves set skipUpload so
    // the extract endpoint doesn't write a duplicate R2 object.
    if (opts?.skipUpload) formData.append('skip_upload', '1');
    // authedFetch: full header set (Authorization + X-Teajia-Account, no
    // Content-Type on FormData) + 401-refresh retry. The old hand-rolled
    // version read localStorage directly (missed sessionStorage tokens) and
    // sent no account header, so the R2 write could land without account scope.
    return authedFetch(`${API_URL}/api/extract-from-image`, {
      method: 'POST',
      body: formData,
    });
  },

  transcribeAudio: async (audioBlob: Blob): Promise<{ text: string; recording_id: string }> => {
    const formData = new FormData();
    const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('wav') ? 'wav' : 'webm';
    formData.append('file', audioBlob, `recording.${ext}`);
    return authedFetch(`${API_URL}/api/transcribe`, {
      method: 'POST',
      body: formData,
    });
  },

  retryTranscription: async (recordingId: string): Promise<{ text: string; recording_id: string }> =>
    authedFetch(`${API_URL}/api/transcriptions/${encodeURIComponent(recordingId)}/retry`, { method: 'POST' }),

  discardTranscription: async (recordingId: string): Promise<{ ok: true }> =>
    authedFetch(`${API_URL}/api/transcriptions/${encodeURIComponent(recordingId)}`, { method: 'DELETE' }),

  uploadImage: async (
    file: File | Blob,
    options?: { productId?: string; slot?: 'main' | '1' | '2' | 'bag'; filename?: string },
  ) => {
    const formData = new FormData();
    // Browsers default a Blob filename to "blob"; pass a real .jpg filename so
    // the worker can derive an extension for stable-key uploads.
    const filename = options?.filename ?? (file instanceof File ? file.name : 'photo.jpg');
    formData.append('file', file, filename);
    if (options?.productId) formData.append('product_id', options.productId);
    if (options?.slot) formData.append('slot', options.slot);
    const data = await authedFetch(`${API_URL}/api/upload-image`, {
      method: 'POST',
      body: formData,
    });
    return data.url as string;
  },

  // Same upload, but reports real progress (0..1) via XHR so a phone on cell
  // data shows a live bar instead of a silent wait. Falls back to uploadImage
  // semantics on error.
  uploadImageProgress: async (
    file: File | Blob,
    onProgress: (p: number) => void,
    options?: { filename?: string },
  ): Promise<string> => {
    const formData = new FormData();
    const filename = options?.filename ?? (file instanceof File ? file.name : 'photo.jpg');
    formData.append('file', file, filename);
    // Use the same headers authedFetch sends (Authorization + X-Teajia-Account),
    // but NOT Content-Type, the browser sets the multipart boundary itself.
    // Network-level failures (timeout / connection reset) retry on a fresh
    // connection up to 2 extra times, on GFW-style jumpy links the first
    // attempt often dies mid-stream while an immediate retry lands. HTTP
    // errors (4xx/5xx) are real answers from the server and do NOT retry.
    // Each attempt creates at most one R2 object, so a duplicate is harmless.
    const attemptUpload = () => new Promise<string>((resolve, reject) => {
      const headers = authHeaders();
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/upload-image`);
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === 'content-type') continue;
        xhr.setRequestHeader(k, v);
      }
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText).url as string); }
          catch { reject(new Error('bad upload response')); }
        } else reject(Object.assign(new Error(`upload failed: ${xhr.status}`), { permanent: true }));
      };
      xhr.onerror = () => reject(new Error('network error'));
      xhr.ontimeout = () => reject(new Error('upload timed out'));
      xhr.timeout = 60000; // never hang forever on a flaky phone connection
      xhr.send(formData);
    });
    let lastErr: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await attemptUpload();
      } catch (err: any) {
        lastErr = err;
        if (err?.permanent) throw err;
        onProgress(0); // reset the bar so the retry doesn't look stuck at 90%
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    throw lastErr;
  },

  events: {
    // Admin endpoints
    listAdmin: async () => {
      return authedFetch(`${API_URL}/api/admin/events`)
    },
    getAdmin: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}`)
    },
    create: async (data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/events`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}`, {
        method: 'DELETE',
      });
    },
    getAttendees: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/attendees`)
    },
    updateAttendee: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/attendees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    getNotifications: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/notifications`)
    },
    createNotifications: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/notifications`, {
        method: 'POST',
      });
    },
    getPostSession: (id: string): Promise<AdminEventPostSession> =>
      authedFetch(`${API_URL}/api/admin/events/${id}/post-session`),
    upsertPostSession: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/post-session`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    createArticleDraft: (id: string): Promise<{ existing: boolean; article: DbArticle }> =>
      authedFetch(`${API_URL}/api/admin/events/${id}/article-draft`, { method: 'POST' }),
    duplicate: async (id: string, input: { slug: string; eventDate: string }) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ slug: input.slug, event_date: input.eventDate }),
      });
    },
    batchAttendance: async (id: string, attendeeIds: string[], attended: boolean) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ attendee_ids: attendeeIds, attended }),
      });
    },
    getTeaMenu: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/tea-menu`)
    },
    upsertTeaMenu: async (id: string, items: Record<string, any>[]) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/tea-menu`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
    },
    deleteTeaMenuItem: async (id: string, itemId: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/tea-menu/${itemId}`, {
        method: 'DELETE',
      });
    },
    getTastingNotes: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/tasting-notes`)
    },
    // V2: Attendee approval actions
    approveAttendee: async (id: string, data?: { approved_guests?: number; message?: string }) => {
      return authedFetch(`${API_URL}/api/admin/attendees/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify(data || {}),
      });
    },
    denyAttendee: async (id: string, data?: { message?: string }) => {
      return authedFetch(`${API_URL}/api/admin/attendees/${id}/deny`, {
        method: 'PUT',
        body: JSON.stringify(data || {}),
      });
    },
    getPendingAttendees: async () => {
      return authedFetch(`${API_URL}/api/admin/pending-attendees`)
    },
    waitlistAttendee: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/attendees/${id}/waitlist`, {
        method: 'PUT',
      });
    },
    approveBatch: async (eventId: string, attendeeIds: string[], approvedGuestsMap?: Record<string, number>) => {
      return authedFetch(`${API_URL}/api/admin/events/${eventId}/approve-batch`, {
        method: 'POST',
        body: JSON.stringify({ attendee_ids: attendeeIds, approved_guests_map: approvedGuestsMap }),
      });
    },
    getShareMessages: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/share`)
    },
    sendEmailInvites: async (_id: string, _data: Record<string, any>) => {
      throw new EmailDeliveryUnavailableError();
    },
    /** Email delivery is not configured for Release 1. */
    sendInvites: async (_eventId: string): Promise<{ sent: number; failed: number }> => {
      throw new EmailDeliveryUnavailableError();
    },
    /** Fetch the public tea menu for an event (no auth required). */
    getPublicTeaMenu: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/tea-menu`);
      if (!res.ok) return [];
      return res.json();
    },
    /** Email delivery is not configured for Release 1. */
    sendEventInvites: async (_eventId: string): Promise<{ sent: number; failed: number }> => {
      throw new EmailDeliveryUnavailableError();
    },
    getCustomerJourney: async (customerId: string) => {
      return authedFetch(`${API_URL}/api/admin/customers/${customerId}/journey`)
    },
    // V2: Interest capture
    registerInterest: async (slug: string, data: { name?: string; phone?: string; email?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    // F12: List interest signups for an event
    getInterestSignups: async (eventId: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${eventId}/interest`)
    },
    // F12: Convert interest signups to RSVPs
    convertInterestToRsvp: async (eventId: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${eventId}/convert-interest`, {
        method: 'POST',
      });
    },
    // F40: Create next recurring event occurrence
    createNextEventOccurrence: async (eventId: string, nextDate: string, slug: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${eventId}/create-next`, {
        method: 'POST',
        body: JSON.stringify({ next_date: nextDate, slug }),
      });
    },
    // F7: Mark event as complete and auto-draft invoices
    completeEvent: async (eventId: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${eventId}/complete`, {
        method: 'POST',
      });
    },
    // Public endpoints
    listPublic: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/events`);
      return handleResponse(res);
    },
    getPublic: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/public`);
      return handleResponse(res);
    },
    /** Fetch the public post-session recap for a completed event (no auth required). */
    getPublicRecap: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/recap`);
      return handleResponse(res);
    },
    getAvailability: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/availability`);
      return handleResponse(res);
    },
    uploadFlyer: async (file: File | Blob) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('teajia_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/upload-flyer`, {
        method: 'POST',
        headers,
        body: formData,
      });
      return handleResponse(res);
    },
  },

  venues: {
    list: async () => {
      return authedFetch(`${API_URL}/api/admin/venues`);
    },
    create: async (data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/venues`, {
        method: 'POST', body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/venues/${id}`, {
        method: 'PUT', body: JSON.stringify(data),
      });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/venues/${id}`, {
        method: 'DELETE',
      });
    },
    uploadPhoto: async (venueId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('teajia_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/admin/venues/${venueId}/photos`, {
        method: 'POST', headers, body: formData,
      });
      return handleResponse(res);
    },
    createSpace: async (venueId: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/venues/${venueId}/spaces`, {
        method: 'POST', body: JSON.stringify(data),
      });
    },
    updateSpace: async (venueId: string, spaceId: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/venues/${venueId}/spaces/${spaceId}`, {
        method: 'PUT', body: JSON.stringify(data),
      });
    },
    deleteSpace: async (venueId: string, spaceId: string) => {
      return authedFetch(`${API_URL}/api/admin/venues/${venueId}/spaces/${spaceId}`, {
        method: 'DELETE',
      });
    },
    getEvents: async (venueId: string) => {
      return authedFetch(`${API_URL}/api/admin/venues/${venueId}/events`)
    },
    listPublic: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/venues/public`);
      return handleResponse(res);
    },
  },

  savedLocations: {
    list: async () => {
      return authedFetch(`${API_URL}/api/admin/locations`)
    },
    create: async (data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/locations`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/locations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/locations/${id}`, {
        method: 'DELETE',
      });
    },
  },

  newsletter: {
    subscribe: async (email: string, source = 'website') => {
      const res = await fetchWithTimeout(`${API_URL}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      return handleResponse(res);
    },
    subscribers: async () => {
      return authedFetch(`${API_URL}/api/newsletter/subscribers`)
    },
  },

  rsvp: {
    submit: async (slug: string, data: Record<string, any>) => {
      const body = {
        full_name: data.fullName,
        phone_number: data.phoneNumber || undefined,
        email: data.email || undefined,
        contact_method: data.contactMethod,
        guest_requests: data.guests?.map((g: any) => ({
          nameHint: g.nameHint,
          contact: g.contact || undefined,
        })),
        notes: data.notes || undefined,
        show_in_guest_list: data.show_in_guest_list ? true : undefined,
      };
      return authedFetch(`${API_URL}/api/events/${slug}/rsvp`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    get: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
    update: async (token: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    claim: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
    getPostSession: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}/post-session`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
    submitTastingNotes: async (token: string, notes: Record<string, any>[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}/tasting-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      return handleResponse(res);
    },
    findByPhone: async (slug: string, phoneNumber: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/find-rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });
      return handleResponse(res);
    },
    findByEmail: async (slug: string, email: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/find-rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return handleResponse(res);
    },
    findByAccount: async (slug: string) => {
      const token = localStorage.getItem('teajia_token') || sessionStorage.getItem('teajia_token');
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/find-rsvp`, {
        method: 'POST',
        headers: {
          'Content-Length': '0',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      return handleResponse(res);
    },
    // V2: Cancel with optional note
    cancel: async (token: string, note?: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', cancellation_note: note }),
      });
      return handleResponse(res);
    },
    // V2: Mark first-visit briefing seen
    markBriefed: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_visit_briefed: 1 }),
      });
      return handleResponse(res);
    },
  },

  // V2: Guest invite single-use links
  guestInvites: {
    get: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/guest-invite/${token}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
    claim: async (token: string, data: { name: string; phone?: string; email?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/guest-invite/${token}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
  },

  // Verification codes power both event identity and passwordless sign-in.
  verify: {
    requestCode: async (contact: string, purpose: 'signin' | 'event' = 'event') => {
      const res = await fetchWithTimeout(`${API_URL}/api/verify/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, method: 'email', purpose }),
      });
      return handleResponse(res);
    },
    confirmCode: async (contact: string, code: string, purpose: 'signin' | 'event' = 'event') => {
      const res = await fetchWithTimeout(`${API_URL}/api/verify/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, code, purpose }),
      });
      const data = await handleResponse(res);
      if (purpose === 'signin' && typeof data?.token === 'string') {
        setToken(data.token);
        const claims = hydrateAccountStateFromToken();
        if (claims) {
          useAppStore.getState().setAuthUser({
            email: claims.email,
            username: claims.username ?? null,
            name: claims.name,
            role: claims.role,
          });
        }
      }
      return data;
    },
  },

  // V2: Guest journey (tea history, seals, impressions)
  journey: {
    get: async (contact: string, token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/journey/${encodeURIComponent(contact)}?token=${encodeURIComponent(token)}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await handleResponse(res);
      return {
        sessionsAttended: Number(data.sessions_attended ?? 0),
        totalTeas: Number(data.total_teas ?? 0),
        teaTypeMap: data.tea_type_map ?? {},
        favorites: data.favorites ?? [],
        impressions: (data.impressions ?? []).map((item: Record<string, unknown>) => ({
          text: item.text,
          teaName: item.tea_name,
          eventTitle: item.event_title,
          date: item.date,
        })),
        milestones: data.milestones ?? [],
        seals: (data.seals ?? []).map((item: Record<string, unknown>) => ({
          eventId: item.event_id,
          title: item.title,
          date: item.date,
          flyerUrl: item.flyer_url,
        })),
      };
    },
  },

  compass: {
    list: async (params?: { status?: string; vendor_id?: string }, options: ApiBackgroundOptions = {}) => {
      const qp = new URLSearchParams();
      if (params?.status) qp.set('status', params.status);
      if (params?.vendor_id) qp.set('vendor_id', params.vendor_id);
      const qs = qp.toString();
      return authedFetch(`${API_URL}/api/compass/entries${qs ? `?${qs}` : ''}`, options)
    },
    create: async (entry: CompassWrite) => {
      return authedFetch(`${API_URL}/api/compass/entries`, {
        method: 'POST',
        body: JSON.stringify(entry),
      });
    },
    update: async (id: string, updates: CompassWrite) => {
      // PUT by id, idempotent, safe to retry through a GFW timeout.
      return authedFetch(`${API_URL}/api/compass/entries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
        retryTimeouts: true,
      });
    },
    remove: async (id: string, options: ApiBackgroundOptions = {}) => {
      // DELETE by id, idempotent, safe to retry through a GFW timeout.
      return authedFetch(`${API_URL}/api/compass/entries/${id}`, {
        ...options,
        method: 'DELETE',
        retryTimeouts: true,
      });
    },
    sync: async (entries: CompassWrite[], options: ApiBackgroundOptions = {}): Promise<CompassSyncResult> => {
      // Worker uses an ownership-scoped upsert keyed by entry id, idempotent
      // without replacing server-owned or omitted fields.
      return authedFetch(`${API_URL}/api/compass/sync`, {
        ...options,
        method: 'POST',
        body: JSON.stringify({ entries }),
        retryTimeouts: true,
      });
    },
    /** Promote a compass entry to a Draft product in the active account.
     *  Idempotent, returns the existing product if already promoted. */
    promote: async (entryId: string, options: ApiBackgroundOptions = {}): Promise<{ id: string; product: Record<string, any>; alreadyPromoted: boolean }> => {
      return authedFetch(`${API_URL}/api/compass/entries/${entryId}/promote`, {
        ...options,
        method: 'POST',
        retryTimeouts: true,
      });
    },
    proposeReceipt: async (entryId: string, proposal: {
      purpose: 'working' | 'sample' | 'personal'; quantity: number; unit: 'g' | 'unit';
      acquisition_kind: 'purchase' | 'free_sample' | 'gift' | 'transfer' | 'other';
      idempotency_key: string; product_id?: string; batch_id?: string;
      product_name?: string; product_type?: string; import_id?: string; import_item_id?: string;
    }): Promise<CurateReceiptProposal> => authedFetch(`${API_URL}/api/compass/entries/${entryId}/receipt-proposals`, {
      method: 'POST', body: JSON.stringify(proposal), retryTimeouts: true,
    }),
    updateReceiptProposal: async (id: string, updates: Partial<Pick<CurateReceiptProposal,
      'product_id' | 'batch_id' | 'product_name' | 'product_type' | 'purpose' | 'quantity' | 'unit' | 'acquisition_kind'>>): Promise<CurateReceiptProposal> =>
      authedFetch(`${API_URL}/api/curate/receipt-proposals/${id}`, { method: 'PUT', body: JSON.stringify(updates), retryTimeouts: true }),
    acceptReceiptProposal: async (id: string): Promise<{ proposal: CurateReceiptProposal; product_id: string; ledger_id: string; alreadyAccepted: boolean }> =>
      authedFetch(`${API_URL}/api/curate/receipt-proposals/${id}/accept`, { method: 'POST', retryTimeouts: true }),
    rejectReceiptProposal: async (id: string): Promise<CurateReceiptProposal> =>
      authedFetch(`${API_URL}/api/curate/receipt-proposals/${id}/reject`, { method: 'POST', retryTimeouts: true }),
    /** Share a capture card to known accounts and/or generate an invite link for external tasters */
    share: async (params: {
      entryId: string;
      targetAccountIds?: string[];
      generateInviteLink?: boolean;
    }) => {
      return authedFetch(`${API_URL}/api/compass/share`, {
        method: 'POST',
        body: JSON.stringify({
          entry_id: params.entryId,
          target_account_ids: params.targetAccountIds,
          generate_invite_link: params.generateInviteLink,
        }),
      });
    },
    /** List pending incoming shares for the current account */
    getIncoming: async () => {
      return authedFetch(`${API_URL}/api/compass/incoming`)
    },
    /** Accept a direct-push share, creates a compass entry in caller's account */
    acceptShare: async (shareId: string) => {
      return authedFetch(`${API_URL}/api/compass/shares/${shareId}/accept`, {
        method: 'POST',
      });
    },
    /** Decline a direct-push share */
    declineShare: async (shareId: string) => {
      return authedFetch(`${API_URL}/api/compass/shares/${shareId}/decline`, {
        method: 'POST',
      });
    },
    /** Public, fetch share metadata from an invite token (no auth required) */
    getInvite: async (token: string) => {
      // Token is injected by authedFetch (if present), no extra headers needed.
      return authedFetch(`${API_URL}/api/compass/invite/${token}`);
    },
    /** Authenticated, claim an invite link into the caller's compass */
    claimInvite: async (token: string) => {
      return authedFetch(`${API_URL}/api/compass/invite/${token}/claim`, {
        method: 'POST',
      });
    },
    entryFeedback: async (entryId: string) => {
      return authedFetch(`${API_URL}/api/compass/entries/${entryId}/feedback`)
    },
    createTableShare: async (entryId: string) => {
      return authedFetch(`${API_URL}/api/compass/entries/${entryId}/table-share`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
  },

  curateContext: {
    listJourneys: (): Promise<{ journeys: CurateJourney[] }> => authedFetch(`${API_URL}/api/curate/journeys`),
    createJourney: (journey: Partial<CurateJourney>): Promise<CurateJourney> => authedFetch(`${API_URL}/api/curate/journeys`, { method: 'POST', body: JSON.stringify(journey) }),
    updateJourney: (id: string, updates: Partial<CurateJourney>): Promise<CurateJourney> => authedFetch(`${API_URL}/api/curate/journeys/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    deleteJourney: (id: string): Promise<{ success: true }> => authedFetch(`${API_URL}/api/curate/journeys/${id}`, { method: 'DELETE' }),
    listVisits: (journeyId?: string): Promise<{ visits: CurateVisit[] }> => authedFetch(`${API_URL}/api/curate/visits${journeyId ? `?journey_id=${encodeURIComponent(journeyId)}` : ''}`),
    createVisit: (visit: Partial<CurateVisit>): Promise<CurateVisit> => authedFetch(`${API_URL}/api/curate/visits`, { method: 'POST', body: JSON.stringify(visit) }),
    updateVisit: (id: string, updates: Partial<CurateVisit>): Promise<CurateVisit> => authedFetch(`${API_URL}/api/curate/visits/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    deleteVisit: (id: string): Promise<{ success: true }> => authedFetch(`${API_URL}/api/curate/visits/${id}`, { method: 'DELETE' }),
  },

  curateImports: {
    listIncomplete: (): Promise<{ imports: CurateImportDetail[] }> => authedFetch(`${API_URL}/api/curate/imports?state=incomplete`),
    create: (payload: {
      title: string; journey_id?: string; visit_id?: string;
      source_kind?: CurateImportSourceKind; pasted_text?: string;
      items?: Array<Partial<CurateImportItem>>;
      idempotency_key?: string;
    }): Promise<CurateImportDetail> => authedFetch(`${API_URL}/api/curate/imports`, { method: 'POST', body: JSON.stringify({ ...payload, idempotency_key: payload.idempotency_key || crypto.randomUUID() }), retryTimeouts: true }),
    get: (id: string): Promise<CurateImportDetail> => authedFetch(`${API_URL}/api/curate/imports/${id}`),
    addItem: (id: string, item: { name: string; category: 'tea' | 'teaware'; source_id?: string }): Promise<CurateImportItem> => authedFetch(`${API_URL}/api/curate/imports/${id}/items`, { method: 'POST', body: JSON.stringify(item) }),
    abandon: (id: string): Promise<{ success: true; review_state: 'abandoned' }> => authedFetch(`${API_URL}/api/curate/imports/${id}/abandon`, { method: 'POST', body: JSON.stringify({}) }),
    addSource: (id: string, source: { kind: CurateImportSourceKind; pasted_text?: string; r2_object_key?: string; metadata?: Record<string, unknown>; idempotency_key?: string }): Promise<CurateImportSource> =>
      authedFetch(`${API_URL}/api/curate/imports/${id}/sources`, { method: 'POST', body: JSON.stringify({ ...source, idempotency_key: source.idempotency_key || crypto.randomUUID() }), retryTimeouts: true }),
    uploadEvidence: (id: string, file: File, clientEvidenceId: string): Promise<CurateImportSource> => authedFetch(`${API_URL}/api/curate/imports/${id}/evidence`, {
      method: 'POST', body: file, headers: { 'Content-Type': file.type, 'X-Filename': encodeURIComponent(file.name), 'X-Client-Evidence-Id': clientEvidenceId },
    }),
    getEvidence: (batchId: string, sourceId: string): Promise<Blob> => authedBlobFetch(`${API_URL}/api/curate/imports/${batchId}/sources/${sourceId}/content`),
    analyze: (id: string, sourceIds?: string[]): Promise<CurateImportDetail> =>
      authedFetch(`${API_URL}/api/curate/imports/${id}/analyze`, { method: 'POST', body: JSON.stringify(sourceIds?.length ? { source_ids: sourceIds } : {}), retryTimeouts: false, timeoutMs: 120_000 }),
    updateGroup: (batchId: string, groupId: string, updates: { resolved_vendor_customer_id?: string | null; proposed_vendor_name?: string | null }): Promise<CurateImportVendorGroup> =>
      authedFetch(`${API_URL}/api/curate/imports/${batchId}/groups/${groupId}`, { method: 'PUT', body: JSON.stringify(updates), retryTimeouts: true }),
    createVendorForGroup: (batchId: string, groupId: string, vendor: { name: string; contact?: string | null }): Promise<CurateImportVendorGroup> =>
      authedFetch(`${API_URL}/api/curate/imports/${batchId}/groups/${groupId}/vendor`, { method: 'POST', body: JSON.stringify(vendor), retryTimeouts: true }),
    setJourney: (id: string, journeyId: string | null): Promise<CurateImportBatch> =>
      authedFetch(`${API_URL}/api/curate/imports/${id}/journey`, { method: 'PUT', body: JSON.stringify({ journey_id: journeyId }), retryTimeouts: true }),
    finalize: (id: string, idempotencyKey: string): Promise<CurateImportFinalizeResult> =>
      authedFetch(`${API_URL}/api/curate/imports/${id}/finalize`, { method: 'POST', body: JSON.stringify({ idempotency_key: idempotencyKey }), retryTimeouts: true }),
    updateItem: (batchId: string, itemId: string, updates: CurateImportItemUpdate): Promise<CurateImportItem> => {
      const richFields: Array<[keyof CurateImportItem, string]> = [
        ['english_name', 'englishName'], ['original_name', 'originalName'], ['pack_weight', 'packWeight'],
        ['weight_unit', 'weightUnit'], ['pack_count', 'packCount'], ['price_amount', 'priceAmount'],
        ['currency', 'currency'], ['price_basis', 'priceBasis'], ['total_quantity_grams', 'totalQuantityGrams'],
        ['total_units', 'totalUnits'], ['line_cost', 'lineCost'], ['unit_cost', 'unitCost'], ['blocking_fields', 'blockingFields'],
      ];
      const payload: Record<string, unknown> = { ...updates };
      const parsedData: Record<string, unknown> = { ...(updates.parsed_data || {}) };
      for (const [clientKey, serverKey] of richFields) if (clientKey in updates) { parsedData[serverKey] = updates[clientKey]; delete payload[clientKey]; }
      if (Object.keys(parsedData).length) payload.parsed_data = parsedData;
      return authedFetch(`${API_URL}/api/curate/imports/${batchId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(payload), retryTimeouts: true });
    },
    acceptItem: (batchId: string, itemId: string): Promise<CurateImportItem & { already_accepted?: boolean }> =>
      authedFetch(`${API_URL}/api/curate/imports/${batchId}/items/${itemId}/accept`, { method: 'POST', retryTimeouts: true }),
    mergeItem: (batchId: string, itemId: string, compassEntryId: string): Promise<CurateImportItem> =>
      authedFetch(`${API_URL}/api/curate/imports/${batchId}/items/${itemId}/merge`, { method: 'POST', body: JSON.stringify({ compass_entry_id: compassEntryId }), retryTimeouts: true }),
    chat: (importId: string, body: {
      item_id?: string | null;
      role: 'operator' | 'assistant' | 'agent' | 'system';
      body: string;
      asks_field?: string | null;
      answers_field?: string | null;
      answer_value?: string | number | boolean | null;
      answer_kind?: 'value' | 'unknown' | 'skip';
      origin?: 'web' | 'agent' | 'system';
    }): Promise<{ message_id: string; role: string; origin: string; item_version: number | null; item_id: string | null }> =>
      authedFetch(`${API_URL}/api/curate/imports/${importId}/chat`, { method: 'POST', body: JSON.stringify({ origin: 'web', ...body }), retryTimeouts: true }),
  },

  inquiries: {
    create: async (data: {
      tracking_token: string;
      ref_number: string;
      store_slug: string;
      customer_name: string;
      customer_contact: string;
      customer_location?: string;
      notes?: string;
      items_json: string;
      total_estimate_usd: number;
      currency: string;
      source: 'whatsapp' | 'email' | 'copy';
    }): Promise<{ id: string; ref_number: string; tracking_token: string; source: string; success: true; idempotent?: true }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(error?.error || 'Your order request could not be saved. Please try again.');
      }
      return res.json();
    },

    getByTrackingToken: async (token: string): Promise<{
      ref_number: string;
      items_json: string;
      status: string;
      total_estimate_usd: number;
      currency: string;
      created_at: string;
      // Null until the request has been priced into an invoice. There is
      // nothing to pay before that.
      payment: InvoicePayment | null;
      // Where the order stands, derived. `status` above is still the operator's
      // own filing word and is NOT what the customer should be shown.
      journey: OrderJourney;
    } | null> => {
      // The plaintext token is in the path, and the incident reporter files the
      // path it failed on. A signed-in customer hitting a 5xx here would come to
      // rest with their private order key in the incident ledger, which platform
      // admins read. The signature already carries category, method and status,
      // so the identifier adds nothing the report needs.
      const res = await fetchWithTimeout(`${API_URL}/api/inquiries/${encodeURIComponent(token)}`, { reportIncident: false });
      if (res.status === 404) return null;
      if (!res.ok) {
        const error = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(error?.error || 'Order tracking is temporarily unavailable.');
      }
      return res.json();
    },

    list: async (status?: InquiryStatus): Promise<{ inquiries: InquiryRecord[] }> => {
      const url = new URL(`${API_URL}/api/admin/inquiries`);
      if (status) url.searchParams.set('status', status);
      return authedFetch(url.toString());
    },

    // Turns a saved order request into a Draft invoice. Once only: a second call
    // throws an ApiError with status 409 whose `data.invoice_id` is the invoice
    // the request already became.
    convert: async (id: string): Promise<{ invoice_id: string; invoice_number: string }> => {
      return authedFetch(`${API_URL}/api/inquiries/${encodeURIComponent(id)}/convert`, {
        method: 'POST',
      });
    },

    updateStatus: async (id: string, status: InquiryStatus): Promise<{ success: true }> => {
      return authedFetch(`${API_URL}/api/admin/inquiries/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },

    // A customer on their tracking page saying they have sent payment. This is
    // a report: it moves no money and settles nothing until the tea house
    // confirms it. Scoped by the tracking token, like getByTrackingToken.
    reportPayment: async (token: string, input: PaymentClaimInput = {}): Promise<PaymentClaimResult> => {
      const res = await fetchWithTimeout(`${API_URL}/api/orders/${encodeURIComponent(token)}/payment-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(error?.error || 'That could not be sent. Please try again.');
      }
      return res.json();
    },
  },

  favorites: {
    get: async (): Promise<{ favorites: string[] }> => {
      return authedFetch(`${API_URL}/api/user/favorites`)
    },
    put: async (favorites: string[]): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/user/favorites`, {
        method: 'PUT',
        body: JSON.stringify({ favorites }),
      });
    },
  },

  // ── Samples ──
  samples: {
    // Public: get a single sample (source info stripped for non-admin)
    get: async (id: string) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = typeof localStorage !== 'undefined' && localStorage.getItem('teajia_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/samples/${id}`, { headers });
      return handleResponse(res);
    },
    // Public: get all samples in a set
    getSet: async (setId: string) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = typeof localStorage !== 'undefined' && localStorage.getItem('teajia_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/samples/set/${setId}`, { headers });
      return handleResponse(res);
    },
    // Public/guest: add a tasting to a sample
    addTasting: async (
      sampleId: string,
      data: SampleTastingApiWrite,
      options: ApiBackgroundOptions = {},
    ): Promise<SampleTastingApiRow> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = typeof localStorage !== 'undefined' && localStorage.getItem('teajia_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/samples/${sampleId}/tastings`, {
        ...options,
        method: 'POST',
        retryTimeouts: true,
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    // Customer: request a sample
    request: async (data: { product_id: string; quantity_grams: number; note?: string; account_id?: string }): Promise<{ id: string; set_id: string; status: string }> => {
      return authedFetch(`${API_URL}/api/samples/request`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    // Admin: list all samples
    list: async (
      params?: { setId?: string; status?: string },
      options: ApiBackgroundOptions = {},
    ): Promise<{ samples: SampleApiRow[] }> => {
      const qp = new URLSearchParams();
      if (params?.setId) qp.set('setId', params.setId);
      if (params?.status) qp.set('status', params.status);
      const qs = qp.toString();
      return authedFetch(`${API_URL}/api/admin/samples${qs ? `?${qs}` : ''}`, options)
    },
    create: async (sample: SampleApiWrite, options: ApiBackgroundOptions = {}): Promise<SampleApiRow> => {
      return authedFetch(`${API_URL}/api/admin/samples`, {
        ...options,
        method: 'POST',
        retryTimeouts: true,
        body: JSON.stringify(sample),
      });
    },
    update: async (id: string, updates: Partial<SampleApiWrite>, options: ApiBackgroundOptions = {}): Promise<SampleApiRow> => {
      return authedFetch(`${API_URL}/api/admin/samples/${id}`, {
        ...options,
        method: 'PUT',
        retryTimeouts: true,
        body: JSON.stringify(updates),
      });
    },
    remove: async (id: string, options: ApiBackgroundOptions = {}): Promise<{ success: true }> => {
      return authedFetch(`${API_URL}/api/admin/samples/${id}`, {
        ...options,
        method: 'DELETE',
        retryTimeouts: true,
      });
    },
  },

  tastingJournal: {
    list: async (options: ApiBackgroundOptions = {}) => {
      return authedFetch(`${API_URL}/api/tasting-journal`, options)
    },
    add: async (entry: any) => {
      return authedFetch(`${API_URL}/api/tasting-journal`, {
        method: 'POST',
        body: JSON.stringify(entry),
      });
    },
    remove: async (id: string) => {
      return authedFetch(`${API_URL}/api/tasting-journal/${id}`, {
        method: 'DELETE',
      });
    },
    sync: async (entries: any[], options: ApiBackgroundOptions = {}) => {
      return authedFetch(`${API_URL}/api/tasting-journal/sync`, {
        ...options,
        method: 'POST',
        body: JSON.stringify({ entries }),
      });
    },
    starCandidate: (entryId: string, noteKey: string, data: { source_text: string; source_tasting?: unknown }) =>
      authedFetch(`${API_URL}/api/tasting-journal/${entryId}/candidates/${encodeURIComponent(noteKey)}`, {
        method: 'PUT', body: JSON.stringify(data),
      }),
    unstarCandidate: (entryId: string, noteKey: string) =>
      authedFetch(`${API_URL}/api/tasting-journal/${entryId}/candidates/${encodeURIComponent(noteKey)}`, { method: 'DELETE' }),
  },

  tastingNoteCandidates: {
    list: (status = 'starred') => authedFetch(`${API_URL}/api/admin/tasting-note-candidates?status=${encodeURIComponent(status)}`),
    update: (id: string, data: { edited_text?: string; attribution_name?: string; attribution_detail?: string }) =>
      authedFetch(`${API_URL}/api/admin/tasting-note-candidates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    promote: (id: string, data: { edited_text: string; attribution_name: string; attribution_detail?: string }) =>
      authedFetch(`${API_URL}/api/admin/tasting-note-candidates/${id}/promote`, { method: 'POST', body: JSON.stringify(data) }),
    dismiss: (id: string) => authedFetch(`${API_URL}/api/admin/tasting-note-candidates/${id}/dismiss`, { method: 'POST' }),
  },

  productImpressions: {
    list: async (productId: string) => handleResponse(await fetchWithTimeout(`${API_URL}/api/products/${encodeURIComponent(productId)}/impressions`)),
  },

  wisdomVerifications: {
    get: (accountId: string, entryKind: WisdomEntryKind, entryId: string): Promise<WisdomVerificationReceipt | null> =>
      authedFetch(`${API_URL}/api/wisdom/verifications/${encodeURIComponent(entryKind)}/${encodeURIComponent(entryId)}`, {
        headers: { 'X-Teajia-Account': accountId },
      }),
    put: (accountId: string, entryKind: WisdomEntryKind, entryId: string, contentHash: string): Promise<WisdomVerificationReceipt> =>
      authedFetch(`${API_URL}/api/wisdom/verifications/${encodeURIComponent(entryKind)}/${encodeURIComponent(entryId)}`, {
        method: 'PUT',
        headers: { 'X-Teajia-Account': accountId },
        body: JSON.stringify({ content_hash: contentHash }),
      }),
    delete: (accountId: string, entryKind: WisdomEntryKind, entryId: string): Promise<WisdomVerificationReceipt | null> =>
      authedFetch(`${API_URL}/api/wisdom/verifications/${encodeURIComponent(entryKind)}/${encodeURIComponent(entryId)}`, {
        method: 'DELETE',
        headers: { 'X-Teajia-Account': accountId },
      }),
  },

  // Tea Discovery, the onboarding disposition profile (one per member, server-
  // persisted so it follows them across devices and the tea master can read it).
  teaDiscovery: {
    get: async () => {
      return authedFetch(`${API_URL}/api/tea-discovery`);
    },
    save: async (payload: {
      answers: Record<string, string | string[]>;
      level: string;
      dispositionId: string;
      dispositionName: string;
      completedAt: string;
    }) => {
      return authedFetch(`${API_URL}/api/tea-discovery`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
  },

  xref: {
    articles: {
      list: async (articleId: string) => {
        return authedFetch(`${API_URL}/api/xref/articles/${articleId}/products`);
      },
      link: async (articleId: string, productId: string) => {
        return authedFetch(`${API_URL}/api/xref/articles/${articleId}/products`, {
          method: 'POST', body: JSON.stringify({ product_id: productId }),
        });
      },
      unlink: async (articleId: string, productId: string) => {
        return authedFetch(`${API_URL}/api/xref/articles/${articleId}/products/${productId}`, {
          method: 'DELETE',
        });
      },
    },
    modules: {
      list: async (moduleId: string) => {
        return authedFetch(`${API_URL}/api/xref/modules/${moduleId}/products`);
      },
      link: async (moduleId: string, productId: string) => {
        return authedFetch(`${API_URL}/api/xref/modules/${moduleId}/products`, {
          method: 'POST', body: JSON.stringify({ product_id: productId }),
        });
      },
      unlink: async (moduleId: string, productId: string) => {
        return authedFetch(`${API_URL}/api/xref/modules/${moduleId}/products/${productId}`, {
          method: 'DELETE',
        });
      },
    },
    projects: {
      list: async (projectId: string) => {
        return authedFetch(`${API_URL}/api/xref/projects/${projectId}/products`);
      },
      link: async (projectId: string, productId: string) => {
        return authedFetch(`${API_URL}/api/xref/projects/${projectId}/products`, {
          method: 'POST', body: JSON.stringify({ product_id: productId }),
        });
      },
      unlink: async (projectId: string, productId: string) => {
        return authedFetch(`${API_URL}/api/xref/projects/${projectId}/products/${productId}`, {
          method: 'DELETE',
        });
      },
    },
  },

  // Public (no-auth) xref reads for Magazine / Learn / Advise colophons.
  // Returns PUBLIC_FIELDS products from the platform-owner account. Used by
  // the colophon components on public content pages.
  publicXref: {
    articles: async (articleId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/public/xref/articles/${encodeURIComponent(articleId)}/products`);
      if (!res.ok) return [];
      return handleResponse(res);
    },
    modules: async (moduleId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/public/xref/modules/${encodeURIComponent(moduleId)}/products`);
      if (!res.ok) return [];
      return handleResponse(res);
    },
    projects: async (projectId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/public/xref/projects/${encodeURIComponent(projectId)}/products`);
      if (!res.ok) return [];
      return handleResponse(res);
    },
    productArticles: async (productId: string): Promise<{ articles: Array<{ id: string; slug: string; title: string; subtitle?: string | null; author_name?: string | null }> }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/public/xref/products/${encodeURIComponent(productId)}/articles`);
      const data = await handleResponse(res);
      return { articles: Array.isArray(data?.articles) ? data.articles : [] };
    },
  },

  accounts: {
    getMine: async (): Promise<{ memberships: AccountMembership[]; active_account_id: string }> => {
      return authedFetch(`${API_URL}/api/accounts/me`)
    },
    switch: async (accountId: string): Promise<{ token: string }> => {
      const data = await authedFetch(`${API_URL}/api/accounts/switch`, {
        method: 'POST',
        body: JSON.stringify({ account_id: accountId }),
      });
      if (data?.token) setToken(data.token);
      return data;
    },
    get: async (id: string): Promise<Account> => {
      return authedFetch(`${API_URL}/api/accounts/${id}`)
    },
    update: async (id: string, updates: Partial<Account>): Promise<Account> => {
      return authedFetch(`${API_URL}/api/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    listMembers: async (id: string): Promise<AccountMember[]> => {
      return authedFetch(`${API_URL}/api/accounts/${id}/members`)
    },
    getActivity: async (
      id: string,
      params: { limit?: number; offset?: number } = {}
    ): Promise<{
      entries: Array<{
        id: string;
        action: string;
        actor_id: string | null;
        actor_email: string | null;
        target_type: string | null;
        target_id: string | null;
        details: Record<string, any> | string;
        created_at: string;
      }>;
      limit: number;
      offset: number;
    }> => {
      const qs = new URLSearchParams();
      if (params.limit != null) qs.set('limit', String(params.limit));
      if (params.offset != null) qs.set('offset', String(params.offset));
      const url = `${API_URL}/api/accounts/${id}/activity${qs.toString() ? `?${qs.toString()}` : ''}`;
      return authedFetch(url);
    },
    addMember: async (
      id: string,
      email: string,
      role: AccountRole
    ): Promise<AccountMember & { success?: boolean; created_user?: boolean; invite_link?: string | null }> => {
      return authedFetch(`${API_URL}/api/accounts/${id}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
    },
    updateMember: async (accountId: string, userId: string, role: AccountRole): Promise<void> => {
      await authedFetch(`${API_URL}/api/accounts/${accountId}/members/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
    },
    removeMember: async (accountId: string, userId: string): Promise<void> => {
      await authedFetch(`${API_URL}/api/accounts/${accountId}/members/${userId}`, {
        method: 'DELETE',
      });
    },
    updateMemberPermissions: async (accountId: string, userId: string, permissions: Record<string, boolean>): Promise<void> => {
      await authedFetch(`${API_URL}/api/accounts/${accountId}/members/${userId}/permissions`, {
        method: 'PUT', body: JSON.stringify(permissions),
      });
    },
    setCuratorFlag: async (accountId: string, userId: string, can_create_collections: boolean): Promise<void> => {
      await authedFetch(`${API_URL}/api/accounts/${accountId}/members/${userId}/curator`, {
        method: 'PUT', body: JSON.stringify({ can_create_collections }),
      });
    },
    transferOwnership: async (accountId: string, newOwnerUserId: string): Promise<void> => {
      await authedFetch(`${API_URL}/api/accounts/${accountId}/transfer-ownership`, {
        method: 'POST', body: JSON.stringify({ new_owner_user_id: newOwnerUserId }),
      });
    },
    // Members & Access, roster with bundle resolution per member
    getAccess: async (accountId: string): Promise<{ members: AccountMember[] }> => {
      return authedFetch(`${API_URL}/api/accounts/${accountId}/access`)
    },
    // Members & Access, replace a member's bundles wholesale
    setMemberBundles: async (accountId: string, userId: string, bundles: Bundle[]): Promise<void> => {
      await authedFetch(`${API_URL}/api/accounts/${accountId}/members/${userId}/bundles`, {
        method: 'PUT', body: JSON.stringify({ bundles }),
      });
    },
    getFeatures: async (accountId: string): Promise<Record<string, boolean>> => {
      const data = await authedFetch(`${API_URL}/api/accounts/${accountId}/features`)
      return (data?.features ?? data) as Record<string, boolean>;
    },
    // BYOK: per-account OpenAI API key. Plaintext is sent over HTTPS once,
    // encrypted server-side, and never returned again.
    setOpenAIKey: async (
      accountId: string,
      apiKey: string,
    ): Promise<{ has_openai_key: boolean; openai_key_last4: string | null }> => {
      return authedFetch(`${API_URL}/api/accounts/${accountId}/integrations/openai-key`, {
        method: 'PUT',
        body: JSON.stringify({ api_key: apiKey }),
      });
    },
    clearOpenAIKey: async (
      accountId: string,
    ): Promise<{ has_openai_key: boolean; openai_key_last4: string | null }> => {
      return authedFetch(`${API_URL}/api/accounts/${accountId}/integrations/openai-key`, {
        method: 'DELETE',
      });
    },
  },

  catalog: {
    list: async (): Promise<{ products: any[]; trust_tier: string }> => {
      return authedFetch(`${API_URL}/api/catalog`);
    },
  },

  network: {
    /** Public list of accounts with public_enabled = true */
    getStores: async (): Promise<Array<{ id: string; slug: string; name: string; tagline?: string; logo_url?: string; location_city?: string; location_country?: string }>> => {
      return authedFetch(`${API_URL}/api/network/stores`)
    },

    /**
     * GET /api/network/catalog
     * Returns profiles the caller does not yet carry, with computed wholesale price.
     * Requires Catalog bundle on caller account.
     */
    catalog: async (): Promise<{ profiles: import('../types').NetworkCatalogProfile[] }> => {
      return authedFetch(`${API_URL}/api/network/catalog`)
    },

    /**
     * GET /api/listings/:id
     * Returns the listing row + joined tea_profile for the caller's account.
     * Requires Catalog bundle. Returns 404 if not found or not owned by caller.
     */
    getListing: async (listingId: string): Promise<{
      listing: {
        id: string; account_id: string; profile_id: string;
        stock_grams: number | null; fixed_retail_price_usd: number | null;
        store_note: string | null; listing_photos: string[];
        is_sample: boolean; status: string; created_at: string;
      };
      profile: {
        id: string; slug: string; name: string; chinese_name?: string | null;
        type?: string | null; form?: string | null;
        origin_country?: string | null; origin_region?: string | null;
        varietal?: string | null; harvest_year?: string | null;
        description?: string | null; lore?: string | null;
        processing_notes?: string | null; terroir?: string | null;
        mood?: string | null; experience?: string | null;
        image_url?: string | null; canonical_photos: string[];
        status: string; curated_by_account_id: string;
        originated_by_account_id: string; curated_by_name?: string | null;
      };
    }> => {
      return authedFetch(`${API_URL}/api/listings/${listingId}`)
    },

    /**
     * PUT /api/listings/:id, update partner-owned listing fields
     * (stock_grams, fixed_retail_price_usd, store_note, is_sample).
     * No canonical fields. Catalog bundle required.
     */
    updateListing: async (
      listingId: string,
      patch: {
        stock_grams?: number;
        // Preferred: send price in the partner's display currency per 100g;
        // server converts to USD/gram via the exchange_rates table.
        price_amount?: number | null;
        price_currency?: string;
        // Legacy direct-USD shape; kept for backward compatibility.
        fixed_retail_price_usd?: number | null;
        store_note?: string | null;
        is_sample?: boolean;
      },
    ): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/listings/${listingId}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
    },

    /**
     * POST /api/listings/carry
     * Creates a listing for the given profile on the caller's account.
     * Copies canonical_photos into listing_photos. Requires Catalog bundle.
     */
    carryProfile: async (
      profileId: string,
      opts: import('../types').CarryProfileOpts,
    ): Promise<import('../types').CarryProfileResult> => {
      return authedFetch(`${API_URL}/api/listings/carry`, {
        method: 'POST',
        body: JSON.stringify({
          profile_id: profileId,
          initial_price_amount: opts.initial_price_amount,
          initial_price_currency: opts.initial_price_currency,
          initial_stock_grams: opts.initial_stock_grams,
        }),
      });
    },

    /**
     * POST /api/profiles/:id/suggestions
     * Partner submits a bundle of canonical edits against a tea profile.
     * fields: per-field changes the curator will review individually.
     */
    suggestEdits: async (
      profileId: string,
      fields: import('../types').ProfileSuggestionFieldDraft[],
    ): Promise<{ suggestion_id: string; field_count: number }> => {
      return authedFetch(`${API_URL}/api/profiles/${profileId}/suggestions`, {
        method: 'POST',
        body: JSON.stringify({ fields }),
      });
    },

    /**
     * GET /api/profiles/:id/suggestions
     * Curator-only on the profile. All bundles for one profile.
     */
    listProfileSuggestions: async (
      profileId: string,
    ): Promise<{ suggestions: import('../types').ProfileSuggestion[] }> => {
      return authedFetch(`${API_URL}/api/profiles/${profileId}/suggestions`)
    },

    /**
     * GET /api/suggestions/incoming
     * Curator's whole queue across all profiles they curate.
     * Default filter: pending + partial.
     */
    incomingSuggestions: async (
      status?: 'pending' | 'partial' | 'resolved' | 'withdrawn',
    ): Promise<{ suggestions: import('../types').ProfileSuggestion[] }> => {
      const url = new URL(`${API_URL}/api/suggestions/incoming`);
      if (status) url.searchParams.set('status', status);
      return authedFetch(url.toString());
    },

    /**
     * POST /api/suggestions/:id/decide
     * Per-field accept/reject. Accepted fields write to canonical immediately.
     */
    decideSuggestion: async (
      suggestionId: string,
      decisions: import('../types').ProfileSuggestionDecision[],
    ): Promise<{ suggestion_id: string; bundle_status: string; decisions_recorded: number }> => {
      return authedFetch(`${API_URL}/api/suggestions/${suggestionId}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decisions }),
      });
    },

    /** POST /api/network/profiles/:id/suggest-for-network, partner flags own profile */
    suggestForNetwork: async (profileId: string, note?: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/network/profiles/${profileId}/suggest-for-network`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
    },

    /** GET /api/network/adoption-queue?status=pending|adopted|declined: Platform tier */
    adoptionQueue: async (
      status: 'pending' | 'adopted' | 'declined' = 'pending',
    ): Promise<{ profiles: import('../types').AdoptionQueueEntry[] }> => {
      const url = new URL(`${API_URL}/api/network/adoption-queue`);
      url.searchParams.set('status', status);
      return authedFetch(url.toString());
    },

    /** POST /api/network/profiles/:id/adopt: Platform tier decides */
    decideAdoption: async (
      profileId: string,
      decision: 'adopted' | 'declined',
      decline_note?: string,
    ): Promise<{ ok: true; decision: string }> => {
      return authedFetch(`${API_URL}/api/network/profiles/${profileId}/adopt`, {
        method: 'POST',
        body: JSON.stringify({ decision, decline_note }),
      });
    },
  },

  /** Wholesale orders (Step 4), cross-account transactional layer. */
  wholesale: {
    /** POST /api/wholesale/orders, buyer creates a draft. */
    createOrder: async (
      body: import('../types').WholesaleOrderCreateBody,
    ): Promise<{ order_id: string }> => {
      return authedFetch(`${API_URL}/api/wholesale/orders`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    /** GET /api/wholesale/orders, list with optional role + status filters. */
    listOrders: async (
      opts: { role?: 'buyer' | 'supplier'; status?: import('../types').WholesaleOrderStatus } = {},
    ): Promise<{ orders: import('../types').WholesaleOrderSummary[] }> => {
      const url = new URL(`${API_URL}/api/wholesale/orders`);
      if (opts.role) url.searchParams.set('role', opts.role);
      if (opts.status) url.searchParams.set('status', opts.status);
      return authedFetch(url.toString());
    },

    /** GET /api/wholesale/orders/:id, detail + items + party accounts. */
    getOrder: async (orderId: string): Promise<import('../types').WholesaleOrderDetail> => {
      return authedFetch(`${API_URL}/api/wholesale/orders/${orderId}`)
    },

    /** PUT /api/wholesale/orders/:id, buyer edits draft (or replied). */
    updateOrder: async (
      orderId: string,
      patch: import('../types').WholesaleOrderUpdateBody,
    ): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/wholesale/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
    },

    /** POST /api/wholesale/orders/:id/transition, single dispatch for status changes. */
    transition: async (
      orderId: string,
      transition: import('../types').WholesaleTransitionBody,
    ): Promise<{ ok: true; status: string }> => {
      return authedFetch(`${API_URL}/api/wholesale/orders/${orderId}/transition`, {
        method: 'POST',
        body: JSON.stringify(transition),
      });
    },

    /** POST /api/wholesale/orders/:id/nudge, buyer reminds supplier. 24h throttle. */
    nudge: async (orderId: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/wholesale/orders/${orderId}/nudge`, {
        method: 'POST',
      });
    },
  },

  /** Account-wide contact tag queries (autocomplete + tag-aware picker). */
  customerTags: {
    listAll: async (): Promise<Array<{ tag: string; count: number }>> => {
      return authedFetch(`${API_URL}/api/customer-tags`)
    },
    customersByTag: async (tag: string): Promise<Array<{ id: string; name: string; phone?: string; whatsapp?: string }>> => {
      return authedFetch(`${API_URL}/api/customer-tags/${encodeURIComponent(tag)}/customers`)
    },
    /** Rename or merge a tag account-wide. Pass renameTo='' to delete everywhere. */
    rename: async (tag: string, renameTo: string): Promise<{ success: boolean }> => {
      return authedFetch(`${API_URL}/api/customer-tags/${encodeURIComponent(tag)}`, {
        method: 'PUT',
        body: JSON.stringify({ rename_to: renameTo }),
      });
    },
  },

  collections: {
    list: async (opts?: { status?: 'draft' | 'active' | 'archived'; productId?: string }): Promise<{ collections: import('../types').CollectionListRow[] }> => {
      const qs = new URLSearchParams();
      if (opts?.status) qs.set('status', opts.status);
      if (opts?.productId) qs.set('product_id', opts.productId);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return authedFetch(`${API_URL}/api/collections${suffix}`)
    },
    get: async (id: string): Promise<import('../types').CollectionDetail> => {
      return authedFetch(`${API_URL}/api/collections/${id}`)
    },
    create: async (data: { title: string; note?: string; hero_image_url?: string; initial_product_ids?: string[] }): Promise<{ id: string }> => {
      return authedFetch(`${API_URL}/api/collections`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, patch: Partial<{ title: string; note: string | null; hero_image_url: string | null; status: 'draft' | 'active' | 'archived' }>): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/collections/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
    },
    addItems: async (id: string, productIds: string[]): Promise<{ added: number; skipped: number }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/items`, {
        method: 'POST',
        body: JSON.stringify({ product_ids: productIds }),
      });
    },
    removeItem: async (id: string, itemId: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/items/${itemId}`, {
        method: 'DELETE',
      });
    },
    reorderItem: async (id: string, itemId: string, direction: 'up' | 'down'): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ direction }),
      });
    },
    /** Drag-and-drop reorder: commit a full ordered list of item ids in one call. */
    reorderItems: async (id: string, itemIds: string[]): Promise<{ ok: true }> => {
      // itemId in the path is unused by the array branch; send the first as a placeholder.
      return authedFetch(`${API_URL}/api/collections/${id}/items/${itemIds[0] ?? 'none'}`, {
        method: 'PUT',
        body: JSON.stringify({ item_ids: itemIds }),
      });
    },
    /** Update a single item's curator note and/or recommendation (quantity, price). */
    patchItem: async (
      id: string,
      itemId: string,
      patch: Partial<{ item_note: string | null; recommended_quantity: string | null; recommended_price_usd: number | null }>,
    ): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
    },
    publish: async (id: string, recipients: import('../types').CollectionRecipient[]): Promise<{ id: string; slug: string }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/publications`, {
        method: 'POST',
        body: JSON.stringify({ target_type: 'person', recipients }),
      });
    },
    publishToStore: async (id: string, targetAccountId: string): Promise<{ id: string; slug: string }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/publications`, {
        method: 'POST',
        body: JSON.stringify({ target_type: 'store', target_id: targetAccountId }),
      });
    },
    publishToTag: async (id: string, tag: string): Promise<{ id: string; slug: string }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/publications`, {
        method: 'POST',
        body: JSON.stringify({ target_type: 'tag', target_id: tag }),
      });
    },
    recentRecipients: async (days = 90, limit = 6): Promise<Array<{ customer_id: string; name: string; phone?: string; last_published_at: string }>> => {
      return authedFetch(`${API_URL}/api/collection-publications/recent-recipients?days=${days}&limit=${limit}`)
    },
    listInbound: async (): Promise<{ inbound: import('../types').InboundCollectionRow[]; unread_count: number }> => {
      return authedFetch(`${API_URL}/api/collections/inbound`)
    },
    getInbound: async (pubId: string): Promise<import('../types').InboundCollectionDetail> => {
      return authedFetch(`${API_URL}/api/collections/inbound/${pubId}`)
    },
    importInbound: async (pubId: string, productIds: string[]): Promise<{ imported: Array<{ source_id: string; new_id: string }>; skipped: number }> => {
      return authedFetch(`${API_URL}/api/collections/inbound/${pubId}/import`, {
        method: 'POST',
        body: JSON.stringify({ product_ids: productIds }),
      });
    },
    unpublish: async (id: string, pubId: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/publications/${pubId}`, {
        method: 'DELETE',
      });
    },
    needsAttention: async (): Promise<{ items: import('../types').NeedsAttentionItem[] }> => {
      return authedFetch(`${API_URL}/api/collections/needs-attention`)
    },
    /** Public, no auth. Used by /c/:slug page. */
    getPublic: async (slug: string): Promise<import('../types').PublicCollectionResponse> => {
      const res = await fetchWithTimeout(`${API_URL}/api/public/c/${slug}`, {});
      return handleResponse(res);
    },
    trackPublicView: async (slug: string): Promise<void> => {
      await fetchWithTimeout(`${API_URL}/api/public/c/${slug}/view`, { method: 'POST' });
    },
    /** Public, no auth. Recipient confirms their picks; creates a Draft invoice for the curator to review. */
    confirmPicks: async (
      slug: string,
      payload: { picks: Array<{ item_id: string; quantity: number; note?: string }>; contact_name?: string; contact_phone?: string },
    ): Promise<{ ok: true; invoice_number: string; item_count: number }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/public/c/${slug}/confirm`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },
    /** The logged-in user's saved/received collection shelf (cross-account). */
    listMine: async (): Promise<{ collections: import('../types').SavedCollectionRow[] }> => {
      return authedFetch(`${API_URL}/api/me/collections`)
    },
    /** Explicitly save a shared collection (by its publication slug) to my shelf. */
    saveMine: async (slug: string): Promise<{ ok: true; collection_id: string }> => {
      return authedFetch(`${API_URL}/api/me/collections/save`, {
        method: 'POST',
        body: JSON.stringify({ slug }),
      });
    },
    /** Best-effort: record that I (a logged-in user) opened a shared link, so it
     *  lands on my shelf as 'received'. Swallows errors, never blocks the view. */
    markReceived: async (slug: string): Promise<void> => {
      try {
        await authedFetch(`${API_URL}/api/me/collections/received`, {
          method: 'POST',
          body: JSON.stringify({ slug }),
        });
      } catch { /* not logged in or dead link, fine, this is opportunistic */ }
    },
    /** Remove a collection from my shelf. */
    unsaveMine: async (collectionId: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/me/collections/${collectionId}`, {
        method: 'DELETE',
      });
    },
    /** Publish a collection to the shop audience. Idempotent. */
    publishToShop: async (collectionId: string): Promise<{ publication: import('../types').CollectionPublication; created: boolean }> => {
      return authedFetch(`${API_URL}/api/collections/${collectionId}/publish-shop`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    /** Remove a collection from the shop audience. */
    unpublishFromShop: async (collectionId: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/collections/${collectionId}/unpublish-shop`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    /** Public, no auth. Returns the 20 most recently shop-published collections. */
    publicShop: async (): Promise<import('../types').PublicShopCollectionsResponse> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/shop`, {});
      return handleResponse(res);
    },
  },

  platform: {
    listUsers: async (): Promise<{ users: PlatformUser[] }> => {
      return authedFetch(`${API_URL}/api/platform/users`)
    },
    setUserPlatformRole: async (userId: string, platform_role: import('../types').PlatformRole): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/users/${userId}/platform-role`, {
        method: 'PUT',
        body: JSON.stringify({ platform_role }),
      });
    },
    // Stock spine step 5: grant/revoke a user's public shelf and set its slug.
    grantShelf: async (userId: string, data: { enabled: boolean; slug?: string }): Promise<{ ok: boolean; enabled: boolean; slug: string | null }> => {
      return authedFetch(`${API_URL}/api/platform/users/${userId}/shelf`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    listAccounts: async (): Promise<{ accounts: PlatformAccount[] }> => {
      return authedFetch(`${API_URL}/api/platform/accounts`)
    },
    // Stock spine step 3: read-only stock across every location.
    allStock: async (): Promise<{ stock: PlatformStockRow[] }> => {
      return authedFetch(`${API_URL}/api/platform/all-stock`)
    },
    toggleFeature: async (accountId: string, feature: string, enabled: boolean): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/accounts/${accountId}/features/${feature}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
    },
    setAccountStatus: async (accountId: string, status: 'active' | 'suspended'): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/accounts/${accountId}/status`, {
        method: 'PUT', body: JSON.stringify({ status }),
      });
    },
    setTrustTier: async (accountId: string, trust_tier: 'basic' | 'verified' | 'partner'): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/accounts/${accountId}/trust-tier`, {
        method: 'PUT', body: JSON.stringify({ trust_tier }),
      });
    },
    resendInvite: async (userId: string, account_name?: string): Promise<{ invite_link: string; email_sent: boolean }> => {
      return authedFetch(`${API_URL}/api/platform/users/${userId}/resend-invite`, {
        method: 'POST', body: JSON.stringify({ account_name }),
      });
    },
    getAuditLog: async (
      opts: { limit?: number; offset?: number; account_id?: string; actor_id?: string; action?: string } = {}
    ): Promise<{ entries: AuditLogEntry[]; limit: number; offset: number }> => {
      const params = new URLSearchParams();
      params.set('limit', String(opts.limit ?? 50));
      params.set('offset', String(opts.offset ?? 0));
      if (opts.account_id) params.set('account_id', opts.account_id);
      if (opts.actor_id) params.set('actor_id', opts.actor_id);
      if (opts.action) params.set('action', opts.action);
      return authedFetch(`${API_URL}/api/platform/audit-log?${params.toString()}`)
    },
    createAccount: async (data: {
      slug: string;
      name: string;
      invoice_prefix: string;
      location_city?: string;
      location_country?: string;
      currency_default?: string;
      timezone?: string;
      whatsapp_number?: string;
      contact_email?: string;
      owner_email?: string;
    }): Promise<{ account_id: string; slug: string; invite_link: string | null }> => {
      return authedFetch(`${API_URL}/api/platform/accounts`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    // ── Members & Access (Platform tier) ────────────────────────────────────
    listApplications: async (
      filters: { status?: AccountApplication['status']; kind?: 'location' | 'master' } = {}
    ): Promise<{ applications: AccountApplication[] }> => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.kind) params.set('kind', filters.kind);
      const qs = params.toString();
      return authedFetch(`${API_URL}/api/platform/applications${qs ? `?${qs}` : ''}`)
    },
    decideApplication: async (
      applicationId: string,
      decision: 'approve' | 'decline',
      opts: { decision_note?: string; trust_tier?: 'basic' | 'verified' | 'partner' } = {}
    ): Promise<{ success: true; account_id?: string; user_id?: string; claim_link?: string | null }> => {
      return authedFetch(`${API_URL}/api/platform/applications/${applicationId}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision, ...opts }),
      });
    },
    inviteTeaMaster: async (
      data: { email: string; name?: string; note?: string }
    ): Promise<{ success: true; account_id: string; user_id: string; claim_link: string | null; email_sent: boolean }> => {
      return authedFetch(`${API_URL}/api/platform/tea-masters/invite`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    upgradeToLocation: async (
      accountId: string,
      data: { location_name?: string; location_city?: string; location_country?: string; timezone?: string } = {}
    ): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/accounts/${accountId}/upgrade-to-location`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    suspendAccount: async (accountId: string, reason?: string): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/accounts/${accountId}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    reactivateAccount: async (accountId: string, note?: string): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/accounts/${accountId}/reactivate`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
    },

    // Exchange-rate admin (Platform tier only).
    listExchangeRates: async (): Promise<{
      rates: Array<{ currency: string; rate_to_usd: number; last_updated: string | null; usage_count: number }>;
    }> => {
      return authedFetch(`${API_URL}/api/platform/exchange-rates`)
    },
    createExchangeRate: async (data: { currency: string; rate_to_usd: number }): Promise<{
      success: true; currency: string; rate_to_usd: number;
    }> => {
      return authedFetch(`${API_URL}/api/platform/exchange-rates`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    updateExchangeRate: async (currency: string, rate_to_usd: number): Promise<{
      success: true; currency: string; rate_to_usd: number;
    }> => {
      return authedFetch(`${API_URL}/api/platform/exchange-rates/${encodeURIComponent(currency)}`, {
        method: 'PUT',
        body: JSON.stringify({ rate_to_usd }),
      });
    },
    deleteExchangeRate: async (currency: string): Promise<{ success: true }> => {
      return authedFetch(`${API_URL}/api/platform/exchange-rates/${encodeURIComponent(currency)}`, {
        method: 'DELETE',
      });
    },
  },

  sampleSets: {
    list: async (options: ApiBackgroundOptions = {}): Promise<{ sets: SampleSetApiRow[] }> => {
      return authedFetch(`${API_URL}/api/admin/sample-sets`, options)
    },
    create: async (set: SampleSetApiWrite, options: ApiBackgroundOptions = {}): Promise<SampleSetApiRow> => {
      return authedFetch(`${API_URL}/api/admin/sample-sets`, {
        ...options,
        method: 'POST',
        retryTimeouts: true,
        body: JSON.stringify(set),
      });
    },
    update: async (id: string, updates: Partial<SampleSetApiWrite>, options: ApiBackgroundOptions = {}): Promise<SampleSetApiRow> => {
      return authedFetch(`${API_URL}/api/admin/sample-sets/${id}`, {
        ...options,
        method: 'PUT',
        retryTimeouts: true,
        body: JSON.stringify(updates),
      });
    },
    remove: async (id: string, options: ApiBackgroundOptions = {}): Promise<{ success: true }> => {
      return authedFetch(`${API_URL}/api/admin/sample-sets/${id}`, {
        ...options,
        method: 'DELETE',
        retryTimeouts: true,
      });
    },
  },

  notes: {
    /** Push unsynced notes (upsert + soft-deletes) */
    sync: async (notes: Record<string, unknown>[], options: ApiBackgroundOptions = {}): Promise<void> => {
      const token = getToken();
      const res = await fetchWithTimeout(`${API_URL}/api/notes/sync`, {
        ...options,
        method: 'POST',
        retryTimeouts: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ notes }),
      });
      return handleResponse(res);
    },

    /** Push unsynced sessions */
    syncSessions: async (sessions: Record<string, unknown>[], options: ApiBackgroundOptions = {}): Promise<void> => {
      const token = getToken();
      const res = await fetchWithTimeout(`${API_URL}/api/note-sessions/sync`, {
        ...options,
        method: 'POST',
        retryTimeouts: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessions }),
      });
      return handleResponse(res);
    },

    /** Fetch all notes for the current account */
    getAll: async (options: ApiBackgroundOptions = {}): Promise<{ notes: Record<string, unknown>[] }> => {
      const token = getToken();
      const res = await fetchWithTimeout(`${API_URL}/api/notes`, {
        ...options,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      return handleResponse(res);
    },

    /** Fetch notes for a specific tea_key */
    forTea: async (teaKey: string): Promise<{ notes: Record<string, unknown>[] }> => {
      const token = getToken();
      const res = await fetchWithTimeout(`${API_URL}/api/notes?tea_key=${encodeURIComponent(teaKey)}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      return handleResponse(res);
    },

    /** Fetch notes for a compass entry (draft) */
    forCompassEntry: async (compassEntryId: string): Promise<{ notes: Record<string, unknown>[] }> => {
      const token = getToken();
      const res = await fetchWithTimeout(`${API_URL}/api/notes?compass_entry_id=${encodeURIComponent(compassEntryId)}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      return handleResponse(res);
    },
  },

  teaReviews: {
    list: async (params: {
      tea_key?: string;
      product_id?: string;
      source_sample_id?: string;
      visibility?: string;
    }) => {
      const qp = new URLSearchParams();
      if (params.tea_key) qp.set('tea_key', params.tea_key);
      if (params.product_id) qp.set('product_id', params.product_id);
      if (params.source_sample_id) qp.set('source_sample_id', params.source_sample_id);
      if (params.visibility) qp.set('visibility', params.visibility);
      return authedFetch(`${API_URL}/api/tea-reviews?${qp.toString()}`)
    },
    create: async (review: {
      tea_key: string;
      product_id?: string;
      source_sample_id?: string;
      visibility?: string;
      session_date?: string;
      rating?: number;
      notes?: string;
      voice_notes?: string[];
      tasting?: Record<string, unknown>;
      brew_params?: Record<string, unknown>;
      status?: 'draft' | 'submitted';
      verdict?: string;
      would_buy?: boolean;
    }) => {
      return authedFetch(`${API_URL}/api/tea-reviews`, {
        method: 'POST',
        body: JSON.stringify(review),
      });
    },
    update: async (id: string, updates: {
      visibility?: string;
      session_date?: string;
      rating?: number;
      notes?: string;
      voice_notes?: string[];
      tasting?: Record<string, unknown>;
      brew_params?: Record<string, unknown>;
      status?: 'draft' | 'submitted';
      verdict?: string;
      would_buy?: boolean;
    }) => {
      return authedFetch(`${API_URL}/api/tea-reviews/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    remove: async (id: string) => {
      return authedFetch(`${API_URL}/api/tea-reviews/${id}`, {
        method: 'DELETE',
      });
    },
  },

  me: {
    profile: async () => {
      return authedFetch(`${API_URL}/api/me/profile`);
    },
    queue: async () => {
      return authedFetch(`${API_URL}/api/me/queue`);
    },
    wishlist: async () => {
      return authedFetch(`${API_URL}/api/me/wishlist`);
    },
    journey: async () => {
      return authedFetch(`${API_URL}/api/me/journey`);
    },
    orders: async (): Promise<{
      orders: Array<{
        id: string;
        invoice_number: string;
        status: string;
        total_amount_usd: number;
        currency: string;
        created_at: string;
        line_items_count: number;
        payment: InvoicePayment | null;
        journey: OrderJourney | null;
      }>;
    }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/me/orders`, { headers: authHeaders() });
      return handleResponse(res);
    },
    order: async (id: string): Promise<CustomerOrderDetail & {
      payment: InvoicePayment | null;
      journey: OrderJourney | null;
    }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/me/orders/${encodeURIComponent(id)}`, { headers: authHeaders() });
      return handleResponse(res);
    },
    // The signed-in twin of inquiries.reportPayment. Same boundary: a report,
    // never a settlement.
    reportOrderPayment: async (id: string, input: PaymentClaimInput = {}): Promise<PaymentClaimResult> => {
      const res = await fetchWithTimeout(`${API_URL}/api/me/orders/${encodeURIComponent(id)}/payment-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      });
      return handleResponse(res);
    },
    samples: async (): Promise<{
      samples: Array<{
        id: string;
        status: string;
        sent_at: string;
        tea_name: string;
        notes: string | null;
      }>;
    }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/me/samples`, { headers: authHeaders() });
      return handleResponse(res);
    },
  },

  // Stock spine step 4: the personal cellar: location-less, person-owned stock.
  cellar: {
    list: async (): Promise<{ items: CellarItem[] }> => {
      return authedFetch(`${API_URL}/api/me/cellar`);
    },
    create: async (data: Partial<CellarItem> & { name: string }): Promise<{ item: CellarItem }> => {
      return authedFetch(`${API_URL}/api/me/cellar`, { method: 'POST', body: JSON.stringify(data) });
    },
    update: async (id: string, data: Partial<CellarItem>): Promise<{ item: CellarItem }> => {
      return authedFetch(`${API_URL}/api/me/cellar/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    remove: async (id: string): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/me/cellar/${id}`, { method: 'DELETE' });
    },
    requestPlacement: async (id: string, accountId: string): Promise<{ item: CellarItem }> => {
      return authedFetch(`${API_URL}/api/me/cellar/${id}/request-placement`, {
        method: 'POST', body: JSON.stringify({ account_id: accountId }),
      });
    },
    cancelPlacement: async (id: string): Promise<{ item: CellarItem }> => {
      return authedFetch(`${API_URL}/api/me/cellar/${id}/cancel-placement`, { method: 'POST' });
    },
    // Location-owner side, review and decide placement requests.
    listPlacements: async (): Promise<{ requests: CellarPlacementRequest[] }> => {
      return authedFetch(`${API_URL}/api/cellar-placements`);
    },
    approvePlacement: async (id: string): Promise<{ ok: boolean; product_id: string }> => {
      return authedFetch(`${API_URL}/api/cellar-placements/${id}/approve`, { method: 'POST' });
    },
    declinePlacement: async (id: string): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/cellar-placements/${id}/decline`, { method: 'POST' });
    },
    // Stock spine step 5: the standalone public shelf.
    getShelf: async (): Promise<ShelfSettings> => {
      return authedFetch(`${API_URL}/api/me/shelf`);
    },
    updateShelf: async (data: { title?: string; whatsapp?: string }): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/me/shelf`, { method: 'PUT', body: JSON.stringify(data) });
    },
    publishToShelf: async (id: string): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/me/cellar/${id}/publish-shelf`, { method: 'POST' });
    },
    unpublishFromShelf: async (id: string): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/me/cellar/${id}/unpublish-shelf`, { method: 'POST' });
    },
  },

  // Stock spine step 5: PUBLIC standalone shelf (no auth).
  shelf: {
    getPublic: async (slug: string): Promise<PublicShelf> => {
      const res = await fetchWithTimeout(`${API_URL}/api/shelf/${encodeURIComponent(slug)}`);
      return handleResponse(res);
    },
  },

  members: {
    search: async (q: string) => {
      return authedFetch(`${API_URL}/api/members/search?q=${encodeURIComponent(q)}`)
    },
  },

  sessions: {
    list: async (params?: { status?: 'active' | 'completed'; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.limit) qs.set('limit', String(params.limit));
      const url = `${API_URL}/api/sessions${qs.toString() ? `?${qs.toString()}` : ''}`;
      return authedFetch(url);
    },
    create: async (data: { title?: string; entry_ids?: string[]; product_ids?: string[]; member_ids?: string[] }) => {
      return authedFetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    issueJoinCode: async (sessionId: string): Promise<{ code: string; expires_at: string; reused?: boolean }> => {
      return authedFetch(`${API_URL}/api/auth/join-code/issue`, {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      });
    },
    revokeJoinCode: async (code: string) => {
      return authedFetch(`${API_URL}/api/auth/join-code/${code}/revoke`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    hostLive: async (id: string) => {
      return authedFetch(`${API_URL}/api/sessions/${id}/host-live`);
    },
    get: async (id: string) => {
      return authedFetch(`${API_URL}/api/sessions/${id}`);
    },
    getByToken: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/sessions/join/${token}`);
      return handleResponse(res);
    },
    join: async (id: string) => {
      return authedFetch(`${API_URL}/api/sessions/${id}/join`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    submitVerdict: async (sessionId: string, teaId: string, data: {
      verdict?: string;
      tasting_data?: Record<string, any>;
      notes?: string;
      would_buy?: boolean;
    }) => {
      return authedFetch(`${API_URL}/api/sessions/${sessionId}/teas/${teaId}/verdict`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    verdicts: async (id: string) => {
      return authedFetch(`${API_URL}/api/sessions/${id}/verdicts`);
    },
    complete: async (id: string) => {
      return authedFetch(`${API_URL}/api/sessions/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
  },

  connections: {
    list: async () => {
      return authedFetch(`${API_URL}/api/connections`);
    },
    invite: async (data: { to_user_id: string; pending_share_id?: string }) => {
      return authedFetch(`${API_URL}/api/connections/invite`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    acceptInvite: async (id: string) => {
      return authedFetch(`${API_URL}/api/connections/invites/${id}/accept`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
  },

  tableCard: {
    get: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/t/${token}`);
      return handleResponse(res);
    },
    submitVerdict: async (token: string, data: {
      browser_token: string;
      verdict: string;
      notes?: string;
      tasting_data?: Record<string, any>;
    }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/t/${token}/verdict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
  },

  articles: {
    // Admin
    list: async (status?: string): Promise<DbArticle[]> => {
      return authedFetch(`${API_URL}/api/admin/articles${status ? `?status=${status}` : ''}`);
    },
    get: async (id: string): Promise<DbArticle> => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}`)
    },
    create: async (data: Partial<DbArticle>): Promise<DbArticle> => {
      return authedFetch(`${API_URL}/api/admin/articles`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: Partial<DbArticle>): Promise<DbArticle> => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    publish: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}/publish`, {
        method: 'POST',
      });
    },
    unpublish: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}/unpublish`, {
        method: 'POST',
      });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}`, {
        method: 'DELETE',
      });
    },
    // Public
    listPublished: async (limit = 20, offset = 0) => {
      const res = await fetchWithTimeout(
        `${API_URL}/api/articles?limit=${limit}&offset=${offset}`
      );
      return handleResponse(res);
    },
    getBySlug: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/articles/${slug}`);
      return handleResponse(res);
    },
  },

  // Photos for hand-built Read story pages: a real image + pan/zoom crop per
  // named frame. Public read; admin-gated write (uses the same upload pipeline).
  storyPhotos: {
    get: async (slug: string): Promise<Record<string, { url: string; crop: { scale: number; x: number; y: number } }>> => {
      const res = await fetchWithTimeout(`${API_URL}/api/story-photos/${encodeURIComponent(slug)}`);
      return handleResponse(res);
    },
    put: async (
      slug: string,
      slot: string,
      image_url: string,
      crop: { scale: number; x: number; y: number },
    ): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/story-photos/${encodeURIComponent(slug)}/${encodeURIComponent(slot)}`, {
        method: 'PUT',
        body: JSON.stringify({ image_url, crop }),
      });
    },
    remove: async (slug: string, slot: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/story-photos/${encodeURIComponent(slug)}/${encodeURIComponent(slot)}`, {
        method: 'DELETE',
      });
    },
  },

  // Inline-editable story content for hand-built Read pages: per-field text +
  // photo overrides, a draft the owner edits freely, publish to go live, and a
  // version history for one-click undo. Public read returns published content.
  storyContent: {
    get: async (slug: string, state: 'published' | 'draft' = 'published'): Promise<any> => {
      if (state === 'draft') {
        return authedFetch(`${API_URL}/api/story-content/${encodeURIComponent(slug)}?state=draft`);
      }
      const res = await fetchWithTimeout(`${API_URL}/api/story-content/${encodeURIComponent(slug)}`);
      return handleResponse(res);
    },
    saveDraft: async (slug: string, content: any): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/story-content/${encodeURIComponent(slug)}/draft`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
    },
    publish: async (slug: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/story-content/${encodeURIComponent(slug)}/publish`, {
        method: 'POST',
      });
    },
    versions: async (slug: string): Promise<{ id: string; label: string | null; created_at: string }[]> => {
      return authedFetch(`${API_URL}/api/story-content/${encodeURIComponent(slug)}/versions`);
    },
    restore: async (slug: string, versionId: string): Promise<{ ok: true; content: any }> => {
      return authedFetch(`${API_URL}/api/story-content/${encodeURIComponent(slug)}/restore/${encodeURIComponent(versionId)}`, {
        method: 'POST',
      });
    },
  },

  profile: {
    getSelf: async (): Promise<SelfProfileResponse & { can_create?: boolean }> => {
      const data = await authedFetch(`${API_URL}/api/me/public-profile`);
      const row = data?.profile ?? data?.contributor ?? null;
      if (!row) return { profile: null, can_create: Boolean(data?.can_create) };
      const isPublished = Boolean(row.is_published);
      const accounts = Array.isArray(row.associations) ? row.associations : Array.isArray(row.accounts) ? row.accounts : [];
      return {
        can_create: Boolean(data?.can_create),
        profile: {
          id: String(row.id),
          slug: String(row.slug ?? row.id),
          display_name: String(row.display_name ?? ''),
          chinese_name: row.chinese_name ?? null,
          beginnings: row.beginnings ?? null,
          now_text: row.now_text ?? null,
          location_line: row.location_line ?? null,
          languages: Array.isArray(row.languages) ? row.languages.filter((item: unknown): item is string => typeof item === 'string') : [],
          avatar_url: row.avatar_url ?? null,
          portrait_url: row.portrait_url ?? null,
          links: Array.isArray(row.links) ? row.links : [],
          publication_state: row.publication_state ?? (isPublished ? 'published' : 'draft'),
          approval_state: row.approval_state ?? (isPublished ? 'approved' : 'pending'),
          is_published: isPublished,
          has_pending_draft: Boolean(row.has_pending_draft),
          reviewer_note: row.reviewer_note ?? null,
          selection_count: Number.isFinite(Number(row.selection_count)) ? Number(row.selection_count) : 0,
          article_count: Number.isFinite(Number(row.article_count)) ? Number(row.article_count) : 0,
          shelf_slug: row.shelf_slug ?? null,
          associations: accounts.map((account: any) => ({
            account_id: String(account.account_id ?? account.id ?? ''),
            account_slug: String(account.account_slug ?? account.slug ?? ''),
            account_name: String(account.account_name ?? account.name ?? ''),
            public_role: account.public_role ?? null,
            is_host: Boolean(account.is_host),
            display_order: Number.isFinite(Number(account.display_order)) ? Number(account.display_order) : 0,
            account_kind: account.account_kind ?? undefined,
          })),
        },
      };
    },
    updateSelf: async (data: SelfProfileUpdate & { id?: string }): Promise<{ contributor?: unknown; profile?: unknown }> => {
      return authedFetch(`${API_URL}/api/me/public-profile`, { method: 'PUT', body: JSON.stringify(data) });
    },
    uploadImage: async (image: File | Blob, slot: 'portrait' | 'avatar' = 'portrait'): Promise<string> => {
      const formData = new FormData();
      formData.append('file', image, image instanceof File ? image.name : 'profile.jpg');
      formData.append('slot', slot);
      const data = await authedFetch(`${API_URL}/api/me/public-profile/image`, { method: 'POST', body: formData });
      return String(data.url);
    },
    unpublishSelf: async (): Promise<{ success: true }> => {
      return authedFetch(`${API_URL}/api/me/public-profile/unpublish`, { method: 'POST' });
    },
    listFavorites: async (): Promise<{ favorites: ProfileFavorite[]; available_teas: import('../components/profile/types').FavoriteTea[] }> => {
      const data = await authedFetch(`${API_URL}/api/me/profile/favorites`);
      return {
        favorites: (Array.isArray(data?.favorites) ? data.favorites : []).map((row: any) => normalizeProfileFavorite(row)),
        available_teas: (Array.isArray(data?.available_teas) ? data.available_teas : []).map((tea: any) => ({
          id: String(tea?.id ?? ''),
          name: String(tea?.name ?? 'Tea'),
          chinese_name: tea?.chinese_name ?? null,
          type: tea?.type ?? null,
          year: Number.isFinite(Number(tea?.year)) ? Number(tea.year) : null,
          origin: tea?.origin ?? null,
          image_url: tea?.image_url ?? null,
          public_path: tea?.public_path ?? null,
          is_public: Boolean(tea?.is_public),
          source_account_id: tea?.source_account_id ?? null,
          source_product_id: tea?.source_product_id ?? null,
          source_listing_id: tea?.source_listing_id ?? null,
        })),
      };
    },
    createFavorite: async (favorite: FavoriteWrite): Promise<{ success: true }> => {
      return authedFetch(`${API_URL}/api/me/profile/favorites`, { method: 'POST', body: JSON.stringify(favorite) });
    },
    updateFavorite: async (teaProfileId: string, favorite: FavoriteWrite): Promise<{ success: true }> => {
      return authedFetch(`${API_URL}/api/me/profile/favorites/${encodeURIComponent(teaProfileId)}`, { method: 'PUT', body: JSON.stringify(favorite) });
    },
    deleteFavorite: async (teaProfileId: string): Promise<{ success: true }> => {
      return authedFetch(`${API_URL}/api/me/profile/favorites/${encodeURIComponent(teaProfileId)}`, { method: 'DELETE' });
    },
    reorderFavorites: async (teaProfileIds: string[]): Promise<{ success: true }> => {
      return authedFetch(`${API_URL}/api/me/profile/favorites/order`, { method: 'PUT', body: JSON.stringify({ tea_profile_ids: teaProfileIds }) });
    },
    listPaymentMethods: async (): Promise<{ methods: PaymentMethod[] }> => {
      const data = await authedFetch(`${API_URL}/api/me/profile/payment-methods`);
      const rows = Array.isArray(data?.methods) ? data.methods : Array.isArray(data?.payment_methods) ? data.payment_methods : [];
      return { methods: rows.map(normalizePaymentMethod) };
    },
    createPaymentMethod: async (method: PaymentMethodWrite): Promise<{ payment_method: PaymentMethod }> => {
      const data = await authedFetch(`${API_URL}/api/me/profile/payment-methods`, { method: 'POST', body: JSON.stringify(method) });
      return { payment_method: normalizePaymentMethod(data?.payment_method) };
    },
    updatePaymentMethod: async (id: string, method: PaymentMethodWrite): Promise<{ payment_method: PaymentMethod }> => {
      const data = await authedFetch(`${API_URL}/api/me/profile/payment-methods/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(method) });
      return { payment_method: normalizePaymentMethod(data?.payment_method) };
    },
    deletePaymentMethod: async (id: string): Promise<{ success: true }> => {
      return authedFetch(`${API_URL}/api/me/profile/payment-methods/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    getPublicFavorites: async (slug: string): Promise<PublicFavoritesResponse> => {
      const [favoritesResponse, contributorResponse] = await Promise.all([
        fetchWithTimeout(`${API_URL}/api/public/people/${encodeURIComponent(slug)}/favorites`).then(handleResponse),
        fetchWithTimeout(`${API_URL}/api/people/${encodeURIComponent(slug)}`).then(handleResponse),
      ]);
      return {
        contributor: {
          slug,
          display_name: String(contributorResponse?.display_name ?? slug),
          portrait_url: contributorResponse?.portrait_url ?? contributorResponse?.avatar_url ?? null,
          associations: (Array.isArray(contributorResponse?.accounts) ? contributorResponse.accounts : []).map((account: any) => ({
            account_id: String(account.account_id ?? account.id ?? account.slug ?? ''),
            account_slug: String(account.account_slug ?? account.slug ?? ''),
            account_name: String(account.account_name ?? account.name ?? ''),
            public_role: account.public_role ?? null,
            is_host: Boolean(account.is_host),
            display_order: Number.isFinite(Number(account.display_order)) ? Number(account.display_order) : 0,
            account_kind: account.account_kind ?? undefined,
          })),
        },
        favorites: (Array.isArray(favoritesResponse?.favorites) ? favoritesResponse.favorites : []).map((row: any) => normalizeProfileFavorite(row, true)),
      };
    },
    getPublicPaymentMethods: async (
      slug: string,
      accountSlug?: string | null,
      // The payment details off the pay link. `amount` is the dollar figure
      // that is owed and stays authoritative; `display` is the currency the
      // customer was quoted in, and asks the worker for an approximation of
      // that same money in it. Both are forwarded, never computed here.
      context?: { amount?: string | null; display?: string | null },
    ): Promise<PublicPaymentMethodsResponse> => {
      const params = new URLSearchParams();
      // The public route contract calls this context "account". The current
      // Worker also accepts it under its compatibility name, "store".
      if (accountSlug) { params.set('account', accountSlug); params.set('store', accountSlug); }
      if (context?.amount) params.set('amount', context.amount);
      if (context?.display) params.set('display', context.display);
      const suffix = params.size ? `?${params.toString()}` : '';
      const data = await fetchWithTimeout(`${API_URL}/api/public/people/${encodeURIComponent(slug)}/payment-methods${suffix}`).then(handleResponse);
      const rows = Array.isArray(data?.methods) ? data.methods : Array.isArray(data?.payment_methods) ? data.payment_methods : [];
      const account = data?.account ?? data?.store ?? data?.resolved_store ?? null;
      const associationRows = Array.isArray(data?.available_accounts)
        ? data.available_accounts
        : Array.isArray(data?.associations)
        ? data.associations
        : Array.isArray(data?.accounts)
          ? data.accounts
          : Array.isArray(data?.contributor?.accounts)
            ? data.contributor.accounts
            : Array.isArray(data?.contributor?.associations)
              ? data.contributor.associations
              : [];
      return {
        contributor: {
          slug,
          display_name: String(data?.contributor?.display_name ?? slug),
          portrait_url: data?.contributor?.portrait_url ?? null,
          associations: associationRows.map((account: any) => ({
            account_id: String(account.account_id ?? account.id ?? account.slug ?? ''),
            account_slug: String(account.account_slug ?? account.slug ?? ''),
            account_name: String(account.account_name ?? account.name ?? ''),
            public_role: account.public_role ?? null,
            is_host: Boolean(account.is_host),
            display_order: Number.isFinite(Number(account.display_order)) ? Number(account.display_order) : 0,
            account_kind: account.account_kind ?? undefined,
          })),
        },
        account: account ? { slug: String(account.slug), name: String(account.name) } : null,
        resolution: data?.resolution === 'account' ? 'account' : 'default',
        hasAnyMethod: data?.has_any_method === true,
        methods: rows.map(normalizePaymentMethod),
        // Passed through rather than rebuilt. This mapper hand-writes its
        // result, so a field the worker adds reaches nothing until it is named
        // here, and dropping one raises no type error at all.
        context: data?.context ?? null,
      };
    },
  },

  people: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/people`);
      return handleResponse(res);
    },
    getBySlug: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/people/${encodeURIComponent(slug)}`);
      return handleResponse(res);
    },
    getRelationshipAudit: async () => {
      return authedFetch(`${API_URL}/api/admin/people/relationship-audit`)
    },
    applyRelationshipAudit: async () => {
      return authedFetch(`${API_URL}/api/admin/people/relationship-audit/apply`, {
        method: 'POST',
      });
    },
    listAdminContributors: async (): Promise<{ contributors: AdminContributor[] }> => {
      return authedFetch(`${API_URL}/api/admin/contributors`)
    },
    listContributorOptions: async (): Promise<{ contributors: ContributorOption[] }> => {
      return authedFetch(`${API_URL}/api/admin/contributor-options`)
    },
    createContributor: async (data: ContributorWrite): Promise<{ contributor: AdminContributor }> => {
      return authedFetch(`${API_URL}/api/admin/contributors`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    getAdminContributor: async (contributorId: string): Promise<{ contributor: AdminContributor }> => {
      return authedFetch(`${API_URL}/api/admin/contributors/${encodeURIComponent(contributorId)}`);
    },
    updateContributor: async (contributorId: string, data: ContributorWrite): Promise<{ contributor: AdminContributor }> => {
      return authedFetch(`${API_URL}/api/admin/contributors/${encodeURIComponent(contributorId)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    publishContributor: async (contributorId: string): Promise<{ contributor: AdminContributor }> => {
      return authedFetch(`${API_URL}/api/admin/contributors/${encodeURIComponent(contributorId)}/publish`, { method: 'POST' });
    },
    unpublishContributor: async (contributorId: string): Promise<{ contributor: AdminContributor }> => {
      return authedFetch(`${API_URL}/api/admin/contributors/${encodeURIComponent(contributorId)}/unpublish`, { method: 'POST' });
    },
    getContributorAccounts: async (contributorId: string): Promise<{ accounts: import('../types').ContributorAccountRef[] }> => {
      return authedFetch(`${API_URL}/api/admin/contributors/${encodeURIComponent(contributorId)}/accounts`);
    },
    updateContributorAccounts: async (contributorId: string, accounts: Array<{ account_id: string; public_role: string | null; is_host: boolean; display_order: number }>): Promise<{ accounts: import('../types').ContributorAccountRef[] }> => {
      return authedFetch(`${API_URL}/api/admin/contributors/${encodeURIComponent(contributorId)}/accounts`, {
        method: 'PUT',
        body: JSON.stringify({ accounts }),
      });
    },
    requestContributorChanges: async (contributorId: string, note: string): Promise<{ contributor: AdminContributor }> => {
      return authedFetch(`${API_URL}/api/admin/contributors/${encodeURIComponent(contributorId)}/request-changes`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
    },
    updateContributorContact: async (contributorId: string, customerId: string | null) => {
      return authedFetch(`${API_URL}/api/admin/contributors/${encodeURIComponent(contributorId)}/contact`, {
        method: 'PUT',
        body: JSON.stringify({ customer_id: customerId }),
      });
    },
  },

};
