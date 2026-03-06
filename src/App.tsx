
import React, { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';

const AdminApp = lazy(() => import('./admin/AdminApp'));
import { STORIES, LEARN_STORIES } from './constants';
import { Story, ContentType, ViewState, Person, InventoryItem, Section } from './types';
import { useAppStore } from './lib/store';
import { pathToSection, sectionToPath } from './lib/routes';
import { MediaViewer } from './components/MediaViewer';
import { Reader } from './components/Reader';
import { VisualFeatureViewer } from './components/PhotoEssay/VisualFeatureViewer';
import { ContributorProfile } from './components/ContributorProfile';
import { ShareModal } from './components/ShareModal';
import { Icons } from './components/Icons';
import { Shop } from './components/Shop';
import { CartDrawer } from './components/CartDrawer';
import { LearnHub } from './components/LearnHub';
import { HomePage } from './components/HomePage';
import { StoryProvider, useStories } from './context/StoryContext';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { ThemeProvider } from './context/ThemeContext';
import { ImagePreloaderProvider, useImagePreloader } from './context/ImagePreloaderContext';
import { AccountPanel } from './components/AccountPanel';
import { LeftSidebar } from './components/LeftSidebar';
import { BottomTabBar } from './components/BottomTabBar';
import { MagazineTabbed } from './components/MagazineTabbed';
import { ConsultPage } from './components/ConsultPage';
import AboutPage from './AboutPage';
import Footer from './components/shared/Footer';
import { ErrorBoundary } from './admin/components/ErrorBoundary';
import { SectionSkeleton } from './components/shared/SectionSkeleton';
import { PullToRefreshIndicator } from './components/shared/PullToRefreshIndicator';
import { PreloadIndicator } from './components/shared/PreloadIndicator';
import { CartFlyAnimation } from './components/shared/CartFlyAnimation';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { COMMUNITY_MEMBERS } from './data/communityMembers';
import { TEA_INSPIRE_IMAGES } from './data/teaInspire';

// Create an inner component to use the context
const AppContent = () => {
  const { stories } = useStories();
  const { inventory } = useInventory();
  const {
    publicCart: cart,
    isPublicCartOpen: isCartOpen,
    addToPublicCart,
    removeFromPublicCart,
    updatePublicCartQuantity,
    setIsPublicCartOpen: setIsCartOpen,
  } = useAppStore();
  const preloader = useImagePreloader();

  const { pullDistance, isRefreshing, progress } = usePullToRefresh();

  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = pathToSection(location.pathname);

  const [magazineDefaultTab, setMagazineDefaultTab] = useState<'articles' | 'visual' | 'tea-inspire'>('articles');
  const [isSectionTransitioning, setIsSectionTransitioning] = useState(false);

  // Scroll position memory for each section
  const scrollPositions = useRef<Record<Section, number>>({
    HOME: 0, MAGAZINE: 0, LEARN: 0, SHOP: 0, OFFERINGS: 0, ACCOUNT: 0, ABOUT: 0
  });

  // Previous section for scroll position save
  const prevSection = useRef<Section>(activeSection);

  // Save/restore scroll positions on section change
  useEffect(() => {
    if (prevSection.current !== activeSection) {
      // Save scroll for previous section
      scrollPositions.current[prevSection.current] = window.scrollY;
      // Restore scroll for new section
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositions.current[activeSection]);
      });
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

  // Navigate with scroll position memory + skeleton flash
  const setActiveSection = useCallback((section: Section) => {
    if (section === activeSection) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Save current scroll position before navigating
    scrollPositions.current[activeSection] = window.scrollY;
    setIsSectionTransitioning(true);
    // Brief skeleton flash for perceived speed
    setTimeout(() => {
      navigate(sectionToPath(section));
      // Close any open reader/viewer when navigating to a different section
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

  // User State
  const [savedStoryIds, setSavedStoryIds] = useState<Record<string, boolean>>({});
  const [watchedStoryIds, setWatchedStoryIds] = useState<Record<string, boolean>>({});

  // Cart state managed by Zustand store (publicCart)

  // Modal State
  const [showContact, setShowContact] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  // UI Feedback State
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
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

  // Cart persistence handled by Zustand persist middleware

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
    // Trigger fly animation from center of screen to cart icon
    setFlyAnimation({
      x: window.innerWidth / 2 - 24,
      y: window.innerHeight / 2,
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
    showToast(`Added ${item.name}`);
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

  const handleOpenAccount = () => {
    setShowAccountModal(true);
  };

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
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[#0c0c0c] text-neutral-400 font-sans text-sm">Loading admin...</div>}>
          <Routes>
            <Route path="/admin/*" element={<AdminApp />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F0E7] dark:bg-[#0f0f0f] text-tea-ink dark:text-tea-paper relative selection:bg-tea-seal selection:text-white overflow-x-hidden font-serif flex flex-col lg:flex-row transition-colors duration-300">

      <div className="texture-overlay"></div>
      <div className="fixed inset-0 wood-texture pointer-events-none opacity-[0.15] dark:opacity-[0.15] mix-blend-color-burn z-0"></div>
      <div className="fixed inset-0 wood-texture pointer-events-none opacity-[0.05] dark:opacity-[0.1] z-0 invert filter brightness-150"></div>
      <div className="fixed inset-0 bg-gradient-radial from-transparent via-white/0 dark:via-[#1a1a1a]/40 to-white/10 dark:to-[#121212]/90 pointer-events-none z-0"></div>

      {/* Pull to Refresh Indicator */}
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={progress} />

      {/* Left Sidebar for Desktop */}
      <LeftSidebar activeSection={activeSection} onNavigate={setActiveSection} onAccountClick={handleOpenAccount} onCartClick={handleOpenCart} cartItemCount={cart.length} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative lg:ml-20 xl:ml-56">

      <main id="main-content" className="px-4 md:px-6 lg:px-10 pt-0 lg:pt-0 pb-32 md:pb-24 lg:pb-8 min-h-screen w-full flex-1 transition-opacity duration-300">
          {isSectionTransitioning ? (
            <SectionSkeleton variant={activeSection === 'HOME' ? 'hero' : activeSection === 'SHOP' ? 'list' : 'grid'} />
          ) : (
            viewState === 'BROWSE' && (
              <Routes>
                <Route path="/" element={
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
                } />
                <Route path="/magazine" element={
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
                } />
                <Route path="/learn" element={
                  <LearnHub onStoryClick={handleCardClick} watchedStories={watchedStoryIds} onCartClick={handleOpenCart} onAccountClick={handleOpenAccount} cartItemCount={cart.length} onNavigateToConsult={() => setActiveSection('OFFERINGS')} />
                } />
                <Route path="/shop" element={
                  <div className="w-full animate-[fadeIn_0.5s_ease-out]">
                    <Shop teaInventory={teaInventory} teawareInventory={teawareInventory} onAddToCart={handleAddToCart} cartItemCount={cart.length} onCartClick={handleOpenCart} onAccountClick={handleOpenAccount} />
                  </div>
                } />
                <Route path="/consult" element={
                  <ConsultPage onCartClick={handleOpenCart} onAccountClick={handleOpenAccount} cartItemCount={cart.length} />
                } />
                <Route path="/about" element={<AboutPage />} />
                {/* Catch-all: redirect to home */}
                <Route path="*" element={
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
                } />
              </Routes>
            )
          )}
      </main>

      {/* Global Footer */}
      {viewState === 'BROWSE' && (
        <div className="px-4 md:px-6 lg:px-10 max-w-[1400px] mx-auto w-full pb-32 md:pb-24 lg:pb-8">
          <Footer onNavigate={setActiveSection} />
        </div>
      )}

      {/* --- Full Screen Views --- */}

      {viewState === 'READER' && selectedStory && (
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
      )}

      {viewState === 'STORY_VIEW' && selectedStory && (
         <MediaViewer
            story={selectedStory}
            onBack={handleBackToBrowse}
            isSaved={savedStoryIds[selectedStory.id]}
            onToggleSave={() => toggleSave(selectedStory.id)}
            onShare={handleShare}
         />
      )}

      {viewState === 'PHOTO_ESSAY' && selectedStory && (
         <VisualFeatureViewer
            story={selectedStory}
            onBack={handleBackToBrowse}
            onPersonClick={setSelectedPerson}
            isSaved={savedStoryIds[selectedStory.id]}
            onToggleSave={() => toggleSave(selectedStory.id)}
            onShare={handleShare}
         />
      )}

      {selectedPerson && (
         <ContributorProfile person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      )}

      {sharingStory && (
         <ShareModal story={sharingStory} onClose={() => setSharingStory(null)} />
      )}

      <CartDrawer
         isOpen={isCartOpen}
         onClose={handleCloseCart}
         cart={cart}
         onRemoveItem={handleRemoveFromCart}
         onUpdateQuantity={handleUpdateCartQuantity}
      />

      {/* --- ACCOUNT MODAL --- */}
      {showAccountModal && (
        <AccountPanel onClose={handleCloseAccount} />
      )}

      {/* --- CONTACT MODAL --- */}
      {showContact && (
        <div className="fixed inset-0 z-[210] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-[fadeIn_0.3s_ease-out]" onClick={() => setShowContact(false)}>
            <div className="bg-[#F3F0E7] max-w-md w-full p-10 text-center relative shadow-2xl animate-[scaleIn_0.3s_ease-out]" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowContact(false)} className="absolute top-4 right-4 p-2 text-tea-ink/40 hover:text-tea-seal transition-colors duration-300"><Icons.Close className="w-5 h-5" /></button>
                <h2 className="text-2xl font-serif text-tea-ink mb-8 animate-[fadeIn_0.5s_ease-out]" style={{ animationDelay: '150ms' }}>Contact Us</h2>

                <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]" style={{ animationDelay: '200ms' }}>
                    <div className="flex flex-col items-center">
                        <Icons.Mail className="w-6 h-6 text-tea-seal mb-2 opacity-80 transition-transform duration-300 hover:scale-110" />
                        <span className="text-sm uppercase tracking-widest text-tea-ink/50 mb-1">General Inquiries</span>
                        <a href="mailto:hello@teajia.com" className="font-serif text-xl text-tea-ink hover:text-tea-seal transition-colors duration-300">hello@teajia.com</a>
                    </div>

                    <div className="w-full h-[1px] bg-tea-ink/10"></div>

                    <div className="flex flex-col items-center">
                        <Icons.Instagram className="w-6 h-6 text-tea-seal mb-2 opacity-80 transition-transform duration-300 hover:scale-110" />
                        <span className="text-sm uppercase tracking-widest text-tea-ink/50 mb-1">Follow Us</span>
                        <a href="#" className="font-serif text-xl text-tea-ink hover:text-tea-seal transition-colors duration-300">@teajia.journal</a>
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

      {/* Preload indicator */}
      <PreloadIndicator />

      <div className={`fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 bg-tea-paper text-tea-ink px-6 py-3 rounded-sm shadow-2xl transition-all duration-500 z-[250] flex items-center gap-3 ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <Icons.Seal className="w-4 h-4 text-tea-seal" />
          <span className="text-xs uppercase tracking-widest font-medium">{toast.message}</span>
      </div>

      {/* Bottom Tab Bar for Mobile */}
      <BottomTabBar activeSection={activeSection} onNavigate={setActiveSection} cartItemCount={cart.length} hidden={isCartOpen || showAccountModal} />

      </div>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <StoryProvider>
        <InventoryProvider>
          <ImagePreloaderProvider>
            <AppContent />
          </ImagePreloaderProvider>
        </InventoryProvider>
      </StoryProvider>
    </ThemeProvider>
  );
}
