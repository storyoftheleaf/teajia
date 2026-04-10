
import React, { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';

// Reload once on stale chunk hash (happens after a new deployment)
function lazyWithReload<T extends { default: React.ComponentType<unknown> }>(
  factory: () => Promise<T>
): React.LazyExoticComponent<T['default']> {
  return lazy(() =>
    factory().catch(() => {
      if (!sessionStorage.getItem('chunkReloaded')) {
        sessionStorage.setItem('chunkReloaded', '1');
        window.location.reload();
      }
      return new Promise<T>(() => {}); // suspend forever while reloading
    })
  );
}

const AdminApp = lazyWithReload(() => import('./admin/AdminApp'));
const MediaViewer = lazy(() => import('./components/MediaViewer').then(m => ({ default: m.MediaViewer })));
const Reader = lazy(() => import('./components/Reader').then(m => ({ default: m.Reader })));
const VisualFeatureViewer = lazy(() => import('./components/PhotoEssay/VisualFeatureViewer').then(m => ({ default: m.VisualFeatureViewer })));
const Shop = lazyWithReload(() => import('./components/Shop').then(m => ({ default: m.Shop })));
const SharedCollection = lazy(() => import('./components/SharedCollection').then(m => ({ default: m.SharedCollection })));
const EventLanding = lazy(() => import('./components/events/EventLanding'));
const GuestManagement = lazy(() => import('./components/events/GuestManagement'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const OrderStatusPage = lazy(() => import('./pages/OrderStatusPage'));
const JourneyPage = lazy(() => import('./pages/JourneyPage'));
const GuestInviteClaimPage = lazy(() => import('./pages/GuestInviteClaimPage'));
const SamplePage = lazy(() => import('./pages/SamplePage'));
const ShareCardPage = lazy(() => import('./pages/ShareCardPage'));
const Storefront = lazy(() => import('./components/storefront/Storefront').then(m => ({ default: m.Storefront })));
const FindATable = lazy(() => import('./components/storefront/FindATable').then(m => ({ default: m.FindATable })));

import { useQuery } from '@tanstack/react-query';
import { fetchStore } from './lib/storefrontApi';
import { STORIES, LEARN_STORIES } from './constants';
import { Story, ContentType, ViewState, Person, InventoryItem, Section } from './types';
import type { Account } from './types';
import { useAppStore } from './lib/store';
import { useAuth } from './hooks/useAuth';
import { useFavoritesSync } from './hooks/useFavoritesSync';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useTastingJournalSync } from './hooks/useTastingJournalSync';
import { useCompassSync } from './hooks/useCompassSync';
import { useNotesSync } from './hooks/useNotesSync';
import { pathToSection, sectionToPath } from './lib/routes';
import { ContributorProfile } from './components/ContributorProfile';
import { ShareModal } from './components/ShareModal';
import { Icons } from './components/Icons';
import { CartPanel } from './components/shared/CartPanel';
import { CartIndicator } from './components/shared/CartIndicator';
import { LearnHub } from './components/LearnHub';
import { HomePage } from './components/HomePage';
import { StoryProvider, useStories } from './context/StoryContext';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { ThemeProvider } from './context/ThemeContext';
import { ImagePreloaderProvider } from './context/ImagePreloaderContext';
import { AccountPanel } from './components/AccountPanel';
import { GlobalSearch } from './components/shared/GlobalSearch';
import { LeftSidebar } from './components/LeftSidebar';
import { BottomTabBar } from './components/BottomTabBar';
import { MagazineTabbed } from './components/MagazineTabbed';
import { ConsultPage } from './components/ConsultPage';
import AboutPage from './AboutPage';
import Footer from './components/shared/Footer';
import { ErrorBoundary } from './admin/components/ErrorBoundary';
import { SectionSkeleton } from './components/shared/SectionSkeleton';
import { PullToRefreshIndicator } from './components/shared/PullToRefreshIndicator';
import { NetworkStatus } from './components/shared/NetworkStatus';
import { SessionExpiredNotice } from './components/shared/SessionExpiredNotice';
import { PreloadIndicator } from './components/shared/PreloadIndicator';
import { CartFlyAnimation } from './components/shared/CartFlyAnimation';
import { CartToast } from './components/shared/CartToast';
import { ScrollProgressBar } from './components/shared/ScrollProgressBar';
import { BackToTop } from './components/shared/BackToTop';
import { AnimatedRoutes } from './components/shared/AnimatedRoutes';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { COMMUNITY_MEMBERS } from './data/communityMembers';
import { TEA_INSPIRE_IMAGES } from './data/teaInspire';

// View Transitions API feature detection (#46)
const supportsViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document;

// Create an inner component to use the context
const AppContent = () => {
  // Track click/tap position for cart fly animation (activeElement unreliable on mobile)
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      const point = 'touches' in e ? e.touches[0] : e;
      if (point) {
        (window as any).__teajia_last_click = { x: point.clientX, y: point.clientY };
      }
    };
    window.addEventListener('pointerdown', handler as EventListener, { passive: true });
    return () => window.removeEventListener('pointerdown', handler as EventListener);
  }, []);

  const { stories } = useStories();
  const { inventory, isLoading: inventoryLoading, isError: inventoryError, error: inventoryErrorObj, refetch: refetchInventory } = useInventory();
  const {
    publicCart: cart,
    isPublicCartOpen: isCartOpen,
    addToPublicCart,
    removeFromPublicCart,
    updatePublicCartQuantity,
    setIsPublicCartOpen: setIsCartOpen,
    sidebarCollapsed,
  } = useAppStore();
  const { isAdmin, isAuthenticated } = useAuth();
  useFavoritesSync(isAuthenticated);
  useOfflineSync(isAuthenticated);
  useTastingJournalSync(isAuthenticated);
  useCompassSync(isAuthenticated);
  useNotesSync(isAuthenticated);
  const showAdminBar = false;

  const { pullDistance, isRefreshing, progress } = usePullToRefresh();

  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = pathToSection(location.pathname);

  // Detect active storefront from pathname to route checkout to that store's
  // WhatsApp number. Shares the react-query cache with <Storefront /> itself.
  const storefrontSlug = useMemo(() => {
    const m = location.pathname.match(/^\/store\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }, [location.pathname]);

  const { data: activeStore } = useQuery<Account>({
    queryKey: ['storefront', 'store', storefrontSlug],
    queryFn: () => fetchStore(storefrontSlug as string),
    enabled: !!storefrontSlug,
    staleTime: 1000 * 60 * 5,
  });

  const [magazineDefaultTab, setMagazineDefaultTab] = useState<'articles' | 'visual' | 'tea-inspire'>('articles');
  const [isSectionTransitioning, setIsSectionTransitioning] = useState(false);

  // Scroll position memory for each section
  const scrollPositions = useRef<Record<Section, number>>({
    HOME: 0, MAGAZINE: 0, LEARN: 0, SHOP: 0, OFFERINGS: 0, ACCOUNT: 0, ABOUT: 0
  });
  const prevSection = useRef<Section>(activeSection);
  // Track whether the navigation was a deliberate link click (scroll to top)
  // vs browser back/forward (restore saved position)
  const isNavClick = useRef(false);

  useEffect(() => {
    if (prevSection.current !== activeSection) {
      scrollPositions.current[prevSection.current] = window.scrollY;
      if (isNavClick.current) {
        // Deliberate link click — go to top
        window.scrollTo(0, 0);
        isNavClick.current = false;
      } else {
        // Browser back/forward — restore saved position
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPositions.current[activeSection]);
        });
      }
      prevSection.current = activeSection;
    }
  }, [activeSection]);

  // Update document title on section change
  useEffect(() => {
    const titles: Record<Section, string> = {
      HOME: 'Teajia | Tea Journal',
      MAGAZINE: 'Magazine — Teajia',
      LEARN: 'Learn — Teajia',
      SHOP: 'Shop — Teajia',
      OFFERINGS: 'Consult — Teajia',
      ACCOUNT: 'Account — Teajia',
      ABOUT: 'About — Teajia',
    };
    document.title = titles[activeSection] ?? 'Teajia | Tea Journal';
  }, [activeSection]);

  // Navigate to section with skeleton flash
  const setActiveSection = useCallback((section: Section) => {
    if (section === activeSection) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    isNavClick.current = true;
    setIsSectionTransitioning(true);
    setShowAccountModal(false);
    setTimeout(() => {
      navigate(sectionToPath(section));
      setViewState('BROWSE');
      setSelectedStory(null);
      setIsSectionTransitioning(false);
    }, 120);
  }, [activeSection, navigate]);

  const [viewState, setViewState] = useState<ViewState>('BROWSE');
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  // Track where user came from for back navigation
  const [returnToSection, setReturnToSection] = useState<Section>('MAGAZINE');
  const [returnToTab, setReturnToTab] = useState<'articles' | 'visual' | 'tea-inspire'>('articles');

  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [sharingStory, setSharingStory] = useState<Story | null>(null);

  // User State — persisted to localStorage (#77, #78)
  const [savedStoryIds, setSavedStoryIds] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('teajia_saved_stories') || '{}'); } catch { return {}; }
  });
  const [watchedStoryIds, setWatchedStoryIds] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('teajia_watched_stories') || '{}'); } catch { return {}; }
  });

  // Persist saved/watched stories to localStorage
  useEffect(() => { localStorage.setItem('teajia_saved_stories', JSON.stringify(savedStoryIds)); }, [savedStoryIds]);
  useEffect(() => { localStorage.setItem('teajia_watched_stories', JSON.stringify(watchedStoryIds)); }, [watchedStoryIds]);

  // Cart state managed by Zustand store (publicCart)

  // Modal State
  const [showContact, setShowContact] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  // UI Feedback State
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [cartToast, setCartToast] = useState<{ itemName: string; cartCount: number } | null>(null);
  const [flyAnimation, setFlyAnimation] = useState<{ x: number; y: number; image?: string } | null>(null);

  // Listen for cart open event from Account section
  useEffect(() => {
    const onOpenCartEvent = () => setIsCartOpen(true);
    window.addEventListener('openCart', onOpenCartEvent);
    return () => window.removeEventListener('openCart', onOpenCartEvent);
  }, []);

  // Listen for navigate CustomEvent from HomePage sections
  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const section = (e as CustomEvent).detail?.section as Section;
      if (section) setActiveSection(section);
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, [setActiveSection]);

  // Listen for openArticle CustomEvent dispatched from product detail cards
  useEffect(() => {
    const handler = (e: Event) => {
      const story = (e as CustomEvent).detail?.story as Story | undefined;
      if (!story) return;
      setReturnToSection(activeSection);
      setReturnToTab(magazineDefaultTab);
      setSelectedStory(story);
      setWatchedStoryIds(prev => ({ ...prev, [story.id]: true }));
      if (story.type === ContentType.Article) {
        setViewState('READER');
      } else if (story.type === ContentType.PhotoEssay) {
        setViewState('PHOTO_ESSAY');
      } else {
        setViewState('STORY_VIEW');
      }
    };
    window.addEventListener('openArticle', handler);
    return () => window.removeEventListener('openArticle', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, magazineDefaultTab]);

  // Cart persistence handled by Zustand persist middleware

  // Global search keyboard shortcut (Cmd/Ctrl+K)
  useEffect(() => {
    const handleSearchShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  // Desktop keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const sections: Section[] = ['HOME', 'MAGAZINE', 'LEARN', 'OFFERINGS', 'SHOP'];
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        setActiveSection(sections[parseInt(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveSection]);

  // Separate Inventory into Tea and Ware
  const teaInventory = useMemo(() => inventory.filter(i => i.category === 'tea'), [inventory]);
  const teawareInventory = useMemo(() => inventory.filter(i => i.category === 'ware'), [inventory]);

  // Filter out any story that isn't PUBLISHED (e.g. Vault content)
  const publishedStories = useMemo(() => {
      return stories.filter(s => s.status === 'published');
  }, [stories]);

  const handleAddToCart = (item: InventoryItem, qty: number, total: number) => {
    if (item.stock_g !== undefined && item.stock_g <= 0) {
      setCartToast({ itemName: `${item.name} is sold out`, cartCount: useAppStore.getState().publicCart.length });
      return;
    }

    // Use the most recent click/tap position for fly origin, fall back to screen center
    let originX = window.innerWidth / 2 - 24;
    let originY = window.innerHeight / 2;
    // Try the click event target first (works reliably on mobile tap)
    const lastClick = (window as any).__teajia_last_click as { x: number; y: number } | undefined;
    if (lastClick) {
      originX = lastClick.x;
      originY = lastClick.y;
    } else {
      const active = document.activeElement as HTMLElement;
      if (active && active !== document.body) {
        const rect = active.getBoundingClientRect();
        originX = rect.left + rect.width / 2;
        originY = rect.top + rect.height / 2;
      }
    }

    setFlyAnimation({
      x: originX,
      y: originY,
      image: item.image,
    });

    const pricePerGram = item.category === 'tea'
      ? parseFloat(item.price_per_gram || '0')
      : parseFloat(item.price_50g || '0');

    addToPublicCart({
      id: item.id,
      name: item.name,
      variant: item.variant,
      category: item.category,
      quantityGrams: qty,
      pricePerGram,
      totalPrice: total,
      image: item.image,
    });
    // Show cart toast — read fresh count from store (Zustand updates synchronously)
    const freshCart = useAppStore.getState().publicCart;
    setCartToast({ itemName: item.name, cartCount: freshCart.length });
  };

  const handleRemoveFromCart = (id: string) => {
    removeFromPublicCart(id);
  };

  const handleUpdateCartQuantity = (id: string, grams: number) => {
    updatePublicCartQuantity(id, grams);
  };

  const handleCardClick = (story: Story) => {
    // Save current location before navigating
    setReturnToSection(activeSection);
    setReturnToTab(magazineDefaultTab);

    setSelectedStory(story);
    if (!watchedStoryIds[story.id]) {
       setWatchedStoryIds(prev => ({ ...prev, [story.id]: true }));
    }

    let newViewState: ViewState;
    if (story.type === ContentType.Article) {
      newViewState = 'READER';
    } else if (story.type === ContentType.PhotoEssay) {
      newViewState = 'PHOTO_ESSAY';
    } else {
      newViewState = 'STORY_VIEW';
    }
    setViewState(newViewState);
  };

  const handleBackToBrowse = () => {
    setViewState('BROWSE');
    setSelectedStory(null);
    setSelectedPerson(null);
  };

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  const toggleSave = (id: string) => {
    const isCurrentlySaved = savedStoryIds[id];
    setSavedStoryIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));

    if (!isCurrentlySaved) {
      showToast("Collected");
    } else {
      showToast("Removed from collection");
    }
  };

  const handleShare = (story: Story) => {
    setSharingStory(story);
  };

  const handleOpenCart = () => {
    setIsCartOpen(true);
  };

  const dismissCartToast = useCallback(() => setCartToast(null), []);

  const handleViewCartFromToast = useCallback(() => {
    setCartToast(null);
    setIsCartOpen(true);
  }, []);

  const handleOpenAccount = () => {
    setShowAccountModal(true);
  };

  // Allow any component to open the account panel via a custom event
  useEffect(() => {
    const handler = () => setShowAccountModal(true);
    window.addEventListener('open-account-panel', handler);
    return () => window.removeEventListener('open-account-panel', handler);
  }, []);

  const handleCloseCart = () => {
    setIsCartOpen(false);
  };

  const handleCloseAccount = () => {
    setShowAccountModal(false);
  };

  const getSectionIcon = (section: Section, active: boolean) => {
    const className = `w-5 h-5 transition-all duration-300 ${active ? 'opacity-100 scale-110' : 'opacity-40 hover:opacity-80'}`;
    switch (section) {
        case 'HOME': return <Icons.Home className={className} />;
        case 'MAGAZINE': return <Icons.Book className={className} />;
        case 'SHOP': return <Icons.Bag className={className} />;
        case 'LEARN': return <Icons.School className={className} />;
        case 'OFFERINGS': return <Icons.Sparkles className={className} />;
        case 'ACCOUNT': return <Icons.User className={className} />;
        default: return null;
    }
  };

  // Admin gets its own full-screen layout — bypass the Grid shell entirely
  if (location.pathname.startsWith('/admin')) {
    return (
      <ErrorBoundary>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen bg-tea-bg">
            <div className="w-8 h-8 border-2 border-tea-gold border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <Routes>
            <Route path="/admin/*" element={<AdminApp />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-tea-bg text-tea-text relative selection:bg-tea-gold selection:text-white overflow-x-hidden font-serif flex flex-col lg:flex-row transition-colors duration-300 pt-[env(safe-area-inset-top)]">

      <div className="texture-overlay"></div>
      <div className="fixed inset-0 grain-texture pointer-events-none opacity-[0.20] z-0"></div>
      <div className="fixed inset-0 bg-gradient-radial from-transparent via-tea-bg/40 to-tea-surface/90 pointer-events-none z-0"></div>

      {/* Admin Toolbar — visible only for admin users */}

      {/* Scroll Progress Bar */}
      <ScrollProgressBar />

      {/* Route-change loading progress bar */}
      <AnimatePresence>
        {isSectionTransitioning && (
          <motion.div
            className="fixed top-[env(safe-area-inset-top)] left-0 right-0 h-[2px] z-priority origin-left"
            style={{ background: 'linear-gradient(90deg, var(--tea-gold), var(--tea-gold-lt))' }}
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 0.85, opacity: 1 }}
            exit={{ scaleX: 1, opacity: 0 }}
            transition={{ scaleX: { duration: 0.8, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.3, delay: 0.1 } }}
          />
        )}
      </AnimatePresence>

      {/* Pull to Refresh Indicator */}
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={progress} />

      {/* Left Sidebar for Desktop */}
      <LeftSidebar activeSection={activeSection} onNavigate={setActiveSection} onAccountClick={handleOpenAccount} onCartClick={handleOpenCart} onSearchClick={() => setShowGlobalSearch(true)} cartItemCount={cart.length} topOffset={showAdminBar} />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col relative ${sidebarCollapsed ? 'lg:ml-14' : 'lg:ml-56'} transition-[margin] duration-300 ${showAdminBar ? 'pt-9' : ''}`}>

      <main id="main-content" className="px-4 md:px-6 lg:px-10 pt-0 lg:pt-0 pb-[calc(44px+env(safe-area-inset-bottom,0px)+2rem)] lg:pb-8 min-h-screen w-full max-w-7xl mx-auto flex-1 transition-opacity duration-300">
          <AnimatePresence mode="wait">
          {isSectionTransitioning ? (
            <SectionSkeleton key="skeleton" variant={activeSection === 'HOME' ? 'hero' : activeSection === 'SHOP' ? 'shop' : activeSection === 'MAGAZINE' ? 'magazine' : 'grid'} />
          ) : (
            viewState === 'BROWSE' && (
              <AnimatedRoutes>
              <Routes>
                <Route path="/" element={
                  <ErrorBoundary>
                    <HomePage
                      onNavigateToSection={(section, magazineTab?: 'articles' | 'visual' | 'tea-inspire') => {
                        setActiveSection(section);
                        if (magazineTab) {
                          setMagazineDefaultTab(magazineTab);
                        }
                      }}
                      savedStoryIds={savedStoryIds}
                      watchedStoryIds={watchedStoryIds}
                      onCardClick={handleCardClick}
                      onToggleSave={toggleSave}
                      onShare={handleShare}
                      onCartClick={handleOpenCart}
                      onAccountClick={handleOpenAccount}
                      cartItemCount={cart.length}
                    />
                  </ErrorBoundary>
                } />
                <Route path="/magazine" element={
                  <ErrorBoundary>
                    <MagazineTabbed
                      stories={publishedStories}
                      savedStoryIds={savedStoryIds}
                      watchedStoryIds={watchedStoryIds}
                      onCardClick={handleCardClick}
                      onToggleSave={toggleSave}
                      onShare={handleShare}
                      defaultTab={magazineDefaultTab}
                      onCartClick={handleOpenCart}
                      onAccountClick={handleOpenAccount}
                      cartItemCount={cart.length}
                    />
                  </ErrorBoundary>
                } />
                <Route path="/learn" element={
                  <ErrorBoundary>
                    <LearnHub onStoryClick={handleCardClick} watchedStories={watchedStoryIds} onCartClick={handleOpenCart} onAccountClick={handleOpenAccount} cartItemCount={cart.length} onNavigateToConsult={() => setActiveSection('OFFERINGS')} />
                  </ErrorBoundary>
                } />
                <Route path="/shop" element={
                  <ErrorBoundary>
                    <Suspense fallback={<SectionSkeleton variant="list" />}>
                      <div className="w-full animate-[fadeIn_0.5s_ease-out]">
                        <Shop teaInventory={teaInventory} teawareInventory={teawareInventory} onAddToCart={handleAddToCart} cartItemCount={cart.length} onCartClick={handleOpenCart} onAccountClick={handleOpenAccount} isLoading={inventoryLoading} isError={inventoryError} error={inventoryErrorObj} onRetry={refetchInventory} />
                      </div>
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/shop/product/:id" element={
                  <ErrorBoundary>
                    <Suspense fallback={<SectionSkeleton variant="hero" />}>
                      <ProductPage onAddToCart={handleAddToCart} />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/consult" element={
                  <ErrorBoundary>
                    <ConsultPage onCartClick={handleOpenCart} onAccountClick={handleOpenAccount} cartItemCount={cart.length} />
                  </ErrorBoundary>
                } />
                <Route path="/collection" element={
                  <ErrorBoundary>
                    <Suspense fallback={<SectionSkeleton variant="list" />}>
                      <SharedCollection />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/about" element={<ErrorBoundary><AboutPage /></ErrorBoundary>} />
                <Route path="/event/:slug" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><EventLanding /></Suspense></ErrorBoundary>} />
                <Route path="/m/:magicToken" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><GuestManagement /></Suspense></ErrorBoundary>} />
                <Route path="/order/:ref" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><OrderStatusPage /></Suspense></ErrorBoundary>} />
                <Route path="/reset-password" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><ResetPasswordPage /></Suspense></ErrorBoundary>} />
                <Route path="/journey" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><JourneyPage /></Suspense></ErrorBoundary>} />
                <Route path="/invite/:token" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><GuestInviteClaimPage /></Suspense></ErrorBoundary>} />
                <Route path="/s/:sampleId" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><SamplePage /></Suspense></ErrorBoundary>} />
                <Route path="/share/:token" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><ShareCardPage /></Suspense></ErrorBoundary>} />
                <Route path="/find-a-table" element={
                  <ErrorBoundary>
                    <Suspense fallback={<SectionSkeleton variant="grid" />}>
                      <FindATable />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/store/:slug" element={
                  <ErrorBoundary>
                    <Suspense fallback={<SectionSkeleton variant="hero" />}>
                      <Storefront
                        onAddToCart={handleAddToCart}
                        onCartClick={handleOpenCart}
                        onAccountClick={handleOpenAccount}
                        cartItemCount={cart.length}
                      />
                    </Suspense>
                  </ErrorBoundary>
                } />
                {/* 404 Page */}
                <Route path="*" element={
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-[fadeIn_0.5s_ease-out]">
                    <h1 className="text-6xl font-serif text-tea-gold mb-4">404</h1>
                    <p className="text-xl font-serif text-tea-text mb-2">Page not found</p>
                    <p className="text-sm text-tea-text-sec mb-8 max-w-md">The page you're looking for doesn't exist or may have been moved.</p>
                    <button onClick={() => setActiveSection('HOME')} className="px-8 py-3 bg-tea-gold text-white text-xs uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors">Return Home</button>
                  </div>
                } />
              </Routes>
              </AnimatedRoutes>
            )
          )}
          </AnimatePresence>
      </main>

      {/* Global Footer — hidden on Home */}
      {viewState === 'BROWSE' && activeSection !== 'HOME' && (
        <div className="px-4 md:px-6 lg:px-10 max-w-[1400px] mx-auto w-full pb-32 md:pb-24 lg:pb-8">
          <Footer />
        </div>
      )}

      {/* --- Full Screen Views --- */}

      {viewState === 'READER' && selectedStory && (
         <ImagePreloaderProvider>
           <Suspense fallback={<SectionSkeleton variant="grid" />}>
             <Reader
               story={selectedStory}
               onBack={handleBackToBrowse}
               onNavigate={(s) => { setSelectedStory(s); setWatchedStoryIds(prev => ({ ...prev, [s.id]: true })); }}
               onPersonClick={setSelectedPerson}
               isSaved={savedStoryIds[selectedStory.id]}
               onToggleSave={() => toggleSave(selectedStory.id)}
               onShare={handleShare}
               watchedStories={watchedStoryIds}
               recommendations={stories.filter(s => s.id !== selectedStory.id && s.type === ContentType.Article).slice(0, 3)}
             />
           </Suspense>
           <PreloadIndicator />
         </ImagePreloaderProvider>
      )}

      {viewState === 'STORY_VIEW' && selectedStory && (
         <Suspense fallback={<SectionSkeleton variant="grid" />}>
           <MediaViewer
              story={selectedStory}
              onBack={handleBackToBrowse}
              isSaved={savedStoryIds[selectedStory.id]}
              onToggleSave={() => toggleSave(selectedStory.id)}
              onShare={handleShare}
           />
         </Suspense>
      )}

      {viewState === 'PHOTO_ESSAY' && selectedStory && (
         <Suspense fallback={<SectionSkeleton variant="grid" />}>
           <VisualFeatureViewer
              story={selectedStory}
              onBack={handleBackToBrowse}
              onPersonClick={setSelectedPerson}
              isSaved={savedStoryIds[selectedStory.id]}
              onToggleSave={() => toggleSave(selectedStory.id)}
              onShare={handleShare}
           />
         </Suspense>
      )}

      {selectedPerson && (
         <ContributorProfile person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      )}

      {sharingStory && (
         <ShareModal story={sharingStory} onClose={() => setSharingStory(null)} />
      )}

      {/* --- GLOBAL SEARCH --- */}
      <GlobalSearch isOpen={showGlobalSearch} onClose={() => setShowGlobalSearch(false)} />

      {/* --- ACCOUNT MODAL --- */}
      {showAccountModal && (
        <AccountPanel onClose={handleCloseAccount} />
      )}

      {/* --- CONTACT MODAL --- */}
      {showContact && (
        <div className="fixed inset-0 z-modal bg-tea-text/90 backdrop-blur-sm flex items-center justify-center p-6 animate-[fadeIn_0.3s_ease-out]" role="dialog" aria-modal="true" aria-label="Contact Us" onClick={() => setShowContact(false)} onKeyDown={(e) => { if (e.key === 'Escape') setShowContact(false); }}>
            <div className="bg-tea-surface max-w-md w-full p-10 text-center relative shadow-2xl animate-[scaleIn_0.3s_ease-out]" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowContact(false)} className="absolute top-4 right-4 p-2 text-tea-text-sec hover:text-tea-gold transition-colors duration-300" aria-label="Close contact dialog"><Icons.Close className="w-5 h-5" /></button>
                <h2 className="text-2xl font-serif text-tea-text mb-8 animate-[fadeIn_0.5s_ease-out]" style={{ animationDelay: '150ms' }}>Contact Us</h2>

                <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]" style={{ animationDelay: '200ms' }}>
                    <div className="flex flex-col items-center">
                        <Icons.Mail className="w-6 h-6 text-tea-gold mb-2 opacity-80 transition-transform duration-300 hover:scale-110" />
                        <span className="text-sm uppercase tracking-widest text-tea-text-sec mb-1">General Inquiries</span>
                        <a href="mailto:hello@teajia.com" className="font-serif text-xl text-tea-text hover:text-tea-gold transition-colors duration-300">hello@teajia.com</a>
                    </div>

                    <div className="w-full h-[1px] bg-tea-border"></div>

                    <div className="flex flex-col items-center">
                        <Icons.Instagram className="w-6 h-6 text-tea-gold mb-2 opacity-80 transition-transform duration-300 hover:scale-110" />
                        <span className="text-sm uppercase tracking-widest text-tea-text-sec mb-1">Follow Us</span>
                        <a href="#" className="font-serif text-xl text-tea-text hover:text-tea-gold transition-colors duration-300">@teajia.journal</a>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Cart fly animation */}
      {flyAnimation && (
        <CartFlyAnimation
          startX={flyAnimation.x}
          startY={flyAnimation.y}
          imageUrl={flyAnimation.image}
          onComplete={() => setFlyAnimation(null)}
        />
      )}

      {/* Preload indicator moved to Reader's ImagePreloaderProvider scope */}

      {/* Cart "View Cart" toast */}
      <CartToast
        itemName={cartToast?.itemName ?? ''}
        cartCount={cartToast?.cartCount ?? 0}
        isVisible={!!cartToast}
        onViewCart={handleViewCartFromToast}
        onDismiss={dismissCartToast}
      />

      <div role="status" aria-live="polite" className={`fixed bottom-[calc(44px+env(safe-area-inset-bottom,0px)+1rem)] lg:bottom-8 left-1/2 -translate-x-1/2 bg-tea-surface text-tea-text px-6 py-3 rounded-sm shadow-2xl transition-all duration-500 z-toast flex items-center gap-3 ${toast.show ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
          <Icons.Seal className="w-4 h-4 text-tea-gold" />
          <span className="text-xs uppercase tracking-widest font-medium">{toast.message}</span>
      </div>


      {/* Bottom Tab Bar for Mobile */}
      <BottomTabBar activeSection={activeSection} onNavigate={setActiveSection} hidden={false} onAccountClick={handleOpenAccount} />

      </div>

      {/* Cart — rendered outside content wrapper so fixed positioning is viewport-relative */}
      <CartIndicator itemCount={cart.length} onOpen={handleOpenCart} />
      <CartPanel
         mode="public"
         isOpen={isCartOpen}
         onClose={handleCloseCart}
         cart={cart}
         onRemoveItem={handleRemoveFromCart}
         onUpdateQuantity={handleUpdateCartQuantity}
         onAddItem={addToPublicCart}
         whatsappNumber={activeStore?.whatsapp_number}
      />
    </div>
  );
};

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <ThemeProvider>
          <StoryProvider>
            <InventoryProvider>
                <NetworkStatus />
                <SessionExpiredNotice />
                <AppContent />
            </InventoryProvider>
          </StoryProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </MotionConfig>
  );
}
