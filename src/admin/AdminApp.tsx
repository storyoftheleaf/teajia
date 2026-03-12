import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, ChevronDown, Menu, ShoppingCart, AlertTriangle, ArrowRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isConfigured, hasToken, clearToken, getTokenClaims } from '../lib/api';
import { Product } from './types';
import { useProducts, useRates } from './hooks/useAdminData';
import { useAppStore } from './store';

// Import Components
import { Sidebar } from './components/Sidebar';
import { TeaTable } from './components/TeaTable';
import { TeawareCatalog } from './components/TeawareCatalog';
import { InventoryView } from './components/InventoryView';
import { CartPanel } from '../components/shared/CartPanel';
import { RecordsView } from './components/SoldItemsView';
import { OrdersView } from './components/OrdersView';
import { CustomersView } from './components/CustomersView';
import { PersonalCollectionView } from './components/PersonalCollectionView';
import { SettingsView } from './components/SettingsView';
import { ToastProvider, useToast } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AdminBottomNav } from './components/AdminBottomNav';
import { DashboardView } from './components/DashboardView';
import { EventsManager } from './components/EventsManager';
import { EventDetail } from './components/EventDetail';

// Import Modals
import { AuthModal } from './components/AuthModal';
import { CsvImportModal } from './components/CsvImportModal';
import { AddToCartModal } from './components/AddToCartModal';
import { AddProductModal } from './components/AddProductModal';

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

const ProtectedRoute = ({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) => {
  if (!isAdmin) return <div className="p-12 text-center text-tea-text-sec font-serif">Access Restricted</div>;
  return <>{children}</>;
};

const AdminContent = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Zustand Store
  const {
    cart, isCartOpen, currency, isDevAdmin,
    addToCart, clearCart, setIsCartOpen, setCurrency, toggleDevAdmin, setCart
  } = useAppStore();

  const [isAuthenticated, setIsAuthenticated] = useState(hasToken());
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const claims = getTokenClaims();
  const userRole = claims?.role || (isDevAdmin ? 'owner' : null);
  const isAdmin = (isAuthenticated && (userRole === 'admin' || userRole === 'owner')) || isDevAdmin;

  // Modals
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [selectedProductForCart, setSelectedProductForCart] = useState<Product | null>(null);

  // React Query Hooks
  const { data: products = [], isLoading: productsLoading, isError: productsError, error: productsErrorObj, refetch: refetchProducts } = useProducts();
  const { data: rates = [], refetch: refetchRates } = useRates();

  const loading = productsLoading;

  // Regular users can browse catalog but not manage inventory
  const isLoggedIn = isAuthenticated || isDevAdmin;

  // Redirect when entering admin at root
  useEffect(() => {
    if (isLoggedIn && location.pathname === '/admin') {
      navigate(isAdmin ? '/admin/inventory' : '/admin/catalog');
    }
  }, [isLoggedIn, isAdmin, navigate, location.pathname]);

  // Early return for missing configuration (after all hooks)
  if (!isConfigured) {
    return (
      <div className="flex min-h-screen bg-tea-bg text-tea-text items-center justify-center p-6">
        <div className="bg-tea-surface border border-tea-border p-8 rounded-lg max-w-md w-full shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tea-accent to-tea-accent/50"></div>
            <div className="mb-6 flex justify-center">
              <div className="p-4 bg-tea-accent/10 rounded-full border border-tea-accent/20">
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
    <div className="flex min-h-screen bg-tea-bg text-tea-text font-sans selection:bg-tea-accent/30">
      <button onClick={() => setIsMobileOpen(true)} className="fixed top-4 left-4 z-40 p-2 bg-tea-surface rounded-xl border border-tea-border md:hidden text-tea-text-sec backdrop-blur-md">
        <Menu size={24} />
      </button>

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
      />

      <main className="flex-1 relative flex flex-col min-w-0">
        <div className="sticky top-0 z-30 bg-tea-bg/80 backdrop-blur-xl border-b border-tea-border px-6 py-4 flex justify-end items-center gap-4 flex-none">
           <button onClick={() => setIsCommandPaletteOpen(true)} className="md:hidden text-tea-text-sec hover:text-tea-text transition-colors p-2.5">
              <Search size={18} />
           </button>
           <button onClick={handleRefresh} className="text-tea-text-sec hover:text-tea-text transition-colors p-2">
              <RefreshCw size={16} />
           </button>

           <div className="relative group">
              <button className="flex items-center gap-2 text-sm font-medium text-tea-text-sec hover:text-tea-text transition-colors">
                {currency} <ChevronDown size={14} />
              </button>
              <div className="absolute right-0 mt-2 w-32 bg-tea-surface border border-tea-border rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden backdrop-blur-xl">
                {rates.map(rate => (
                  <button key={rate.currency} onClick={() => setCurrency(rate.currency)} className={`block w-full text-left px-4 py-2.5 text-sm hover:bg-tea-elevated/50 transition-colors ${currency === rate.currency ? 'text-tea-accent font-medium' : 'text-tea-text-sec'}`}>
                    {rate.currency}
                  </button>
                ))}
              </div>
           </div>

           <div className="w-px h-4 bg-tea-border"></div>

           <button onClick={() => setIsCartOpen(true)} className="relative text-tea-text-sec hover:text-tea-text transition-colors p-2">
             <ShoppingCart size={20} />
             {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-tea-accent text-tea-bg font-bold text-[10px] w-4 h-4 flex items-center justify-center rounded-full shadow-lg shadow-tea-accent/20">{cart.length}</span>}
           </button>
        </div>

        <div className="flex-1 overflow-auto relative pb-16 md:pb-0">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Navigate to="inventory" replace />} />
              <Route path="catalog" element={<PageTransition><TeaTable products={products} currency={currency} rates={rates} onAdd={openAddModal} isAdmin={isAdmin} onEdit={(product) => setEditingProduct(product)} isLoading={loading} isError={productsError} error={productsErrorObj} onRefresh={refetchProducts} /></PageTransition>} />
              <Route path="teaware" element={<PageTransition><TeawareCatalog products={products} currency={currency} rates={rates} onAdd={openAddModal} loading={loading} isAdmin={isAdmin} /></PageTransition>} />

              <Route path="inventory" element={
                <ProtectedRoute isAdmin={isAdmin}>
                  <PageTransition>
                    <InventoryView
                      products={products}
                      isLoading={loading}
                      isError={productsError}
                      error={productsErrorObj}
                      onImportClick={() => setIsImportOpen(true)}
                      onAddClick={() => setIsCreateModalOpen(true)}
                      onRefresh={refetchProducts}
                    />
                  </PageTransition>
                </ProtectedRoute>
              } />
              <Route path="personal" element={<ProtectedRoute isAdmin={isAdmin}><PageTransition><PersonalCollectionView products={products} isLoading={loading} onRefresh={refetchProducts} /></PageTransition></ProtectedRoute>} />
              <Route path="customers" element={<ProtectedRoute isAdmin={isAdmin}><PageTransition><CustomersView /></PageTransition></ProtectedRoute>} />
              <Route path="orders" element={<ProtectedRoute isAdmin={isAdmin}><PageTransition><OrdersView /></PageTransition></ProtectedRoute>} />
              <Route path="records" element={<ProtectedRoute isAdmin={isAdmin}><PageTransition><RecordsView products={products} /></PageTransition></ProtectedRoute>} />
              <Route path="dashboard" element={<ProtectedRoute isAdmin={isAdmin}><PageTransition><DashboardView products={products} isLoading={loading} /></PageTransition></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute isAdmin={isAdmin}><PageTransition><SettingsView /></PageTransition></ProtectedRoute>} />
              <Route path="events" element={<ProtectedRoute isAdmin={isAdmin}><PageTransition><EventsManager /></PageTransition></ProtectedRoute>} />
              <Route path="events/:id" element={<ProtectedRoute isAdmin={isAdmin}><PageTransition><EventDetail /></PageTransition></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="inventory" replace />} />
            </Routes>
          </AnimatePresence>
        </div>

        {/* --- PERSISTENT CART BAR (When Drawer Closed) --- */}
        {cart.length > 0 && !isCartOpen && (
            <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="bg-tea-accent text-tea-bg px-6 py-3 rounded-full shadow-2xl hover:scale-105 transition-transform flex items-center gap-4 border border-tea-accent/20"
                >
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <span className="bg-tea-bg text-tea-accent w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{cart.length}</span>
                        <span className="uppercase tracking-[0.2em] text-xs">View Registry</span>
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

        <AuthModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onAuthSuccess={() => setIsAuthenticated(true)} />
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
