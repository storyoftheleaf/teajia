
import React, { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams, type Location } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { TEA_REFERENCE_ROUTE_PATHS } from './wisdom/reference/previewMode';
import { useArticleAccess } from './pages/read/publishGate';

// Retry a failed chunk load in place. A transient fetch failure is common on a
// jumpy/firewalled connection, especially for the large admin bundle.
//
// Never reload automatically from this path. Automatic reload was the mechanism
// behind the rapid flashing incident: an old shell could fail its AdminApp
// preload, reload, and immediately repeat. After bounded retries, throw to the
// root ErrorBoundary; its button is the only explicit recovery navigation.
function lazyWithRetry<T extends { default: React.ComponentType<unknown> }>(
  factory: () => Promise<T>
): React.LazyExoticComponent<T['default']> {
  return lazy(async () => {
    const delays = [400, 1200, 2500]; // ms of backoff between fetch retries
    for (let attempt = 0; ; attempt++) {
      try {
        return await factory();
      } catch (err) {
        if (attempt < delays.length) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
          continue; // transient blip, retry the same import
        }
        // Bounded attempts exhausted: surface the stable recovery screen.
        throw err;
      }
    }
  });
}

const AdminApp = lazyWithRetry(() => import('./admin/AdminApp'));
const MediaViewer = lazy(() => import('./components/MediaViewer').then(m => ({ default: m.MediaViewer })));
const Reader = lazy(() => import('./components/Reader').then(m => ({ default: m.Reader })));
// Legacy MagazinePageReader removed; articles render through the unified
// 4:5 reader at /article/:slug. See docs/ARCHITECTURE.md.
const Shop = lazyWithRetry(() => import('./components/Shop').then(m => ({ default: m.Shop })));
// The real product page for cold loads of /shop/product/:id. Grid taps open
// the same URL as a modal over the shop instead (background-location routing).
const ProductPage = lazy(() => import('./pages/ProductPage'));

// Branches /article/:slug by render mode. Both readers fetch by slug with the
// SAME query key ['article', slug], so the chosen reader reuses the cached
// result (no double fetch). Until the article loads, falls through to the
// carousel reader, which shares the same query.
function ArticleRouteSwitch() {
  const { slug } = useParams();
  const { data: article } = useQuery<DbArticle>({
    queryKey: ['article', slug],
    queryFn: () => api.articles.getBySlug(slug as string),
    enabled: !!slug,
  });
  if (article && getArticleRenderMode(article) === 'immersive_scroll') {
    return <ImmersiveArticlePage />;
  }
  return <ArticlePage />;
}

// The publish gate for every /read/* article route. `useArticleAccess` reads
// the same ARTICLE_LIVE map ReadIndex's contents list reads, so a route not
// marked live there renders ReadNotFound instead of its children for a
// visitor, and renders normally for a signed-in owner or editor. Before this
// existed, the fourteen article page components had no gate at all: a route
// with no `live` entry was still fully public at its own URL. (JOBC-2)
//
// `children` is the lazy page element itself; React only mounts a lazy
// component when it actually renders, so a blocked route never triggers that
// chunk's fetch, it renders ReadNotFound's own (separately lazy) chunk
// instead.
const ArticleGate: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => {
  const allowed = useArticleAccess(href);
  if (!allowed) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<EmblemLoader />}>
          <ReadNotFound />
        </Suspense>
      </ErrorBoundary>
    );
  }
  return <>{children}</>;
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
const PalettePreviewPage = lazy(() => import('./pages/PalettePreviewPage'));
const ArticleEditorHarness = lazy(() => import('./pages/ArticleEditorHarness'));
const DesignSystemShowcase = lazy(() => import('./pages/DesignSystemShowcase'));
const JournalPage = lazy(() => import('./pages/JournalPage'));
const CollectionPage = lazy(() => import('./pages/CollectionPage'));
const CellarPage = lazy(() => import('./pages/CellarPage'));
const SharedCollectionsPage = lazy(() => import('./pages/SharedCollectionsPage'));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'));
const CenterPage = lazy(() => import('./pages/CenterPage'));
const OrderHistoryPage = lazy(() => import('./pages/OrderHistoryPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const SampleHistoryPage = lazy(() => import('./pages/SampleHistoryPage'));
// Repository docs can contain historical external URLs and are a development
// tool, so do not ship their raw contents in the public production bundle.
const DeveloperDocsPage = import.meta.env.DEV
  ? lazy(() => import('./pages/DeveloperDocsPage'))
  : () => (
      <div className="min-h-dvh flex items-center justify-center px-6 pb-nav text-center">
        <p className="font-serif text-ui-15 text-tea-text-sec">The development library is available in local development only.</p>
      </div>
    );
const BriefingPage = lazy(() => import('./pages/BriefingPage'));
const SessionPage = lazy(() => import('./pages/SessionPage'));
const JoinPage = lazy(() => import('./pages/JoinPage'));
const TableCardPage = lazy(() => import('./pages/TableCardPage'));
const ShelfPage = lazy(() => import('./pages/ShelfPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const ForYourSpacePage = lazy(() => import('./pages/ForYourSpacePage'));
const SpacesPage = lazy(() => import('./pages/SpacesPage'));
const StartHerePage = lazy(() => import('./pages/StartHerePage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const ImmersiveArticlePage = lazy(() => import('./pages/ImmersiveArticlePage'));
// Immersive long-reads (espresso + gold scrolling articles) for the Read section.
const ReadIndex = lazy(() => import('./pages/read/ReadIndex'));
const LeafToLiquor = lazy(() => import('./pages/read/LeafToLiquor'));
const RockRemembers = lazy(() => import('./pages/read/RockRemembers'));
const EarthWaterFire = lazy(() => import('./pages/read/EarthWaterFire'));
const BeforeTheMist = lazy(() => import('./pages/read/BeforeTheMist'));
// The 10 new Read templates ported from the Tea Article Redesign design project.
const AtlasMapOfMountains = lazy(() => import('./pages/read/AtlasMapOfMountains'));
const CraftPotThatRemembers = lazy(() => import('./pages/read/CraftPotThatRemembers'));
const EssayLongWayToCup = lazy(() => import('./pages/read/EssayLongWayToCup'));
const FieldNotesTwoRoomsBali = lazy(() => import('./pages/read/FieldNotesTwoRoomsBali'));
const FieldStudyWaterBeforeLeaf = lazy(() => import('./pages/read/FieldStudyWaterBeforeLeaf'));
const HistoryTenThousandMornings = lazy(() => import('./pages/read/HistoryTenThousandMornings'));
const LegendImmortalsCliff = lazy(() => import('./pages/read/LegendImmortalsCliff'));
const RitualSevenSteeps = lazy(() => import('./pages/read/RitualSevenSteeps'));
const TastingVocabularyOfTaste = lazy(() => import('./pages/read/TastingVocabularyOfTaste'));
const TeaHouseQuietHours = lazy(() => import('./pages/read/TeaHouseQuietHours'));
const CraftRenewalPorcelain = lazy(() => import('./pages/read/CraftRenewalPorcelain'));
const ReadNotFound = lazy(() => import('./pages/read/ReadNotFound'));
const PublicCollectionPage = lazy(() => import('./pages/PublicCollectionPage'));
const ContributorProfilePage = lazy(() => import('./pages/ContributorProfilePage'));
const AccountProfilePage = lazy(() => import('./pages/AccountProfilePage'));
const ProfileFavoritesPage = lazy(() => import('./pages/ProfileFavoritesPage'));
const ProfilePaymentPage = lazy(() => import('./pages/ProfilePaymentPage'));
const ContributorsIndexPage = lazy(() => import('./pages/ContributorsIndexPage'));
const StoreLaunchPlaybookPage = lazy(() => import('./pages/StoreLaunchPlaybookPage'));
const McpPage = lazy(() => import('./pages/McpPage'));
// The public tea reference: a page per holding, read out of src/wisdom.
const WisdomHomePage = import.meta.env.MODE === 'tea-reference-preview'
  ? lazy(() => import('./pages/wisdom/PreviewWisdomHomePage'))
  : lazy(() => import('./pages/wisdom/WisdomHomePage'));
const CultivarIndexPage = lazy(() => import('./pages/wisdom/CultivarIndexPage'));
const CultivarPage = lazy(() => import('./pages/wisdom/CultivarPage'));
const ProducerIndexPage = lazy(() => import('./pages/wisdom/ProducerIndexPage'));
const ProducerPage = lazy(() => import('./pages/wisdom/ProducerPage'));
const MarkIndexPage = lazy(() => import('./pages/wisdom/MarkIndexPage'));
const MarkPage = lazy(() => import('./pages/wisdom/MarkPage'));
const StyleIndexPage = lazy(() => import('./pages/wisdom/StyleIndexPage'));
const StylePage = lazy(() => import('./pages/wisdom/StylePage'));
const RegionIndexPage = lazy(() => import('./pages/wisdom/RegionIndexPage'));
const RegionPage = lazy(() => import('./pages/wisdom/RegionPage'));
const NamedTeaIndexPage = lazy(() => import('./pages/wisdom/NamedTeaIndexPage'));
const NamedTeaPage = lazy(() => import('./pages/wisdom/NamedTeaPage'));
const TeaTypeIndexPage = lazy(() => import('./pages/wisdom/TeaTypeIndexPage'));
const TeaFamilyPage = lazy(() => import('./pages/wisdom/TeaFamilyPage'));
const TeaTypePage = lazy(() => import('./pages/wisdom/TeaTypePage'));

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStore } from './lib/storefrontApi';
import { LEARN_STORIES } from './constants';
import { Story, ContentType, ViewState, Person, InventoryItem, Section } from './types';
import type { Account, DbArticle } from './types';
import { useAppStore } from './lib/store';
import { api, setToken, hydrateAccountStateFromToken } from './lib/api';
import { classifyIncident } from './lib/incidents';
import { currentHostStoreSlug } from './lib/storeHost';
import {
  canAddToStoreCart,
  resolveCartContactStoreSlug,
  resolveCheckoutStoreSlug,
  shouldFetchCheckoutStore,
} from './lib/publicCartDomain';
import { getArticleRenderMode } from './lib/articleRenderMode';
import { useAuth } from './hooks/useAuth';
import { useFavoritesSync } from './hooks/useFavoritesSync';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useTastingJournalSync } from './hooks/useTastingJournalSync';
import { useTeaDiscoverySync } from './hooks/useTeaDiscoverySync';
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
import { sellUnitOf, wholePieceOf } from './lib/teaPricing';
import { AdvisePage } from './components/AdvisePage';
import AboutPage from './AboutPage';
import Footer from './components/shared/Footer';
import { ErrorBoundary } from './admin/components/ErrorBoundary';
import { EmblemLoader } from './components/shared/EmblemLoader';
import { WisdomFallback } from './pages/wisdom/frame';
import { PullToRefreshIndicator } from './components/shared/PullToRefreshIndicator';
import { NetworkStatus } from './components/shared/NetworkStatus';
import { SessionExpiredNotice } from './components/shared/SessionExpiredNotice';
import { NetworkErrorNotice } from './components/shared/NetworkErrorNotice';
import { PreloadIndicator } from './components/shared/PreloadIndicator';
import { CartFlyAnimation } from './components/shared/CartFlyAnimation';
import { CartToast, type CartToastTone } from './components/shared/CartToast';
import { WalkthroughDock } from './components/shared/WalkthroughDock';
import { ScrollProgressBar, shouldShowGlobalScrollProgress } from './components/shared/ScrollProgressBar';
import { AnimatedRoutes } from './components/shared/AnimatedRoutes';
import { usePullToRefresh } from './hooks/usePullToRefresh';

// View Transitions API feature detection (#46)
const supportsViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document;

const AccountRouteBridge: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    onOpen();
  }, [onOpen]);

  return <div className="min-h-[60vh]" aria-hidden="true" />;
};

// Create an inner component to use the context
const AppContent = () => {
  // When the site is reached on a store-dedicated subdomain (e.g. au.teajia.com),
  // the root URL opens straight onto that store's shop instead of the homepage.
  // Computed once, the host doesn't change within a session.
  const hostStoreSlug = currentHostStoreSlug();

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
    updatePublicCartPacks,
    removeFromPublicCart,
    updatePublicCartQuantity,
    setIsPublicCartOpen: setIsCartOpen,
    shopStoreSlug,
    sidebarCollapsed,
  } = useAppStore();
  const { isAdmin, isAuthenticated, isSessionReady, checkSession } = useAuth();
  const syncEnabled = isAuthenticated && isSessionReady;
  useFavoritesSync(syncEnabled);
  useOfflineSync(syncEnabled);
  useTastingJournalSync(syncEnabled);
  useTeaDiscoverySync(syncEnabled);
  useCompassSync(syncEnabled);
  useNotesSync(syncEnabled);
  const showAdminBar = false;

  const queryClient = useQueryClient();
  const location = useLocation();
  // The immersive Read long-reads (/read and /read/*) scroll the document
  // normally; pull-to-refresh must stay OFF there or a downward read-scroll
  // from the top gets mistaken for a pull gesture (the page refreshes and the
  // article won't scroll). Computed before the hook so it can gate the listeners.
  const isImmersiveReadRoute =
    location.pathname === '/read' || location.pathname.startsWith('/read/');
  // Pull-to-refresh: re-fetch inventory + invalidate active server queries so
  // public pages (Shop, Magazine, Events) reflect any updates made elsewhere.
  // The hook awaits this promise before hiding the indicator.
  const { pullDistance, isRefreshing, progress } = usePullToRefresh(async () => {
    await Promise.all([
      refetchInventory(),
      queryClient.invalidateQueries(),
    ]);
  }, { enabled: !isImmersiveReadRoute });

  const navigate = useNavigate();
  const activeSection = pathToSection(location.pathname);

  // One URL, two containers (the Instagram pattern): grid taps navigate to
  // /shop/product/:id with { state: { background: location } }. While that
  // background location is present the route table renders against it: the
  // shop stays mounted underneath (scroll + filters intact) and the grid
  // component floats the AlcoveModal above it. Cold loads (shared links,
  // reloads without state) have no background and render the real ProductPage.
  const backgroundLocation = (location.state as { background?: Location } | null)?.background;
  const displayLocation = backgroundLocation ?? location;

  // Detect active storefront from pathname to route checkout to that store's
  // WhatsApp number. Shares the react-query cache with <Storefront /> itself.
  const storefrontSlug = useMemo(() => {
    const m = location.pathname.match(/^\/store\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }, [location.pathname]);

  const isShopRoute = location.pathname === '/shop' || location.pathname.startsWith('/shop/');
  const querySelectedStoreSlug = useMemo(() => {
    if (!isShopRoute) return null;
    return new URLSearchParams(location.search).get('store')?.trim() || null;
  }, [isShopRoute, location.search]);
  const browsingStoreSlug = resolveCheckoutStoreSlug({
    hostedSlug: hostStoreSlug,
    storefrontSlug,
    querySelectedSlug: querySelectedStoreSlug,
    selectedSlug: shopStoreSlug,
  });
  const contactStoreSlug = resolveCartContactStoreSlug(cart, browsingStoreSlug);
  const isCommerceRoute = isShopRoute || !!storefrontSlug;
  const shouldFetchStore = shouldFetchCheckoutStore({
    hasCart: cart.length > 0,
    isCommerceRoute,
    hostedSlug: hostStoreSlug,
    contactStoreSlug,
  });

  const { data: activeStore } = useQuery<Account>({
    queryKey: ['storefront', 'store', contactStoreSlug],
    queryFn: () => fetchStore(contactStoreSlug as string),
    enabled: shouldFetchStore,
    staleTime: 1000 * 60 * 5,
  });
  const checkoutContactStore = activeStore?.slug === contactStoreSlug ? activeStore : undefined;

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
        // Deliberate link click, go to top
        window.scrollTo(0, 0);
        isNavClick.current = false;
      } else {
        // Browser back/forward, restore saved position
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
  //
  // Product-modal navigations are exempt: opening/swiping (new location has a
  // background) and closing (previous one had a background) keep the shop
  // mounted underneath, so its scroll position must survive untouched.
  const lastPathname = useRef(location.pathname);
  const lastHadBackground = useRef(!!backgroundLocation);
  useEffect(() => {
    if (lastPathname.current !== location.pathname) {
      lastPathname.current = location.pathname;
      if (!backgroundLocation && !lastHadBackground.current) {
        window.scrollTo(0, 0);
      }
    }
    lastHadBackground.current = !!backgroundLocation;
  }, [location.pathname, backgroundLocation]);

  // Update document title on section change
  useEffect(() => {
    const titles: Record<Section, string> = {
      HOME: 'Teajia | Tea Journal',
      MAGAZINE: 'Magazine · Teajia',
      LEARN: 'Craft · Teajia',
      SHOP: 'Shop · Teajia',
      OFFERINGS: 'Advise · Teajia',
      EVENTS: 'Sessions · Teajia',
      YOUR_TABLE: 'Your Table · Teajia',
      ABOUT: 'About · Teajia',
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

  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [sharingStory, setSharingStory] = useState<Story | null>(null);

  // User State, persisted to localStorage (#77, #78)
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
  const [cartToast, setCartToast] = useState<{ itemName: string; detail?: string; tone?: CartToastTone; cartCount: number } | null>(null);
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
      setSelectedStory(story);
      setWatchedStoryIds(prev => ({ ...prev, [story.id]: true }));
      if (story.type === ContentType.Article) {
        const slug = story.slug || story.id;
        navigate(`/article/${encodeURIComponent(slug)}`);
        return;
      } else {
        setViewState('STORY_VIEW');
      }
    };
    window.addEventListener('openArticle', handler);
    return () => window.removeEventListener('openArticle', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, navigate]);

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

  const handleAddToCart = (item: InventoryItem, qty: number, total: number) => {
    if (item.stock_g !== undefined && item.stock_g <= 0) {
      /* Reported, not confirmed. The band carries its own label per tone, so
         the name stays the name and the state stops being smuggled into it. */
      setCartToast({ itemName: item.name, tone: 'unavailable', cartCount: useAppStore.getState().publicCart.length });
      return;
    }

    const pricePerGram = item.category === 'tea'
      ? parseFloat(item.price_per_gram || '0')
      : parseFloat(item.price_50g || '0');
    const browsingStoreName = activeStore?.slug === browsingStoreSlug
      ? activeStore.name
      : cart[0]?.storeSlug === browsingStoreSlug
        ? cart[0].storeName
        : browsingStoreSlug;
    const cartItem = {
      id: item.id,
      name: item.name,
      variant: item.variant,
      category: item.category,
      storeSlug: browsingStoreSlug,
      storeName: browsingStoreName,
      quantityGrams: qty,
      /* One pack of this weight. The store adds a second pack rather than a
         heavier one when the same size is added again. */
      packGrams: qty,
      packs: 1,
      pricePerGram,
      totalPrice: total,
      /* A sealed unit ships as it is, exactly as an unbroken cake does, so the
         cart prices it the same way. */
      wholePieceGrams: item.category === 'tea'
        ? (sellUnitOf(item.form, item.pieceWeightG, item.soldInWholeUnits) ?? wholePieceOf(item.form, item.pieceWeightG))?.grams
        : undefined,
      type: item.type,
      image: item.image,
    };
    const currentCart = useAppStore.getState().publicCart;
    if (!canAddToStoreCart(currentCart, cartItem).allowed) {
      setCartToast(null);
      setIsCartOpen(true);
      showToast(`Your cart already contains items from ${currentCart[0].storeName}. One order can contain items from one store only.`, 5000);
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

    addToPublicCart(cartItem);
    // Show cart toast, read fresh count from store (Zustand updates synchronously)
    const freshCart = useAppStore.getState().publicCart;
    setCartToast({
      itemName: item.name,
      /* The size that was actually added. Two 50g packs of the same tea are
         the commonest thing a reader does here, and a confirmation that only
         names the tea cannot tell them apart. Teaware is sold by the piece,
         so it has no weight to state. */
      detail: item.category === 'tea' ? `${qty} g` : undefined,
      cartCount: freshCart.length,
    });
  };

  const handleRemoveFromCart = (lineKey: string) => {
    removeFromPublicCart(lineKey);
  };

  const handleUpdateCartQuantity = (lineKey: string, grams: number) => {
    updatePublicCartQuantity(lineKey, grams);
  };

  const handleUpdateCartPacks = (lineKey: string, packs: number) => {
    updatePublicCartPacks(lineKey, packs);
  };

  const handleCardClick = (story: Story) => {
    // Save current location before navigating
    setReturnToSection(activeSection);
    setSelectedStory(story);
    if (!watchedStoryIds[story.id]) {
       setWatchedStoryIds(prev => ({ ...prev, [story.id]: true }));
    }

    if (story.type === ContentType.Article) {
      const slug = story.slug || story.id;
      navigate(`/article/${encodeURIComponent(slug)}`);
      return;
    }

    setViewState('STORY_VIEW');
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

  /**
   * The public products query fails: who should hear about it.
   *
   * `useInventory` is provided at the app root, so this effect used to announce
   * one failed fetch on every route in the app. A reader on `/wisdom/regions`,
   * which renders its growing places out of a static module and issues no
   * product request at all, got a five-second "Something prevented this from
   * loading" laid over a page that had loaded perfectly. The reference pages,
   * the read pages and the craft pages are all in that position.
   *
   * Scoped by route rather than by moving the effect down into the components
   * that call `useInventory`, for three reasons. The question the effect has to
   * answer is "is the reader looking at something made of products right now",
   * and the route is exactly that fact, known here, where the effect already
   * lives. The two surfaces that are made of products (`Shop` and the product
   * loader behind it) are already handed `isError` and `onRetry` and render an
   * inline failure with a retry button, which is a better treatment than a
   * toast, so pushing the toast down means writing it into the places that need
   * it least. And the remaining callers, the search overlay, the account
   * panel's collection, the article product references, are incidental strips
   * that should degrade to nothing rather than interrupt.
   *
   * The message names the shop as well. `/collection` is a shared collection
   * rather than the shop itself, so on that route the reader needs to be told
   * which dependency failed, and "the shop could not load" is a sentence they
   * can act on where "something" is not.
   *
   * The incident record is deliberately outside the gate. An authenticated
   * session leaves one record per failure wherever the reader happened to be:
   * it is the interruption that was misplaced, not the diagnosis.
   */
  const isProductSurface = location.pathname === '/shop'
    || location.pathname.startsWith('/shop/')
    || location.pathname === '/collection';

  // Classify the actual failure rather than describing every HTTP/API error as
  // a connection problem. Authenticated sessions also leave one deduplicated,
  // sanitized incident record for later diagnosis.
  //
  // Two refs, not one, and the split is the point. A single "already handled"
  // flag would let the reader's location at the moment of failure decide
  // whether they ever see the message: fail while they are on a reference page,
  // flag set, and walking to the shop afterwards would find a silent one. The
  // report fires once per failure wherever they are; the toast fires once per
  // failure, once they are somewhere it means something.
  const incidentReportedRef = useRef(false);
  const inventoryToastShownRef = useRef(false);
  useEffect(() => {
    if (!inventoryError) {
      incidentReportedRef.current = false;
      inventoryToastShownRef.current = false;
      return;
    }
    if (incidentReportedRef.current && (inventoryToastShownRef.current || !isProductSurface)) return;

    const incident = classifyIncident(inventoryErrorObj, { route: '/api/products/public', method: 'GET' });

    if (isProductSurface && !inventoryToastShownRef.current) {
      inventoryToastShownRef.current = true;
      showToast(`The shop could not load. ${incident.userMessage}`, 5000);
    }

    if (!incidentReportedRef.current) {
      incidentReportedRef.current = true;
      if (isAuthenticated) {
        const { userMessage: _userMessage, ...report } = incident;
        void api.incidents.report(report).catch(() => { /* reporting must never block the user */ });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryError, inventoryErrorObj, isAuthenticated, isProductSurface]);

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

  // Google OAuth return, the worker redirects customers back here to
  // /?account=1 with the JWT in the URL hash (#oauth_token=...) on success, or
  // ?oauth_error=... on failure. Pick it up on load, hydrate the session, and
  // reopen the account panel so they see they're signed in.
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);

    if (hash.includes('oauth_token=')) {
      const oauthToken = new URLSearchParams(hash.slice(1)).get('oauth_token');
      if (oauthToken) {
        setToken(oauthToken);
        hydrateAccountStateFromToken();
        void checkSession();
        setShowAccountModal(true);
        // Strip the token from the URL so it isn't left in history/shareable.
        params.delete('account');
        const search = params.toString();
        window.history.replaceState(null, '', window.location.pathname + (search ? `?${search}` : ''));
        return;
      }
    }

    const oauthError = params.get('oauth_error');
    if (oauthError) {
      const messages: Record<string, string> = {
        access_denied: 'Google sign-in was cancelled.',
        invalid_state: 'Sign-in session expired. Please try again.',
        token_exchange_failed: 'Could not complete Google sign-in. Please try again.',
        userinfo_failed: 'Could not retrieve your Google profile.',
        account_error: 'Could not create or link your account.',
      };
      showToast(messages[oauthError] || 'Google sign-in failed. Please try again.', 5000);
      setShowAccountModal(true);
      setAccountInitialView('signin');
      params.delete('oauth_error');
      params.delete('account');
      const search = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (search ? `?${search}` : ''));
      return;
    }

    // Plain ?account=1 (no OAuth payload), also a request to open the panel.
    if (params.get('account') === '1') {
      setShowAccountModal(true);
      params.delete('account');
      const search = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (search ? `?${search}` : ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCloseCart = () => {
    setIsCartOpen(false);
  };

  const handleCloseAccount = () => {
    setShowAccountModal(false);
    setAccountInitialView(undefined);
    if (location.pathname === '/account') {
      navigate('/', { replace: true });
    }
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
  // Focused, standalone pages with no app chrome (nav, footer, bottom bar), link
  // recipients who aren't logged in. Public collection links (/c/:slug) belong here
  // too: a sent link should be a clean single-purpose page, not the full app shell.
  const isFocusedShareRoute = location.pathname.startsWith('/share/') || location.pathname.startsWith('/c/');
  // The four hand-built Read long-reads (/read and /read/*) are full-bleed
  // editorial experiences with their own sticky nav, reading-progress bar and
  // bottom-right accent control. They escape the app's content padding and the
  // floating bottom tab bar (which would otherwise overlap those accent swatches).
  //
  // The DB-driven immersive reader at /article/:slug intentionally KEEPS the
  // bottom tab bar: it's where authored articles open and a reader there should
  // be able to navigate the rest of the app. (It carries no corner accent
  // controls, so there's nothing for the bar to overlap.)
  const isImmersiveRead = isImmersiveReadRoute;

  // The product page owns its own gutter, so the shell must not add a second
  // one. Its reading used to sit 40px in from the edge of a phone, the
  // shell's 16px plus the alcove's own 24px, which is nine per cent of the
  // screen given away on each side of a column of prose that needs every
  // character it can get. The page's blocks are inset 20px from their own
  // edge; with the shell flush below lg that is the whole gutter, half what it
  // was. On lg the shell's px-10 stays: there the reading is a centred column
  // with room to spare and the outer margin is doing real work.
  const isProductPage = /^\/shop\/product\//.test(location.pathname);
  // The creator pages (/people, /people/:slug and its pay sheet) are built
  // edge to edge: the masthead, the photo grid and the tea rows reach the
  // screen's sides, and every block of words carries its own gutter inside.
  const isPeopleRoute = /^\/people(\/|$)/.test(location.pathname);

  // The sidebar sets --teajia-sidebar-w while it is mounted, and it now mounts
  // on public routes too. This only has to zero the variable where the sidebar
  // genuinely is not there, which is the focused share route: zeroing it on
  // every non-admin route would leave sidebar-inset overlays flush to the
  // window edge and sitting under the sidebar.
  useEffect(() => {
    if (isFocusedShareRoute) {
      document.documentElement.style.setProperty('--teajia-sidebar-w', '0px');
    }
  }, [isFocusedShareRoute]);

  return (
    <div className={`${isAdminRoute ? 'h-dvh overflow-hidden' : 'min-h-dvh overflow-x-clip'} bg-tea-bg text-tea-text relative selection:bg-tea-gold selection:text-tea-bg font-serif flex flex-col lg:flex-row transition-colors duration-300 pt-[env(safe-area-inset-top)]`}>

      <div className="texture-overlay"></div>
      <div className="fixed inset-0 bg-gradient-radial from-transparent via-tea-bg/40 to-tea-surface/90 pointer-events-none z-0"></div>

      {/* Admin Toolbar, visible only for admin users */}

      {/* Scroll Progress Bar */}
      {!isFocusedShareRoute && shouldShowGlobalScrollProgress(location.pathname) && <ScrollProgressBar />}


      {/* Pull to Refresh Indicator */}
      {!isFocusedShareRoute && !isImmersiveRead && <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={progress} />}

      {/* Desktop navigation is the sidebar, on every route rather than only on
          admin. The floating bar used to carry the desk as well, on the argument
          that one bar across every width is one mental model; in practice it
          put navigation along the bottom edge of a desk screen, which is not
          where the design puts it. The bar is now what it was drawn as: the
          phone's navigation. */}
      {!isFocusedShareRoute && (
        <LeftSidebar activeSection={activeSection} onNavigate={setActiveSection} onAccountClick={handleOpenAccount} onCartClick={handleOpenCart} onSearchClick={() => { window.dispatchEvent(new CustomEvent('dismiss-tasting-overlay')); setShowAccountModal(false); setAccountInitialView(undefined); setShowGlobalSearch(true); }} cartItemCount={cart.length} topOffset={showAdminBar} />
      )}

      {/* Main Content Area. Every route now clears the sidebar on the desk,
          public included: it used to run full width under a floating bar, and
          with the bar gone that left the content sitting under the sidebar.
          Below lg the sidebar is not there and the bar is, which is what
          pb-nav-gap-lg on main is for. */}
      <div className={`flex-1 min-w-0 min-h-0 flex flex-col relative ${
        isFocusedShareRoute
          ? 'lg:ml-0 lg:max-w-none'
          : sidebarCollapsed
            ? 'lg:ml-20 lg:max-w-[calc(100vw-5rem)]'
            : 'lg:ml-[14.5rem] lg:max-w-[calc(100vw-14.5rem)]'
      } transition-[margin,max-width] duration-300`}>

      {isAdminRoute ? (
        <Suspense fallback={<EmblemLoader />}>
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
      <main id="main-content" className={`${isFocusedShareRoute || isImmersiveRead ? 'px-0 pb-0' : `${isProductPage || isPeopleRoute ? 'px-0 lg:px-10' : 'px-4 md:px-6 lg:px-10'} pb-nav-gap-lg lg:pb-8`} pt-0 lg:pt-0 min-h-screen w-full flex-1 transition-opacity duration-300`}>
          <AnimatePresence mode="wait">
          {viewState === 'BROWSE' && (
            <AnimatedRoutes location={displayLocation}>
            <Routes location={displayLocation}>
                <Route path="/" element={
                  hostStoreSlug ? (
                    <ErrorBoundary>
                      <Suspense fallback={<EmblemLoader />}>
                        <Storefront
                          slug={hostStoreSlug}
                          onAddToCart={handleAddToCart}
                          onCartClick={handleOpenCart}
                          onAccountClick={handleOpenAccount}
                          cartItemCount={cart.length}
                        />
                      </Suspense>
                    </ErrorBoundary>
                  ) : (
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
                  )
                } />
                <Route path="/article/:slug" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <ArticleRouteSwitch />
                    </Suspense>
                  </ErrorBoundary>
                } />
                {/* Immersive long-reads, espresso + gold scrolling articles for the Read section. */}
                <Route path="/read" element={
                  <ErrorBoundary><Suspense fallback={<EmblemLoader />}><ReadIndex /></Suspense></ErrorBoundary>
                } />
                <Route path="/read/leaf-to-liquor" element={
                  <ErrorBoundary><Suspense fallback={<EmblemLoader />}><LeafToLiquor /></Suspense></ErrorBoundary>
                } />
                <Route path="/read/leaf-to-liquor/:template" element={
                  <ErrorBoundary><Suspense fallback={<EmblemLoader />}><LeafToLiquor /></Suspense></ErrorBoundary>
                } />
                {/* Every route below is gated: a draft renders ReadNotFound for a
                    visitor and the article for a signed-in owner or editor. See
                    ArticleGate above and src/pages/read/publishGate.ts. (JOBC-2) */}
                <Route path="/read/rock-remembers" element={
                  <ArticleGate href="/read/rock-remembers">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><RockRemembers /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/read/earth-water-fire" element={
                  <ArticleGate href="/read/earth-water-fire">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><EarthWaterFire /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/read/before-the-mist" element={
                  <ArticleGate href="/read/before-the-mist">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><BeforeTheMist /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                {/* The 10 templates ported from the Tea Article Redesign design project. */}
                <Route path="/read/atlas" element={
                  <ArticleGate href="/read/atlas">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><AtlasMapOfMountains /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/read/craft" element={
                  <ArticleGate href="/read/craft">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><CraftPotThatRemembers /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/read/porcelain-and-tea" element={
                  <ArticleGate href="/read/porcelain-and-tea">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><CraftRenewalPorcelain /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/read/essay" element={
                  <ArticleGate href="/read/essay">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><EssayLongWayToCup /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/read/field-notes" element={
                  <ArticleGate href="/read/field-notes">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><FieldNotesTwoRoomsBali /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/read/field-study" element={
                  <ArticleGate href="/read/field-study">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><FieldStudyWaterBeforeLeaf /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/read/history" element={
                  <ArticleGate href="/read/history">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><HistoryTenThousandMornings /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/read/legend" element={
                  <ArticleGate href="/read/legend">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><LegendImmortalsCliff /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/read/ritual" element={
                  <ArticleGate href="/read/ritual">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><RitualSevenSteeps /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/read/tasting" element={
                  <ArticleGate href="/read/tasting">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><TastingVocabularyOfTaste /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/read/tea-house" element={
                  <ArticleGate href="/read/tea-house">
                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><TeaHouseQuietHours /></Suspense></ErrorBoundary>
                  </ArticleGate>
                } />
                <Route path="/craft" element={
                  <ErrorBoundary>
                    <LearnHub onStoryClick={handleCardClick} watchedStories={watchedStoryIds} onCartClick={handleOpenCart} onAccountClick={handleOpenAccount} cartItemCount={cart.length} onNavigateToAdvise={() => setActiveSection('OFFERINGS')} />
                  </ErrorBoundary>
                } />
                {/* Legacy route, old links to /learn keep working. */}
                <Route path="/learn" element={<Navigate to="/craft" replace />} />
                <Route path="/shop" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <div className="w-full animate-[fadeIn_0.5s_ease-out]">
                        <Shop teaInventory={teaInventory} teawareInventory={teawareInventory} onAddToCart={handleAddToCart} cartItemCount={cart.length} onCartClick={handleOpenCart} onAccountClick={handleOpenAccount} isLoading={inventoryLoading} isError={inventoryError} error={inventoryErrorObj} onRetry={refetchInventory} modalLocation={location} />
                      </div>
                    </Suspense>
                  </ErrorBoundary>
                } />
                {/* Cold loads only. Grid taps carry a background location, so
                    this route stays on the shop and the modal opens instead. */}
                <Route path="/shop/product/:id" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <ProductPage
                        onAddToCart={handleAddToCart}
                        onCartClick={handleOpenCart}
                        cartItemCount={cart.length}
                      />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/advise" element={
                  <ErrorBoundary>
                    <AdvisePage onCartClick={handleOpenCart} onAccountClick={handleOpenAccount} cartItemCount={cart.length} />
                  </ErrorBoundary>
                } />
                {/* Legacy route, old links to /consult keep working. */}
                <Route path="/consult" element={<Navigate to="/advise" replace />} />
                <Route path="/for-your-space" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <ForYourSpacePage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/spaces" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <SpacesPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/start" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <StartHerePage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/discover" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <DiscoverPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/store-launch-playbook" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <StoreLaunchPlaybookPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/stores/playbook" element={<Navigate to="/store-launch-playbook" replace />} />
                <Route path="/collection" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <SharedCollection />
                    </Suspense>
                  </ErrorBoundary>
                } />
                {/* The public tea reference. /wisdom is the front door naming every holding;
                    each holding has its own index and detail page. */}
                <Route path="/wisdom" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><WisdomHomePage /></Suspense></ErrorBoundary>
                } />
                <Route path="/wisdom/cultivars" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><CultivarIndexPage /></Suspense></ErrorBoundary>
                } />
                <Route path="/wisdom/cultivar/:id" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><CultivarPage /></Suspense></ErrorBoundary>
                } />
                <Route path="/wisdom/regions" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><RegionIndexPage /></Suspense></ErrorBoundary>
                } />
                <Route path="/wisdom/region/:id" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><RegionPage /></Suspense></ErrorBoundary>
                } />
                <Route path="/wisdom/producers" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><ProducerIndexPage /></Suspense></ErrorBoundary>
                } />
                <Route path="/wisdom/producer/:id" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><ProducerPage /></Suspense></ErrorBoundary>
                } />
                <Route path="/wisdom/marks" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><MarkIndexPage /></Suspense></ErrorBoundary>
                } />
                <Route path="/wisdom/mark/:id" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><MarkPage /></Suspense></ErrorBoundary>
                } />
                <Route path="/wisdom/styles" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><StyleIndexPage /></Suspense></ErrorBoundary>
                } />
                <Route path="/wisdom/style/:id" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><StylePage /></Suspense></ErrorBoundary>
                } />
                <Route path="/wisdom/named" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><NamedTeaIndexPage /></Suspense></ErrorBoundary>
                } />
                <Route path="/wisdom/named/:id" element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><NamedTeaPage /></Suspense></ErrorBoundary>
                } />
                <Route path={TEA_REFERENCE_ROUTE_PATHS.index} element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><TeaTypeIndexPage /></Suspense></ErrorBoundary>
                } />
                <Route path={TEA_REFERENCE_ROUTE_PATHS.family} element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><TeaFamilyPage /></Suspense></ErrorBoundary>
                } />
                <Route path={TEA_REFERENCE_ROUTE_PATHS.type} element={
                  <ErrorBoundary><Suspense fallback={<WisdomFallback />}><TeaTypePage /></Suspense></ErrorBoundary>
                } />
                <Route path="/about" element={<ErrorBoundary><AboutPage /></ErrorBoundary>} />
                <Route path="/mcp" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><McpPage /></Suspense></ErrorBoundary>} />
                {/* /compass is admin-only at /admin/compass, public route removed.
                    Members use /account/journal for tasting; Compass is sourcing + ledger only. */}
                <Route path="/compass" element={<Navigate to="/account/journal" replace />} />
                <Route path="/account" element={<AccountRouteBridge onOpen={() => handleOpenAccount()} />} />
                <Route path="/account/journal" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><JournalPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/collection" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><CollectionPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/cellar" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><CellarPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/collections" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><SharedCollectionsPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/journey" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><AccountJourneyPage /></Suspense></ErrorBoundary>} />
                <Route path="/signin" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><SignInPage /></Suspense></ErrorBoundary>} />
                <Route path="/signup" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><SignUpPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/settings" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><AccountSettingsPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/profile" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><AccountProfilePage /></Suspense></ErrorBoundary>} />
                <Route path="/account/orders" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><OrderHistoryPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/orders/:id" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><OrderDetailPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/samples" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><SampleHistoryPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/docs" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><DeveloperDocsPage /></Suspense></ErrorBoundary>} />
                <Route path="/account/briefing" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><BriefingPage /></Suspense></ErrorBoundary>} />
                <Route path="/design/tabs" element={<ErrorBoundary><Suspense fallback={null}><TabStyleDemo /></Suspense></ErrorBoundary>} />
                <Route path="/design/palette-preview" element={<ErrorBoundary><Suspense fallback={null}><PalettePreviewPage /></Suspense></ErrorBoundary>} />
                <Route path="/design/article-editor" element={<ErrorBoundary><Suspense fallback={null}><ArticleEditorHarness /></Suspense></ErrorBoundary>} />
                <Route path="/design/system" element={<ErrorBoundary><Suspense fallback={null}><DesignSystemShowcase /></Suspense></ErrorBoundary>} />
                <Route path="/events" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><EventsPage /></Suspense></ErrorBoundary>} />
                <Route path="/event/:slug" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><EventLanding /></Suspense></ErrorBoundary>} />
                <Route path="/event/:slug/recap" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><EventRecapPage /></Suspense></ErrorBoundary>} />
                <Route path="/m/:magicToken" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><GuestManagement /></Suspense></ErrorBoundary>} />
                <Route path="/order/:ref" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><OrderStatusPage /></Suspense></ErrorBoundary>} />
                <Route path="/reset-password" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><ResetPasswordPage /></Suspense></ErrorBoundary>} />
                <Route path="/journey" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><JourneyPage /></Suspense></ErrorBoundary>} />
                <Route path="/passport/:token" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><PassportPage /></Suspense></ErrorBoundary>} />
                <Route path="/invite/:token" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><GuestInviteClaimPage /></Suspense></ErrorBoundary>} />
                <Route path="/s/:sampleId" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><SamplePage /></Suspense></ErrorBoundary>} />
                <Route path="/share/:token" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><ShareCardPage /></Suspense></ErrorBoundary>} />
                <Route path="/c/:slug" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><PublicCollectionPage /></Suspense></ErrorBoundary>} />
                <Route path="/me" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><CenterPage /></Suspense></ErrorBoundary>} />
                <Route path="/session/:id" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><SessionPage /></Suspense></ErrorBoundary>} />
                <Route path="/join" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><JoinPage /></Suspense></ErrorBoundary>} />
                <Route path="/join/:code" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><JoinPage /></Suspense></ErrorBoundary>} />
                <Route path="/t/:token" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><TableCardPage /></Suspense></ErrorBoundary>} />
                {/* Stock spine step 5: standalone public shelf. /u/ avoids the /t/:token collision. */}
                <Route path="/u/:slug" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><ShelfPage /></Suspense></ErrorBoundary>} />
                <Route path="/find-a-table" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <FindATable />
                    </Suspense>
                  </ErrorBoundary>
                } />
                {/* Legacy community URL now points to the network directory. */}
                <Route path="/community" element={<Navigate to="/find-a-table" replace />} />
                <Route path="/store/:slug" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <Storefront
                        onAddToCart={handleAddToCart}
                        onCartClick={handleOpenCart}
                        onAccountClick={handleOpenAccount}
                        cartItemCount={cart.length}
                      />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/people/:slug" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <ContributorProfilePage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/people/:slug/favorites" element={
                  <ErrorBoundary><Suspense fallback={<EmblemLoader />}><ProfileFavoritesPage /></Suspense></ErrorBoundary>
                } />
                <Route path="/people/:slug/pay" element={
                  <ErrorBoundary><Suspense fallback={<EmblemLoader />}><ProfilePaymentPage /></Suspense></ErrorBoundary>
                } />
                <Route path="/people" element={
                  <ErrorBoundary>
                    <Suspense fallback={<EmblemLoader />}>
                      <ContributorsIndexPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                {/* 404 Page */}
                <Route path="*" element={
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-[fadeIn_0.5s_ease-out]">
                    <h1 className="text-6xl font-serif text-tea-gold mb-4">404</h1>
                    <p className="text-xl font-serif text-tea-text mb-2">Page not found</p>
                    <p className="text-sm text-tea-text-sec mb-8 max-w-md">The page you're looking for doesn't exist or may have been moved.</p>
                    <button onClick={() => setActiveSection('HOME')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors">Return Home</button>
                  </div>
                } />
              </Routes>
            </AnimatedRoutes>
          )}
          </AnimatePresence>
      </main>

      {/* Global Footer, hidden on Home. Full-bleed; clearance lives inside Footer. */}
      {viewState === 'BROWSE' && activeSection !== 'HOME' && (
        <Footer />
      )}
      </>
      )}

      {/* --- Full Screen Views --- */}

      {/* Legacy article overlay removed, articles route through /article/:slug. */}

      {viewState === 'READER' && selectedStory && (
         <ImagePreloaderProvider>
           <Suspense fallback={<EmblemLoader />}>
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
         <Suspense fallback={<EmblemLoader />}>
           <MediaViewer
              story={selectedStory}
              onBack={handleBackToBrowse}
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
                        <Icons.Mail className="w-6 h-6 text-tea-gold mb-2 opacity-80 transition-transform duration-300" />
                        <span className="text-sm uppercase tracking-widest text-tea-text-sec mb-1">General Inquiries</span>
                        <a href="mailto:hello@teajia.com" className="font-serif text-xl text-tea-text hover:text-tea-gold transition-colors duration-300">hello@teajia.com</a>
                    </div>

                    <div className="w-full h-[1px] bg-tea-border"></div>

                    <div className="flex flex-col items-center">
                        <Icons.Instagram className="w-6 h-6 text-tea-gold mb-2 opacity-80 transition-transform duration-300" />
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

      {/* The add-to-cart confirmation band */}
      <CartToast
        itemName={cartToast?.itemName ?? ''}
        detail={cartToast?.detail}
        tone={cartToast?.tone}
        cartCount={cartToast?.cartCount ?? 0}
        isVisible={!!cartToast}
        onViewCart={handleViewCartFromToast}
        onDismiss={dismissCartToast}
      />

      {/* Walk-through companion, follows the owner across pages while they
          run and test a flow from the guide. Renders nothing unless active. */}
      <WalkthroughDock />

      <div role="status" aria-live="polite" className={`fixed bottom-nav-gap lg:bottom-8 left-1/2 -translate-x-1/2 bg-tea-surface text-tea-text px-6 py-3 rounded-md shadow-2xl transition-all duration-500 z-toast flex items-center gap-3 ${toast.show ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
          <Icons.Seal className="w-4 h-4 text-tea-gold" />
          <span className="text-xs uppercase tracking-widest font-medium">{toast.message}</span>
      </div>


      {/* Soft fade behind the floating bottom tab bar, masks page content
          peeking through the pill's side margins and bottom gap so the bar
          reads cleanly without distracting text behind it. */}
      {!isFocusedShareRoute && !isCartOpen && (
        <div
          aria-hidden="true"
          className="lg:hidden fixed inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
            background: 'linear-gradient(to top, var(--tea-bg) 0%, var(--tea-bg) 55%, transparent 100%)',
            /* z-panel-modal */ zIndex: 70,
          }}
        />
      )}

      {/* Bottom Tab Bar for Mobile, kept visible on the Read section too, so the
          reader can always navigate. The Read long-reads stay full-bleed (the
          px-0 layout still keys off isImmersiveRead); their bottom-right accent
          swatches sit above the bar's height so they don't collide. */}
      {!isFocusedShareRoute && (
        <BottomTabBar activeSection={activeSection} onNavigate={handleNavSection} hidden={isCartOpen} onAccountClick={handleToggleAccount} onAccountClose={handleCloseAccount} isAccountOpen={showAccountModal} onSearchClick={() => { window.dispatchEvent(new CustomEvent('dismiss-tasting-overlay')); setShowAccountModal(false); setAccountInitialView(undefined); setShowGlobalSearch(true); }} onSearchClose={() => setShowGlobalSearch(false)} isSearchOpen={showGlobalSearch} isAdminRoute={isAdminRoute} />
      )}

      </div>

      <CartPanel
         mode="public"
         storeSlug={contactStoreSlug || browsingStoreSlug}
         storeName={checkoutContactStore?.name || cart[0]?.storeName || browsingStoreSlug}
         isOpen={isCartOpen}
         onClose={handleCloseCart}
         cart={cart}
         onRemoveItem={handleRemoveFromCart}
         onUpdateQuantity={handleUpdateCartQuantity}
         onUpdatePacks={handleUpdateCartPacks}
         onAddItem={addToPublicCart}
         whatsappNumber={checkoutContactStore?.whatsapp_number}
         contactEmail={checkoutContactStore?.contact_email}
         canBePaid={checkoutContactStore?.can_be_paid}
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
