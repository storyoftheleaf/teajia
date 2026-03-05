
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Story, Person, LayoutVariant } from '../types';
import { Icons } from './Icons';
import { SinglePageRenderer, PageData, videoPlayerRegistry } from './SinglePageRenderer';
import { useImagePreloader } from '../context/ImagePreloaderContext';

interface ReaderProps {
  story: Story;
  onBack: () => void;
  onNavigate: (story: Story) => void;
  onPersonClick: (person: Person) => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onShare?: (story: Story) => void;
  enableKeyboard?: boolean;
  watchedStories?: Record<string, boolean>;
  recommendations?: Story[];
  customZIndex?: string;
}

// Helper: Content Analyzer
const isImage = (text: string) => text && (text.match(/^https?:\/\/.*\.(jpeg|jpg|png|webp|gif)/i) || text.includes('picsum') || text.includes('unsplash') || text.startsWith('data:image'));

// Helper: Extract YouTube Video ID from various formats
const extractYouTubeId = (text: string): string | null => {
  if (!text) return null;
  // Already a clean ID (11 chars, alphanumeric + dash/underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(text.trim())) {
    return text.trim();
  }
  // Full YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Helper: Extract Instagram Reel shortcode from various formats
// Format: IG:SHORTCODE or full Instagram URL
const extractInstagramId = (text: string): string | null => {
  if (!text) return null;
  const trimmed = text.trim();

  // Check for IG: prefix (e.g., "IG:CqQ5_5xP123")
  if (trimmed.startsWith('IG:')) {
    return trimmed.substring(3);
  }

  // Full Instagram URL patterns
  const patterns = [
    /instagram\.com\/reel\/([a-zA-Z0-9_-]+)/,
    /instagram\.com\/p\/([a-zA-Z0-9_-]+)/
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// --- Scaled Page Wrapper ---
// CRITICAL: Maintains strict 3:4 aspect ratio across all viewport sizes
//
// How it works:
// - Article always rendered at 800×1067px (3:4 ratio)
// - Scale = Math.min(clientWidth/800, clientHeight/1067)
// - transform: scale() shrinks it to fit within available container space
// - Math.min() ensures the limiting dimension controls scale (preserves 3:4 ratio)
// - transformOrigin: 'center center' keeps it centered
//
// On mobile (375px wide):
// - Width is the limiting factor
// - scaleX = 375/800 ≈ 0.47, scaleY = height/1067
// - Final scale = Math.min(scaleX, scaleY) = scaleX (width limited)
// - Result: Article fits width perfectly, maintains 3:4 aspect ratio
//
// On desktop (1920×1080):
// - Height is the limiting factor
// - scaleX = 1920/800 = 2.4, scaleY = 1080/1067 ≈ 1.01
// - Final scale = Math.min(scaleX, scaleY) = scaleY (height limited)
// - Result: Article fits height perfectly, maintains 3:4 aspect ratio
//
// Container padding DIRECTLY affects clientWidth/clientHeight calculation
// - See MAIN CONTENT AREA container below for padding values
// - NEVER modify padding without testing on mobile
//
// Related: Main content container (line ~423), BottomTabBar.tsx
//
const ScaledPage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    const BASE_WIDTH = 800;
    const BASE_HEIGHT = 1067; // 3:4 aspect ratio approx

    useEffect(() => {
        const calculateScale = () => {
            if (containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                // Simple approach: use width, calculate proportional height for 3:4 ratio
                // scaleX ensures article width fits container width
                // scaleY ensures article height fits container height
                // Math.min picks the limiting factor to guarantee both dimensions fit
                const scaleX = clientWidth / BASE_WIDTH;
                const scaleY = clientHeight / BASE_HEIGHT;
                const newScale = Math.min(scaleX, scaleY);
                setScale(newScale);
            }
        };

        calculateScale();
        // Debounce resize slightly to prevent thrashing
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(calculateScale, 100);
        };

        window.addEventListener('resize', handleResize);
        const observer = new ResizeObserver(calculateScale);
        if (containerRef.current) observer.observe(containerRef.current);
        
        return () => {
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
            clearTimeout(timeoutId);
        };
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden bg-transparent">
            <div
                style={{
                    width: BASE_WIDTH,
                    height: BASE_HEIGHT,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    filter: 'drop-shadow(0 25px 50px rgba(0, 0, 0, 0.25))',
                    contain: 'layout style paint'
                }}
                className="shrink-0 bg-[#F3F0E7] dark:bg-[#2a2a2a]"
            >
                {children}
            </div>
        </div>
    );
};

export const Reader: React.FC<ReaderProps> = ({ story, onBack, onNavigate, onShare, isSaved, onToggleSave, enableKeyboard = true, watchedStories, recommendations = [], customZIndex }) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showNav, setShowNav] = useState(false);
  const { preloadImages, clearCache } = useImagePreloader();

  // Horizontal scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- PAGE GENERATION ENGINE ---
  const pages: PageData[] = useMemo(() => {
    const generated: PageData[] = [];

    const rawContent = story.content || [];
    
    const textDefaults = [
        LayoutVariant.TEXT_SINGLE_COL, 
        LayoutVariant.TEXT_DROP_CAP, 
        LayoutVariant.TEXT_JUSTIFIED_NARROW,
        LayoutVariant.TEXT_DOUBLE_COL
    ];
    let textCycle = 0;

    rawContent.forEach((block, i) => {
        let variant: LayoutVariant | null = null;
        let content = block;
        let images: string[] = [];

        const variantMatch = block.match(/^:::(\w+):::(.*)/s);
        if (variantMatch) {
            const variantName = variantMatch[1];
            // Check if valid enum
            if (Object.values(LayoutVariant).includes(variantName as LayoutVariant)) {
                variant = variantName as LayoutVariant;
                content = variantMatch[2];
            }
        }

        // Extract Color Flag
        let textColor: 'light' | 'dark' = 'light';
        if (content.startsWith('$$dark$$')) {
            textColor = 'dark';
            content = content.substring(8); // remove marker
        }

        const parts = content.split('|').map(s => s.trim());

        // Video parsing for TEXT_WITH_VIDEO variants
        // Format: :::TEXT_WITH_VIDEO:::Text above|VIDEO_ID|caption|Text below
        // VIDEO_ID can be: YouTube ID, IG:SHORTCODE, or full URL
        let videoId: string | undefined;
        let instagramId: string | undefined;
        let videoCaption: string | undefined;

        if (variant === LayoutVariant.TEXT_WITH_VIDEO || variant === LayoutVariant.TEXT_WITH_VIDEO_VERTICAL) {
            // parts[0] = text above, parts[1] = video ID, parts[2] = caption, parts[3] = text below
            if (parts.length >= 2) {
                // Try Instagram first (IG: prefix), then YouTube
                instagramId = extractInstagramId(parts[1]) || undefined;
                if (!instagramId) {
                    videoId = extractYouTubeId(parts[1]) || undefined;
                }
                videoCaption = parts[2] || undefined;
                // Rebuild content as "text above|text below" for the layout
                const textAbove = parts[0] || '';
                const textBelow = parts[3] || '';
                content = textAbove + '|' + textBelow;
            }
        } else {
            // Standard image extraction for non-video layouts
            parts.forEach(p => {
                 if (isImage(p)) images.push(p);
            });
        }

        const textParts = parts.filter(p => !isImage(p) && !extractYouTubeId(p));
        const mainText = (variant === LayoutVariant.TEXT_WITH_VIDEO || variant === LayoutVariant.TEXT_WITH_VIDEO_VERTICAL)
            ? content
            : textParts.join('\n\n');

        if (!variant) {
            if (images.length > 0) {
                variant = LayoutVariant.IMG_FULL_BLEED;
            } else if (block.startsWith('#')) {
                variant = LayoutVariant.CHAPTER_BOLD;
            } else if (block.length < 100) {
                 variant = LayoutVariant.QUOTE_MINIMAL;
            } else {
                variant = textDefaults[textCycle % textDefaults.length];
                textCycle++;
            }
        }

        generated.push({
            variant: variant as LayoutVariant,
            content: mainText,
            images: images,
            index: generated.length,
            title: parts[0],
            textColor,
            videoId,
            instagramId,
            videoCaption
        });
    });

    if (generated.length === 0) {
        generated.push({ 
            variant: LayoutVariant.COVER_MAIN, 
            index: 0, 
            content: story.subtitle, 
            images: [story.thumbnailUrl || ''] 
        });
    }

    // Always append Next Reads page
    generated.push({
        variant: LayoutVariant.NEXT_READS,
        index: generated.length,
        content: 'Journal Index',
        images: [],
        textColor: 'light'
    });

    return generated;
  }, [story]);

  // --- PROGRESS & PERSISTENCE ---
  useEffect(() => {
    // Load saved progress on mount (or story change)
    const savedPage = localStorage.getItem(`teajia_progress_${story.id}`);
    if (savedPage) {
        const p = parseInt(savedPage, 10);
        if (!isNaN(p) && p > 0 && p < pages.length - 1) {
            setCurrentPageIndex(p);
            // Scroll to the restored page after layout so content is visible.
            // Double rAF ensures React has committed the render and layout is complete.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const container = scrollContainerRef.current;
                    if (container) {
                        const pageWidth = container.clientWidth;
                        container.scrollTo({ left: p * pageWidth, behavior: 'instant' });
                    }
                });
            });
        } else {
            setCurrentPageIndex(0);
        }
    } else {
        setCurrentPageIndex(0);
    }
  }, [story.id, pages.length]);

  useEffect(() => {
    // Save progress
    localStorage.setItem(`teajia_progress_${story.id}`, currentPageIndex.toString());
  }, [currentPageIndex, story.id]);

  // --- NAVIGATION ---
  const next = () => {
    if (currentPageIndex < pages.length - 1) {
      const nextIndex = currentPageIndex + 1;
      scrollToPage(nextIndex);
    }
  };

  const prev = () => {
    if (currentPageIndex > 0) {
      const prevIndex = currentPageIndex - 1;
      scrollToPage(prevIndex);
    }
  };

  const scrollToPage = (index: number) => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const firstChild = container.children[0] as HTMLElement;
    if (!firstChild) return;

    // Calculate scroll position: each page is 100vw (gap is 0)
    const pageWidth = container.clientWidth;
    const scrollLeft = index * pageWidth;

    container.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });
  };

  // --- SCROLL-BASED PAGE TRACKING ---
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const pageWidth = container.clientWidth;

      const newIndex = Math.round(scrollLeft / pageWidth);

      if (newIndex !== currentPageIndex && newIndex >= 0 && newIndex < pages.length) {
        setCurrentPageIndex(newIndex);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentPageIndex, pages.length]);

  // --- PAUSE VIDEOS ON PAGE CHANGE ---
  useEffect(() => {
    // When page changes, pause all playing videos
    videoPlayerRegistry.forEach((player) => {
      player.pause();
    });
  }, [currentPageIndex]);

  useEffect(() => {
    if (!enableKeyboard) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex, pages.length]);

  // --- IMAGE PRELOADING ---
  // Preload images for next 2-3 pages as user navigates
  useEffect(() => {
    // Collect URLs from next 3 pages
    const urlsToPreload: string[] = [];
    for (let i = 1; i <= 3 && currentPageIndex + i < pages.length; i++) {
      const pageImages = pages[currentPageIndex + i]?.images || [];
      urlsToPreload.push(...pageImages.filter(Boolean));
    }

    if (urlsToPreload.length > 0) {
      preloadImages(urlsToPreload).catch(() => {
        // Silent error - images will load on-demand if preload fails
      });
    }
  }, [currentPageIndex, pages, preloadImages]);

  // Clear cache when story changes (prevent memory accumulation)
  useEffect(() => {
    clearCache();
  }, [story.id, clearCache]);

  // --- PROGRESS SCRUBBER ---
  const ProgressScrubber = ({ className = '' }: { className?: string }) => {
    const progress = pages.length > 1 ? currentPageIndex / (pages.length - 1) : 0;
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const targetPage = Math.round(ratio * (pages.length - 1));
      scrollToPage(targetPage);
    };
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <span className="text-xs font-mono text-white/50 tabular-nums w-4 text-right">{currentPageIndex + 1}</span>
        <div
          onClick={handleClick}
          className="flex-1 h-8 flex items-center cursor-pointer group"
          role="slider"
          aria-valuenow={currentPageIndex + 1}
          aria-valuemin={1}
          aria-valuemax={pages.length}
          aria-label="Reading progress"
        >
          <div className="w-full h-[3px] bg-white/10 rounded-full relative">
            <div
              className="absolute inset-y-0 left-0 bg-white/60 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.3)] transition-all duration-300 ease-out group-hover:w-2.5 group-hover:h-2.5"
              style={{ left: `calc(${progress * 100}% - 4px)` }}
            />
          </div>
        </div>
        <span className="text-xs font-mono text-white/35 tabular-nums w-4">{pages.length}</span>
      </div>
    );
  };

  // --- SUB-COMPONENTS (Nav Overlay) ---
  const NavOverlay = () => (
    <div 
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-end animate-[fadeIn_0.2s_ease-out]" 
        onClick={() => setShowNav(false)}
    >
        <div className="w-full max-w-sm bg-[#F3F0E7] h-full shadow-2xl p-8 overflow-y-auto border-l border-tea-ink/10 animate-[slideLeft_0.3s_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-10 border-b border-tea-ink/10 pb-4">
                <span className="text-tea-ink font-serif italic text-xl">Journal Index</span>
                <button onClick={() => setShowNav(false)} className="p-2 hover:bg-tea-ink/5 rounded-full transition-colors">
                    <Icons.Close className="w-5 h-5 text-tea-ink/60" />
                </button>
            </div>
            <div className="space-y-8">
                {recommendations.map(s => (
                    <div key={s.id} onClick={() => { onNavigate(s); setShowNav(false); }} className="group cursor-pointer flex gap-5">
                         {/* Thumbnail */}
                         <div className="w-16 h-20 bg-tea-ink/5 shrink-0 relative overflow-hidden">
                             <img src={s.thumbnailUrl} className="w-full h-full object-cover sepia-[0.3] group-hover:sepia-0 transition-all duration-500" alt="thumb" loading="lazy" />
                         </div>
                         <div className="flex-1">
                             <div className="flex justify-between items-start">
                                 <span className="text-[11px] uppercase tracking-widest text-tea-ink/60 mb-1 block">{s.type}</span>
                                 {watchedStories?.[s.id] && <Icons.Check className="w-3 h-3 text-tea-green opacity-70" />}
                             </div>
                             <h4 className="text-tea-ink font-serif text-lg leading-tight group-hover:text-tea-seal transition-colors mb-1">{s.title}</h4>
                             <p className="text-tea-ink/60 text-xs uppercase tracking-wider">{s.subtitle}</p>
                         </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );

  // --- MAIN RENDER ---
  return (
    <div className={`fixed inset-0 bg-[#1a1a1a] flex flex-col items-center justify-center overflow-hidden ${customZIndex || 'z-[60]'}`}>
        
        {/* Background Texture for Immersion */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-50 pointer-events-none"></div>

        {/* Navigation Drawer */}
        {showNav && <NavOverlay />}

        {/* --- TOP BAR (Universal) --- */}
        <div className="absolute top-0 left-0 w-full h-16 z-50 flex items-center justify-between px-6 md:px-10 text-white/70 pointer-events-none bg-gradient-to-b from-black/40 to-transparent">
             <button onClick={onBack} className="flex items-center gap-2 text-xs uppercase tracking-widest hover:text-white pointer-events-auto transition-colors">
                 <Icons.Close className="w-5 h-5" />
                 <span className="hidden md:inline">Close</span>
             </button>

             <div className="flex items-center gap-6 pointer-events-auto">
                 <button onClick={() => setShowNav(true)} className="hover:text-white transition-colors">
                    <Icons.List className="w-5 h-5" />
                 </button>
                 {onShare && (
                     <button onClick={() => onShare(story)} className="hover:text-white transition-colors">
                        <Icons.Share className="w-5 h-5" />
                     </button>
                 )}
                 <button onClick={onToggleSave} className={`hover:text-white transition-colors ${isSaved ? 'text-tea-seal' : ''}`}>
                    <Icons.Leaf filled={isSaved} className="w-5 h-5" />
                 </button>
             </div>
        </div>

        {/* --- DESKTOP NAV ARROWS (Floating) --- */}
        <button
            onClick={prev}
            disabled={currentPageIndex === 0}
            className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 z-50 text-white/40 hover:text-white transition-all disabled:opacity-0"
        >
            <Icons.Back className="w-10 h-10" />
        </button>
        <button
            onClick={next}
            disabled={currentPageIndex >= pages.length - 1}
            className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 z-50 text-white/40 hover:text-white transition-all disabled:opacity-0"
        >
            <Icons.Next className="w-10 h-10" />
        </button>

        {/* --- MAIN CONTENT AREA --- */}
        {/* Horizontal scroll container for all pages */}
        <div
            ref={scrollContainerRef}
            className="relative w-full h-full overflow-x-scroll overflow-y-hidden snap-x snap-mandatory scroll-smooth hide-scrollbar-always flex items-center"
            style={{
              paddingTop: '64px',
              paddingBottom: '96px'
            }}
        >
            <div className="inline-flex h-full" style={{ gap: '0' }}>
                {pages.map((page, index) => {
                    // Lazy rendering: only render pages within range of current page
                    const isInRange = Math.abs(index - currentPageIndex) <= 2;

                    if (isInRange) {
                        return (
                            <div key={index} className="w-screen h-full snap-center snap-always shrink-0">
                                <ScaledPage>
                                    <SinglePageRenderer
                                        page={page}
                                        storyTitle={story.title}
                                        storySubtitle={story.subtitle}
                                        onNavigate={onNavigate}
                                        recommendations={recommendations}
                                    />
                                </ScaledPage>
                            </div>
                        );
                    } else {
                        // Placeholder to maintain scroll positions
                        return (
                            <div key={index} className="w-screen h-full snap-center snap-always shrink-0" />
                        );
                    }
                })}
            </div>
        </div>

        {/* --- BOTTOM BAR (Mobile Nav & Progress) --- */}
        <div className="absolute left-0 w-full z-50 pointer-events-none bottom-[70px] lg:bottom-0">

             {/* Mobile: Arrows + Scrubber */}
             <div className="lg:hidden flex items-center px-6 pb-4 gap-3 pointer-events-auto">
                 <button
                    onClick={prev}
                    disabled={currentPageIndex === 0}
                    className="text-white/40 hover:text-white disabled:opacity-0 transition-all shrink-0"
                 >
                     <Icons.Back className="w-7 h-7" />
                 </button>

                 <ProgressScrubber className="flex-1" />

                 <button
                    onClick={next}
                    disabled={currentPageIndex >= pages.length - 1}
                    className="text-white/40 hover:text-white disabled:opacity-0 transition-all shrink-0"
                 >
                     <Icons.Next className="w-7 h-7" />
                 </button>
             </div>

             {/* Desktop: Scrubber only */}
             <div className="hidden lg:flex pb-6 pointer-events-auto justify-center">
                 <ProgressScrubber className="w-64" />
             </div>
        </div>

    </div>
  );
};
