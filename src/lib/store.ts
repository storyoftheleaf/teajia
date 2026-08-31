import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem as AdminCartItem, Currency, Product } from '../admin/types';
import { Account, AccountMembership, CartItem as PublicCartItem, CustomerTasting, PlatformRole } from '../types';
import type { TeaDiscoveryProfile } from '../components/TeaDiscovery/types';
import { canAddToStoreCart } from './publicCartDomain';
import { quoteGrams } from './teaPricing';

/**
 * What one cart line costs.
 *
 * Every path here used to write `pricePerGram * grams`, which is not the price:
 * the curve folds a handling fee into everything except an unbroken piece, so
 * the shop quoted $42 for 200g and the cart stored $40, and a second add or a
 * quantity change silently rewrote a correct total into a wrong one. Teaware is
 * priced per piece and has no curve, so it keeps the multiplication.
 */
function lineTotal(item: PublicCartItem, grams: number): number {
  if (item.category !== 'tea') return item.pricePerGram * grams;
  return Math.ceil(quoteGrams(item.pricePerGram, grams, { wholePieceGrams: item.wholePieceGrams }).totalUsd);
}

export interface AuthUser {
  email: string;
  username: string | null;
  name: string;
  role: string;
  phone?: string | null;
  canCreateCollections?: boolean;
}

/** A half-filled product captured by the AddProductModal auto-save. */
export type DraftProduct = Partial<Product>;

/**
 * The two rooms of the desktop sidebar. 'browse' is the storefront (the same
 * four sections the mobile tab bar carries); 'manage' is the workshop. Only
 * one is visible at a time, which is what keeps the column from stacking two
 * navigation systems on top of each other.
 */
export type SidebarRoom = 'browse' | 'manage';

interface InventoryViewConfig {
  id: string;
  name: string;
  icon?: string | null;
  columns: string[];
  sortConfig: { key: string; direction: 'asc' | 'desc' }[];
  filterType: string;
  groupBy: string | null;
}

interface AppState {
  // Admin Cart / Transaction Builder (for invoice builder + purchase orders)
  cart: AdminCartItem[];
  isCartOpen: boolean;
  cartDirection: 'sale' | 'purchase';
  cartVendorName: string;
  cartSourceEventId: string | null;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setCart: (cart: AdminCartItem[]) => void;
  setIsCartOpen: (isOpen: boolean) => void;
  setCartDirection: (direction: 'sale' | 'purchase') => void;
  setCartVendorName: (name: string) => void;
  setCartSourceEventId: (eventId: string | null) => void;
  openPurchaseOrder: (vendorName?: string) => void;

  // Public Cart (for customer checkout)
  publicCart: PublicCartItem[];
  isPublicCartOpen: boolean;
  addToPublicCart: (item: PublicCartItem) => void;
  removeFromPublicCart: (id: string) => void;
  updatePublicCartQuantity: (id: string, grams: number) => void;
  clearPublicCart: () => void;
  setIsPublicCartOpen: (isOpen: boolean) => void;

  // Global Settings
  currency: Currency;
  setCurrency: (currency: Currency) => void;

  // Admin State
  isDevAdmin: boolean;
  toggleDevAdmin: () => void;
  setDevAdmin: (isAdmin: boolean) => void;

  // AI Settings
  aiPromptTemplate: string;
  setAiPromptTemplate: (prompt: string) => void;

  // Favorite Teas (shareable collection)
  favoriteTeas: string[];
  toggleFavoriteTea: (id: string) => void;
  clearFavoriteTeas: () => void;
  mergeFavorites: (serverFavorites: string[]) => void;

  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  // Which room the desktop sidebar is showing: the storefront a visitor
  // browses, or the workshop the business is run from. Only one hierarchy is
  // visible at a time; the switch lives under the account row.
  sidebarRoom: SidebarRoom;
  setSidebarRoom: (room: SidebarRoom) => void;

  // Shop display preferences
  shopPriceWeight: 25 | 50 | 100;
  setShopPriceWeight: (grams: 25 | 50 | 100) => void;
  shopSort: 'featured' | 'price_asc' | 'price_desc' | 'recent' | 'tasted';
  setShopSort: (sort: 'featured' | 'price_asc' | 'price_desc' | 'recent' | 'tasted') => void;
  shopSavedOnly: boolean;
  setShopSavedOnly: (v: boolean) => void;

  // Recently Viewed
  recentlyViewed: string[];
  addRecentlyViewed: (id: string) => void;

  // Tea Discovery profile (onboarding quiz, client-side in v1; see docs/TEA_DISCOVERY.md)
  teaDiscoveryProfile: TeaDiscoveryProfile | null;
  setTeaDiscoveryProfile: (profile: TeaDiscoveryProfile) => void;
  clearTeaDiscoveryProfile: () => void;

  // Product Comparison
  compareItems: string[];
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  removeCompareItem: (id: string) => void;

  // Tasting Journal (customer)
  tastingJournal: CustomerTasting[];
  /** Insert a new entry. Use upsertTastingByProductId for the normal save path. */
  addTasting: (tasting: CustomerTasting) => void;
  removeTasting: (id: string) => void;
  updateTasting: (id: string, updates: Partial<CustomerTasting>) => void;
  /**
   * Save a tasting for a product. If an entry exists for (productId), edit it
   * in place (overwrites the most recent record). If `record.reason` is set,
   * appends as a new TastingRecord instead. Returns the entry id.
   */
  upsertTastingByProductId: (
    productId: string,
    productName: string,
    productType: string,
    productImage: string | undefined,
    record: import('../types').TastingRecord,
    noteUpdates?: Partial<CustomerTasting['note']>,
    accountId?: string,
  ) => string;

  // Inventory view management
  inventoryColumns: string[];
  savedViews: InventoryViewConfig[];
  activeViewId: string | null;
  inventoryGroupBy: string | null;
  inventorySortConfig: { key: string; direction: 'asc' | 'desc' }[];
  inventoryPriceMode: 'cost' | 'retail';
  /** Mobile swipe-table per-column pixel widths, keyed by column key. Persisted
   *  so a drag-resize survives reload. Absent keys fall back to MOBILE_COL_PX. */
  inventoryMobileColWidths: Record<string, number>;
  setInventoryColumns: (columns: string[]) => void;
  setInventoryMobileColWidth: (key: string, px: number) => void;
  toggleInventoryColumn: (column: string) => void;
  saveView: (view: InventoryViewConfig) => void;
  deleteView: (viewId: string) => void;
  setActiveView: (viewId: string | null) => void;
  setInventoryGroupBy: (groupBy: string | null) => void;
  setInventorySortConfig: (sortConfig: { key: string; direction: 'asc' | 'desc' }[]) => void;
  setInventoryPriceMode: (mode: 'cost' | 'retail') => void;

  // Draft Product (auto-save for AddProductModal), scoped per account so
  // operators can context-switch between stores without losing a half-drafted
  // product. Keyed by `activeAccountId`.
  draftProductByAccountId: Record<string, DraftProduct>;
  /** Sets the draft for the currently active account. No-op if no active account. */
  setDraftProduct: (draft: DraftProduct | null) => void;
  /** Clears the draft for the currently active account. */
  clearDraftProduct: () => void;

  // Public shop, selected store location (null = default Bali)
  shopStoreSlug: string | null;
  setShopStoreSlug: (slug: string | null) => void;

  // Multi-Account (Multi-Store) state
  memberships: AccountMembership[];
  activeUserId: string | null;
  activeAccountId: string | null;
  activeAccount: Account | null;
  platformRole: PlatformRole;
  setMemberships: (m: AccountMembership[]) => void;
  setActiveUserId: (id: string | null) => void;
  setActiveAccountId: (id: string | null) => void;
  setActiveAccount: (a: Account | null) => void;
  setPlatformRole: (role: PlatformRole) => void;
  clearAccountState: () => void;

  // Auth, shared across all components. NOT persisted (JWT is source of truth).
  authUser: AuthUser | null;
  isSessionReady: boolean;
  setAuthUser: (u: AuthUser | null) => void;
  setIsSessionReady: (ready: boolean) => void;

  // Notification state (for bottom nav dot + cart badge)
  upcomingEventsCount: number;
  setUpcomingEventsCount: (count: number) => void;
  cartLastAddedAt: number | null;

  // True while a full-screen product detail overlay (AlcoveModal /
  // TeawareAlcoveModal) is open. The bar stays visible (it does not hide
  // when an alcove opens), but other surfaces may want to know. Set by the
  // modals on open/close.
  productOverlayOpen: boolean;
  setProductOverlayOpen: (open: boolean) => void;
}

// ── Members & Access selectors ────────────────────────────────────────────────
// Use these in components to keep bundle checks consistent. Platform tier
// (platform_owner / platform_admin) always returns true regardless of bundle,
// they have all six bundles on every account by definition.
export function selectHasBundle(state: Pick<AppState, 'memberships' | 'activeAccountId' | 'platformRole'>, bundle: import('../types').Bundle): boolean {
  if (state.platformRole === 'platform_owner' || state.platformRole === 'platform_admin') return true;
  const active = state.memberships.find(m => m.account_id === state.activeAccountId);
  if (!active) return false;
  return Array.isArray(active.bundles) && active.bundles.includes(bundle);
}

// True if the caller is the active account's owner-tier (or platform tier acting in it).
// Used for actions reserved beyond Members bundle: transfer ownership, set per-partner
// margin overrides, etc.
export function selectIsOwnerTier(state: Pick<AppState, 'memberships' | 'activeAccountId' | 'platformRole'>): boolean {
  if (state.platformRole === 'platform_owner' || state.platformRole === 'platform_admin') return true;
  const active = state.memberships.find(m => m.account_id === state.activeAccountId);
  return active?.role === 'owner';
}

// Returns the active account's in-progress product draft, or null if none exists
// (or no account is active). Drafts are scoped per account so operators don't
// lose work when switching stores.
export function selectActiveDraftProduct(
  state: Pick<AppState, 'draftProductByAccountId' | 'activeAccountId'>,
): DraftProduct | null {
  if (!state.activeAccountId) return null;
  return state.draftProductByAccountId[state.activeAccountId] ?? null;
}

const DEFAULT_INVENTORY_COLUMNS = ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount', 'pricePerGramUSD', 'vendor', 'form'];
const DEFAULT_INVENTORY_SORT_CONFIG = [{ key: 'type', direction: 'asc' as const }];

const scopedStateReset = () => ({
  cart: [],
  isCartOpen: false,
  cartDirection: 'sale' as const,
  cartVendorName: '',
  cartSourceEventId: null,
  publicCart: [],
  isPublicCartOpen: false,
  favoriteTeas: [],
  tastingJournal: [],
  recentlyViewed: [],
  compareItems: [],
  inventoryColumns: [...DEFAULT_INVENTORY_COLUMNS],
  savedViews: [],
  activeViewId: null,
  inventoryGroupBy: null,
  inventorySortConfig: [...DEFAULT_INVENTORY_SORT_CONFIG],
  inventoryPriceMode: 'retail' as const,
  // NOTE: draftProductByAccountId is intentionally NOT reset here. Drafts are
  // scoped per account and must survive account switches.
  upcomingEventsCount: 0,
  cartLastAddedAt: null,
});

const createdAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Admin Cart / Transaction Builder
      cart: [],
      isCartOpen: false,
      cartDirection: 'sale' as 'sale' | 'purchase',
      cartVendorName: '',
      cartSourceEventId: null as string | null,

      addToCart: (product, quantity) =>
        set((state) => {
          const existingItem = state.cart.find((item) => item.productId === product.id);
          if (existingItem) {
            return {
              cart: state.cart.map((item) =>
                item.productId === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            };
          }
          return {
            cart: [
              ...state.cart,
              {
                productId: product.id,
                quantity,
                priceAtSale: product.pricePerGramUSD,
                product: { ...product },
              },
            ],
          };
        }),

      removeFromCart: (productId) =>
        set((state) => ({
          cart: state.cart.filter((item) => item.productId !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => ({
          cart: state.cart.map((item) =>
            item.productId === productId ? { ...item, quantity } : item
          ),
        })),

      clearCart: () => set({ cart: [] }),
      setCart: (cart) => set({ cart }),
      setIsCartOpen: (isOpen) => set({ isCartOpen: isOpen }),
      setCartDirection: (direction) => set({ cartDirection: direction }),
      setCartVendorName: (name) => set({ cartVendorName: name }),
      setCartSourceEventId: (eventId) => set({ cartSourceEventId: eventId }),
      openPurchaseOrder: (vendorName) => set({
        cartDirection: 'purchase',
        cartVendorName: vendorName || '',
        isCartOpen: true,
      }),

      // Public Cart
      publicCart: [],
      isPublicCartOpen: false,

      addToPublicCart: (item) =>
        set((state) => {
          if (!canAddToStoreCart(state.publicCart, item).allowed) {
            return state;
          }
          const existing = state.publicCart.find((c) => c.id === item.id);
          if (existing) {
            const newGrams = existing.quantityGrams + item.quantityGrams;
            return {
              publicCart: state.publicCart.map((c) =>
                c.id === item.id
                  ? { ...c, quantityGrams: newGrams, totalPrice: lineTotal(c, newGrams) }
                  : c
              ),
            };
          }
          return {
            publicCart: [...state.publicCart, { ...item, totalPrice: lineTotal(item, item.quantityGrams) }],
            cartLastAddedAt: Date.now(),
          };
        }),

      removeFromPublicCart: (id) =>
        set((state) => ({
          publicCart: state.publicCart.filter((item) => item.id !== id),
        })),

      updatePublicCartQuantity: (id, grams) =>
        set((state) => ({
          publicCart: state.publicCart.map((item) =>
            item.id === id
              ? { ...item, quantityGrams: grams, totalPrice: lineTotal(item, grams) }
              : item
          ),
        })),

      clearPublicCart: () => set({ publicCart: [] }),
      setIsPublicCartOpen: (isOpen) => set({ isPublicCartOpen: isOpen }),

      // Global Settings
      currency: 'USD',
      setCurrency: (currency) => set({ currency }),

      // Admin State
      isDevAdmin: false,
      toggleDevAdmin: () => set((state) => ({ isDevAdmin: !state.isDevAdmin })),
      setDevAdmin: (isAdmin) => set({ isDevAdmin: isAdmin }),

      // AI Settings
      aiPromptTemplate: 'You are a poetic but grounded tea master. Write 2-3 short paragraphs of historical or geographical lore about the tea named "{{productName}}" of type "{{type}}". Each paragraph should be 1-2 sentences, separated by double newlines. Cover origin story, terroir significance, and cultural context. Provide exactly 3-4 distinct sensory tasting notes. Also, provide the traditional Chinese name for this tea (if applicable) and its specific origin region (e.g., "Anxi, Fujian, China" or "Alishan, Taiwan"). Additionally, provide processing notes (e.g. "Heavy charcoal roast over pine wood."), a mood (e.g. "Grounding & Meditative"), an experience description (e.g. "A deeply centering tea..."), and a liquor color (e.g. "Deep Amber"). Do not be overly pretentious; focus on terroir, history, and clear flavors. Return the response in JSON format.',
      setAiPromptTemplate: (prompt) => set({ aiPromptTemplate: prompt }),

      // Favorite Teas
      favoriteTeas: [],
      toggleFavoriteTea: (id) =>
        set((state) => ({
          favoriteTeas: state.favoriteTeas.includes(id)
            ? state.favoriteTeas.filter((fid) => fid !== id)
            : [...state.favoriteTeas, id],
        })),
      clearFavoriteTeas: () => set({ favoriteTeas: [] }),
      mergeFavorites: (serverFavorites) =>
        set((state) => ({
          favoriteTeas: [...new Set([...state.favoriteTeas, ...serverFavorites])],
        })),

      // Sidebar
      sidebarCollapsed: false,
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      sidebarRoom: 'browse',
      setSidebarRoom: (sidebarRoom) => set({ sidebarRoom }),

      shopPriceWeight: 50,
      setShopPriceWeight: (grams) => set({ shopPriceWeight: grams }),
      shopSort: 'featured',
      setShopSort: (sort) => set({ shopSort: sort }),
      shopSavedOnly: false,
      setShopSavedOnly: (v) => set({ shopSavedOnly: v }),

      // Recently Viewed
      recentlyViewed: [],
      addRecentlyViewed: (id) =>
        set((state) => ({
          recentlyViewed: [id, ...state.recentlyViewed.filter((rid) => rid !== id)].slice(0, 10),
        })),

      // Tea Discovery profile
      teaDiscoveryProfile: null,
      setTeaDiscoveryProfile: (teaDiscoveryProfile) => set({ teaDiscoveryProfile }),
      clearTeaDiscoveryProfile: () => set({ teaDiscoveryProfile: null }),

      // Product Comparison
      compareItems: [],
      toggleCompare: (id) =>
        set((state) => {
          if (state.compareItems.includes(id)) {
            return { compareItems: state.compareItems.filter((cid) => cid !== id) };
          }
          if (state.compareItems.length >= 4) return state; // max 4
          return { compareItems: [...state.compareItems, id] };
        }),
      clearCompare: () => set({ compareItems: [] }),
      removeCompareItem: (id) =>
        set((state) => ({
          compareItems: state.compareItems.filter((cid) => cid !== id),
        })),

      // Tasting Journal
      tastingJournal: [],
      addTasting: (tasting) =>
        set((state) => ({
          tastingJournal: [tasting, ...state.tastingJournal].slice(0, 100),
        })),
      removeTasting: (id) =>
        set((state) => ({
          tastingJournal: state.tastingJournal.filter((t) => t.id !== id),
        })),
      updateTasting: (id, updates) =>
        set((state) => ({
          tastingJournal: state.tastingJournal.map((t) =>
            t.id === id ? { ...t, ...updates, synced: false } : t
          ),
        })),
      upsertTastingByProductId: (productId, productName, productType, productImage, record, noteUpdates, accountId) => {
        const now = new Date().toISOString();
        let entryId = '';
        set((state) => {
          const existing = state.tastingJournal.find(
            (e) => e.productId === productId && !e.archived
          );
          if (existing) {
            entryId = existing.id;
            const isFreshTasting = !!record.reason;
            const isSessionRecord = record.sourceType === 'session';
            // Sessions: append a new TastingRecord (so an existing journal entry
            // gains a session-stamped record rather than overwriting the user's
            // last solo note). Re-saves of the same eventId within the session
            // are deduped server-side by the journal bridge.
            let updatedTastings;
            if (isFreshTasting) {
              updatedTastings = [...existing.tastings, record];
            } else if (isSessionRecord) {
              const idx = existing.tastings.findIndex(
                (t) => t.eventId && record.eventId && t.eventId === record.eventId
              );
              updatedTastings = idx >= 0
                ? existing.tastings.map((t, i) => i === idx ? { ...t, ...record, id: t.id } : t)
                : [...existing.tastings, record];
            } else if (existing.tastings.length > 0) {
              updatedTastings = [...existing.tastings.slice(0, -1), { ...existing.tastings[existing.tastings.length - 1], ...record, id: existing.tastings[existing.tastings.length - 1].id }];
            } else {
              updatedTastings = [record];
            }
            return {
              tastingJournal: state.tastingJournal.map((t) =>
                t.id === existing.id
                  ? {
                      ...t,
                      productName,
                      productType,
                      productImage: productImage ?? t.productImage,
                      tastings: updatedTastings,
                      note: {
                        ...t.note,
                        tasting: record.tasting,
                        ...noteUpdates,
                        updatedAt: now,
                      },
                      synced: false,
                    }
                  : t
              ),
            };
          }
          entryId = crypto.randomUUID();
          const newEntry: CustomerTasting = {
            id: entryId,
            productId,
            productName,
            productType,
            productImage,
            note: {
              tasting: record.tasting,
              personalNote: noteUpdates?.personalNote,
              rating: noteUpdates?.rating,
              verdict: noteUpdates?.verdict,
              wouldBuy: noteUpdates?.wouldBuy,
              updatedAt: now,
            },
            tastings: [{ ...record, reason: undefined }],
            createdAt: now,
            accountId,
            synced: false,
          };
          return {
            tastingJournal: [newEntry, ...state.tastingJournal].slice(0, 100),
          };
        });
        return entryId;
      },

      // Inventory view management
      inventoryColumns: [...DEFAULT_INVENTORY_COLUMNS],
      savedViews: [],
      activeViewId: null,
      inventoryGroupBy: null,
      inventorySortConfig: [...DEFAULT_INVENTORY_SORT_CONFIG],
      inventoryPriceMode: 'retail' as 'cost' | 'retail',
      inventoryMobileColWidths: {},

      setInventoryColumns: (columns) => set({ inventoryColumns: columns }),
      setInventoryMobileColWidth: (key, px) =>
        set((state) => ({
          inventoryMobileColWidths: { ...state.inventoryMobileColWidths, [key]: Math.round(px) },
        })),
      toggleInventoryColumn: (column) =>
        set((state) => ({
          inventoryColumns: state.inventoryColumns.includes(column)
            ? state.inventoryColumns.filter((c) => c !== column)
            : [...state.inventoryColumns, column],
        })),
      saveView: (view) =>
        set((state) => ({
          savedViews: state.savedViews.some((v) => v.id === view.id)
            ? state.savedViews.map((v) => (v.id === view.id ? view : v))
            : [...state.savedViews, view],
        })),
      deleteView: (viewId) =>
        set((state) => ({
          savedViews: state.savedViews.filter((v) => v.id !== viewId),
          activeViewId: state.activeViewId === viewId ? null : state.activeViewId,
        })),
      setActiveView: (viewId) => set({ activeViewId: viewId }),
      setInventoryGroupBy: (groupBy) => set({ inventoryGroupBy: groupBy }),
      setInventorySortConfig: (sortConfig) => set({ inventorySortConfig: sortConfig }),
      setInventoryPriceMode: (mode) => set({ inventoryPriceMode: mode }),

      // Draft Product, per-account so operators don't lose drafts on switch
      draftProductByAccountId: {},
      setDraftProduct: (draft) =>
        set((state) => {
          const accountId = state.activeAccountId;
          if (!accountId) return state;
          // A null/empty draft means "clear", drop the key entirely so we
          // don't keep stale entries hanging around.
          if (!draft || Object.keys(draft).length === 0) {
            if (!(accountId in state.draftProductByAccountId)) return state;
            const next = { ...state.draftProductByAccountId };
            delete next[accountId];
            return { draftProductByAccountId: next };
          }
          return {
            draftProductByAccountId: {
              ...state.draftProductByAccountId,
              [accountId]: draft,
            },
          };
        }),
      clearDraftProduct: () =>
        set((state) => {
          const accountId = state.activeAccountId;
          if (!accountId || !(accountId in state.draftProductByAccountId)) return state;
          const next = { ...state.draftProductByAccountId };
          delete next[accountId];
          return { draftProductByAccountId: next };
        }),


      // Public shop location
      shopStoreSlug: null,
      setShopStoreSlug: (slug) => set({ shopStoreSlug: slug }),

      // Multi-Account state
      memberships: [],
      activeUserId: null,
      activeAccountId: null,
      activeAccount: null,
      platformRole: null,
      setMemberships: (memberships) => set({ memberships }),
      setActiveUserId: (activeUserId) =>
        set((state) => (
          state.activeUserId === activeUserId
            ? { activeUserId }
            : { ...scopedStateReset(), activeUserId }
        )),
      setActiveAccountId: (activeAccountId) =>
        set((state) => (
          state.activeAccountId === activeAccountId
            ? { activeAccountId }
            : { ...scopedStateReset(), activeAccountId, activeAccount: null }
        )),
      setActiveAccount: (activeAccount) => set({ activeAccount }),
      setPlatformRole: (platformRole) => set({ platformRole }),
      clearAccountState: () =>
        set({
          ...scopedStateReset(),
          memberships: [],
          activeUserId: null,
          activeAccountId: null,
          activeAccount: null,
          platformRole: null,
        }),

      // Auth (shared; not persisted, see partialize)
      authUser: null,
      isSessionReady: false,
      setAuthUser: (authUser) => set({ authUser }),
      setIsSessionReady: (isSessionReady) => set({ isSessionReady }),

      // Notifications
      upcomingEventsCount: 0,
      setUpcomingEventsCount: (count) => set({ upcomingEventsCount: count }),
      cartLastAddedAt: null,

      // Product overlay flag (transient, never persisted)
      productOverlayOpen: false,
      setProductOverlayOpen: (open) => set({ productOverlayOpen: open }),
    }),
    {
      name: 'teajia-storage',
      partialize: (state) => ({
        cart: state.cart,
        cartDirection: state.cartDirection,
        cartVendorName: state.cartVendorName,
        publicCart: state.publicCart,
        currency: state.currency,
        aiPromptTemplate: state.aiPromptTemplate,
        favoriteTeas: state.favoriteTeas,
        tastingJournal: state.tastingJournal,
        recentlyViewed: state.recentlyViewed,
        teaDiscoveryProfile: state.teaDiscoveryProfile,
        compareItems: state.compareItems,
        inventoryColumns: state.inventoryColumns,
        savedViews: state.savedViews,
        activeViewId: state.activeViewId,
        inventoryGroupBy: state.inventoryGroupBy,
        inventorySortConfig: state.inventorySortConfig,
        inventoryPriceMode: state.inventoryPriceMode,
        inventoryMobileColWidths: state.inventoryMobileColWidths,
        draftProductByAccountId: state.draftProductByAccountId,
        shopStoreSlug: state.shopStoreSlug,
        memberships: state.memberships,
        activeUserId: state.activeUserId,
        activeAccountId: state.activeAccountId,
        // isDevAdmin intentionally excluded, never persisted to localStorage (security fix)
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarRoom: state.sidebarRoom,
        shopPriceWeight: state.shopPriceWeight,
        shopSort: state.shopSort,
        shopSavedOnly: state.shopSavedOnly,
        upcomingEventsCount: state.upcomingEventsCount,
        cartLastAddedAt: state.cartLastAddedAt,
      }),
      // v1: introduced `draftProductByAccountId` (was `draftProduct`).
      //     Lift any existing single-slot draft into the active account's slot
      //     so operators don't lose work on the rollout.
      // v2: the Source (vendor) and Leaf (form) inventory columns were added to
      //     the column set. They never existed before, so a persisted column
      //     list / saved view from v1 simply omits them and they can never
      //     render. Append them (never reorder or remove) to any persisted
      //     `inventoryColumns` and to each saved view's `columns` so a returning
      //     operator's stored layout picks up the new columns without losing any
      //     deliberate customization.
      // v3: public cart rows became store-bound. Ambiguous legacy rows are
      //     discarded rather than silently assigning them to a store.
      version: 3,
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState as AppState;
        if (version < 1) {
          const prev = persistedState as Record<string, unknown> & {
            draftProduct?: DraftProduct | null;
            activeAccountId?: string | null;
            draftProductByAccountId?: Record<string, DraftProduct>;
          };
          const { draftProduct, activeAccountId } = prev;
          const byAccount: Record<string, DraftProduct> = { ...(prev.draftProductByAccountId ?? {}) };
          if (draftProduct && activeAccountId && Object.keys(draftProduct).length > 0) {
            byAccount[activeAccountId] = draftProduct;
          }
          delete prev.draftProduct;
          prev.draftProductByAccountId = byAccount;
        }
        if (version < 2) {
          const prev = persistedState as Record<string, unknown> & {
            inventoryColumns?: string[];
            savedViews?: InventoryViewConfig[];
          };
          const ADDED = ['vendor', 'form'];
          const withAdded = (cols: string[] | undefined): string[] => {
            const base = Array.isArray(cols) ? [...cols] : [...DEFAULT_INVENTORY_COLUMNS];
            for (const key of ADDED) if (!base.includes(key)) base.push(key);
            return base;
          };
          prev.inventoryColumns = withAdded(prev.inventoryColumns);
          if (Array.isArray(prev.savedViews)) {
            // Only the tea "All" view should gain the new columns automatically;
            // teaware and the filtered tea views (Selling, Alerts, etc.) keep
            // their intentionally narrower sets.
            prev.savedViews = prev.savedViews.map((v) =>
              v.filterType === 'All' && !v.id.includes('teaware')
                ? { ...v, columns: withAdded(v.columns) }
                : v
            );
          }
        }
        if (version < 3) {
          const prev = persistedState as { publicCart?: Array<Partial<PublicCartItem>> };
          prev.publicCart = Array.isArray(prev.publicCart)
            ? prev.publicCart.filter(
                (item): item is PublicCartItem =>
                  typeof item.storeSlug === 'string' && item.storeSlug.length > 0,
              )
            : [];
        }
        return persistedState as AppState;
      },
    }
  )
);


/**
 * One store per page, however many times this module is evaluated.
 *
 * Vite serves a hot-updated module under a new URL (`?t=<timestamp>`), so a
 * second evaluation is a second store with its own empty state. The app keeps
 * whichever copy it loaded first; anything reaching the module by its plain
 * path afterwards gets the other one, writes into it, and watches the screen
 * not change. Binding the store to the page rather than to the module
 * evaluation makes every copy the same store.
 */
const USEAPPSTORE_KEY = '__teajia_useAppStore';
type UseAppStoreHandle = typeof createdAppStore;
const useAppStoreScope = globalThis as unknown as Record<string, UseAppStoreHandle | undefined>;
export const useAppStore: UseAppStoreHandle =
  useAppStoreScope[USEAPPSTORE_KEY] ?? (useAppStoreScope[USEAPPSTORE_KEY] = createdAppStore);
