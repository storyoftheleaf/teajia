import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { RefreshCw, ChevronDown, Menu, ShoppingCart, AlertTriangle, ArrowRight, Search, X as XIcon, MoreHorizontal, MapPin } from 'lucide-react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/shared/PullToRefreshIndicator';
import { motion, AnimatePresence } from 'framer-motion';
import { isConfigured, hasToken, clearToken, getTokenClaims, isTokenExpired, SESSION_EXPIRED_EVENT } from '../lib/api';
import { Product } from './types';
import { useProducts, useRates } from './hooks/useAdminData';
import { useAppStore } from './store';

// Import Components
import { Sidebar } from './components/Sidebar';
import { TeaTable } from './components/TeaTable';
import { TeawareCatalog } from './components/TeawareCatalog';
import { InventoryView } from './components/InventoryView';
import { CartPanel } from '../components/shared/CartPanel';
import { ToastProvider, useToast } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AdminBottomNav } from './components/AdminBottomNav';
import { DashboardView } from './components/DashboardView';
import { EventsManager } from './components/EventsManager';
import { EventDetail } from './components/EventDetail';
import { TastingNotesView } from './components/TastingNotesView';
import { PeopleView } from './components/PeopleView';
import { ActivityView } from './components/ActivityView';
import { QuickCapture } from './components/QuickCapture';
import { TeaCompass } from '../components/TeaCompass';
import type { CompassMode } from '../components/TeaCompass';
import SampleSetCreator from '../samples/SampleSetCreator';

// Import Modals
import { AuthModal } from './components/AuthModal';
import { CsvImportModal } from './components/CsvImportModal';
import { AddToCartModal } from './components/AddToCartModal';
import { AddProductModal } from './components/AddProductModal';

/** Reads ?tab= and ?entry= query params and passes them to TeaCompass */
const CompassWithMode: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [params] = useSearchParams();
  const tab = params.get('tab');
  const entryId = params.get('entry');
  const initialMode: CompassMode | undefined =
    tab === 'ledger' ? 'ledger' : tab === 'capture' ? 'capture' : tab === 'browse' ? 'browse' : undefined;
  return <TeaCompass onBack={onBack} initialMode={initialMode} initialEntryId={entryId || undefined} />;
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

const ProtectedRoute = ({ isAdmin, isLoggingIn, children }: { isAdmin: boolean; isLoggingIn?: boolean; children: React.ReactNode }) => {
  if (!isAdmin) {
    // Don't flash "Access Restricted" when the login modal is about to open or is open
    if (isLoggingIn) return null;
    return <div className="p-12 text-center text-tea-text-sec font-serif">Access Restricted</div>;
  }
  return <>{children}</>;
};

const AdminContent = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Zustand Store
  const {
    cart, isCartOpen, currency, isDevAdmin, cartDirection,
    addToCart, clearCart, setIsCartOpen, setCurrency, toggleDevAdmin, setCart, openPurchaseOrder
  } = useAppStore();

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // On mount, check that the token exists AND isn't expired
    if (!hasToken()) return false;
    if (isTokenExpired()) {
      clearToken();
      return false;
    }
    return true;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  // currencyOpen state removed — currency selector moved to InventoryView options menu

  const claims = getTokenClaims();
  const userRole = claims?.role || (isDevAdmin ? 'owner' : null);
  const isAdmin = (isAuthenticated && (userRole === 'admin' || userRole === 'owner')) || isDevAdmin;

  // Listen for session expiry (401 responses clear the token in api.ts)
  useEffect(() => {
    const handleSessionExpired = () => {
      setIsAuthenticated(false);
      setIsLoginOpen(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
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
  const isOnInventory = location.pathname.includes('/admin/inventory');

  // React Query Hooks — only fetch when authenticated to avoid 401 errors on initial load
  const isLoggedIn = isAuthenticated || isDevAdmin;
  const { data: products = [], isLoading: productsLoading, isError: productsError, error: productsErrorObj, refetch: refetchProducts } = useProducts({ enabled: isLoggedIn });
  const { data: rates = [], refetch: refetchRates } = useRates();

  // Pull-to-refresh (mobile)
  const { pullDistance, isRefreshing, progress } = usePullToRefresh(() => {
    refetchProducts();
    refetchRates();
  });

  const loading = productsLoading;

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

  // Redirect when entering admin at root, or prompt login if not authenticated
  useEffect(() => {
    if (isLoggedIn && location.pathname === '/admin') {
      navigate('/admin/inventory');
    } else if (!isLoggedIn && location.pathname.startsWith('/admin')) {
      setIsLoginOpen(true);
    }
  }, [isLoggedIn, isAdmin, navigate, location.pathname]);

  // Close registry drawer when navigating to a different route
  useEffect(() => {
    setIsCartOpen(false);
  }, [location.pathname]);

  // Early return for missing configuration (after all hooks)
  if (!isConfigured) {
    return (
      <div className="flex min-h-[100dvh] bg-tea-bg text-tea-text items-center justify-center p-6">
        <div className="bg-tea-surface border border-tea-border p-8 rounded-lg max-w-md w-full shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tea-accent to-tea-accent/50"></div>
            <div className="mb-6 flex justify-center">
              <div className="p-4 bg-tea-accent/10 rounded-full border border-tea-accent-sub">
                <AlertTriangle className="text-tea-accent" size={32} />
              </div>
            </div>
            <h2 className="text-xl font-serif text-tea-text mb-2">Setup Required</h2>
            <p className="text-tea-text-sec text-sm mb-6 leading-relaxed">
                The application cannot connect to the database. Please configure your API credentials to continue.
            </p>
            <div className="text-left bg-tea-bg/50 p-4 rounded-xl text-xs font-mono text-tea-text-sec mb-6 border border-tea-border space-y-2">
                <p>1. Open <span className="text-tea-text bg-tea-surface px-1 rounded">.env</span> file</p>
                <p>2. Find <span className="text-tea-accent">VITE_API_URL</span></p>
                <p>3. Set it to your Worker API URL</p>
            </div>
            <button onClick={() => window.location.reload()} className="bg-tea-accent text-tea-bg px-6 py-3 rounded-xl text-sm font-medium hover:bg-tea-accent/90 transition-colors w-full">
                I've Updated It, Reload App
            </button>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    clearToken();
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

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-tea-bg text-tea-text font-sans selection:bg-tea-accent/30"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={progress} />
      {/* Mobile hamburger — hidden since bottom nav handles navigation */}

      {isMobileOpen && <div className="fixed inset-0 bg-tea-text/80 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileOpen(false)} />}

      <Sidebar
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
        onLoginClick={() => setIsLoginOpen(true)}
        onLogoutClick={handleLogout}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        cartItemCount={cart.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenPurchase={() => openPurchaseOrder()}
      />

      <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden">
        <div className="z-modal bg-tea-surface/90 backdrop-blur-xl px-3 md:px-6 py-1.5 flex items-center gap-2 flex-none relative">
           {/* Inventory: Tea / Teaware toggle + search */}
           {isOnInventory ? (
             <>
               <div className="flex items-center p-0.5 shrink-0">
                 <button
                   onClick={() => { setInventoryCategory('tea'); setInventorySearchQuery(''); }}
                   className={`px-3 py-1 text-[10px] uppercase tracking-[0.15em] rounded-md transition-colors ${
                     inventoryCategory === 'tea'
                       ? 'text-tea-gold font-medium'
                       : 'text-tea-text-sec hover:text-tea-text'
                   }`}
                 >
                   Tea
                 </button>
                 <button
                   onClick={() => { setInventoryCategory('teaware'); setInventorySearchQuery(''); }}
                   className={`px-3 py-1 text-[10px] uppercase tracking-[0.15em] rounded-md transition-colors ${
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
                   value={inventorySearchQuery}
                   onChange={(e) => { setInventorySearchQuery(e.target.value); setShowSourceSuggestions(true); }}
                   onFocus={() => setShowSourceSuggestions(true)}
                   className="w-full bg-transparent pl-5 pr-7 py-1 text-xs text-tea-text outline-none font-serif italic placeholder-tea-text-sec/50 transition-colors"
                 />
                 {inventorySearchQuery && (
                   <button
                     onClick={() => { setInventorySearchQuery(''); setShowSourceSuggestions(false); }}
                     className="absolute right-2 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text p-0.5"
                   >
                     <XIcon size={12} />
                   </button>
                 )}
                 {/* Source/vendor suggestions dropdown */}
                 {showSourceSuggestions && matchingVendors.length > 0 && (
                   <div className="absolute top-full left-0 right-0 mt-1 bg-tea-surface border border-tea-border rounded-lg shadow-lg overflow-hidden z-priority">
                     <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.15em] text-tea-text-dim border-b border-tea-border">
                       Sources
                     </div>
                     {matchingVendors.map(v => (
                       <button
                         key={v.name}
                         onClick={() => {
                           setInventorySearchQuery('');
                           setShowSourceSuggestions(false);
                           navigate(`/admin/inventory?vendor=${encodeURIComponent(v.name)}`);
                         }}
                         className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-tea-bg/60 transition-colors"
                       >
                         <MapPin size={12} className="text-tea-gold flex-shrink-0" />
                         <span className="text-xs text-tea-text font-serif truncate">{v.name}</span>
                         <span className="text-[10px] text-tea-text-dim ml-auto flex-shrink-0">{v.count} tea{v.count !== 1 ? 's' : ''}</span>
                       </button>
                     ))}
                   </div>
                 )}
               </div>
             </>
           ) : (
             <button onClick={() => setIsCommandPaletteOpen(true)} className="flex items-center gap-2 flex-1 max-w-[200px] bg-tea-bg/60 border border-tea-border rounded-lg px-3 py-1 text-tea-text-dim text-xs hover:border-tea-text-dim transition-colors">
                <Search size={13} />
                <span className="truncate">Search...</span>
             </button>
           )}

           {/* Right: Currency selector */}
           <div className="flex items-center ml-auto shrink-0 relative">
             <select
               value={currency}
               onChange={(e) => setCurrency(e.target.value as any)}
               className="appearance-none bg-transparent text-[10px] text-tea-text-dim uppercase tracking-[0.1em] px-2 py-1 pr-4 cursor-pointer hover:text-tea-text-sec transition-colors outline-none"
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
             >
               <MoreHorizontal size={17} />
             </button>
           )}
        </div>

        <div className="flex-1 relative overflow-hidden pb-[calc(40px+env(safe-area-inset-bottom,0px))] md:pb-0">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Navigate to="inventory" replace />} />

              {/* Core admin views */}
              <Route path="inventory" element={
                <ProtectedRoute isAdmin={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}>
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
              <Route path="activity" element={<ProtectedRoute isAdmin={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><ActivityView products={products} /></PageTransition></ProtectedRoute>} />
              <Route path="people" element={<ProtectedRoute isAdmin={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><PeopleView userRole={userRole || 'user'} /></PageTransition></ProtectedRoute>} />
              <Route path="dashboard" element={<ProtectedRoute isAdmin={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><DashboardView products={products} isLoading={loading} /></PageTransition></ProtectedRoute>} />

              {/* Quick Capture — Intake Hub */}
              <Route path="capture" element={
                <ProtectedRoute isAdmin={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}>
                  <PageTransition>
                    <QuickCapture
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

              {/* Tea Compass + Ledger — full page */}
              <Route path="compass" element={
                <ProtectedRoute isAdmin={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}>
                  <PageTransition>
                    <CompassWithMode onBack={() => navigate('/admin/inventory')} />
                  </PageTransition>
                </ProtectedRoute>
              } />

              {/* Samples */}
              <Route path="samples" element={
                <ProtectedRoute isAdmin={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}>
                  <PageTransition>
                    <SampleSetCreator />
                  </PageTransition>
                </ProtectedRoute>
              } />

              {/* Supplementary views */}
              <Route path="tasting" element={<ProtectedRoute isAdmin={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><TastingNotesView products={products} isLoading={loading} onRefresh={refetchProducts} /></PageTransition></ProtectedRoute>} />
              <Route path="events" element={<ProtectedRoute isAdmin={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><EventsManager /></PageTransition></ProtectedRoute>} />
              <Route path="events/:id" element={<ProtectedRoute isAdmin={isAdmin} isLoggingIn={isLoginOpen || !isLoggedIn}><PageTransition><EventDetail /></PageTransition></ProtectedRoute>} />

              {/* Legacy routes — redirect to new unified views */}
              <Route path="catalog" element={<Navigate to="/admin/inventory" replace />} />
              <Route path="teaware" element={<Navigate to="/admin/inventory" replace />} />
              <Route path="personal" element={<Navigate to="/admin/inventory" replace />} />
              <Route path="customers" element={<Navigate to="/admin/people" replace />} />
              <Route path="sources" element={<Navigate to="/admin/people" replace />} />
              <Route path="orders" element={<Navigate to="/admin/activity" replace />} />
              <Route path="records" element={<Navigate to="/admin/activity" replace />} />
              <Route path="settings" element={<Navigate to="/admin/people" replace />} />

              <Route path="*" element={<Navigate to="inventory" replace />} />
            </Routes>
          </AnimatePresence>
        </div>

        {/* --- PERSISTENT CART BAR (When Drawer Closed) --- */}
        {cart.length > 0 && !isCartOpen && (
            <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="bg-tea-accent text-tea-bg px-6 py-3 rounded-full shadow-2xl hover:scale-105 transition-transform flex items-center gap-4 border border-tea-accent-sub"
                >
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <span className="bg-tea-bg text-tea-accent w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{cart.length}</span>
                        <span className="uppercase tracking-[0.2em] text-xs">{cartDirection === 'purchase' ? 'View Order' : 'View Registry'}</span>
                    </div>
                    <ArrowRight size={16} />
                </button>
            </div>
        )}

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

        <AuthModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onAuthSuccess={() => { setIsAuthenticated(true); refetchProducts(); refetchRates(); }} />
        <CsvImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onComplete={refetchProducts} />

        <AddProductModal
          isOpen={isCreateModalOpen || !!editingProduct}
          onClose={() => { setIsCreateModalOpen(false); setEditingProduct(null); }}
          initialData={editingProduct || undefined}
          onSuccess={() => { refetchProducts(); setEditingProduct(null); setIsCreateModalOpen(false); }}
          rates={rates}
        />

        <CommandPalette onAddProduct={() => setIsCreateModalOpen(true)} externalOpen={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />

        <AdminBottomNav
          onSearchClick={() => setIsCommandPaletteOpen(true)}
          onCartClick={() => setIsCartOpen(true)}
          cartItemCount={cart.length}
          isAdmin={isAdmin}
          onAddProduct={() => setIsCreateModalOpen(true)}
        />

      </main>
    </div>
  );
};

const AdminApp = () => (
  <ErrorBoundary>
    <ToastProvider>
      <AdminContent />
    </ToastProvider>
  </ErrorBoundary>
);

export default AdminApp;
