
import React, { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
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
const MagazinePageReader = lazy(() => import('./components/MagazinePageReader').then(m => ({ default: m.MagazinePageReader })));
const VisualFeatureViewer = lazy(() => import('./components/PhotoEssay/VisualFeatureViewer').then(m => ({ default: m.VisualFeatureViewer })));
const Shop = lazyWithReload(() => import('./components/Shop').then(m => ({ default: m.Shop })));

// Reads :id from the URL and passes it to Shop so the AlcoveModal opens for
// that product. Defined at module level so React treats it as a stable type.
const ShopProductLoader: React.FC<{
  teaInventory: InventoryItem[];
  teawareInventory: InventoryItem[];
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
  cartItemCount?: number;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}> = (props) => {
  const { id } = useParams<{ id: string }>();
  return <Shop {...props} initialProductId={id} />;
};
const SharedCollection = lazy(() => import('./components/SharedCollection').then(m => ({ default: m.SharedCollection })));
const EventLanding = lazy(() => import('./components/events/EventLanding'));
const EventRecapPage = lazy(() => import('./pages/EventRecapPage'));
const GuestManagement = lazy(() => import('./components/events/GuestManagement'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const OrderStatusPage = lazy(() => import('./pages/OrderStatusPage'));
const JourneyPage = lazy(() => import('./pages/JourneyPage'));
const AccountJourneyPage = lazy(() => import('./pages/AccountJourneyPage'));
const PassportPage = lazy(() => import('./pages/PassportPage'));
const GuestInviteClaimPage = lazy(() => import('./pages/GuestInviteClaimPage'));
const SamplePage = lazy(() => import('./pages/SamplePage'));
const ShareCardPage = lazy(() => import('./pages/ShareCardPage'));
const Storefront = lazy(() => import('./components/storefront/Storefront').then(m => ({ default: m.Storefront })));
const FindATable = lazy(() => import('./components/storefront/FindATable').then(m => ({ default: m.FindATable })));
const TabStyleDemo = lazy(() => import('./pages/TabStyleDemo'));
const JournalPage = lazy(() => import('./pages/JournalPage'));
const CollectionPage = lazy(() => import('./pages/CollectionPage'));
const CompassPage = lazy(() => import('./pages/CompassPage'));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'));
const SavedStoriesPage = lazy(() => import('./pages/SavedStoriesPage'));
const ReadingHistoryPage = lazy(() => import('./pages/ReadingHistoryPage'));
const CenterPage = lazy(() => import('./pages/CenterPage'));
const OrderHistoryPage = lazy(() => import('./pages/OrderHistoryPage'));
const SampleHistoryPage = lazy(() => import('./pages/SampleHistoryPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const SessionPage = lazy(() => import('./pages/SessionPage'));
const TableCardPage = lazy(() => import('./pages/TableCardPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const ForYourSpacePage = lazy(() => import('./pages/ForYourSpacePage'));
const SpacesPage = lazy(() => import('./pages/SpacesPage'));
const StartHerePage = lazy(() => import('./pages/StartHerePage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const PublicCollectionPage = lazy(() => import('./pages/PublicCollectionPage'));

import { useQuery } from '@tanstack/react-query';
import { fetchStore } from './lib/storefrontApi';
import { STORIES, LEARN_STORIES, PREVIEW_MODE } from './constants';
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
import { LearnHub } from './components/LearnHub';
import { HomePage } from './components/HomePage';
import { StoryProvider, useStories } from './context/StoryContext';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { ThemeProvider } from './context/ThemeContext';
import { ImagePreloaderProvider } from './context/ImagePreloaderContext';
import { AccountPanel } from './components/AccountPanel';
import type { PanelView } from './components/AccountPanel/types';
import { GlobalSearch } from './components/shared/GlobalSearch';
import { LeftSidebar } from './components/LeftSidebar';
import { BottomTabBar } from './components/BottomTabBar';
import { MagazineTabbed } from './components/MagazineTabbed';
import { AdvisePage } from './components/AdvisePage';
import AboutPage from './AboutPage';
import Footer from './components/shared/Footer';
import { ErrorBoundary } from './admin/components/ErrorBoundary';
import { SectionSkeleton } from './components/shared/SectionSkeleton';
import { PullToRefreshIndicator } from './components/shared/PullToRefreshIndicator';
import { NetworkStatus } from './components/shared/NetworkStatus';
import { SessionExpiredNotice } from './components/shared/SessionExpiredNotice';
import { NetworkErrorNotice } from './components/shared/NetworkErrorNotice';
import { PreloadIndicator } from './components/shared/PreloadIndicator';
import { CartFlyAnimation } from './components/shared/CartFlyAnimation';
import { CartToast } from './components/shared/CartToast';
import { ScrollProgressBar } from './components/shared/ScrollProgressBar';
import { ComingSoonPage } from './components/shared/ComingSoonPage';
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
  const { isAdmin, isAuthenticated, isSessionReady } = useAuth();
  const syncEnabled = isAuthenticated && isSessionReady;
  useFavoritesSync(syncEnabled);
  useOfflineSync(syncEnabled);
  useTastingJournalSync(syncEnabled);
  useCompassSync(syncEnabled);
  useNotesSync(syncEnabled);
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

  // Scroll position memory for each section
  const scrollPositions = useRef<Record<Section, number>>({
    HOME: 0, MAGAZINE: 0, LEARN: 0, SHOP: 0, OFFERINGS: 0, EVENTS: 0, YOUR_TABLE: 0, ABOUT: 0
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

  // Reset scroll on any pathname change. The activeSection effect above only
  // fires for Section-tracked routes; pages like /signin, /signup, /account/*
  // are not in that enum, so without this they inherit the previous scrollY.
  const lastPathname = useRef(location.pathname);
  useEffect(() => {
    if (lastPathname.current !== location.pathname) {
      lastPathname.current = location.pathname;
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // Update document title on section change
  useEffect(() => {
    const titles: Record<Section, string> = {
      HOME: 'Teajia | Tea Journal',
      MAGAZINE: 'Magazine — Teajia',
      LEARN: 'Learn — Teajia',
      SHOP: 'Shop — Teajia',
      OFFERINGS: 'Advise — Teajia',
      EVENTS: 'Sessions — Teajia',
      YOUR_TABLE: 'Your Table — Teajia',
      ABOUT: 'About — Teajia',
    };
    document.title = titles[activeSection] ?? 'Teajia | Tea Journal';
  }, [activeSection]);

  const setActiveSection = useCallback((section: Section) => {
    if (section === activeSection) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    isNavClick.current = true;
    setShowAccountModal(false);
    navigate(sectionToPath(section));
    setViewState('BROWSE');
    setSelectedStory(null);
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
  const [accountInitialView, setAccountInitialView] = useState<PanelView | undefined>(undefined);
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
        setViewState('PAGE_READER');
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

  // Open search when navigating here from admin with state { openSearch: true }
  useEffect(() => {
    if ((location.state as { openSearch?: boolean } | null)?.openSearch) {
      setShowGlobalSearch(true);
      // Clear the state so back-navigation doesn't re-trigger it
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Global search keyboard shortcut (Cmd/Ctrl+K)
  useEffect(() => {
    const handleSearchShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!showGlobalSearch) window.dispatchEvent(new CustomEvent('dismiss-tasting-overlay'));
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
      newViewState = 'PAGE_READER';
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

  const showToast = (message: string, duration = 2000) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), duration);
  };

  // Show API error toast when the Worker is unreachable
  const apiErrorShownRef = useRef(false);
  useEffect(() => {
    if (inventoryError && !apiErrorShownRef.current) {
      apiErrorShownRef.current = true;
      showToast('Connection issue — please try again shortly.', 5000);
    }
    if (!inventoryError) {
      apiErrorShownRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryError]);

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

  const handleOpenAccount = (view?: PanelView) => {
    window.dispatchEvent(new CustomEvent('dismiss-tasting-overlay'));
    setShowGlobalSearch(false);
    setAccountInitialView(view);
    setShowAccountModal(true);
  };

  const handleToggleAccount = () => {
    setShowAccountModal(prev => {
      if (!prev) {
        window.dispatchEvent(new CustomEvent('dismiss-tasting-overlay'));
        setShowGlobalSearch(false);
      } else {
        setAccountInitialView(undefined);
      }
      return !prev;
    });
  };

  const handleNavSection = (section: Section) => {
    window.dispatchEvent(new CustomEvent('dismiss-tasting-overlay'));
    setShowGlobalSearch(false);
    setShowAccountModal(false);
    setAccountInitialView(undefined);
    setActiveSection(section);
  };


  // Allow any component to open the account panel via a custom event
  useEffect(() => {
    const handler = () => {
      window.dispatchEvent(new CustomEvent('dismiss-tasting-overlay'));
      setShowAccountModal(true);
    };
    window.addEventListener('open-account-panel', handler);
    return () => window.removeEventListener('open-account-panel', handler);
  }, []);

  const handleCloseCart = () => {
    setIsCartOpen(false);
  };

  const handleCloseAccount = () => {
    setShowAccountModal(false);
    setAccountInitialView(undefined);
  };

  const getSectionIcon = (section: Section, active: boolean) => {
    const className = `w-5 h-5 transition-all duration-300 ${active ? 'opacity-100 scale-110' : 'opacity-40 hover:opacity-80'}`;
    switch (section) {
        case 'HOME': return <Icons.Home className={className} />;
        case 'MAGAZINE': return <Icons.Book className={className} />;
        case 'SHOP': return <Icons.Bag className={className} />;
        case 'LEARN': return <Icons.School className={className} />;
        case 'OFFERINGS': return <Icons.Sparkles className={className} />;
        case 'EVENTS': return <Icons.Sparkles className={className} />;
        case 'YOUR_TABLE': return <Icons.User className={className} />;
        default: return null;
    }
  };

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className={`${isAdminRoute ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-tea-bg text-tea-text relative selection:bg-tea-gold selection:text-white overflow-x-hidden font-serif flex flex-col lg:flex-row transition-colors duration-300 pt-[env(safe-area-inset-top)]`}>

      <div className="texture-overlay"></div>
      <div className="fixed inset-0 bg-gradient-radial from-transparent via-tea-bg/40 to-tea-surface/90 pointer-events-none z-0"></div>

      {/* Admin Toolbar — visible only for admin users */}

      {/* Scroll Progress Bar */}
      <ScrollProgressBar />


      {/* Pull to Refresh Indicator */}
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={progress} />

      {/* Left Sidebar for Desktop */}
      <LeftSidebar activeSection={activeSection} onNavigate={setActiveSection} onAccountClick={handleOpenAccount} onCartClick={handleOpenCart} onSearchClick={() => { window.dispatchEvent(new CustomEvent('dismiss-tasting-overlay')); setShowAccountModal(false); setAccountInitialView(undefined); setShowGlobalSearch(true); }} cartItemCount={cart.length} topOffset={showAdminBar} />

      {/* Main Content Area */}
      <div className={`flex-1 min-w-0 flex flex-col relative ${sidebarCollapsed ? 'lg:ml-14 lg:max-w-[calc(100vw-3.5rem)]' : 'lg:ml-56 lg:max-w-[calc(100vw-14rem)]'} transition-[margin,max-width] duration-300`}>

      {isAdminRoute ? (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-tea-bg"><div className="w-8 h-8 border-2 border-tea-gold border-t-transparent rounded-full animate-spin" /></div>}>
          <Routes>
            <Route path="/admin/*" element={
              <AdminApp
                onAccountClick={handleOpenAccount}
                onSearchClick={() => { setShowAccountModal(false); setAccountInitialView(undefined); setShowGlobalSearch(true); }}
                onCartClick={handleOpenCart}
              />
            } />
          </Routes>
        </Suspense>
      ) : (
      <>
      <main id="main-content" className="px-4 md:px-6 lg:px-10 pt-0 lg:pt-0 pb-[calc(44px+env(safe-area-inset-bottom,0px)+2rem)] lg:pb-8 min-h-screen w-full flex-1 transition-opacity duration-300">
          <AnimatePresence mode="wait">
          {viewState === 'BROWSE' && (
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
                <Route path="/article/:slug" element={
                  <ErrorBoundary>
                    <Suspense fallback={<SectionSkeleton variant="hero" />}>
                      <ArticlePage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/learn" element={
                  <ErrorBoundary>
                    <LearnHub onStoryClick={handleCardClick} watchedStories={watchedStoryIds} onCartClick={handleOpenCart} onAccountClick={handleOpenAccount} cartItemCount={cart.length} onNavigateToAdvise={() => setActiveSection('OFFERINGS')} />
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
                    <Suspense fallback={<SectionSkeleton variant="list" />}>
                      <div className="w-full animate-[fadeIn_0.5s_ease-out]">
                        <ShopProductLoader teaInventory={teaInventory} teawareInventory={teawareInventory} onAddToCart={handleAddToCart} cartItemCount={cart.length} onCartClick={handleOpenCart} onAccountClick={handleOpenAccount} isLoading={inventoryLoading} isError={inventoryError} error={inventoryErrorObj} onRetry={refetchInventory} />
                      </div>
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/advise" element={
                  <ErrorBoundary>
                    <AdvisePage onCartClick={handleOpenCart} onAccountClick={handleOpenAccount} cartItemCount={cart.length} />
                  </ErrorBoundary>
                } />
                {/* Legacy route — old links to /consult keep working. */}
                <Route path="/consult" element={<Navigate to="/advise" replace />} />
                {/* PREVIEW_MODE stubs — restore in docs/LAUNCH_CHECKLIST.md */}
                <Route path="/for-your-space" element={PREVIEW_MODE ? <ComingSoonPage label="For your space" /> : (
                  <ErrorBoundary>
                    <Suspense fallback={<SectionSkeleton variant="hero" />}>
                      <ForYourSpacePage />
                    </Suspense>
                  </ErrorBoundary>
                )} />
                <Route path="/spaces" element={PREVIEW_MODE ? <ComingSoonPage label="Our spaces" /> : (
                  <ErrorBoundary>
                    <Suspense fallback={<SectionSkeleton variant="list" />}>
                      <SpacesPage />
                    </Suspense>
                  </ErrorBoundary>
                )} />
                <Route path="/start" element={PREVIEW_MODE ? <ComingSoonPage label="Start here" /> : (
                  <ErrorBoundary>
                    <Suspense fallback={<SectionSkeleton variant="grid" />}>
                      <StartHerePage />
                    </Suspense>
                  </ErrorBoundary>
                )} />
                <Route path="/collection" element={
                  <ErrorBoundary>
                    <Suspense fallback={<SectionSkeleton variant="list" />}>
                      <SharedCollection />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/about" element={<ErrorBoundary><AboutPage /></ErrorBoundary>} />
                <Route path="/compass" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="grid" />}><CompassPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/journal" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="list" />}><JournalPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/collection" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="list" />}><CollectionPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/journey" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><AccountJourneyPage /></Suspense></ErrorBoundary>} />
                <Route path="/signin" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><SignInPage /></Suspense></ErrorBoundary>} />
                <Route path="/signup" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><SignUpPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/settings" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><AccountSettingsPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/saved" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="list" />}><SavedStoriesPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/history" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="list" />}><ReadingHistoryPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/orders" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="list" />}><OrderHistoryPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/samples" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="list" />}><SampleHistoryPage /></Suspense></ErrorBoundary>} />
                <Route path="/community" element={PREVIEW_MODE ? <ComingSoonPage label="Community" /> : <ErrorBoundary><Suspense fallback={<SectionSkeleton variant="grid" />}><CommunityPage /></Suspense></ErrorBoundary>} />
                <Route path="/design/tabs" element={<ErrorBoundary><Suspense fallback={null}><TabStyleDemo /></Suspense></ErrorBoundary>} />
                <Route path="/events" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="list" />}><EventsPage /></Suspense></ErrorBoundary>} />
                <Route path="/event/:slug" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><EventLanding /></Suspense></ErrorBoundary>} />
                <Route path="/event/:slug/recap" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><EventRecapPage /></Suspense></ErrorBoundary>} />
                <Route path="/m/:magicToken" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><GuestManagement /></Suspense></ErrorBoundary>} />
                <Route path="/order/:ref" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><OrderStatusPage /></Suspense></ErrorBoundary>} />
                <Route path="/reset-password" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><ResetPasswordPage /></Suspense></ErrorBoundary>} />
                <Route path="/journey" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><JourneyPage /></Suspense></ErrorBoundary>} />
                <Route path="/passport/:token" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><PassportPage /></Suspense></ErrorBoundary>} />
                <Route path="/invite/:token" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><GuestInviteClaimPage /></Suspense></ErrorBoundary>} />
                <Route path="/s/:sampleId" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><SamplePage /></Suspense></ErrorBoundary>} />
                <Route path="/share/:token" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><ShareCardPage /></Suspense></ErrorBoundary>} />
                <Route path="/c/:slug" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><PublicCollectionPage /></Suspense></ErrorBoundary>} />
                <Route path="/me" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="list" />}><CenterPage /></Suspense></ErrorBoundary>} />
                <Route path="/session/:id" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><SessionPage /></Suspense></ErrorBoundary>} />
                <Route path="/t/:token" element={<ErrorBoundary><Suspense fallback={<SectionSkeleton variant="hero" />}><TableCardPage /></Suspense></ErrorBoundary>} />
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
                    <button onClick={() => setActiveSection('HOME')} className="px-8 py-3 bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors">Return Home</button>
                  </div>
                } />
              </Routes>
            </AnimatedRoutes>
          )}
          </AnimatePresence>
      </main>

      {/* Global Footer — hidden on Home */}
      {viewState === 'BROWSE' && activeSection !== 'HOME' && (
        <div className="px-4 md:px-6 lg:px-10 max-w-[1400px] mx-auto w-full pb-32 md:pb-24 lg:pb-8">
          <Footer />
        </div>
      )}
      </>
      )}

      {/* --- Full Screen Views --- */}

      {viewState === 'PAGE_READER' && selectedStory && (
        <Suspense fallback={<SectionSkeleton variant="grid" />}>
          <MagazinePageReader
            story={selectedStory}
            onBack={handleBackToBrowse}
            isSaved={savedStoryIds[selectedStory.id]}
            onToggleSave={() => toggleSave(selectedStory.id)}
          />
        </Suspense>
      )}

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

      {/* --- YOUR TABLE MODAL --- */}
      {showAccountModal && (
        <AccountPanel onClose={handleCloseAccount} initialView={accountInitialView} />
      )}

      {/* --- CONTACT MODAL --- */}
      {showContact && (
        <div className="fixed inset-0 z-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-[fadeIn_0.3s_ease-out]" role="dialog" aria-modal="true" aria-label="Contact Us" onClick={() => setShowContact(false)} onKeyDown={(e) => { if (e.key === 'Escape') setShowContact(false); }}>
            <div className="bg-tea-surface max-w-md w-full p-10 text-center relative shadow-2xl animate-[scaleIn_0.3s_ease-out]" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowContact(false)} className="absolute top-4 right-4 p-2 text-tea-text-sec hover:text-tea-text transition-colors duration-300" aria-label="Close contact dialog"><Icons.Close className="w-5 h-5" /></button>
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
                        <a href="https://www.instagram.com/teajia.foundation/" target="_blank" rel="noopener noreferrer" className="font-serif text-xl text-tea-text hover:text-tea-gold transition-colors duration-300">@teajia.journal</a>
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
      <BottomTabBar activeSection={activeSection} onNavigate={handleNavSection} hidden={isCartOpen} onAccountClick={handleToggleAccount} onAccountClose={handleCloseAccount} onSearchClick={() => { window.dispatchEvent(new CustomEvent('dismiss-tasting-overlay')); setShowAccountModal(false); setAccountInitialView(undefined); setShowGlobalSearch(true); }} onSearchClose={() => setShowGlobalSearch(false)} isAdminRoute={isAdminRoute} />

      </div>

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
                <NetworkErrorNotice />
                <AppContent />
            </InventoryProvider>
          </StoryProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </MotionConfig>
  );
}
