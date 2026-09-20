export type ProfilePublicationState = 'draft' | 'awaiting_approval' | 'published' | 'unpublished';
export type ProfileApprovalState = 'pending' | 'approved' | 'changes_requested';

// Mirrors worker/src/profileDomain.ts's ContributorLink (migration 0021):
// a platform-typed link rather than a flat {label,url} pair, so a WeChat
// entry can carry an id plus an optional QR image instead of a URL.
export const CONTRIBUTOR_LINK_PLATFORMS = ['wechat', 'instagram', 'website', 'other'] as const;
export type ContributorLinkPlatform = typeof CONTRIBUTOR_LINK_PLATFORMS[number];

export interface ProfileLink {
  platform: ContributorLinkPlatform;
  value: string;
  label?: string;
  qr_image_url: string | null;
}

export interface ProfileGalleryImage {
  id?: string;
  image_url: string;
  caption: string | null;
  position?: number;
}

export interface ProfileAssociation {
  account_id: string;
  account_slug: string;
  account_name: string;
  public_role: string | null;
  is_host: boolean;
  display_order?: number;
  account_kind?: 'platform' | 'location' | 'master';
}

export interface SelfProfile {
  id: string;
  slug: string;
  display_name: string;
  business_name: string | null;
  chinese_name: string | null;
  beginnings: string | null;
  now_text: string | null;
  location_line: string | null;
  languages: string[];
  avatar_url: string | null;
  portrait_url: string | null;
  links: ProfileLink[];
  gallery_images: ProfileGalleryImage[];
  publication_state: ProfilePublicationState;
  approval_state: ProfileApprovalState;
  has_pending_draft?: boolean;
  reviewer_note?: string | null;
  is_published: boolean;
  associations: ProfileAssociation[];
  selection_count?: number;
  article_count?: number;
  shelf_slug?: string | null;
}

export type SelfProfileUpdate = Pick<
  SelfProfile,
  | 'display_name'
  | 'business_name'
  | 'chinese_name'
  | 'beginnings'
  | 'now_text'
  | 'location_line'
  | 'languages'
  | 'avatar_url'
  | 'portrait_url'
  | 'links'
>;

export interface FavoriteTea {
  id: string;
  name: string;
  chinese_name?: string | null;
  type?: string | null;
  year?: number | null;
  origin?: string | null;
  image_url?: string | null;
  public_path?: string | null;
  is_public: boolean;
  source_account_id?: string | null;
  source_product_id?: string | null;
  source_listing_id?: string | null;
}

export interface ProfileFavorite {
  tea_profile_id: string;
  source_account_id?: string | null;
  source_product_id?: string | null;
  source_listing_id?: string | null;
  note: string | null;
  position: number;
  is_public: boolean;
  tea: FavoriteTea;
}

export interface FavoriteWrite {
  tea_profile_id: string;
  source_account_id?: string | null;
  source_product_id?: string | null;
  source_listing_id?: string | null;
  note?: string | null;
  is_public: boolean;
}

export type PaymentMethodType = 'bank_transfer' | 'payment_link' | 'provider_qr' | 'other';

export interface PaymentMethod {
  id: string;
  account_id: string | null;
  method_type: PaymentMethodType;
  label: string;
  recipient_name: string;
  account_identifier: string | null;
  instructions: string | null;
  external_url: string | null;
  qr_image_url: string | null;
  position: number;
  is_published: boolean;
}

export type PaymentMethodWrite = Omit<PaymentMethod, 'id' | 'position'> & { id?: string; position?: number };

export interface PaymentContext {
  amount: string | null;
  currency: string | null;
  reference: string | null;
  /**
   * The currency the customer actually transfers in, off `&display=` on the pay
   * link. Never the currency the order is owed in, which stays `currency` and
   * stays authoritative. Null when the link carried none, when it carried one
   * that is not supported, or when it carried the same currency the order is
   * already priced in.
   */
  display: string | null;
  errors: string[];
}

/**
 * The worker's conversion of the amount owed into the customer's own currency.
 *
 * An approximation, and labelled as one wherever it is rendered. `rate` and
 * `as_of` are what make that claim honest rather than a disclaimer: the figure
 * came from a rate that was true at a stated moment and has been drifting since.
 */
export interface PaymentLocalAmount {
  currency: string;
  amount: string;
  rate: number;
  as_of: string;
}

export interface PublicFavoritesResponse {
  contributor: { slug: string; display_name: string; portrait_url?: string | null; associations?: ProfileAssociation[] };
  favorites: ProfileFavorite[];
}

export interface PublicPaymentMethodsResponse {
  contributor: { slug: string; display_name: string; portrait_url?: string | null; associations?: ProfileAssociation[] };
  account: { slug: string; name: string } | null;
  resolution?: 'account' | 'default';
  hasAnyMethod?: boolean;
  methods: PaymentMethod[];
  /**
   * What the worker made of the payment details on the link it was called with.
   * `local` is null whenever the conversion could not honestly be made: an
   * unknown or unsupported currency, no live rate, or a link already priced in
   * the currency the customer would transfer in.
   */
  context?: { local: PaymentLocalAmount | null } | null;
}

export interface SelfProfileResponse {
  profile: SelfProfile | null;
  can_publish?: boolean;
}

export interface ProfileFavoritesResponse {
  favorites: ProfileFavorite[];
  available_teas?: FavoriteTea[];
}

export interface PaymentMethodsResponse {
  methods: PaymentMethod[];
}

export interface PaymentOrderLine {
  name: string;
  /** Already formatted for display: "100g" for tea, "×2" for anything else. */
  quantity: string;
}

export interface PaymentOrderSummaryData {
  lines: PaymentOrderLine[];
  placedOn: string | null;
}
