import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronDown, AlertTriangle, Search, X as XIcon, MoreHorizontal, MapPin, ShieldCheck, ArrowLeft } from 'lucide-react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/shared/PullToRefreshIndicator';
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

// Banner shown across all admin views when a platform owner has switched into
// an account they're not a member of. Reminds them every action is logged and
// gives one-click return to their home account.
const OperatingAsBanner: React.FC<{
  activeAccountId: string;
  fallbackName: string;
  onReturn: () => void;
  canReturn: boolean;
}> = ({ activeAccountId, fallbackName, onReturn, canReturn }) => {
  const [accountName, setAccountName] = useState(fallbackName);
  useEffect(() => {
    let cancelled = false;
    api.accounts.get(activeAccountId)
      .then((acc: any) => { if (!cancelled && acc?.name) setAccountName(acc.name); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeAccountId]);
  return (
    <div className="flex-none bg-tea-gold/10 border-b border-tea-gold/30 px-4 py-2 flex items-center gap-3">
      <ShieldCheck size={14} className="text-tea-gold shrink-0" />
      <div className="flex-1 min-w-0 text-ui-11 tracking-wide text-tea-text">
        Operating as <span className="font-semibold">{accountName}</span>
        <span className="text-tea-text-sec"> — every action is logged and visible to the account owner.</span>
      </div>
      {canReturn && (
        <button
          onClick={onReturn}
          className="flex items-center gap-1 text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-text px-2 py-1 rounded-md hover:bg-tea-gold/10 transition-colors shrink-0"
        >
          <ArrowLeft size={11} /> Return home
        </button>
      )}
    </div>
  );
};
import { useProducts, useRates } from './hooks/useAdminData';
import { eventsListQueryOptions } from './hooks/useEventData';
import { useAppStore } from './store';
import { selectHasBundle } from '../lib/store';

// Import Components
import { TeaTable } from './components/TeaTable';
import { TeawareCatalog } from './components/TeawareCatalog';
import { InventoryView } from './components/InventoryView';
import { CartPanel } from '../components/shared/CartPanel';
import { ToastProvider, useToast } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardView } from './components/DashboardView';
import { NoMembershipGate } from './components/NoMembershipGate';
import { AccountSettingsView } from './views/AccountSettingsView';
import { StoreLaunchPlaybookView } from './views/StoreLaunchPlaybookView';
import { PlatformAdminView } from './views/PlatformAdminView';
import { AccessView } from './views/AccessView';
import { PlatformAccessView } from './views/PlatformAccessView';
import { CurrencyRatesView } from './views/CurrencyRatesView';
import { MCPTokensView } from './views/MCPTokensView';
import { OAuthConsentView } from './views/OAuthConsentView';
import { EventsManager } from './components/EventsManager';
import { EventDetail } from './components/EventDetail';
import { TastingEventsList } from './components/tasting/TastingEventsList';
import { TastingEventForm } from './components/tasting/TastingEventForm';
import { TastingControlRoom } from './components/tasting/TastingControlRoom';
import { VenueManager } from './components/VenueManager';
import { PeopleView } from './components/PeopleView';
import { CustomerProfilePage } from './components/CustomerProfilePage';
import { ActivityView } from './components/ActivityView';
import { DraftsView } from './components/DraftsView';
import { IntakeWorkspace } from './views/IntakeWorkspace';
import { CatalogView } from './views/CatalogView';
import { PurchaseOrdersPage } from './views/PurchaseOrdersPage';
import { TeaCompass } from '../components/TeaCompass';
import type { CompassMode, CompassSurfaceVariant } from '../components/TeaCompass';
import { VendorProfileView } from './views/VendorProfileView';
import { ProductStoryView } from './views/ProductStoryView';
import { PlatformAuditLogPage } from './views/PlatformAuditLogPage';
import { AccountActivityView } from './views/AccountActivityView';
import { MagazineView } from './views/MagazineView';
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
const CompassWithMode: React.FC<{ onBack: () => void; surfaceVariant?: CompassSurfaceVariant }> = ({ onBack, surfaceVariant = 'playbook' }) => {
  const [params] = useSearchParams();
  const tab = params.get('tab');
  const entryId = params.get('entry');
  const capture = params.get('capture');
  const initialMode: CompassMode | undefined =
    tab === 'buying' ? 'buying' : tab === 'ledger' ? 'buying' :
    tab === 'sourcing' ? 'sourcing' : tab === 'capture' ? 'sourcing' :
    tab === 'samples' ? 'sourcing' :
    // 'tasting' kept as a back-compat alias for the old query param —
    // internal name is now 'library' since this view is the Library of
    // past compass captures, not the Tasting surface (that lives at
    // /account/journal).
    tab === 'tasting' ? 'library' : tab === 'browse' ? 'library' :
    tab === 'library' ? 'library' :
    undefined;
  const initialCaptureOption: 'tea' | 'teaware' | 'samples' | undefined =
    tab === 'samples' || capture === 'samples' ? 'samples' :
    capture === 'teaware' ? 'teaware' :
    capture === 'tea' ? 'tea' :
    undefined;
  return (
    <TeaCompass
      onBack={onBack}
      initialMode={initialMode}
      initialEntryId={entryId || undefined}
      initialCaptureOption={initialCaptureOption}
      surfaceVariant={surfaceVariant}
    />
  );
};

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className="h-full"
  >
    {children}
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
  // currencyOpen state removed — currency selector moved to InventoryView options menu

  const claims = getTokenClaims();
  const userRole = claims?.role || (isDevAdmin ? 'owner' : null);
  // Role tiers — each tier is a superset of the one below
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
          // Truly dead — clear and prompt login. This is the graceful
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

  // Inventory top-bar controls (lifted from InventoryView)
  const [inventoryCategory, setInventoryCategory] = useState<'tea' | 'teaware'>('tea');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [showSourceSuggestions, setShowSourceSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const isOnInventory = location.pathname.includes('/admin/stock') || location.pathname.includes('/admin/inventory');
  const isOnCapture = location.pathname.includes('/admin/capture');
  const isOnIntake = location.pathname.includes('/admin/intake');
  const isOnHome = location.pathname === '/admin/' || location.pathname === '/admin/compass';
  const isOnCompass = location.pathname.includes('/admin/compass');

  // React Query Hooks — only fetch when authenticated to avoid 401 errors on initial load
  const isLoggedIn = isAuthenticated || isDevAdmin;
  const { data: products = [], isLoading: productsLoading, isError: productsError, error: productsErrorObj, refetch: refetchProducts } = useProducts({ enabled: isLoggedIn });
  const { data: rates = [], refetch: refetchRates } = useRates();

  // Incoming compass shares — poll every 60s for badge count
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

  // Extract unique vendors with tea counts for source suggestions
  const vendorSuggestions = useMemo(() => {
    const vendorMap = new Map<string, number>();
    for (const p of products) {
      if (p.vendor && p.status !== 'Archived') {
        vendorMap.set(p.vendor, (vendorMap.get(p.vendor) || 0) + 1);
      }
    }
    return Array.from(vendorMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [products]);

  // Filter vendors matching the search query
  const matchingVendors = useMemo(() => {
    if (!inventorySearchQuery || inventorySearchQuery.length < 2) return [];
    const q = inventorySearchQuery.toLowerCase();
    return vendorSuggestions.filter(v => v.name.toLowerCase().includes(q)).slice(0, 5);
  }, [inventorySearchQuery, vendorSuggestions]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSourceSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Redirect when entering admin at root, or prompt login if not authenticated.
  // A short delay lets Zustand persist middleware finish rehydrating isDevAdmin
  // from localStorage before we evaluate isLoggedIn, preventing a false-negative
  // that would skip the login modal on fresh visits.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoggedIn && location.pathname === '/admin') {
        navigate('/admin/compass');
      } else if (!isLoggedIn && location.pathname.startsWith('/admin')) {
        navigate('/signin', { state: { from: location.pathname } });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isLoggedIn, navigate, location.pathname]);

  // Close registry drawer when navigating to a different route
  useEffect(() => {
    setIsCartOpen(false);
  }, [location.pathname]);

  // Gate: authenticated user with no memberships yet — show waiting screen
  const needsMembershipGate =
    isAuthenticated && !isDevAdmin && memberships.length === 0;

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
            <button onClick={() => window.location.reload()} className="bg-tea-gold text-tea-bg px-6 py-3 rounded-xl text-sm font-medium hover:bg-tea-gold/90 transition-colors w-full">
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

  const isPlatformOwner = platformRole === 'platform_owner' || platformRole === 'platform_admin';
  const isOperatingAs = isPlatformOwner && !!activeAccountId && !memberships.some(m => m.account_id === activeAccountId);
  const operatingAsName = isOperatingAs
    ? (memberships.find(m => m.account_id === activeAccountId)?.account_name || 'this account')
    : '';

  const handleReturnHome = async () => {
    if (memberships.length === 0) return;
    try {
      await api.accounts.switch(memberships[0].account_id);
      hydrateAccountStateFromToken();
      showToast(`Returned to ${memberships[0].account_name}`, 'info');
    } catch (err) {
      console.error('return-home switch failed', err);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-tea-bg text-tea-text font-sans selection:bg-tea-gold/30">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={progress} />

      {isOperatingAs && (
        <OperatingAsBanner
          activeAccountId={activeAccountId!}
          fallbackName={operatingAsName}
          onReturn={handleReturnHome}
          canReturn={memberships.length > 0}
        />
      )}

      <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden">
        {isOnInventory && <div className="z-modal bg-tea-surface/90 backdrop-blur-xl px-3 md:px-6 py-1.5 flex items-center gap-2 flex-none relative">
           {/* Inventory: Tea / Teaware toggle + search */}
           {isOnInventory ? (
             <>
               <div className="flex items-center p-0.5 shrink-0">
                 <button
                   onClick={() => { setInventoryCategory('tea'); setInventorySearchQuery(''); }}
                   className={`px-3 py-1 text-ui-10 uppercase tracking-[0.15em] rounded-md transition-colors ${
                     inventoryCategory === 'tea'
                       ? 'text-tea-gold font-medium'
                       : 'text-tea-text-sec hover:text-tea-text'
                   }`}
                 >
                   Tea
                 </button>
                 <button
                   onClick={() => { setInventoryCategory('teaware'); setInventorySearchQuery(''); }}
                   className={`px-3 py-1 text-ui-10 uppercase tracking-[0.15em] rounded-md transition-colors ${
                     inventoryCategory === 'teaware'
                       ? 'text-tea-gold font-medium'
                       : 'text-tea-text-sec hover:text-tea-text'
                   }`}
                 >
                   Wares
                 </button>
               </div>
               <div className="relative flex-1 min-w-0" ref={searchContainerRef}>
                 <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-tea-text-sec pointer-events-none" size={13} />
                 <input
                   type="text"
                   placeholder={inventoryCategory === 'tea' ? 'Search tea or source…' : 'Search teaware…'}
                   aria-label={inventoryCategory === 'tea' ? 'Search tea or source' : 'Search teaware'}
                   value={inventorySearchQuery}
                   onChange={(e) => { setInventorySearchQuery(e.target.value); setShowSourceSuggestions(true); }}
                   onFocus={() => setShowSourceSuggestions(true)}
                   className="w-full bg-transparent pl-5 pr-7 py-1 text-xs text-tea-text outline-none font-serif italic placeholder-tea-text-sec/50 transition-colors"
                 />
                 {inventorySearchQuery && (
                   <button
                     onClick={() => { setInventorySearchQuery(''); setShowSourceSuggestions(false); }}
                     className="absolute right-2 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text p-0.5"
                     aria-label="Clear inventory search"
                   >
                     <XIcon size={12} />
                   </button>
                 )}
                 {/* Source/vendor suggestions dropdown */}
                 {showSourceSuggestions && matchingVendors.length > 0 && (
                   <div className="absolute top-full left-0 right-0 mt-1 bg-tea-surface border border-tea-border rounded-xl shadow-lg overflow-hidden z-priority">
                     <div className="px-3 py-1.5 text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim border-b border-tea-border">
                       Sources
                     </div>
                     {matchingVendors.map(v => (
                       <button
                         key={v.name}
                         onClick={() => {
                           setInventorySearchQuery('');
                           setShowSourceSuggestions(false);
                           navigate(`/admin/stock?vendor=${encodeURIComponent(v.name)}`);
                         }}
                         className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-tea-bg/60 transition-colors"
                       >
                         <MapPin size={12} className="text-tea-text-sec flex-shrink-0" />
                         <span className="text-xs text-tea-text font-serif truncate">{v.name}</span>
                         <span className="text-ui-10 text-tea-text-dim ml-auto flex-shrink-0">{v.count} tea{v.count !== 1 ? 's' : ''}</span>
                       </button>
                     ))}
                   </div>
                 )}
               </div>
             </>
           ) : (
             <button onClick={() => setIsCommandPaletteOpen(true)} className="flex items-center gap-2 flex-1 max-w-[200px] bg-tea-bg/60 border border-tea-border rounded-xl px-3 py-1 text-tea-text-dim text-xs hover:border-tea-text-dim transition-colors">
                <Search size={13} />
                <span className="truncate">Search...</span>
             </button>
           )}

           {/* Current account badge — so staff never forget which store they're acting on */}
           {activeMembership && (
             <div
               className="hidden sm:flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md bg-tea-elevated border border-tea-border shrink-0"
               title={`Active account: ${activeMembership?.account_name}`}
             >
               <span className="w-1.5 h-1.5 rounded-full bg-tea-gold shrink-0" />
               <span className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec font-medium truncate max-w-[140px]">
                 {activeMembership?.account_name}
               </span>
             </div>
           )}

           {/* Right: Currency selector */}
           <div className="flex items-center ml-auto shrink-0 relative">
             <select
               value={currency}
               onChange={(e) => setCurrency(e.target.value as any)}
               aria-label="Select currency"
               className="appearance-none bg-transparent text-ui-10 text-tea-text-dim uppercase tracking-[0.1em] px-2 py-1 pr-4 cursor-pointer hover:text-tea-text-sec transition-colors outline-none"
             >
               {rates.map(rate => (
                 <option key={rate.currency} value={rate.currency} className="bg-tea-surface text-tea-text">
                   {rate.currency}
                 </option>
               ))}
             </select>
             <ChevronDown size={8} className="absolute right-1 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
           </div>
           {isOnInventory && (
             <button
               onClick={() => setInventoryOptionsOpen(!inventoryOptionsOpen)}
               className="w-8 h-8 flex items-center justify-center text-tea-text-dim hover:text-tea-text-sec transition-colors rounded-md shrink-0"
               aria-label="Open inventory actions"
               aria-expanded={inventoryOptionsOpen}
               aria-haspopup="menu"
             >
               <MoreHorizontal size={17} />
             </button>
           )}
        </div>}

        <div className={`flex-1 relative min-h-0 ${isOnInventory || isOnCapture || isOnIntake ? 'overflow-hidden' : 'overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom,0px))] lg:pb-0'}`}>
          <Routes>
              <Route path="/" element={<Navigate to="compass" replace />} />
              <Route path="home" element={<Navigate to="../compass" replace />} />

              {/* Member tools — all authenticated members */}
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
                    <CompassWithMode onBack={() => navigate(-1)} surfaceVariant="classic" />
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

              {/* Member tools — events + samples open to all members */}
              <Route path="events" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><EventsManager /></PageTransition></ProtectedRoute>} />
              <Route path="events/:id" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><EventDetail /></PageTransition></ProtectedRoute>} />
              <Route path="tasting-events" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><TastingEventsList /></PageTransition></ProtectedRoute>} />
              <Route path="tasting-events/new" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><TastingEventForm /></PageTransition></ProtectedRoute>} />
              <Route path="tasting-events/:sessionId" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><TastingControlRoom /></PageTransition></ProtectedRoute>} />
              <Route path="tasting-events/:sessionId/live" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><TastingControlRoom /></PageTransition></ProtectedRoute>} />
              <Route path="venues" element={<ProtectedRoute hasAccess={hasGatherBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><VenueManager /></PageTransition></ProtectedRoute>} />
              <Route path="samples" element={<Navigate to="/admin/compass?tab=samples" replace />} />

              {/* Operations — staff, admin, owner */}
              <Route path="activity" element={<ProtectedRoute hasAccess={hasSellBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><ActivityView products={products} /></PageTransition></ProtectedRoute>} />
              <Route path="activity-logs" element={<Navigate to="/admin/activity?tab=log" replace />} />
              <Route path="people" element={<ProtectedRoute hasAccess={canUsePeople} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><PeopleView userRole={userRole || 'user'} /></PageTransition></ProtectedRoute>} />
              <Route path="people/:customerId" element={<ProtectedRoute hasAccess={canUsePeople} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><CustomerProfilePage /></PageTransition></ProtectedRoute>} />
              <Route path="contact-tags" element={<ProtectedRoute hasAccess={isStaff} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><ContactTagsView /></PageTransition></ProtectedRoute>} />

              {/* Management — admin, owner. Canonical route is /admin/stock;
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
                      externalShowOptions={inventoryOptionsOpen}
                      onOptionsToggle={setInventoryOptionsOpen}
                    />
                  </PageTransition>
                </ProtectedRoute>
              } />
              <Route path="inventory" element={<Navigate to={`/admin/stock${location.search}`} replace />} />
              <Route path="intake" element={<ProtectedRoute hasAccess={canManageInventory} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><IntakeWorkspace onRefresh={refetchProducts} /></PageTransition></ProtectedRoute>} />
              <Route path="dashboard" element={<ProtectedRoute hasAccess={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><DashboardView products={products} isLoading={loading} /></PageTransition></ProtectedRoute>} />
              <Route path="vendors/:vendorId" element={<ProtectedRoute hasAccess={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><VendorProfileView /></PageTransition></ProtectedRoute>} />
              <Route path="products/:id/story" element={<ProtectedRoute hasAccess={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><ProductStoryView /></PageTransition></ProtectedRoute>} />
              <Route path="purchase-orders" element={<Navigate to="/admin/people?tab=purchase-orders" replace />} />
              <Route path="team" element={<Navigate to="/admin/access" replace />} />
              <Route path="access" element={<ProtectedRoute hasAccess={hasMembersBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><AccessView /></PageTransition></ProtectedRoute>} />
              <Route path="access/platform" element={<ProtectedRoute hasAccess={isAdmin && !!platformRole} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><PlatformAccessView /></PageTransition></ProtectedRoute>} />
              <Route path="currency" element={<ProtectedRoute hasAccess={isAdmin && !!platformRole} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><CurrencyRatesView /></PageTransition></ProtectedRoute>} />
              <Route path="mcp-tokens" element={<ProtectedRoute hasAccess={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><MCPTokensView /></PageTransition></ProtectedRoute>} />
              <Route path="oauth-consent" element={<ProtectedRoute hasAccess={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><OAuthConsentView /></PageTransition></ProtectedRoute>} />
              {/* Network hub — single page with tabbed surfaces */}
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
              <Route path="launch-playbook" element={<ProtectedRoute hasAccess={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><StoreLaunchPlaybookView /></PageTransition></ProtectedRoute>} />
              <Route path="account-settings" element={<ProtectedRoute hasAccess={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><AccountSettingsView /></PageTransition></ProtectedRoute>} />
              <Route path="activity" element={<ProtectedRoute hasAccess={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><AccountActivityView /></PageTransition></ProtectedRoute>} />
              <Route path="platform" element={<ProtectedRoute hasAccess={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><PlatformAdminView /></PageTransition></ProtectedRoute>} />
              <Route path="platform/audit-log" element={<ProtectedRoute hasAccess={isAdmin && !!platformRole} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><PlatformAuditLogPage /></PageTransition></ProtectedRoute>} />
              <Route path="magazine" element={<ProtectedRoute hasAccess={hasPublishBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><MagazineView /></PageTransition></ProtectedRoute>} />
              <Route path="collections" element={<ProtectedRoute hasAccess={hasPublishBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><CollectionsView /></PageTransition></ProtectedRoute>} />
              <Route path="collections/inbound/:pubId" element={<ProtectedRoute hasAccess={hasPublishBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><InboundCollectionView /></PageTransition></ProtectedRoute>} />
              <Route path="collections/:id" element={<ProtectedRoute hasAccess={hasPublishBundle} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><CollectionEditView /></PageTransition></ProtectedRoute>} />

              {/* Legacy routes — redirect to new unified views */}
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
