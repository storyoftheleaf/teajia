import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem as AdminCartItem, Currency, Product } from '../admin/types';
import { Account, AccountMembership, CartItem as PublicCartItem, CustomerTasting, PlatformRole } from '../types';

export interface AuthUser {
  email: string;
  username: string | null;
  name: string;
  role: string;
  phone?: string | null;
  canCreateCollections?: boolean;
}

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
  setInventoryColumns: (columns: string[]) => void;
  toggleInventoryColumn: (column: string) => void;
  saveView: (view: InventoryViewConfig) => void;
  deleteView: (viewId: string) => void;
  setActiveView: (viewId: string | null) => void;
  setInventoryGroupBy: (groupBy: string | null) => void;
  setInventorySortConfig: (sortConfig: { key: string; direction: 'asc' | 'desc' }[]) => void;
  setInventoryPriceMode: (mode: 'cost' | 'retail') => void;

  // Draft Product (auto-save for AddProductModal)
  draftProduct: Partial<Product> | null;
  setDraftProduct: (draft: Partial<Product> | null) => void;

  // Public shop — selected store location (null = default Bali)
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

  // Auth — shared across all components. NOT persisted (JWT is source of truth).
  authUser: AuthUser | null;
  isSessionReady: boolean;
  setAuthUser: (u: AuthUser | null) => void;
  setIsSessionReady: (ready: boolean) => void;

  // Sidebar nav font candidate (id from NAV_FONT_CANDIDATES). Persisted so the
  // user's preview survives reload while we're picking the winner.
  navFontId: string;
  setNavFontId: (id: string) => void;

  // Notification state (for bottom nav dot + cart badge)
  upcomingEventsCount: number;
  setUpcomingEventsCount: (count: number) => void;
  cartLastAddedAt: number | null;

  // Bottom-bar action — when set, BottomTabBar swaps the centered logo for
  // a contextual action button (e.g. a web3-styled mic on the sourcing
  // page). Pages register via the `useBottomBarMic` hook on mount.
  bottomBarAction:
    | { type: 'mic'; state: 'idle' | 'recording' | 'transcribing' | 'error'; onPress: () => void }
    | null;
  setBottomBarAction: (action: AppState['bottomBarAction']) => void;
}

// ── Members & Access selectors ────────────────────────────────────────────────
// Use these in components to keep bundle checks consistent. Platform tier
// (platform_owner / platform_admin) always returns true regardless of bundle —
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

const DEFAULT_INVENTORY_COLUMNS = ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount', 'pricePerGramUSD'];
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
  draftProduct: null,
  upcomingEventsCount: 0,
  cartLastAddedAt: null,
});

export const useAppStore = create<AppState>()(
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
          const existing = state.publicCart.find((c) => c.id === item.id);
          if (existing) {
            const newGrams = existing.quantityGrams + item.quantityGrams;
            return {
              publicCart: state.publicCart.map((c) =>
                c.id === item.id
                  ? { ...c, quantityGrams: newGrams, totalPrice: c.pricePerGram * newGrams }
                  : c
              ),
            };
          }
          return { publicCart: [...state.publicCart, { ...item, totalPrice: item.pricePerGram * item.quantityGrams }], cartLastAddedAt: Date.now() };
        }),

      removeFromPublicCart: (id) =>
        set((state) => ({
          publicCart: state.publicCart.filter((item) => item.id !== id),
        })),

      updatePublicCartQuantity: (id, grams) =>
        set((state) => ({
          publicCart: state.publicCart.map((item) =>
            item.id === id
              ? { ...item, quantityGrams: grams, totalPrice: item.pricePerGram * grams }
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

      setInventoryColumns: (columns) => set({ inventoryColumns: columns }),
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

      // Draft Product
      draftProduct: null,
      setDraftProduct: (draft) => set({ draftProduct: draft }),


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

      // Auth (shared; not persisted — see partialize)
      authUser: null,
      isSessionReady: false,
      setAuthUser: (authUser) => set({ authUser }),
      setIsSessionReady: (isSessionReady) => set({ isSessionReady }),

      // Sidebar nav font candidate
      navFontId: 'fraunces',
      setNavFontId: (navFontId) => set({ navFontId }),

      // Notifications
      upcomingEventsCount: 0,
      setUpcomingEventsCount: (count) => set({ upcomingEventsCount: count }),
      cartLastAddedAt: null,

      // Bottom-bar action (transient — never persisted)
      bottomBarAction: null,
      setBottomBarAction: (action) => set({ bottomBarAction: action }),
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
        compareItems: state.compareItems,
        inventoryColumns: state.inventoryColumns,
        savedViews: state.savedViews,
        activeViewId: state.activeViewId,
        inventoryGroupBy: state.inventoryGroupBy,
        inventorySortConfig: state.inventorySortConfig,
        inventoryPriceMode: state.inventoryPriceMode,
        draftProduct: state.draftProduct,
        shopStoreSlug: state.shopStoreSlug,
        memberships: state.memberships,
        activeUserId: state.activeUserId,
        activeAccountId: state.activeAccountId,
        // isDevAdmin intentionally excluded — never persisted to localStorage (security fix)
        sidebarCollapsed: state.sidebarCollapsed,
        shopPriceWeight: state.shopPriceWeight,
        shopSort: state.shopSort,
        shopSavedOnly: state.shopSavedOnly,
        upcomingEventsCount: state.upcomingEventsCount,
        cartLastAddedAt: state.cartLastAddedAt,
        navFontId: state.navFontId,
      }),
    }
  )
);
