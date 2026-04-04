
import '../styles/reader-animations.css';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion';
import { Story, LayoutVariant } from '../types';
import { Icons } from './Icons';
import { SinglePageRenderer, PageData, videoPlayerRegistry } from './SinglePageRenderer';
import { useImagePreloader } from '../context/ImagePreloaderContext';

interface ReaderProps {
  story: Story;
  onBack: () => void;
  onNavigate: (story: Story) => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
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
  if (/^[a-zA-Z0-9_-]{11}$/.test(text.trim())) return text.trim();
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
const extractInstagramId = (text: string): string | null => {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.startsWith('IG:')) return trimmed.substring(3);
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

// Helper: Window width hook for responsive layout
const useWindowWidth = () => {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
};


// Shake detector hook
const useShakeDetector = (onShake: () => void) => {
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    let lastShake = 0;
    let shakeCount = 0;

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      if (magnitude > 15) {
        const now = Date.now();
        if (now - lastShake < 500) {
          shakeCount++;
          if (shakeCount >= 3) {
            onShakeRef.current();
            shakeCount = 0;
          }
        } else {
          shakeCount = 1;
        }
        lastShake = now;
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, []);
};

// --- Scaled Page Wrapper ---
// CRITICAL: Maintains strict 4:5 aspect ratio across all viewport sizes
//
// How it works:
// - Article always rendered at 800×1000px (4:5 ratio)
// - Scale = Math.min(clientWidth/800, clientHeight/1000)
// - transform: scale() shrinks it to fit within available container space
// - Math.min() ensures the limiting dimension controls scale (preserves 4:5 ratio)
// - transformOrigin: 'center center' keeps it centered
//
const ScaledPage: React.FC<{ children: React.ReactNode; isActive?: boolean; pageWeight?: 'text-heavy' | 'image-heavy' | 'spacious' | 'mixed' }> = ({ children, isActive, pageWeight }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const BASE_WIDTH = 800;
  const BASE_HEIGHT = 1000;

  useEffect(() => {
    const calculateScale = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const scaleX = clientWidth / BASE_WIDTH;
        const scaleY = clientHeight / BASE_HEIGHT;
        const newScale = Math.min(scaleX, scaleY);
        setScale(newScale);
      }
    };

    calculateScale();
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
          boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 15px 40px rgba(0,0,0,0.15), 0 50px 100px rgba(0,0,0,0.1)',
          contain: 'layout style paint',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden'
        }}
        className={`shrink-0 bg-tea-bg relative ${
          pageWeight === 'image-heavy' ? 'page-vignette-strong' :
          pageWeight === 'text-heavy' ? 'page-vignette-none' :
          'page-vignette'
        }`}
      >
        {children}
      </div>
    </div>
  );
};

/** Enhanced progress bar with diamond marker for Reader. */
const ReaderProgressBar: React.FC<{ currentPage: number; totalPages: number }> = ({ currentPage, totalPages }) => {
  const progress = totalPages > 1 ? (currentPage / (totalPages - 1)) * 100 : 0;
  const springProgress = useSpring(useMotionValue(progress), { stiffness: 100, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    springProgress.set(progress);
  }, [progress, springProgress]);

  return (
    <div className="absolute top-0 left-0 right-0 z-priority reader-progress-track">
      <motion.div
        className="reader-progress-fill"
        style={{ width: springProgress.get() + '%' }}
        animate={{ width: progress + '%' }}
        transition={{ type: 'spring', stiffness: 100, damping: 30 }}
      />
    </div>
  );
};

export const Reader: React.FC<ReaderProps> = ({ story, onBack, onNavigate, isSaved, onToggleSave, enableKeyboard = true, watchedStories, recommendations = [], customZIndex }) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showNav, setShowNav] = useState(false);
  const [showChapterDrawer, setShowChapterDrawer] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTooltipPage, setDragTooltipPage] = useState<number | null>(null);
  const [showShakeConfirm, setShowShakeConfirm] = useState(false);
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);
  const [marginOpacity, setMarginOpacity] = useState(0.3);

  const { preloadImages, clearCache } = useImagePreloader();
  const windowWidth = useWindowWidth();
  const isDesktop = windowWidth >= 1024;

  const scrubberRef = useRef<HTMLDivElement>(null);
  const lastVibratedPage = useRef<number>(-1);
  const keyboardHintsTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const marginTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // W30: Time-of-Day Theming — strengthened
  const hour = new Date().getHours();
  const timeTheme = hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
  const timeFilter = timeTheme === 'morning'
    ? 'brightness(1.02) saturate(0.96)'
    : timeTheme === 'evening'
      ? 'brightness(0.94) sepia(0.08) saturate(0.88)'
      : undefined; // midday: no filter

  // --- PAGE GENERATION ENGINE ---
  const pages: PageData[] = useMemo(() => {
    const generated: PageData[] = [];
    const rawContent = story.content || [];

    const textDefaults = [
      LayoutVariant.TEXT_SINGLE_COL,
      LayoutVariant.TEXT_DROP_CAP,
      LayoutVariant.TEXT_JUSTIFIED_NARROW,
      LayoutVariant.TEXT_CENTER_NARROW,
      LayoutVariant.TEXT_DOUBLE_COL,
      LayoutVariant.TEXT_SIDEBAR_IMAGE
    ];
    let textCycle = 0;

    rawContent.forEach((block) => {
      let variant: LayoutVariant | null = null;
      let content = block;
      let images: string[] = [];

      const variantMatch = block.match(/^:::(\w+):::(.*)/s);
      if (variantMatch) {
        const variantName = variantMatch[1];
        if (Object.values(LayoutVariant).includes(variantName as LayoutVariant)) {
          variant = variantName as LayoutVariant;
          content = variantMatch[2];
        }
      }

      let textColor: 'light' | 'dark' = 'light';
      if (content.startsWith('$$dark$$')) {
        textColor = 'dark';
        content = content.substring(8);
      }

      const parts = content.split('|').map(s => s.trim());

      let videoId: string | undefined;
      let instagramId: string | undefined;
      let videoCaption: string | undefined;

      if (variant === LayoutVariant.TEXT_WITH_VIDEO || variant === LayoutVariant.TEXT_WITH_VIDEO_VERTICAL) {
        if (parts.length >= 2) {
          instagramId = extractInstagramId(parts[1]) || undefined;
          if (!instagramId) {
            videoId = extractYouTubeId(parts[1]) || undefined;
          }
          videoCaption = parts[2] || undefined;
          const textAbove = parts[0] || '';
          const textBelow = parts[3] || '';
          content = textAbove + '|' + textBelow;
        }
      } else {
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

    // --- PAGE WEIGHT CLASSIFICATION ---
    const getPageWeight = (v: LayoutVariant): 'text-heavy' | 'image-heavy' | 'spacious' | 'mixed' => {
      const s = v as string;
      if (s.startsWith('TEXT_DOUBLE') || s.startsWith('TEXT_TRIPLE') || s === 'TEXT_JUSTIFIED_NARROW' || s === 'TEXT_SINGLE_COL') return 'text-heavy';
      if (s.startsWith('IMG_') || s === 'COVER_MAIN' || s === 'COVER_SPLIT') return 'image-heavy';
      if (s.startsWith('QUOTE_') || s.startsWith('POEM_') || s.startsWith('CHAPTER_') || s === 'TEXT_BLOCKQUOTE_CENTER') return 'spacious';
      return 'mixed';
    };

    // Assign pageWeight to every generated page
    generated.forEach((p) => {
      p.pageWeight = getPageWeight(p.variant);
    });

    // Pacing check: avoid two consecutive text-heavy pages
    for (let i = 1; i < generated.length - 1; i++) {
      if (generated[i].pageWeight === 'text-heavy' && generated[i - 1].pageWeight === 'text-heavy') {
        // Only swap auto-assigned variants (not author-tagged ones)
        const wasAutoAssigned = !rawContent[i]?.match(/^:::(\w+):::/);
        if (wasAutoAssigned) {
          generated[i].variant = LayoutVariant.TEXT_CENTER_NARROW;
          generated[i].pageWeight = 'spacious';
        }
      }
    }

    if (generated.length === 0) {
      generated.push({
        variant: LayoutVariant.COVER_MAIN,
        index: 0,
        content: story.subtitle,
        images: story.thumbnailUrl ? [story.thumbnailUrl] : []
      });
    }

    generated.push({
      variant: LayoutVariant.NEXT_READS,
      index: generated.length,
      content: 'Journal Index',
      images: [],
      textColor: 'light'
    });

    return generated;
  }, [story]);

  // Detect chapters
  const chapters = useMemo(() =>
    pages
      .map((page, index) => ({ page, index }))
      .filter(({ page }) => (page.variant as string).includes('CHAPTER'))
      .map(({ page, index }) => ({ title: page.title || `Chapter ${index + 1}`, pageIndex: index })),
    [pages]
  );

  // --- PROGRESS & PERSISTENCE ---
  useEffect(() => {
    const savedPage = localStorage.getItem(`teajia_progress_${story.id}`);
    if (savedPage) {
      const p = parseInt(savedPage, 10);
      if (!isNaN(p) && p > 0 && p < pages.length - 1) {
        setCurrentPageIndex(p);
      } else {
        setCurrentPageIndex(0);
      }
    } else {
      setCurrentPageIndex(0);
    }
  }, [story.id, pages.length]);

  useEffect(() => {
    localStorage.setItem(`teajia_progress_${story.id}`, currentPageIndex.toString());
  }, [currentPageIndex, story.id]);

  // --- MARGIN OPACITY (desktop gallery) ---
  useEffect(() => {
    setMarginOpacity(1);
    clearTimeout(marginTimerRef.current);
    marginTimerRef.current = setTimeout(() => setMarginOpacity(0.3), 2000);
    return () => clearTimeout(marginTimerRef.current);
  }, [currentPageIndex]);

  // --- CONTROLS AUTO-DISMISS ---
  useEffect(() => {
    if (showControls) {
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
      return () => clearTimeout(controlsTimerRef.current);
    }
  }, [showControls]);

  // --- HAPTIC FEEDBACK ---
  useEffect(() => {
    if (lastVibratedPage.current !== currentPageIndex) {
      lastVibratedPage.current = currentPageIndex;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  }, [currentPageIndex]);

  // --- KEYBOARD HINTS (desktop, first visit) ---
  useEffect(() => {
    if (!isDesktop) return;
    const shown = localStorage.getItem('reader_shortcuts_shown');
    if (!shown) {
      setShowKeyboardHints(true);
      keyboardHintsTimerRef.current = setTimeout(() => {
        setShowKeyboardHints(false);
        localStorage.setItem('reader_shortcuts_shown', '1');
      }, 3000);
    }
    return () => clearTimeout(keyboardHintsTimerRef.current);
  }, [isDesktop]);

  // --- NAVIGATION ---
  const goToPage = useCallback((index: number) => {
    if (index >= 0 && index < pages.length) {
      setCurrentPageIndex(index);
    }
  }, [pages.length]);

  const next = useCallback(() => {
    if (currentPageIndex < pages.length - 1) setCurrentPageIndex(currentPageIndex + 1);
  }, [currentPageIndex, pages.length]);

  const prev = useCallback(() => {
    if (currentPageIndex > 0) setCurrentPageIndex(currentPageIndex - 1);
  }, [currentPageIndex]);

  // --- SWIPE HANDLER ---
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    setSwipeOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    // Only track horizontal swipes
    if (Math.abs(dx) > Math.abs(dy)) {
      // Resist at edges
      const atStart = currentPageIndex === 0 && dx > 0;
      const atEnd = currentPageIndex >= pages.length - 1 && dx < 0;
      const resistance = (atStart || atEnd) ? 0.2 : 1;
      setSwipeOffset(dx * resistance);
    }
  }, [currentPageIndex, pages.length]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current) return;
    const threshold = 50;
    const velocity = Math.abs(swipeOffset) / (Date.now() - touchStartRef.current.time) * 1000;

    if (swipeOffset < -threshold || (swipeOffset < -20 && velocity > 300)) {
      next();
    } else if (swipeOffset > threshold || (swipeOffset > 20 && velocity > 300)) {
      prev();
    }
    setSwipeOffset(0);
    touchStartRef.current = null;
  }, [swipeOffset, next, prev]);

  // Single tap for controls (detect tap vs swipe)
  const handlePageClick = useCallback((e: React.MouseEvent) => {
    // Only toggle controls on click (not after swipe)
    setShowControls(s => !s);
  }, []);

  // --- SHARE HANDLER ---
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: story.title,
          text: `${story.title} — Page ${currentPageIndex + 1}`,
          url: window.location.href,
        });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard?.writeText(window.location.href);
    }
  }, [story.title, currentPageIndex]);

  // --- PAUSE VIDEOS ON PAGE CHANGE ---
  useEffect(() => {
    videoPlayerRegistry.forEach((player) => { player.pause(); });
  }, [currentPageIndex]);

  // --- KEYBOARD EVENTS ---
  useEffect(() => {
    if (!enableKeyboard) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Dismiss keyboard hints on any key
      if (showKeyboardHints) {
        setShowKeyboardHints(false);
        localStorage.setItem('reader_shortcuts_shown', '1');
        clearTimeout(keyboardHintsTimerRef.current);
      }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        next();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
      if (e.key === 'Escape') onBack();
      if (e.key === 'b' || e.key === 'B') onToggleSave?.();
      if (e.key === 't' || e.key === 'T') {
        if (chapters.length > 0) setShowChapterDrawer(s => !s);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex, pages.length, enableKeyboard, onBack, next, prev, showKeyboardHints, onToggleSave, chapters.length]);

  // --- IMAGE PRELOADING ---
  useEffect(() => {
    const urlsToPreload: string[] = [];
    for (let i = 1; i <= 3 && currentPageIndex + i < pages.length; i++) {
      const pageImages = pages[currentPageIndex + i]?.images || [];
      urlsToPreload.push(
        ...pageImages.filter((url): url is string => typeof url === 'string' && url.length > 0 && url !== 'undefined')
      );
    }
    if (urlsToPreload.length > 0) {
      preloadImages(urlsToPreload).catch(() => {});
    }
  }, [currentPageIndex, pages, preloadImages]);

  useEffect(() => {
    clearCache();
  }, [story.id, clearCache]);

  // --- SHAKE TO RESET ---
  useShakeDetector(useCallback(() => {
    setShowShakeConfirm(true);
  }, []));

  // --- PROGRESS SCRUBBER ---
  const updatePageFromScrubber = useCallback((clientX: number) => {
    const rect = scrubberRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newPage = Math.round(ratio * (pages.length - 1));
    setDragTooltipPage(newPage);
    goToPage(newPage);
  }, [pages.length, goToPage]);

  const handleScrubberMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updatePageFromScrubber(e.clientX);
  };
  const handleScrubberMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    updatePageFromScrubber(e.clientX);
  };
  const handleScrubberMouseUp = () => {
    setIsDragging(false);
    setDragTooltipPage(null);
  };
  const handleScrubberTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    updatePageFromScrubber(e.touches[0].clientX);
  };
  const handleScrubberTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    updatePageFromScrubber(e.touches[0].clientX);
  };
  const handleScrubberTouchEnd = () => {
    setIsDragging(false);
    setDragTooltipPage(null);
  };

  // Handle mouse-up outside scrubber
  useEffect(() => {
    if (!isDragging) return;
    const up = () => { setIsDragging(false); setDragTooltipPage(null); };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [isDragging]);

  const ProgressScrubber = ({ className = '' }: { className?: string }) => {
    const progress = pages.length > 1 ? currentPageIndex / (pages.length - 1) : 0;

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const targetPage = Math.round(ratio * (pages.length - 1));
      goToPage(targetPage);
    };

    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <span className="text-xs font-mono text-tea-text-sec/80 tabular-nums w-4 text-right">{currentPageIndex + 1}</span>
        <div
          ref={scrubberRef}
          onClick={handleClick}
          onMouseDown={handleScrubberMouseDown}
          onMouseMove={handleScrubberMouseMove}
          onMouseUp={handleScrubberMouseUp}
          onTouchStart={handleScrubberTouchStart}
          onTouchMove={handleScrubberTouchMove}
          onTouchEnd={handleScrubberTouchEnd}
          className="flex-1 h-8 flex items-center cursor-pointer group relative select-none"
          role="slider"
          aria-valuenow={currentPageIndex + 1}
          aria-valuemin={1}
          aria-valuemax={pages.length}
          aria-label="Reading progress"
        >
          <div className="w-full reader-progress-track rounded-full relative">
            <div
              className="absolute inset-y-0 left-0 reader-progress-fill rounded-full"
              style={{ width: `${progress * 100}%` }}
            />
            {/* Thumb */}
            <div
              className={`reader-scrubber-thumb ${isDragging ? 'dragging' : ''}`}
              style={{ left: `${progress * 100}%` }}
            >
              {/* Drag tooltip */}
              {isDragging && dragTooltipPage !== null && (
                <div className="reader-scrubber-tooltip">
                  {dragTooltipPage + 1}
                </div>
              )}
            </div>
          </div>
        </div>
        <span className="num text-[11px] text-tea-text-sec/80 w-4">{pages.length}</span>
      </div>
    );
  };

  // --- NAV OVERLAY ---
  const NavOverlay = () => (
    <div
      className="fixed inset-0 z-modal bg-tea-text/60 backdrop-blur-sm flex justify-end animate-[fadeIn_0.2s_ease-out]"
      onClick={() => setShowNav(false)}
    >
      <div className="w-full max-w-sm bg-tea-bg h-full shadow-2xl p-8 overflow-y-auto border-l border-tea-border animate-[slideLeft_0.3s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-10 border-b border-tea-border pb-4">
          <span className="text-tea-text font-serif italic text-xl">Journal Index</span>
          <button onClick={() => setShowNav(false)} className="p-3 hover:bg-tea-surface/20 rounded-full transition-colors">
            <Icons.Close className="w-5 h-5 text-tea-text/60" />
          </button>
        </div>
        <div className="space-y-8">
          {recommendations.map(s => (
            <div key={s.id} onClick={() => { onNavigate(s); setShowNav(false); }} className="group cursor-pointer flex gap-5">
              <div className="w-16 h-20 bg-tea-surface shrink-0 relative overflow-hidden">
                <img src={s.thumbnailUrl} className="w-full h-full object-cover sepia-[0.3] group-hover:sepia-0 transition-all duration-500" alt="thumb" loading="lazy" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] uppercase tracking-[0.15em] text-tea-text-dim mb-1 block">{s.type}</span>
                  {watchedStories?.[s.id] && <Icons.Check className="w-3 h-3 text-tea-green opacity-70" />}
                </div>
                <h4 className="text-tea-text font-serif text-lg leading-tight group-hover:text-tea-gold transition-colors mb-1">{s.title}</h4>
                <p className="text-tea-text-sec text-xs uppercase tracking-wider">{s.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // --- CHAPTER DRAWER ---
  const ChapterDrawer = () => (
    <AnimatePresence>
      {showChapterDrawer && (
        <>
          <motion.div
            key="chapter-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-priority bg-tea-text/40 backdrop-blur-sm"
            onClick={() => setShowChapterDrawer(false)}
          />
          <motion.div
            key="chapter-drawer"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-priority bg-tea-elevated border-t border-tea-border rounded-t-2xl p-6 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] max-h-[60vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-tea-border rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-tea-text font-serif text-lg">Chapters</span>
              <button onClick={() => setShowChapterDrawer(false)} className="p-3 rounded-full hover:bg-tea-surface/40 transition-colors">
                <Icons.Close className="w-4 h-4 text-tea-text-dim" />
              </button>
            </div>
            <div className="space-y-1">
              {chapters.map((ch, i) => (
                <button
                  key={i}
                  onClick={() => { goToPage(ch.pageIndex); setShowChapterDrawer(false); }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-tea-accent-sub transition-colors"
                >
                  <span className="text-tea-text-dim text-[10px] uppercase tracking-[0.15em] mr-3">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-tea-text text-sm">{ch.title}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // --- KEYBOARD HINTS OVERLAY ---
  const KeyboardHintsOverlay = () => (
    <AnimatePresence>
      {showKeyboardHints && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="reader-keyboard-hint"
          style={{ zIndex: 200 }}
        >
          <div className="reader-keyboard-hint-card">
            <div className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-4">Keyboard Shortcuts</div>
            {[
              { key: '→ / Space', label: 'Next page' },
              { key: '←', label: 'Previous page' },
              { key: 'Esc', label: 'Close reader' },
              { key: 'B', label: 'Bookmark' },
              { key: 'T', label: 'Chapters / Sidebar' },
            ].map(({ key, label }) => (
              <div key={key} className="reader-keyboard-hint-row">
                <span className="reader-keyboard-hint-key">{key}</span>
                <span className="text-tea-text-sec text-xs">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // --- SHAKE CONFIRM TOAST ---
  const ShakeConfirmToast = () => (
    <AnimatePresence>
      {showShakeConfirm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-48 left-1/2 -translate-x-1/2 z-priority bg-tea-elevated border border-tea-border rounded-xl shadow-xl px-5 py-4 flex items-center gap-4"
        >
          <span className="text-tea-text text-sm">Return to start?</span>
          <button
            onClick={() => { goToPage(0); setShowShakeConfirm(false); }}
            className="text-tea-gold text-sm font-medium hover:text-tea-gold-lt transition-colors"
          >
            Yes
          </button>
          <button
            onClick={() => setShowShakeConfirm(false)}
            className="text-tea-text-dim text-sm hover:text-tea-text transition-colors"
          >
            Cancel
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // --- CONTROLS OVERLAY (center-tap) ---
  const ControlsOverlay = () => (
    <AnimatePresence>
      {showControls && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-tea-elevated/90 backdrop-blur-sm rounded-full px-5 py-3 shadow-lg"
          style={{ bottom: 'calc(44px + env(safe-area-inset-bottom, 0px) + 48px)' }}
        >
          <button
            onClick={handleShare}
            className="p-2 rounded-full hover:bg-tea-surface/40 transition-colors"
            aria-label="Share"
          >
            <Icons.Share className="w-5 h-5 text-tea-text-dim" />
          </button>
          <button
            onClick={onToggleSave}
            className={`p-2 rounded-full hover:bg-tea-surface/40 transition-colors ${isSaved ? 'text-tea-gold' : ''}`}
            aria-label="Bookmark"
          >
            <Icons.Bookmark className="w-5 h-5 text-tea-text-dim" />
          </button>
          {chapters.length > 0 && (
            <button
              onClick={() => { setShowChapterDrawer(true); setShowControls(false); }}
              className="p-2 rounded-full hover:bg-tea-surface/40 transition-colors"
              aria-label="Chapters"
            >
              <Icons.List className="w-5 h-5 text-tea-text-dim" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // --- MAIN RENDER ---
  return (
    <div
      className={`fixed inset-0 bg-tea-bg flex flex-col overflow-hidden ${customZIndex || 'z-modal'}`}
      style={{
        height: '100dvh',
        ...(timeFilter ? { filter: timeFilter } : {}),
      }}
    >
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")` }} />

      {/* Reading Progress Bar */}
      <ReaderProgressBar currentPage={currentPageIndex} totalPages={pages.length} />

      {/* Navigation Drawer */}
      {showNav && <NavOverlay />}

      {/* Chapter Drawer */}
      <ChapterDrawer />

      {/* Shake confirm */}
      <ShakeConfirmToast />

      {/* Keyboard hints (desktop only, first visit) */}
      {isDesktop && <KeyboardHintsOverlay />}

      {/* --- TOP BAR --- */}
      <div className="absolute top-0 left-0 w-full h-16 z-50 flex items-center justify-between px-6 md:px-10 text-tea-text/70 pointer-events-none bg-gradient-to-b from-tea-bg/40 to-transparent">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] hover:text-tea-text pointer-events-auto transition-colors p-3 -ml-3 rounded-full"
        >
          <Icons.Close className="w-5 h-5" />
          <span className="hidden md:inline">Close</span>
        </button>

        <div className="flex items-center gap-4 pointer-events-auto">
          {/* Nav overlay (recommendations) */}
          <button
            onClick={() => setShowNav(true)}
            className="p-3 hover:text-tea-text transition-colors rounded-full"
          >
            <Icons.List className="w-5 h-5" />
          </button>
          <button
            onClick={onToggleSave}
            className={`p-3 hover:text-tea-text transition-colors rounded-full ${isSaved ? 'text-tea-gold' : ''}`}
          >
            <Icons.Leaf filled={isSaved} className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="relative flex-1 flex flex-col overflow-hidden w-full h-full">

        {/* --- GALLERY FRAME (desktop) / SINGLE PAGE (mobile) --- */}
        <div
          className="relative w-full h-full flex items-center justify-center"
          style={{ paddingTop: '64px', paddingBottom: '96px' }}
        >
          {/* Gallery margins — left (desktop only) */}
          <div
            className="hidden lg:flex flex-col justify-between h-full py-20 px-8 pointer-events-none shrink-0"
            style={{ opacity: marginOpacity, transition: 'opacity 0.6s ease' }}
          >
            <span className="text-[11px] uppercase tracking-[0.2em] text-tea-text-dim" style={{ fontFamily: 'var(--font-sans)' }}>
              {story.title}
            </span>
          </div>

          {/* Page container */}
          <div className="relative flex-1 lg:flex-none h-full lg:h-auto" style={{ maxHeight: isDesktop ? 'calc(100vh - 160px)' : undefined, aspectRatio: isDesktop ? '4/5' : undefined }}>
            {/* Swipe zone overlay */}
            <div
              className="absolute inset-0 z-40 cursor-pointer"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={handlePageClick}
            />

            {/* Controls overlay (center-tap) */}
            <ControlsOverlay />

            {/* Push-with-depth page transition */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPageIndex}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, scale: 1, x: swipeOffset }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={swipeOffset !== 0
                  ? { duration: 0, x: { duration: 0 } }
                  : { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
                }
                className="w-full h-full"
              >
                {pages[currentPageIndex] && (
                  <ScaledPage isActive pageWeight={pages[currentPageIndex].pageWeight}>
                    <SinglePageRenderer
                      page={pages[currentPageIndex]}
                      storyTitle={story.title}
                      storySubtitle={story.subtitle}
                      onNavigate={onNavigate}
                      recommendations={recommendations}
                    />
                  </ScaledPage>
                )}
              </motion.div>
            </AnimatePresence>

          </div>

          {/* Gallery margins — right (desktop only) */}
          <div
            className="hidden lg:flex flex-col justify-end h-full py-20 px-8 pointer-events-none shrink-0"
            style={{ opacity: marginOpacity, transition: 'opacity 0.6s ease' }}
          >
            <span className="font-mono text-[11px] text-tea-text-dim tabular-nums">
              {currentPageIndex + 1} / {pages.length}
            </span>
          </div>

          {/* Desktop nav arrows — in margins */}
          {isDesktop && (
            <>
              <button
                onClick={prev}
                disabled={currentPageIndex === 0}
                className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-32 items-center justify-center transition-all disabled:opacity-0 rounded-lg"
                aria-label="Previous page"
              >
                <Icons.Back className="w-6 h-6 text-tea-text-dim/30 hover:text-tea-text-dim/60 transition-colors" />
              </button>
              <button
                onClick={next}
                disabled={currentPageIndex >= pages.length - 1}
                className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-32 items-center justify-center transition-all disabled:opacity-0 rounded-lg"
                aria-label="Next page"
              >
                <Icons.Next className="w-6 h-6 text-tea-text-dim/30 hover:text-tea-text-dim/60 transition-colors" />
              </button>
            </>
          )}
        </div>

        {/* --- BOTTOM BAR --- */}
        <div
          className="absolute left-0 w-full z-50 pointer-events-none"
          style={{ bottom: 0, paddingBottom: 'calc(44px + env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          {/* Mobile: Share icon + Scrubber */}
          <div className="lg:hidden flex items-center px-6 pb-4 gap-3 pointer-events-auto">
            <button
              onClick={handleShare}
              className="p-2 text-tea-text-dim hover:text-tea-text transition-colors shrink-0 rounded-full"
              aria-label="Share"
            >
              <Icons.ExternalLink className="w-4 h-4" />
            </button>
            <ProgressScrubber className="flex-1" />
          </div>

          {/* Desktop: Scrubber only */}
          <div className="hidden lg:flex pb-6 pointer-events-auto justify-center">
            <ProgressScrubber className="w-64" />
          </div>
        </div>
      </div>
    </div>
  );
};
