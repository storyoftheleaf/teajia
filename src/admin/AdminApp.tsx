import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/shared/PullToRefreshIndicator';
import { EmblemLoader } from '../components/shared/EmblemLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isConfigured,
  hasToken,
  clearToken,
  setToken,
  getTokenClaims,
  isTokenExpired,
  SESSION_EXPIRED_EVENT,
  ACCOUNT_MISMATCH_EVENT,
  hydrateAccountStateFromToken,
  ensureTokenRefreshed,
  shouldProactivelyRefreshToken,
  api,
} from '../lib/api';
import { Product } from './types';

import { useProducts, useRates } from './hooks/useAdminData';
import { eventsListQueryOptions } from './hooks/useEventData';
import { useAppStore } from './store';
import { selectHasBundle, selectIsOwnerTier } from '../lib/store';

// Import Components
import { TeaTable } from './components/TeaTable';
import { TeawareCatalog } from './components/TeawareCatalog';
// Code-split (Wave 1): the three heaviest admin surfaces load on demand so the
// admin shell isn't gated on a single ~1.8 MB download. Their route elements
// are wrapped in Suspense via PageTransition below. Dashboard going lazy also
// evicts recharts from the shell chunk. Follow-up lives in docs/tracks/08-platform-hardening.md.
const InventoryView = lazy(() => import('./components/InventoryView').then((m) => ({ default: m.InventoryView })));
import { CartPanel } from '../components/shared/CartPanel';
import { ToastProvider, useToast } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
const DashboardView = lazy(() => import('./components/DashboardView').then((m) => ({ default: m.DashboardView })));
import { NoMembershipGate } from './components/NoMembershipGate';
import { shouldShowNoMembershipGate } from './membershipGate';
import { AccountSettingsView } from './views/AccountSettingsView';
import { PlatformAdminView } from './views/PlatformAdminView';
import { AccessView } from './views/AccessView';
import { PlatformAccessView } from './views/PlatformAccessView';
import { CurrencyRatesView } from './views/CurrencyRatesView';
import { MCPTokensView } from './views/MCPTokensView';
import { OAuthConsentView } from './views/OAuthConsentView';
import { WisdomView } from './views/WisdomView';
import { TEA_REFERENCE_PREVIEW_ENABLED } from '../wisdom/reference/previewMode';
import { EventsManager } from './components/EventsManager';
import { EventDetail } from './components/EventDetail';
import { TastingEventsList } from './components/tasting/TastingEventsList';
import { TastingEventForm } from './components/tasting/TastingEventForm';
import { TastingControlRoom } from './components/tasting/TastingControlRoom';
import { VenueManager } from './components/VenueManager';
import { PeopleView } from './components/PeopleView';
import { CustomerProfilePage } from './components/CustomerProfilePage';
import { ActivityView } from './components/ActivityView';
// DraftsView (capture route) statically imports InventoryView, so it must also
// be lazy, otherwise InventoryView is pulled back into the shell chunk through
// it. Both then share a single on-demand InventoryView chunk.
const DraftsView = lazy(() => import('./components/DraftsView').then((m) => ({ default: m.DraftsView })));
import { IntakeWorkspace } from './views/IntakeWorkspace';
import { CatalogView } from './views/CatalogView';
import { PurchaseOrdersPage } from './views/PurchaseOrdersPage';
const TeaCompass = lazy(() => import('../components/TeaCompass'));
import type { CompassMode } from '../components/TeaCompass';
import { VendorProfileView } from './views/VendorProfileView';
import { ProductStoryView } from './views/ProductStoryView';
import { PlatformAuditLogPage } from './views/PlatformAuditLogPage';
import { MovementStockView } from './views/MovementStockView';
import { MagazineView } from './views/MagazineView';
import { ContributorsView } from './views/ContributorsView';
import { CollectionsView } from './views/CollectionsView';
import { ContactTagsView } from './views/ContactTagsView';
import { CollectionEditView } from './views/CollectionEditView';
import { InboundCollectionView } from './views/InboundCollectionView';
import { CatalogBrowse } from './views/CatalogBrowse';
import { NetworkLanding } from './views/NetworkLanding';
import { PartnerListingEdit } from './views/PartnerListingEdit';
import { SuggestionsInbox } from './views/SuggestionsInbox';
import { WholesaleOrdersList } from './views/WholesaleOrdersList';
import { WholesaleOrderDraft } from './views/WholesaleOrderDraft';
import { WholesaleOrderTimeline } from './views/WholesaleOrderTimeline';
import { AdoptionQueue } from './views/AdoptionQueue';

// Import Modals
import { AuthModal } from './components/AuthModal';
import { CsvImportModal } from './components/CsvImportModal';
import { AddToCartModal } from './components/AddToCartModal';
import { AddProductModal } from './components/AddProductModal';

/** Reads ?tab= and ?entry= query params and passes them to TeaCompass */
const CompassWithMode: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tab = params.get('tab');
  const entryId = params.get('entry');
  const capture = params.get('capture');
  const sampleOrder = params.get('sampleOrder');
  const sampleSetId = params.get('set');
  const developProductId = params.get('developProduct');
  const developName = params.get('developName');
  const developType = params.get('developType');
  const initialMode: CompassMode | undefined =
    tab === 'buying' ? 'buying' : tab === 'ledger' ? 'buying' :
    tab === 'sourcing' ? 'sourcing' : tab === 'capture' ? 'sourcing' :
    tab === 'samples' ? 'sourcing' :
    // 'tasting' kept as a back-compat alias for the old query param.
    // The internal name is now 'library' since this view is the Library of
    // past compass captures, not the Tasting surface (that lives at
    // /account/journal).
    tab === 'tasting' ? 'library' : tab === 'browse' ? 'library' :
    tab === 'library' ? 'library' :
    undefined;
  const initialCaptureOption: 'tea' | 'teaware' | undefined =
    capture === 'teaware' ? 'teaware' :
    capture === 'tea' ? 'tea' :
    undefined;
  return (
    <TeaCompass
      onBack={onBack}
      initialMode={initialMode}
      initialEntryId={entryId || undefined}
      initialDevelopmentProduct={developProductId && developName ? {
        id: developProductId,
        name: developName,
        type: developType || undefined,
      } : undefined}
      initialCaptureOption={initialCaptureOption}
      initialSampleOrder={sampleOrder === 'manage' ? 'manage' : sampleOrder === 'open' ? 'open' : undefined}
      initialSampleSetId={sampleSetId || undefined}
      onSampleOrderRouteClose={() => {
        const next = new URLSearchParams(params);
        next.delete('sampleOrder');
        next.delete('set');
        navigate({ pathname: '/admin/compass', search: next.toString() ? `?${next}` : '' }, { replace: true });
      }}
    />
  );
};

// Suspense fallback for lazy route views. MUST carry `h-full`, it sits inside
// the InventoryView height chain (CLAUDE.md), and a fallback without a definite
// height collapses the inventory scroll container to 0px during the load frame.
const ViewFallback = () => (
  <div className="h-full flex items-center justify-center">
    <EmblemLoader />
  </div>
);

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className="h-full"
  >
    <Suspense fallback={<ViewFallback />}>{children}</Suspense>
  </motion.div>
);

const ProtectedRoute = ({ hasAccess, isLoggingIn, children }: { hasAccess: boolean; isLoggingIn?: boolean; children: React.ReactNode }) => {
  if (!hasAccess) {
    if (isLoggingIn) return null;
    return <div className="p-12 text-center text-tea-text-sec font-serif">Access Restricted</div>;
  }
  return <>{children}</>;
};

interface AdminContentProps {
  onAccountClick?: () => void;
  onSearchClick?: () => void;
  onCartClick?: () => void;
}

const AdminContent = ({ onAccountClick, onSearchClick }: AdminContentProps) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Zustand Store
  const {
    cart, isCartOpen, currency, isDevAdmin, cartDirection,
    addToCart, clearCart, setIsCartOpen, setCurrency, toggleDevAdmin, setCart, openPurchaseOrder,
    memberships, activeAccountId, clearAccountState, platformRole,
  } = useAppStore();

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Grab token from Google OAuth redirect (#oauth_token=...) before first render
    const hash = window.location.hash;
    if (hash.includes('oauth_token=')) {
      const oauthToken = new URLSearchParams(hash.slice(1)).get('oauth_token');
      if (oauthToken) {
        setToken(oauthToken);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    return hasToken();
  });
  // currencyOpen state removed, currency selector moved to InventoryView options menu

  const claims = getTokenClaims();
  const userRole = claims?.role || (isDevAdmin ? 'owner' : null);
  // Role tiers, each tier is a superset of the one below
  const isMember = (isAuthenticated && !!userRole) || isDevAdmin;
  const isStaff  = (isAuthenticated && (userRole === 'staff' || userRole === 'admin' || userRole === 'owner')) || isDevAdmin;
  const isAdmin  = (isAuthenticated && (userRole === 'admin' || userRole === 'owner')) || isDevAdmin;
  const bundleState = { memberships, activeAccountId, platformRole };
  const hasCatalogBundle = isAdmin || selectHasBundle(bundleState, 'catalog');
  const hasStockBundle = isAdmin || selectHasBundle(bundleState, 'stock');
  const hasPublishBundle = isAdmin || selectHasBundle(bundleState, 'publish');
  const hasGatherBundle = isAdmin || selectHasBundle(bundleState, 'gather');
  const hasSellBundle = isAdmin || selectHasBundle(bundleState, 'sell');
  const hasMembersBundle = isAdmin || selectHasBundle(bundleState, 'members');
  const isOwnerTier = isAdmin || selectIsOwnerTier(bundleState);
  const canManageInventory = hasCatalogBundle || hasStockBundle;
  const canUseNetwork = hasCatalogBundle || hasSellBundle || !!platformRole;
  const canUsePeople = hasSellBundle || hasGatherBundle || hasMembersBundle || hasStockBundle || hasPublishBundle;

  // Warm the events list in the background as soon as the user enters admin.
  // The persisted cache may already have a copy, but this kicks off the
  // revalidation immediately so the data is fresh by the time they click.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isMember) return;
    queryClient.prefetchQuery(eventsListQueryOptions);
  }, [isMember, activeAccountId, queryClient]);

  // Listen for session expiry (401 responses clear the token in api.ts)
  useEffect(() => {
    const handleSessionExpired = () => {
      clearAccountState();
      setIsAuthenticated(false);
      setIsLoginOpen(true);
    };
    const handleAccountMismatch = () => {
      // Re-hydrate from JWT; if membership really is gone, user lands on the gate.
      hydrateAccountStateFromToken();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener(ACCOUNT_MISMATCH_EVENT, handleAccountMismatch);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
      window.removeEventListener(ACCOUNT_MISMATCH_EVENT, handleAccountMismatch);
    };
  }, [clearAccountState]);

  // Handle Google OAuth error redirects (?oauth_error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('oauth_error');
    if (oauthError) {
      const messages: Record<string, string> = {
        access_denied: 'Google sign-in was cancelled.',
        invalid_state: 'Sign-in session expired. Please try again.',
        token_exchange_failed: 'Could not complete Google sign-in. Please try again.',
        userinfo_failed: 'Could not retrieve your Google profile.',
        account_error: 'Could not create or link your account.',
      };
      showToast(messages[oauthError] || 'Google sign-in failed. Please try again.', 'error');
      setIsLoginOpen(true);
      params.delete('oauth_error');
      const newSearch = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate account state from JWT on mount (and whenever auth changes)
  useEffect(() => {
    if (isAuthenticated) {
      hydrateAccountStateFromToken();
    }
  }, [isAuthenticated]);

  // Silent refresh on mount: if the token is either already expired (past
  // the client-side buffer) or within the refresh threshold, try to swap it
  // for a fresh one *before* the admin views start firing API calls. This
  // stops the 401 → SESSION_EXPIRED cascade that used to boot active users
  // right at the 30-day boundary.
  useEffect(() => {
    if (!hasToken()) return;
    let cancelled = false;
    (async () => {
      if (isTokenExpired() || shouldProactivelyRefreshToken()) {
        const refreshResult = await ensureTokenRefreshed();
        if (refreshResult === 'rejected' && isTokenExpired()) {
          // Truly dead, clear and prompt login. This is the graceful
          // fallback for someone who hasn't opened the app in over a month.
          clearToken();
          clearAccountState();
          if (!cancelled) {
            setIsAuthenticated(false);
            setIsLoginOpen(true);
          }
        } else if (!cancelled) {
          hydrateAccountStateFromToken();
          setIsAuthenticated(true);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the session alive when the tab returns from background on mobile.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!hasToken()) return;
      if (shouldProactivelyRefreshToken()) {
        void ensureTokenRefreshed();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Modals
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [inventoryOptionsOpen, setInventoryOptionsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [selectedProductForCart, setSelectedProductForCart] = useState<Product | null>(null);

  // Inventory category/search state is shared with the unified inventory header.
  const [inventoryCategory, setInventoryCategory] = useState<'tea' | 'teaware'>('tea');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const isOnInventory = location.pathname.includes('/admin/stock') || location.pathname.includes('/admin/inventory');
  const isOnCapture = location.pathname.includes('/admin/capture');
  const isOnIntake = location.pathname.includes('/admin/intake');
  const isOnHome = location.pathname === '/admin/' || location.pathname === '/admin/compass';
  const isLocalTeaReferenceReview = TEA_REFERENCE_PREVIEW_ENABLED && location.pathname === '/admin/wisdom';

  // React Query Hooks, only fetch when authenticated to avoid 401 errors on initial load
  const isLoggedIn = isAuthenticated || isDevAdmin;
  const { data: products = [], isLoading: productsLoading, isError: productsError, error: productsErrorObj, refetch: refetchProducts } = useProducts({ enabled: isLoggedIn });
  const { data: rates = [], refetch: refetchRates } = useRates();

  // Incoming compass shares, poll every 60s for badge count
  const { data: incomingSharesData } = useQuery({
    queryKey: ['compass-incoming'],
    queryFn: () => api.compass.getIncoming(),
    enabled: isLoggedIn && hasToken(),
    refetchInterval: 60_000,
    select: (data: { shares?: Array<{ id: string }> }) => (data?.shares || []) as Array<{ id: string }>,
  });
  const incomingShareCount = incomingSharesData?.length ?? 0;

  // Pull-to-refresh (mobile)
  const { pullDistance, isRefreshing, progress } = usePullToRefresh(async () => {
    await Promise.all([refetchProducts(), refetchRates()]);
  });

  const loading = productsLoading;
  const activeMembership = memberships.find((m) => m.account_id === activeAccountId);

  // Redirect when entering admin at root, or prompt login if not authenticated.
  // A short delay lets Zustand persist middleware finish rehydrating isDevAdmin
  // from localStorage before we evaluate isLoggedIn, preventing a false-negative
  // that would skip the login modal on fresh visits.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLocalTeaReferenceReview) return;
      if (isLoggedIn && location.pathname === '/admin') {
        navigate('/admin/compass');
      } else if (!isLoggedIn && location.pathname.startsWith('/admin')) {
        navigate('/signin', { state: { from: location.pathname } });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isLocalTeaReferenceReview, isLoggedIn, navigate, location.pathname]);

  // Close registry drawer when navigating to a different route
  useEffect(() => {
    setIsCartOpen(false);
  }, [location.pathname]);

  // Gate: authenticated user with no memberships yet, show waiting screen
  const isPlatformTier = platformRole === 'platform_owner' || platformRole === 'platform_admin';
  const needsMembershipGate = shouldShowNoMembershipGate({
    isAuthenticated, isDevAdmin, platformRole, membershipCount: memberships.length,
  });

  // The editorial receiver is a local preview-only surface with no database,
  // mutation, or persistence. Let it render against its local GET endpoints
  // without requiring production API credentials or an admin session.
  if (isLocalTeaReferenceReview) {
    return (
      <div className="h-full min-h-0 flex flex-col bg-tea-bg">
        <main className="flex-1 min-h-0 overflow-auto">
          <WisdomView />
        </main>
      </div>
    );
  }

  // Early return for missing configuration (after all hooks)
  if (!isConfigured) {
    return (
      <div className="flex min-h-[100dvh] bg-tea-bg text-tea-text items-center justify-center p-6">
        <div className="bg-tea-surface border border-tea-border p-8 rounded-xl max-w-md w-full shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tea-gold to-tea-gold/50"></div>
            <div className="mb-6 flex justify-center">
              <div className="p-4 bg-tea-gold/10 rounded-full border border-tea-accent-sub">
                <AlertTriangle className="text-tea-gold" size={32} />
              </div>
            </div>
            <h2 className="text-xl font-serif text-tea-text mb-2">Setup Required</h2>
            <p className="text-tea-text-sec text-sm mb-6 leading-relaxed">
                The application cannot connect to the database. Please configure your API credentials to continue.
            </p>
            <div className="text-left bg-tea-bg/50 p-4 rounded-xl text-xs font-mono text-tea-text-sec mb-6 border border-tea-border space-y-2">
                <p>1. Open <span className="text-tea-text bg-tea-surface px-1 rounded">.env</span> file</p>
                <p>2. Find <span className="text-tea-gold">VITE_API_URL</span></p>
                <p>3. Set it to your Worker API URL</p>
            </div>
            <button onClick={() => window.location.reload()} className="cta-solid px-6 py-3 rounded-xl text-sm font-medium transition-colors w-full">
                I've Updated It, Reload App
            </button>
        </div>
      </div>
    );
  }

  if (needsMembershipGate) {
    return (
      <NoMembershipGate
        onLogout={() => {
          clearToken();
          clearAccountState();
          setIsAuthenticated(false);
          navigate('/');
        }}
      />
    );
  }

  const handleLogout = () => {
    clearToken();
    clearAccountState();
    setIsAuthenticated(false);
    if (isDevAdmin) toggleDevAdmin();
    navigate('/');
  };

  const openAddModal = (product: Product) => {
    setSelectedProductForCart(product);
    setIsAddModalOpen(true);
  };

  const handleAddToCart = (quantity: number) => {
    if (selectedProductForCart) {
      addToCart(selectedProductForCart, quantity);
      setIsAddModalOpen(false);
      setSelectedProductForCart(null);
      setIsCartOpen(true);
      showToast("Item added to registry", 'success');
    }
  };

  const handleRefresh = () => {
    refetchProducts();
    refetchRates();
    showToast("Data refreshed", 'info');
  };

  const handleInventoryCategoryChange = (category: 'tea' | 'teaware') => {
    setInventoryCategory(category);
    setInventorySearchQuery('');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-tea-bg text-tea-text font-sans selection:bg-tea-gold/30">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={progress} />

      {/* Account / location switching lives inside Your Table (AccountPanel),
          not in a sticky admin bar. See AccountSwitcherChip there. The old
          top switcher bar was removed so no admin screen carries it. */}

      <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden">

        <div className={`flex-1 relative min-h-0 ${isOnInventory || isOnCapture || isOnIntake ? 'overflow-hidden' : 'overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom,0px))] lg:pb-0'}`}>
          <Routes>
              <Route path="/" element={<Navigate to="compass" replace />} />
              <Route path="home" element={<Navigate to="../compass" replace />} />

              {/* Member tools, all authenticated members */}
              <Route path="compass" element={
                <ProtectedRoute hasAccess={hasCatalogBundle} isLoggingIn={isLoginOpen || !isLoggedIn}>
                  <PageTransition>
                    <CompassWithMode onBack={() => navigate(-1)} />
                  </PageTransition>
                </ProtectedRoute>
              } />
              <Route path="compass-playbook" element={
                <ProtectedRoute hasAccess={hasCatalogBundle} isLoggingIn={isLoginOpen || !isLoggedIn}>
                  <PageTransition>
                    <CompassWithMode onBack={() => navigate(-1)} />
                  </PageTransition>
                </ProtectedRoute>
              } />
              <Route path="compass-current" element={
                <ProtectedRoute hasAccess={hasCatalogBundle} isLoggingIn={isLoginOpen || !isLoggedIn}>
                  <PageTransition>
                    <CompassWithMode onBack={() => navigate(-1)} />
                  </PageTransition>
                </ProtectedRoute>
              } />
              <Route path="capture" element={
                <ProtectedRoute hasAccess={hasCatalogBundle} isLoggingIn={isLoginOpen || !isLoggedIn}>
                  <PageTransition>
                    <DraftsView
                      products={products}
                      isLoading={loading}
                      onDraftCreated={refetchProducts}
                      onImportClick={() => setIsImportOpen(true)}
                      onAddClick={() => setIsCreateModalOpen(true)}
                      rates={rates}
                    />
                  </PageTransition>
                </ProtectedRoute>
              } />

              {/* Member tools, events + samples open to all members */}
              <Route path="events" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><EventsManager /></PageTransition></ProtectedRoute>} />
              <Route path="events/:id" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><EventDetail /></PageTransition></ProtectedRoute>} />
              <Route path="tasting-events" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><TastingEventsList /></PageTransition></ProtectedRoute>} />
              <Route path="tasting-events/new" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><TastingEventForm /></PageTransition></ProtectedRoute>} />
              <Route path="tasting-events/:sessionId" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><TastingControlRoom /></PageTransition></ProtectedRoute>} />
              <Route path="tasting-events/:sessionId/live" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><TastingControlRoom /></PageTransition></ProtectedRoute>} />
              <Route path="venues" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><VenueManager /></PageTransition></ProtectedRoute>} />
              <Route path="samples" element={<Navigate to={`/admin/compass?sampleOrder=manage${location.search ? `&${location.search.slice(1)}` : ''}`} replace />} />

              {/* Operations: staff, admin, owner */}
              <Route path="activity" element={<ProtectedRoute hasAccess={hasSellBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><ActivityView products={products} /></PageTransition></ProtectedRoute>} />
              <Route path="activity-logs" element={<Navigate to="/admin/activity?tab=log" replace />} />
              <Route path="people" element={<ProtectedRoute hasAccess={canUsePeople} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><PeopleView userRole={userRole || 'user'} /></PageTransition></ProtectedRoute>} />
              <Route path="people/:customerId" element={<ProtectedRoute hasAccess={canUsePeople} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><CustomerProfilePage /></PageTransition></ProtectedRoute>} />
              <Route path="contact-tags" element={<ProtectedRoute hasAccess={canUsePeople} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><ContactTagsView /></PageTransition></ProtectedRoute>} />

              {/* Management: admin, owner. Canonical route is /admin/stock;
                  /admin/inventory redirects to it (query string preserved for ?panel= deep links). */}
              <Route path="stock" element={
                <ProtectedRoute hasAccess={canManageInventory} isLoggingIn={isLoginOpen || !isLoggedIn}>
                  <PageTransition>
                    <InventoryView
                      products={products}
                      isLoading={loading}
                      isError={productsError}
                      error={productsErrorObj}
                      onImportClick={() => setIsImportOpen(true)}
                      onAddClick={() => setIsCreateModalOpen(true)}
                      onRefresh={refetchProducts}
                      externalCategory={inventoryCategory}
                      externalSearchQuery={inventorySearchQuery}
                      onSearchQueryChange={setInventorySearchQuery}
                      onCategoryChange={handleInventoryCategoryChange}
                      activeAccountName={activeMembership?.account_name || ''}
                      externalShowOptions={inventoryOptionsOpen}
                      onOptionsToggle={setInventoryOptionsOpen}
                    />
                  </PageTransition>
                </ProtectedRoute>
              } />
              <Route path="inventory" element={<Navigate to={`/admin/stock${location.search}`} replace />} />
              <Route path="intake" element={<ProtectedRoute hasAccess={canManageInventory} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><IntakeWorkspace onRefresh={refetchProducts} rates={rates} /></PageTransition></ProtectedRoute>} />
              <Route path="dashboard" element={<ProtectedRoute hasAccess={isOwnerTier} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><DashboardView products={products} isLoading={loading} /></PageTransition></ProtectedRoute>} />
              <Route path="vendors/:vendorId" element={<ProtectedRoute hasAccess={canManageInventory} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><VendorProfileView /></PageTransition></ProtectedRoute>} />
              <Route path="products/:id/story" element={<ProtectedRoute hasAccess={hasCatalogBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><ProductStoryView /></PageTransition></ProtectedRoute>} />
              <Route path="purchase-orders" element={<Navigate to="/admin/people?tab=purchase-orders" replace />} />
              <Route path="team" element={<Navigate to="/admin/access" replace />} />
              {/* The admin copy of the launch playbook was retired: it repeated the
                  Launch Center step for step, but kept its ticks in the browser, so
                  it could tell someone they were done when they were not. The public
                  page it shared a component with is untouched. Anyone holding the old
                  link lands on the checklist that reads live data instead. */}
              <Route path="launch-playbook" element={<Navigate to="/admin/account-settings" replace />} />
              <Route path="access" element={<ProtectedRoute hasAccess={hasMembersBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><AccessView /></PageTransition></ProtectedRoute>} />
              <Route path="access/platform" element={<ProtectedRoute hasAccess={!!platformRole} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><PlatformAccessView /></PageTransition></ProtectedRoute>} />
              <Route path="currency" element={<ProtectedRoute hasAccess={!!platformRole} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><CurrencyRatesView /></PageTransition></ProtectedRoute>} />
              <Route path="mcp-tokens" element={<ProtectedRoute hasAccess={isOwnerTier} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><MCPTokensView /></PageTransition></ProtectedRoute>} />
              <Route path="oauth-consent" element={<ProtectedRoute hasAccess={isOwnerTier} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><OAuthConsentView /></PageTransition></ProtectedRoute>} />
              <Route path="oauth-consent/:requestId" element={<ProtectedRoute hasAccess={isOwnerTier} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><OAuthConsentView /></PageTransition></ProtectedRoute>} />
              <Route path="wisdom" element={<ProtectedRoute hasAccess={hasPublishBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><WisdomView /></PageTransition></ProtectedRoute>} />
              {/* Network hub, single page with tabbed surfaces */}
              <Route path="network" element={<ProtectedRoute hasAccess={canUseNetwork} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><NetworkLanding /></PageTransition></ProtectedRoute>} />
              {/* Legacy destination routes redirect into the hub with their tab */}
              <Route path="network/catalog" element={<Navigate to="/admin/network?tab=catalog" replace />} />
              <Route path="network/suggestions" element={<Navigate to="/admin/network?tab=suggestions" replace />} />
              <Route path="network/wholesale" element={<Navigate to="/admin/network?tab=wholesale" replace />} />
              <Route path="network/adoptions" element={<Navigate to="/admin/network?tab=adoptions" replace />} />
              {/* Deep sub-pages keep their own URLs */}
              <Route path="network/listings/:listingId" element={<ProtectedRoute hasAccess={canUseNetwork} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><PartnerListingEdit /></PageTransition></ProtectedRoute>} />
              <Route path="network/wholesale/new" element={<ProtectedRoute hasAccess={hasSellBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><WholesaleOrderDraft /></PageTransition></ProtectedRoute>} />
              <Route path="network/wholesale/:orderId" element={<ProtectedRoute hasAccess={hasSellBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><WholesaleOrderDraft /></PageTransition></ProtectedRoute>} />
              <Route path="network/wholesale/:orderId/timeline" element={<ProtectedRoute hasAccess={hasSellBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><WholesaleOrderTimeline /></PageTransition></ProtectedRoute>} />
              <Route path="account-settings" element={<ProtectedRoute hasAccess={isOwnerTier} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><AccountSettingsView /></PageTransition></ProtectedRoute>} />
              <Route path="platform" element={<ProtectedRoute hasAccess={!!platformRole} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><PlatformAdminView /></PageTransition></ProtectedRoute>} />
              <Route path="platform/audit-log" element={<ProtectedRoute hasAccess={!!platformRole} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><PlatformAuditLogPage /></PageTransition></ProtectedRoute>} />
              <Route path="platform/all-stock" element={<ProtectedRoute hasAccess={!!platformRole} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><MovementStockView /></PageTransition></ProtectedRoute>} />
              <Route path="magazine" element={<ProtectedRoute hasAccess={hasPublishBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><MagazineView /></PageTransition></ProtectedRoute>} />
              <Route path="contributors" element={<ProtectedRoute hasAccess={isOwnerTier} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><ContributorsView /></PageTransition></ProtectedRoute>} />
              <Route path="collections" element={<ProtectedRoute hasAccess={hasPublishBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><CollectionsView /></PageTransition></ProtectedRoute>} />
              <Route path="collections/inbound/:pubId" element={<ProtectedRoute hasAccess={hasPublishBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><InboundCollectionView /></PageTransition></ProtectedRoute>} />
              <Route path="collections/:id" element={<ProtectedRoute hasAccess={hasPublishBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><CollectionEditView /></PageTransition></ProtectedRoute>} />

              {/* Legacy routes, redirect to new unified views */}
              <Route path="catalog" element={
                activeMembership?.is_platform_account
                  ? <Navigate to="/admin/stock" replace />
                  : <ProtectedRoute hasAccess={hasCatalogBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><CatalogView /></PageTransition></ProtectedRoute>
              } />
              <Route path="teaware" element={<Navigate to="/admin/stock" replace />} />
              <Route path="personal" element={<Navigate to="/admin/stock" replace />} />
              <Route path="customers" element={<Navigate to="/admin/people" replace />} />
              <Route path="sources" element={<Navigate to="/admin/people" replace />} />
              <Route path="orders" element={<Navigate to="/admin/activity?tab=orders" replace />} />
              <Route path="records" element={<Navigate to="/admin/activity?tab=log" replace />} />
              <Route path="settings" element={<Navigate to="/admin/people" replace />} />

              <Route path="*" element={<Navigate to="home" replace />} />
          </Routes>
        </div>


        {/* --- REGISTRY MANIFEST DRAWER --- */}
        <CartPanel
          mode="admin"
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          setCart={setCart}
          onClearCart={clearCart}
          onSuccess={refetchProducts}
          rates={rates}
          showToast={showToast}
        />

        <AddToCartModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onConfirm={handleAddToCart}
          product={selectedProductForCart}
          currency={currency}
          rates={rates}
        />

        <AuthModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onAuthSuccess={() => { hydrateAccountStateFromToken(); setIsAuthenticated(true); refetchProducts(); refetchRates(); }} />
        <CsvImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onComplete={refetchProducts} />

        <AddProductModal
          isOpen={isCreateModalOpen || !!editingProduct}
          onClose={() => { setIsCreateModalOpen(false); setEditingProduct(null); }}
          initialData={editingProduct || undefined}
          onSuccess={() => { refetchProducts(); setEditingProduct(null); setIsCreateModalOpen(false); }}
          rates={rates}
        />

        <CommandPalette onAddProduct={() => setIsCreateModalOpen(true)} externalOpen={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />

      </main>
    </div>
  );
};

interface AdminAppProps {
  onAccountClick?: () => void;
  onSearchClick?: () => void;
  onCartClick?: () => void;
}

const AdminApp = ({ onAccountClick, onSearchClick, onCartClick }: AdminAppProps) => (
  <ErrorBoundary>
    <ToastProvider>
      <AdminContent onAccountClick={onAccountClick} onSearchClick={onSearchClick} onCartClick={onCartClick} />
    </ToastProvider>
  </ErrorBoundary>
);

export default AdminApp;
