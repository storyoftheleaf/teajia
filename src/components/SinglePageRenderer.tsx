
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { LayoutVariant, Story } from '../types';
import { Icons } from './Icons';
import { SkeletonLoader } from './shared/SkeletonLoader';
import { sanitizeHTML } from '../utils/sanitize';
import { useTheme } from '../context/ThemeContext';

export interface PageData {
  variant: LayoutVariant;
  content?: string;
  title?: string;
  images?: string[];
  index: number;
  textColor?: 'light' | 'dark';
  chineseName?: string;       // Optional CJK name for accent strips in chapter layouts
  // Video support
  videoId?: string;           // YouTube video ID
  instagramId?: string;       // Instagram Reel shortcode
  videoCaption?: string;
  // Visual rhythm metadata
  pageWeight?: 'text-heavy' | 'image-heavy' | 'spacious' | 'mixed';
}

interface SinglePageRendererProps {
  page: PageData;
  storyTitle?: string;
  storySubtitle?: string;
  onNavigate?: (story: Story) => void;
  recommendations?: Story[];
  isEditable?: boolean;
  readOnly?: boolean;
  onPageUpdate?: (updates: { content?: string; images?: string[]; textColor?: 'light' | 'dark' }) => void;
  onStoryUpdate?: (field: string, value: string) => void;
}

// ────────────────────────────────────────────────────────────
// TYPOGRAPHY SYSTEM
// Canvas: 800×1067 (~47% scale on 375px phones)
// Three voices: Cormorant Garamond (display), Lora (body), Plus Jakarta Sans (captions/UI)
// Scale ratio ≈ 1:2:4 — body 21px, headline 40px, display 84px
// ────────────────────────────────────────────────────────────
const TYPE = {
  displayFont: '"Cormorant Garamond", "Georgia", serif',
  bodyFont: '"Lora", "Palatino Linotype", serif',
  sansFont: '"Plus Jakarta Sans", system-ui, sans-serif',
  // Display — Cormorant Garamond, high contrast, light weight at large sizes
  display: 'text-[84px] font-display leading-[0.92] tracking-[-0.02em] font-light',
  displaySm: 'text-[64px] font-display leading-[0.95] tracking-[-0.01em] font-light',
  // Headlines — Cormorant Garamond, medium weight
  headline: 'text-[40px] font-display leading-[1.15] font-normal',
  subtitle: 'text-[30px] font-display leading-[1.25] font-light italic',
  headlineSm: 'text-[28px] font-display leading-[1.3] font-normal',
  // Body — Lora, optimized for reading
  subhead: 'text-[22px] font-body leading-[1.4]',
  bodyLarge: 'text-[23px] font-body leading-[1.6]',
  body: 'text-[21px] font-body leading-[1.6]',
  bodySm: 'text-[19px] font-body leading-[1.55]',
  bodyDense: 'text-[20px] font-body leading-[32px]',  // Multi-column, locked leading
  // Captions — Plus Jakarta Sans, small-caps, letterspaced
  caption: 'text-[13px] font-caption leading-[1.4] tracking-[0.14em]',
  folio: 'text-[11px] font-caption leading-[1.3] tracking-[0.2em]',
  micro: 'text-[10px] font-caption leading-[1.2]',
} as const;

// --- Line Height Semantic Constants ---
const LH = {
  tight: 'leading-[1.2]',     // captions, headers
  normal: 'leading-[1.45]',   // short body, quotes
  relaxed: 'leading-[1.6]',   // long-form body
  loose: 'leading-[2.0]',     // poetry, verse
} as const;

// --- Padding Variants (8px grid) ---
const PAD = {
  text: 'px-[56px] py-[48px]',          // Text pages — wide margins, narrow measure
  textWide: 'px-[80px] py-[48px]',      // Centered narrow-measure text
  image: 'p-0',                          // Full-bleed images
  spacious: 'px-[64px] py-[56px]',      // Covers, quotes, chapters
  card: 'px-[48px] py-[40px]',          // Card-style pages
  tight: 'px-[32px] py-[24px]',         // Dense/compact pages
  gutter: 'px-[40px]',                  // Minimal horizontal padding
} as const;

// --- Shared Typography Classes ---
const BODY_CLASS = `${TYPE.body} ${LH.relaxed} text-left font-body [font-optical-sizing:auto] [hanging-punctuation:first_last]`;
const BODY_DENSE_CLASS = `${TYPE.bodyDense} text-justify font-body [font-optical-sizing:auto] [hyphens:auto] [hyphenate-limit-chars:6_3_2] [word-spacing:-0.01em]`;
const CAPTION_CLASS = `${TYPE.caption} ${LH.tight} uppercase font-caption small-caps`;
const FOLIO_CLASS = `${TYPE.folio} uppercase font-caption tracking-[0.2em]`;
const OPENTYPE = { fontFeatureSettings: "'liga' 1, 'kern' 1, 'calt' 1, 'onum' 1", fontOpticalSizing: 'auto' as const } as const;

// --- Animation Styles & Rich Text Helpers ---
const ANIMATION_STYLES = `
  @keyframes slideUpFade {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes readerImageReveal {
    from { opacity: 0; transform: scale(1.03); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes chapterNumReveal {
    from { opacity: 0; }
    to { opacity: 0.07; }
  }
  .rich-text-content:empty:before {
    content: attr(placeholder);
    opacity: 0.4;
    pointer-events: none;
    display: block;
  }
  /* Hanging punctuation for quotes */
  .hang-punct { text-indent: -0.4em; }
  /* Column rules — subtle 1px */
  .col-rule { column-rule: 1px solid rgba(128,128,128,0.18); }
  /* Highlight effect */
  .text-highlight mark { background: linear-gradient(to bottom, transparent 55%, var(--tea-gold-lt, rgba(184,146,78,0.15)) 55%); padding: 0 2px; }
  /* Reader image reveal animation */
  .reader-image-reveal { animation: readerImageReveal 0.8s ease-out forwards; }
  /* Chapter number background fade-in */
  .chapter-num-reveal { animation: chapterNumReveal 1.2s ease-out forwards; opacity: 0; }
`;

// --- Bottom Page Treatment Helper ---
const getBottomTreatment = (variant: LayoutVariant, fadeBg: string): string => {
  const chapterVariants: LayoutVariant[] = [
    LayoutVariant.CHAPTER_BOLD, LayoutVariant.CHAPTER_MINIMAL,
    LayoutVariant.CHAPTER_CENTERED_SMALL, LayoutVariant.CHAPTER_SPLIT,
    LayoutVariant.CHAPTER_IMAGE_BG, LayoutVariant.CHAPTER_LARGE_NUMBER,
  ];
  const imageVariants: LayoutVariant[] = [
    LayoutVariant.IMG_FULL_BLEED, LayoutVariant.IMG_FULL_BLEED_TITLE,
    LayoutVariant.IMG_OVERLAY_TEXT, LayoutVariant.IMG_DUOTONE,
    LayoutVariant.IMG_VIGNETTE_SOFT, LayoutVariant.QUOTE_IMAGE_BG,
    LayoutVariant.CHAPTER_IMAGE_BG, LayoutVariant.SPREAD_PANORAMIC,
    LayoutVariant.FULL_BLEED_TEXT,
  ];
  const quoteVariants: LayoutVariant[] = [
    LayoutVariant.QUOTE_BIG, LayoutVariant.QUOTE_MINIMAL,
    LayoutVariant.POEM_CENTERED, LayoutVariant.POEM_HAIKU_MINIMAL,
    LayoutVariant.POEM_LEFT_ALIGN, LayoutVariant.DEDICATION_SIMPLE,
  ];
  if (chapterVariants.includes(variant) || imageVariants.includes(variant)) return '';
  if (quoteVariants.includes(variant)) return `absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t ${fadeBg} to-transparent pointer-events-none z-10`;
  return `absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t ${fadeBg} to-transparent pointer-events-none z-10`;
};

// --- Visual Weight Categories for Rhythm Analysis ---
export const LAYOUT_WEIGHTS: Record<string, 'text-heavy' | 'image-heavy' | 'spacious' | 'mixed'> = {
  [LayoutVariant.TEXT_SINGLE_COL]: 'text-heavy',
  [LayoutVariant.TEXT_DOUBLE_COL]: 'text-heavy',
  [LayoutVariant.TEXT_TRIPLE_COL]: 'text-heavy',
  [LayoutVariant.TEXT_DROP_CAP]: 'text-heavy',
  [LayoutVariant.TEXT_JUSTIFIED_NARROW]: 'text-heavy',
  [LayoutVariant.TEXT_VERTICAL_CJK]: 'text-heavy',
  [LayoutVariant.TEXT_BLOCKQUOTE_CENTER]: 'mixed',
  [LayoutVariant.TEXT_BLOCKQUOTE_LEFT]: 'mixed',
  [LayoutVariant.TEXT_SIDEBAR_RIGHT]: 'mixed',
  [LayoutVariant.TEXT_SIDEBAR_LEFT]: 'mixed',
  [LayoutVariant.TEXT_ASYMMETRIC_LEFT]: 'mixed',
  [LayoutVariant.TEXT_ASYMMETRIC_RIGHT]: 'mixed',
  [LayoutVariant.TEXT_INVERTED]: 'text-heavy',
  [LayoutVariant.TEXT_TYPEWRITER]: 'text-heavy',
  [LayoutVariant.TEXT_HIGHLIGHTED]: 'text-heavy',
  [LayoutVariant.TEXT_CENTER_NARROW]: 'spacious',
  [LayoutVariant.TEXT_SIDEBAR_IMAGE]: 'mixed',
  [LayoutVariant.TEXT_OVERLAPPING_IMAGES]: 'mixed',
  [LayoutVariant.MAGAZINE_INTERVIEW_Q_A]: 'text-heavy',
  [LayoutVariant.IMG_FULL_BLEED]: 'image-heavy',
  [LayoutVariant.IMG_FULL_BLEED_TITLE]: 'image-heavy',
  [LayoutVariant.IMG_SPLIT_HORIZONTAL]: 'mixed',
  [LayoutVariant.IMG_SPLIT_VERTICAL]: 'mixed',
  [LayoutVariant.IMG_DIAGONAL_SPLIT]: 'image-heavy',
  [LayoutVariant.IMG_GRID_2x2]: 'image-heavy',
  [LayoutVariant.IMG_GRID_3x3]: 'image-heavy',
  [LayoutVariant.IMG_GRID_MONDRIAN]: 'image-heavy',
  [LayoutVariant.IMG_QUAD_GRID]: 'image-heavy',
  [LayoutVariant.IMG_CIRCLE_MASK]: 'spacious',
  [LayoutVariant.IMG_ARCH_MASK]: 'spacious',
  [LayoutVariant.IMG_OVAL_VIGNETTE]: 'spacious',
  [LayoutVariant.IMG_POLAROID_SCATTER]: 'spacious',
  [LayoutVariant.IMG_FILM_STRIP_VERTICAL]: 'image-heavy',
  [LayoutVariant.IMG_WITH_CAPTION_BOTTOM]: 'image-heavy',
  [LayoutVariant.IMG_OVERLAY_TEXT]: 'image-heavy',
  [LayoutVariant.IMG_GALLERY_MOSAIC]: 'image-heavy',
  [LayoutVariant.IMG_DUOTONE]: 'image-heavy',
  [LayoutVariant.IMG_VIGNETTE_SOFT]: 'image-heavy',
  [LayoutVariant.IMG_PANORAMIC]: 'spacious',
  [LayoutVariant.COVER_MAIN]: 'image-heavy',
  [LayoutVariant.COVER_MINIMAL]: 'spacious',
  [LayoutVariant.COVER_TYPOGRAPHIC]: 'text-heavy',
  [LayoutVariant.COVER_PHOTO_INSET]: 'mixed',
  [LayoutVariant.COVER_SPLIT]: 'mixed',
  [LayoutVariant.COVER_MASTHEAD]: 'mixed',
  [LayoutVariant.COVER_ABSTRACT]: 'spacious',
  [LayoutVariant.CHAPTER_BOLD]: 'spacious',
  [LayoutVariant.CHAPTER_MINIMAL]: 'spacious',
  [LayoutVariant.CHAPTER_CENTERED_SMALL]: 'spacious',
  [LayoutVariant.CHAPTER_SPLIT]: 'mixed',
  [LayoutVariant.CHAPTER_IMAGE_BG]: 'image-heavy',
  [LayoutVariant.CHAPTER_LARGE_NUMBER]: 'spacious',
  [LayoutVariant.QUOTE_BIG]: 'spacious',
  [LayoutVariant.QUOTE_MINIMAL]: 'spacious',
  [LayoutVariant.QUOTE_IMAGE_BG]: 'image-heavy',
  [LayoutVariant.POEM_CENTERED]: 'spacious',
  [LayoutVariant.POEM_LEFT_ALIGN]: 'spacious',
  [LayoutVariant.POEM_SCATTERED]: 'spacious',
  [LayoutVariant.POEM_VISUAL]: 'spacious',
  [LayoutVariant.POEM_HAIKU_MINIMAL]: 'spacious',
  [LayoutVariant.INTERVIEW_STANDARD]: 'text-heavy',
  [LayoutVariant.DEFINITION_LARGE]: 'text-heavy',
  [LayoutVariant.STAT_BIG_NUMBER]: 'spacious',
  [LayoutVariant.STAT_CHART_MINIMAL]: 'mixed',
  [LayoutVariant.DATA_BAR_CHART]: 'mixed',
  [LayoutVariant.LIST_CHECKLIST]: 'text-heavy',
  [LayoutVariant.LIST_TIMELINE]: 'text-heavy',
  [LayoutVariant.RECIPE_CARD]: 'text-heavy',
  [LayoutVariant.INDEX_GRID]: 'text-heavy',
  [LayoutVariant.TASTING_NOTES_GRID]: 'spacious',
  [LayoutVariant.MAP_CARTOGRAPHY]: 'mixed',
  [LayoutVariant.NOTE_PAPER]: 'text-heavy',
  [LayoutVariant.POSTCARD_STYLE]: 'mixed',
  [LayoutVariant.BOTANICAL_SKETCH]: 'mixed',
  [LayoutVariant.EPILOGUE_CENTERED]: 'spacious',
  [LayoutVariant.CREDITS_PAGE]: 'spacious',
  [LayoutVariant.BACK_COVER]: 'spacious',
  [LayoutVariant.NEXT_READS]: 'text-heavy',
  [LayoutVariant.CURATED_LINKS]: 'text-heavy',
  [LayoutVariant.TEXT_WITH_VIDEO]: 'mixed',
  [LayoutVariant.TEXT_WITH_VIDEO_VERTICAL]: 'mixed',
  [LayoutVariant.SPREAD_PANORAMIC]: 'image-heavy',
  [LayoutVariant.PULL_QUOTE_MARGINAL]: 'mixed',
  [LayoutVariant.LETTERPRESS_DEBOSS]: 'spacious',
  [LayoutVariant.ANNOTATED_IMAGE]: 'image-heavy',
  [LayoutVariant.CONVERSATION_BUBBLE]: 'text-heavy',
  [LayoutVariant.TIMELINE_VISUAL]: 'mixed',
  [LayoutVariant.COMPARISON_SPLIT]: 'image-heavy',
  [LayoutVariant.STACKED_CARDS]: 'mixed',
  [LayoutVariant.FULL_BLEED_TEXT]: 'image-heavy',
  [LayoutVariant.INFOGRAPHIC_CIRCLE]: 'mixed',
  [LayoutVariant.COPYRIGHT_PAGE]: 'spacious',
  [LayoutVariant.DEDICATION_SIMPLE]: 'spacious',
  [LayoutVariant.TOC_MINIMAL]: 'text-heavy',
  [LayoutVariant.TOC_IMAGE]: 'mixed',
  [LayoutVariant.CHAPTER_MARKER]: 'spacious',
};

const wrapSelection = (className: string, tagName: string = 'span') => {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  if (!selectedText) return;
  const wrapper = document.createElement(tagName);
  wrapper.className = className;
  wrapper.textContent = selectedText;
  range.deleteContents();
  range.insertNode(wrapper);
  selection.removeAllRanges();
};

const FormatToolbar = ({ position, onFormat }: { position: { top: number; left: number } | null; onFormat: (type: string, val?: string) => void; }) => {
  if (!position) return null;
  const safeTop = Math.max(10, position.top - 60);
  const safeLeft = Math.max(10, Math.min(window.innerWidth - 200, position.left));

  return createPortal(
    <div 
      className="fixed z-sticky flex items-center bg-tea-bg border border-tea-gold/15 rounded-sm shadow-2xl p-2 gap-2 animate-[scaleIn_0.1s_ease-out]"
      style={{ top: safeTop, left: safeLeft }}
      onMouseDown={(e) => e.preventDefault()}
    >
        <div className="flex gap-1 border-r border-tea-border pr-2 mr-1">
            <button onClick={() => onFormat('font', 'font-body')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-text/70 hover:text-tea-text" title="Serif"><span className="font-body text-sm">S</span></button>
            <button onClick={() => onFormat('font', 'font-sans')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-text/70 hover:text-tea-text" title="Sans"><span className="font-sans text-sm">S</span></button>
            <button onClick={() => onFormat('font', 'font-mono')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-text/70 hover:text-tea-text" title="Mono"><span className="font-mono text-sm">M</span></button>
        </div>
        <div className="flex gap-1 border-r border-tea-border pr-2 mr-1">
            <button onClick={() => onFormat('weight', 'font-bold')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-text/70 hover:text-tea-text font-bold text-sm">B</button>
            <button onClick={() => onFormat('style', 'italic')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-text/70 hover:text-tea-text italic font-body text-sm">I</button>
        </div>
        <div className="flex gap-1">
             <button onClick={() => onFormat('size', 'text-2xl')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-text/70 hover:text-tea-text text-xs">S</button>
             <button onClick={() => onFormat('size', 'text-4xl')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-text/70 hover:text-tea-text text-sm">M</button>
             <button onClick={() => onFormat('size', 'text-6xl')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-text/70 hover:text-tea-text text-base">L</button>
        </div>
    </div>,
    document.body
  );
};

const EditableText = ({ value, onChange, className = "", placeholder = "Type here...", tag = "p", readOnly = false, delay = 0 }: { value: string; onChange?: (val: string) => void; className?: string; placeholder?: string; tag?: any; readOnly?: boolean; delay?: number; }) => {
  const contentRef = useRef<HTMLElement>(null);
  const [toolbarPos, setToolbarPos] = useState<{top: number, left: number} | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const sharedClasses = `rich-text-content w-full bg-transparent outline-none block break-words whitespace-pre-wrap leading-normal p-0 border-none font-inherit text-inherit m-0`;
  
  const isEditing = !!onChange;
  const animClass = isEditing ? "" : "animate-[slideUpFade_0.6s_ease-out_forwards] opacity-0";
  const style = isEditing ? {} : { animationDelay: `${delay * 100}ms` };

  const handleInput = () => { 
      if (contentRef.current && onChange) {
          onChange(contentRef.current.innerHTML);
      }
  };
  
  const handleSelect = () => {
    if (readOnly) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) { setToolbarPos(null); return; }
    if (contentRef.current?.contains(selection.anchorNode)) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        setToolbarPos({ top: rect.top, left: rect.left + (rect.width / 2) - 100 });
    } else { setToolbarPos(null); }
  };

  const handleFormat = (type: string, val?: string) => {
      if (!val) return;
      wrapSelection(val);
      if (contentRef.current && onChange) onChange(contentRef.current.innerHTML);
  };

  const Tag = tag;
  const shouldSync = readOnly || !isFocused;
  const htmlProp = shouldSync ? { __html: sanitizeHTML(value || placeholder) } : undefined;

  if (readOnly || !onChange) {
      if (!value && readOnly && !placeholder) return null;
      return <Tag className={`${sharedClasses} ${className} ${animClass}`} style={style} dangerouslySetInnerHTML={{ __html: sanitizeHTML(value || placeholder) }} />;
  }

  return (
    <>
        <Tag 
            ref={contentRef} 
            contentEditable 
            suppressContentEditableWarning
            onInput={handleInput} 
            onMouseUp={handleSelect} 
            onKeyUp={handleSelect} 
            onFocus={() => setIsFocused(true)}
            onBlur={() => { setIsFocused(false); setToolbarPos(null); }}
            className={`${sharedClasses} ${className} ${animClass}`} 
            style={style} 
            placeholder={placeholder} 
            dangerouslySetInnerHTML={htmlProp}
            onClick={(e: React.MouseEvent) => e.stopPropagation()} 
        />
        <FormatToolbar position={toolbarPos} onFormat={handleFormat} />
    </>
  );
};

const EditableImage = ({ src, index, onImageUpdate, className = "", readOnly = false }: { src?: string; index: number; onImageUpdate?: (idx: number, url: string) => void; className?: string; readOnly?: boolean; }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageLoading, setImageLoading] = useState(!!src);
  const { theme } = useTheme();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpdate) {
      const reader = new FileReader();
      reader.onloadend = () => onImageUpdate(index, reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Theme-aware filter class — defined in card-utilities.css
  const filterClass = theme === 'dark' ? 'img-filter-dark' : 'img-filter-light';

  return (
    <div className={`relative group overflow-hidden ${onImageUpdate && !readOnly ? 'cursor-pointer' : ''} ${className}`} onClick={(e) => { e.stopPropagation(); if (!readOnly && onImageUpdate) fileInputRef.current?.click(); }}>
      {/* Skeleton loader while image is loading */}
      {imageLoading && src && (
        <SkeletonLoader className="absolute inset-0 z-20" />
      )}

      {/* Main image with fade-in transition */}
      {src ? (
        <img
          src={src}
          className={`w-full h-full object-cover transition-opacity duration-300 ${filterClass}`}
          style={{ opacity: imageLoading ? 0.5 : 1 }}
          alt={`img-${index}`}
          onLoad={() => setImageLoading(false)}
          onError={() => setImageLoading(false)}
        />
      ) : (
        <div className={`w-full h-full bg-tea-text/5 flex items-center justify-center ${readOnly ? 'opacity-50' : ''}`}>
          <Icons.Camera className="w-12 h-12 opacity-20" />
        </div>
      )}

      {/* Edit overlay for editable mode */}
      {onImageUpdate && !readOnly && (
        <div className="absolute inset-0 bg-tea-text/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30">
          <Icons.Camera className="w-10 h-10 text-tea-text" />
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

// --- Video Embed Component ---
// Supports YouTube (videoId) and Instagram Reels (instagramId)
interface VideoEmbedProps {
  videoId?: string;        // YouTube video ID
  instagramId?: string;    // Instagram Reel shortcode
  isVertical?: boolean;
  className?: string;
  onPlay?: () => void;
}

// Global registry of video players for pause-on-swipe
export const videoPlayerRegistry: Map<string, { pause: () => void }> = new Map();

const VideoEmbed: React.FC<VideoEmbedProps> = ({ videoId, instagramId, isVertical = false, className = "", onPlay }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerIdRef = useRef(`video-${videoId || instagramId}-${Date.now()}`);

  const isInstagram = !!instagramId;
  const isYouTube = !!videoId;

  // Thumbnail URLs
  const youtubeThumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
  const youtubeFallback = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
  // Instagram doesn't provide easy thumbnail access, use a placeholder approach
  const thumbnailUrl = isYouTube ? youtubeThumbnail : '';
  const fallbackThumbnail = isYouTube ? youtubeFallback : '';

  // Register player for external pause control (YouTube only - Instagram doesn't support postMessage control)
  React.useEffect(() => {
    if (isPlaying && iframeRef.current && isYouTube) {
      videoPlayerRegistry.set(playerIdRef.current, {
        pause: () => {
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
              '*'
            );
          }
        }
      });
    }
    return () => {
      videoPlayerRegistry.delete(playerIdRef.current);
    };
  }, [isPlaying, isYouTube]);

  const handlePlay = () => {
    setIsPlaying(true);
    onPlay?.();
  };

  // Build embed URLs
  const origin = typeof window !== 'undefined' && window.location.origin !== 'null' ? window.location.origin : undefined;
  const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : '';

  // YouTube embed URL
  const youtubeEmbedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1${originParam}`
    : '';

  // Instagram Reel embed URL
  const instagramEmbedUrl = instagramId
    ? `https://www.instagram.com/reel/${instagramId}/embed/`
    : '';

  const embedUrl = isInstagram ? instagramEmbedUrl : youtubeEmbedUrl;

  return (
    <div
      className={`relative overflow-hidden bg-black ${className}`}
      style={{ aspectRatio: isVertical ? '9/16' : '16/9' }}
    >
      {isPlaying ? (
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          scrolling="no"
          title={isInstagram ? "Instagram Reel" : "YouTube video"}
        />
      ) : (
        <>
          {/* Thumbnail - YouTube only, Instagram shows play button directly */}
          {isYouTube && thumbnailUrl && (
            <img
              src={thumbnailLoaded ? thumbnailUrl : fallbackThumbnail}
              onLoad={() => setThumbnailLoaded(true)}
              onError={(e) => {
                (e.target as HTMLImageElement).src = fallbackThumbnail;
              }}
              className="absolute inset-0 w-full h-full object-cover"
              alt="Video thumbnail"
            />
          )}

          {/* Instagram placeholder background */}
          {isInstagram && (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400" />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/40" />

          {/* Custom Play Button - Tea themed */}
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center group cursor-pointer"
          >
            <div className="w-20 h-20 bg-tea-bg/90 backdrop-blur-sm rounded-full flex items-center justify-center border border-tea-gold/30 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:bg-tea-surface group-active:scale-95">
              <Icons.Play className="w-8 h-8 text-tea-text ml-1" />
            </div>
          </button>
        </>
      )}
    </div>
  );
};

export const SinglePageRenderer: React.FC<SinglePageRendererProps> = ({ page, storyTitle, storySubtitle, isEditable, readOnly = false, onPageUpdate, onStoryUpdate, recommendations, onNavigate }) => {
    if (!page) return <div className="w-full h-full bg-tea-bg"></div>;
    const { variant, content = '', images = [], textColor = 'light' } = page;
    const isDarkText = textColor === 'dark'; 
    const theme = {
      bg: isDarkText ? 'bg-tea-surface' : 'bg-tea-bg',
      fadeBg: isDarkText ? 'from-tea-surface' : 'from-tea-bg',
      text: isDarkText ? 'text-tea-bg' : 'text-tea-text',
      subtext: isDarkText ? 'text-tea-bg/60' : 'text-tea-text/60',
      border: isDarkText ? 'border-tea-bg/10' : 'border-tea-gold/10',
      softBg: isDarkText ? 'bg-tea-bg/5' : 'bg-tea-gold/5',
      seal: 'text-tea-gold',
    };
    const updateContent = (newContent: string) => { if (onPageUpdate && !readOnly) onPageUpdate({ content: newContent }); };
    const updateImage = (idx: number, url: string) => { if (onPageUpdate && !readOnly) { const newImages = [...(images || [])]; newImages[idx] = url; onPageUpdate({ images: newImages }); } };
    const toggleColor = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (onPageUpdate && !readOnly) { onPageUpdate({ textColor: isDarkText ? 'light' : 'dark' }); } };
    
    // Safety helper
    const img = (i: number) => (images && images[i]) || '';
    const SafeImage = ({ index, className }: { index: number, className: string }) => (
        <EditableImage src={img(index)} index={index} onImageUpdate={isEditable ? updateImage : undefined} className={className} readOnly={readOnly} />
    );
    
    // Strict overflow hidden to prevent scrollbars
    const paperBase = `w-full h-full ${theme.bg} ${theme.text} overflow-hidden relative font-body transition-colors duration-300 ${readOnly ? 'pointer-events-none' : ''}`;

    // Legacy alias — use PAD.text / PAD.spacious / PAD.image instead
    const STD_PAD = PAD.spacious; 

    return (
      <div key={page.index} className="w-full h-full relative group/page overflow-hidden">
        <style>{ANIMATION_STYLES}</style>
        {isEditable && !readOnly && (<button onClick={toggleColor} onMouseDown={(e) => e.stopPropagation()} className="absolute top-4 right-4 z-modal p-3 bg-tea-text/40 hover:bg-tea-text/60 backdrop-blur-md rounded-full text-tea-text border border-tea-gold/10 opacity-0 group-hover/page:opacity-100 transition-all"><Icons.Sun className="w-5 h-5" /></button>)}
        {/* Paper texture — hidden on full-bleed image pages */}
        {![LayoutVariant.IMG_FULL_BLEED, LayoutVariant.IMG_FULL_BLEED_TITLE, LayoutVariant.IMG_OVERLAY_TEXT, LayoutVariant.QUOTE_IMAGE_BG, LayoutVariant.IMG_VIGNETTE_SOFT, LayoutVariant.CHAPTER_IMAGE_BG].includes(variant) && (
          <div className="absolute inset-0 pointer-events-none z-[5] opacity-[0.06] mix-blend-overlay"><div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div></div>
        )}

        {(() => {
          switch (variant) {
            // --- COVERS ---
            case LayoutVariant.COVER_MAIN:
                return (
                    <div className={`${paperBase} flex flex-col ${PAD.spacious}`}>
                        <div className="absolute inset-0 z-0"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent z-10 pointer-events-none"></div>
                        {/* Masthead — top left, small caps */}
                        <div className="relative z-20">
                            <span className={`${TYPE.folio} uppercase tracking-[0.3em] text-tea-text/70`}>Teajia</span>
                        </div>
                        {/* Title block — lower third */}
                        <div className="relative z-20 mt-auto pb-8">
                            <EditableText value={storyTitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('title', val) : undefined} className={`${TYPE.display} font-display font-light tracking-[-0.02em] leading-[0.88] mb-5 text-tea-text`} placeholder="Title" tag="h1" readOnly={readOnly} />
                            <EditableText value={storySubtitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('subtitle', val) : undefined} className={`${TYPE.caption} font-caption tracking-[0.12em] text-tea-text/60`} placeholder="Subtitle" tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );
            case LayoutVariant.COVER_TYPOGRAPHIC: {
                return (
                    <div className={`${paperBase} ${isDarkText ? 'bg-tea-bg text-tea-text' : 'bg-tea-bg text-tea-text'} ${PAD.spacious} flex flex-col justify-center items-center text-center`}>
                        <div className="flex-1 flex flex-col justify-center items-center">
                            <EditableText value={storyTitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('title', val) : undefined} className={`${TYPE.display} font-display font-light leading-[0.92] uppercase tracking-[0.3em]`} placeholder="TITLE" tag="h1" readOnly={readOnly} />
                        </div>
                        <div className="pb-8">
                            <EditableText value={storySubtitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('subtitle', val) : undefined} className={`${TYPE.subtitle} font-display italic opacity-60`} placeholder="Subtitle" tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );
            }
            case LayoutVariant.COVER_MINIMAL:
                return (
                    <div className={`${paperBase} flex flex-col items-center justify-center ${PAD.spacious} text-center`}>
                        {/* Masthead — small caps at top */}
                        <span className={`${TYPE.folio} uppercase tracking-[0.35em] opacity-30 mb-16`}>Teajia Journal</span>
                        {/* Thin horizontal rule — 40% width */}
                        <div className="w-[40%] h-[0.5px] bg-current opacity-15 mb-16"></div>
                        {/* Title — display italic */}
                        <EditableText value={storyTitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('title', val) : undefined} className={`${TYPE.displaySm} font-display italic font-light mb-12 tracking-wide leading-tight`} placeholder="Title" tag="h1" readOnly={readOnly} />
                        <EditableText value={storySubtitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('subtitle', val) : undefined} className={`${TYPE.caption} uppercase tracking-[0.25em] ${theme.subtext}`} placeholder="Subtitle" tag="p" readOnly={readOnly} />
                    </div>
                );

            case LayoutVariant.COVER_PHOTO_INSET:
                return (
                    <div className={`${paperBase} bg-tea-surface flex flex-col items-center justify-center ${PAD.spacious} text-center`}>
                        <EditableText value={storyTitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('title', val) : undefined} className={`${TYPE.headline} font-display tracking-tight mb-2`} placeholder="Title" tag="h1" readOnly={readOnly} />
                        <EditableText value={storySubtitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('subtitle', val) : undefined} className={`${TYPE.caption} uppercase tracking-[0.15em] opacity-40 mb-10`} placeholder="Subtitle" tag="p" readOnly={readOnly} />
                        <div className="w-[60%] aspect-[3/4] relative overflow-hidden">
                            <SafeImage index={0} className="w-full h-full" />
                        </div>
                        <div className={`${CAPTION_CLASS} mt-10 opacity-30`}>
                            Teajia Publication
                        </div>
                    </div>
                );

            case LayoutVariant.COVER_SPLIT:
                return (
                    <div className={`${paperBase} flex overflow-hidden`}>
                        <div className="w-1/2 bg-tea-gold/5 flex flex-col justify-center px-12 relative z-10">
                            <EditableText value={storyTitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('title', val) : undefined} className={`${TYPE.displaySm} font-display font-light text-tea-text leading-[0.9] tracking-tight`} placeholder="Title" tag="h1" readOnly={readOnly} />
                            <div className="w-16 h-[0.5px] bg-tea-text/20 my-8"></div>
                            <EditableText value={storySubtitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('subtitle', val) : undefined} className={`${TYPE.caption} uppercase tracking-[0.15em] text-tea-text/50`} placeholder="Subtitle" tag="p" readOnly={readOnly} />
                        </div>
                        <div className="w-1/2 relative">
                            <SafeImage index={0} className="w-full h-full" />
                        </div>
                    </div>
                );

            case LayoutVariant.COVER_MASTHEAD:
                return (
                    <div className={`${paperBase} bg-tea-surface flex flex-col ${PAD.text}`}>
                        {/* Masthead */}
                        <div className="border-b-2 border-tea-text/80 pb-2 mb-1">
                            <div className="text-center">
                                <span className={`${TYPE.display} font-display font-light tracking-[0.15em] leading-none`}>Teajia</span>
                            </div>
                        </div>
                        <div className="border-b border-tea-text/30 pb-2 mb-4 flex justify-between">
                            <span className={`${FOLIO_CLASS}`}>Est. 2024</span>
                            <span className={`${FOLIO_CLASS}`}>Issue No. 03</span>
                            <span className={`${FOLIO_CLASS}`}>Spring Edition</span>
                        </div>
                        {/* Hero image */}
                        <div className="w-full aspect-[16/9] relative overflow-hidden mb-4">
                            <SafeImage index={0} className="w-full h-full" />
                        </div>
                        {/* Headline */}
                        <EditableText value={storyTitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('title', val) : undefined} className={`${TYPE.headline} font-display leading-tight mb-2`} placeholder="Headline" tag="h1" readOnly={readOnly} />
                        <EditableText value={storySubtitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('subtitle', val) : undefined} className={`${TYPE.bodySm} font-body opacity-55 leading-snug`} placeholder="Deck text..." tag="p" readOnly={readOnly} />
                        <div className="mt-auto pt-4 border-t border-tea-text/15 flex justify-between">
                            <span className={`${CAPTION_CLASS}`}>Staff</span>
                            <span className={`${CAPTION_CLASS}`}>Teajia Journal</span>
                        </div>
                    </div>
                );

            case LayoutVariant.COVER_ABSTRACT:
                return (
                    <div className={`${paperBase} bg-tea-bg relative overflow-hidden flex items-center justify-center`}>
                        {/* CSS-generated abstract shapes */}
                        <div className="absolute top-[-10%] left-[-5%] w-[60%] aspect-square rounded-full bg-tea-gold/8"></div>
                        <div className="absolute bottom-[-15%] right-[-10%] w-[50%] aspect-square rounded-full bg-tea-gold/5"></div>
                        <div className="absolute top-[30%] right-[15%] w-[30%] h-[1px] bg-tea-gold/20 rotate-[-25deg]"></div>
                        <div className="absolute bottom-[25%] left-[10%] w-[25%] h-[1px] bg-tea-gold/15 rotate-[15deg]"></div>
                        <div className="absolute top-[20%] left-[20%] w-4 h-4 rounded-full bg-tea-gold/15"></div>
                        {/* Title cut through composition */}
                        <div className="relative z-10 text-center px-16">
                            <EditableText value={storyTitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('title', val) : undefined} className={`${TYPE.display} font-display tracking-tight leading-[0.85] mb-8`} placeholder="Title" tag="h1" readOnly={readOnly} />
                            <div className="w-12 h-[0.5px] bg-current opacity-20 mx-auto mb-8"></div>
                            <EditableText value={storySubtitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('subtitle', val) : undefined} className={`${TYPE.caption} uppercase tracking-[0.25em] opacity-40`} placeholder="Subtitle" tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );

            // --- TEXT LAYOUTS ---
            case LayoutVariant.TEXT_SINGLE_COL:
                return (
                    <div className={`${paperBase} ${PAD.text} flex flex-col justify-start pt-16`} data-page-type="text" style={OPENTYPE}>
                        {/* Folio header */}
                        <div className={`${FOLIO_CLASS} opacity-[0.25] mb-4 flex justify-between`}>
                            <span>{storyTitle || ''}</span>
                            <span>{page.index + 1}</span>
                        </div>
                        <div className="max-w-[520px] mx-auto w-full flex-1">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Start writing..." tag="p" readOnly={readOnly} />
                        </div>
                        <div className={getBottomTreatment(variant, theme.fadeBg)}></div>
                    </div>
                );
            case LayoutVariant.TEXT_DOUBLE_COL:
                return (
                    <div className={`${paperBase} ${PAD.text} pt-16`} data-page-type="text" style={OPENTYPE}>
                        {/* Folio header */}
                        <div className={`${FOLIO_CLASS} mb-6 flex justify-between`}>
                            <span>{storyTitle || ''}</span>
                            <span>{page.index + 1}</span>
                        </div>
                        <div className="mt-6 columns-2 gap-12 h-[calc(100%-3rem)] text-justify [column-fill:auto] col-rule [hyphens:auto] [hyphenate-limit-chars:6_3_2] [word-spacing:-0.02em]">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${BODY_DENSE_CLASS} opacity-90`} placeholder="Double column text..." tag="p" readOnly={readOnly} />
                        </div>
                        <div className={getBottomTreatment(variant, theme.fadeBg)}></div>
                    </div>
                );
            case LayoutVariant.TEXT_DROP_CAP:
                return (
                    <div className={`${paperBase} ${PAD.text} flex flex-col justify-start pt-20`} data-page-type="text" style={OPENTYPE}>
                        <div className="relative max-w-[640px] mx-auto w-full">
                            <div className="drop-cap-gold">
                                <span
                                    className="float-left font-display font-bold mr-3 mt-0 text-tea-gold leading-none select-none"
                                    style={{
                                        fontSize: 'calc(21px * 3.5)',
                                        lineHeight: '0.8',
                                        marginRight: '0.12em',
                                        marginTop: '0.06em',
                                    }}
                                    aria-hidden="true"
                                >{content.charAt(0) || 'T'}</span>
                                <EditableText value={content.slice(1)} onChange={isEditable ? (v) => updateContent(content.charAt(0) + v) : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="he story begins..." tag="p" readOnly={readOnly} />
                            </div>
                        </div>
                        <div className={getBottomTreatment(variant, theme.fadeBg)}></div>
                    </div>
                );
            case LayoutVariant.TEXT_SIDEBAR_RIGHT:
                return (
                    <div className={`${paperBase} flex h-full relative overflow-hidden`} style={OPENTYPE}>
                        <div className={`w-2/3 ${PAD.text} pt-20 border-r border-tea-gold/10`}>
                             <EditableText value={content.split('|')[0] || content} onChange={isEditable ? (v) => updateContent(v + '|' + (content.split('|')[1] || '')) : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Main text..." tag="p" readOnly={readOnly} />
                        </div>
                        <div className={`w-1/3 p-8 ${theme.softBg} flex flex-col justify-center text-center`}>
                             <div className="w-10 h-[0.5px] bg-current mx-auto mb-6 opacity-20"></div>
                             <EditableText value={content.split('|')[1] || ''} onChange={isEditable ? (v) => updateContent((content.split('|')[0] || '') + '|' + v) : undefined} className={`${TYPE.bodySm} opacity-70 leading-[1.5] font-caption`} placeholder="Sidebar note..." tag="p" readOnly={readOnly} />
                        </div>
                        <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t ${theme.fadeBg} to-transparent pointer-events-none z-10`} />
                    </div>
                );
            case LayoutVariant.TEXT_VERTICAL_CJK:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-row-reverse items-start justify-center pt-20`}>
                         <div className="h-[85%]" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                             <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.body} font-body leading-[3rem] tracking-[0.25em] text-justify opacity-90`} placeholder="Vertical text..." tag="p" readOnly={readOnly} />
                         </div>
                    </div>
                );
            case LayoutVariant.TEXT_JUSTIFIED_NARROW:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex items-center justify-center`} style={OPENTYPE}>
                        <div className="max-w-[65%]">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${BODY_CLASS} leading-[1.6]`} placeholder="Narrow text..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );

            case LayoutVariant.QUOTE_BIG: {
                const quoteWords = content ? content.split(' ') : ['Quote', 'goes', 'here...'];
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex items-center justify-center text-center`} data-page-type="text">
                        <div className="w-full px-8">
                            <div className="w-16 h-[0.5px] bg-tea-gold/15 mx-auto mb-16"></div>
                            {isEditable ? (
                                <EditableText value={content} onChange={updateContent} className={`${TYPE.headline} font-display tracking-wide font-light italic ${LH.normal} hang-punct`} placeholder="Quote goes here..." tag="p" readOnly={readOnly} />
                            ) : (
                                <p className={`${TYPE.headline} font-display tracking-wide font-light italic ${LH.normal} hang-punct`}>
                                    {quoteWords.map((word, i) => (
                                        <motion.span
                                            key={i}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={
                                                i === quoteWords.length - 1
                                                    ? { delay: i * 0.07, type: 'spring', bounce: 0.4 }
                                                    : { delay: i * 0.07, duration: 0.4, ease: 'easeOut' }
                                            }
                                            className="inline-block mr-[0.2em]"
                                        >
                                            {word}
                                        </motion.span>
                                    ))}
                                </p>
                            )}
                            <div className="w-16 h-[0.5px] bg-tea-gold/15 mx-auto mt-16"></div>
                        </div>
                    </div>
                );
            }
            case LayoutVariant.CHAPTER_BOLD: {
                const [chNum, chTitle2] = content.split('|');
                const chineseName = page.chineseName;
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col justify-start pt-20 pl-16 relative`} data-page-type="text">
                        {/* Vertical CJK accent strip */}
                        <div className="vertical-cjk absolute right-3 top-0 bottom-0 flex items-center justify-center pointer-events-none select-none" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                            <span className="text-[20px] font-display tracking-[0.4em] opacity-[0.08]">{chineseName || '茶茶茶茶茶'}</span>
                        </div>
                        <div className="relative z-10">
                            {/* Chapter number — display font, light weight */}
                            <EditableText value={chNum || ''} onChange={isEditable ? (v) => updateContent(v + '|' + (chTitle2 || '')) : undefined} className={`${TYPE.displaySm} font-display font-light mb-4 leading-none`} placeholder="01" tag="h1" readOnly={readOnly} />
                            {/* Thin gold rule */}
                            <div className="w-[60px] h-[0.5px] bg-tea-gold opacity-50 mb-6"></div>
                            {/* Chapter title — letterspaced */}
                            {chTitle2 && <EditableText value={chTitle2} onChange={isEditable ? (v) => updateContent((chNum || '') + '|' + v) : undefined} className={`${TYPE.headlineSm} font-display tracking-[0.08em]`} placeholder="Title" tag="p" readOnly={readOnly} />}
                        </div>
                    </div>
                );
            }
            case LayoutVariant.POEM_CENTERED:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex items-center justify-center`} data-page-type="text">
                         <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.headline} font-display italic font-light ${LH.loose} text-center whitespace-pre-wrap`} placeholder="Poem lines..." tag="p" readOnly={readOnly} />
                    </div>
                );
            case LayoutVariant.DEFINITION_LARGE:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col justify-center pl-20`} style={OPENTYPE}>
                         <EditableText value={content.split('|')[0] || ''} onChange={isEditable ? (v) => updateContent(v + '|' + (content.split('|')[1] || '')) : undefined} className={`${TYPE.display} font-display font-bold mb-3 leading-none`} placeholder="Word" tag="h2" readOnly={readOnly} />
                         <div className={`${TYPE.body} font-mono opacity-40 mb-10`}>[noun]</div>
                         <EditableText value={content.split('|')[1] || ''} onChange={isEditable ? (v) => updateContent((content.split('|')[0] || '') + '|' + v) : undefined} className={`${BODY_CLASS} opacity-90 max-w-[520px]`} placeholder="Definition..." tag="p" readOnly={readOnly} />
                    </div>
                );
            case LayoutVariant.STAT_BIG_NUMBER:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center`}>
                         <EditableText value={content.split('|')[0] || ''} onChange={isEditable ? (v) => updateContent(v + '|' + (content.split('|')[1] || '')) : undefined} className="text-[160px] font-display font-light opacity-[0.08] leading-none select-none" placeholder="00" tag="h1" readOnly={readOnly} />
                         <EditableText value={content.split('|')[1] || ''} onChange={isEditable ? (v) => updateContent((content.split('|')[0] || '') + '|' + v) : undefined} className={`${TYPE.headlineSm} uppercase tracking-[0.2em] -mt-16 z-10 text-center font-bold`} placeholder="LABEL" tag="p" readOnly={readOnly} />
                    </div>
                );

            // --- IMAGE LAYOUTS ---
            case LayoutVariant.IMG_FULL_BLEED:
                return (
                    <div className={`${paperBase} bg-black`} data-page-type="image">
                        <div className="absolute inset-0 z-0 reader-image-reveal"><SafeImage index={0} className="w-full h-full" /></div>
                        {/* Gradient overlay for caption readability */}
                        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/30 to-transparent z-[5] pointer-events-none"></div>
                        {/* Minimal caption strip */}
                        <div className="absolute bottom-0 left-0 w-full px-6 py-4 z-10 pointer-events-none">
                            <div className="inline-block bg-black/60 px-4 py-2 backdrop-blur-sm">
                                <div className={readOnly ? "" : "pointer-events-auto"}><EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${CAPTION_CLASS} text-tea-text/80`} placeholder="Caption" tag="span" readOnly={readOnly} /></div>
                            </div>
                        </div>
                    </div>
                );
            case LayoutVariant.IMG_FULL_BLEED_TITLE:
                return (
                    <div className={`${paperBase} bg-black`}>
                         <div className="absolute inset-0 z-0"><SafeImage index={0} className="w-full h-full" /></div>
                         <div className="absolute inset-0 bg-black/40 z-10"></div>
                         <div className="absolute inset-0 z-20 flex items-end p-16 pointer-events-none">
                              <div className={readOnly ? '' : 'pointer-events-auto'}>
                                  <div style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8), 0 4px 40px rgba(0,0,0,0.4)' }}>
                                      <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.displaySm} font-display text-tea-text tracking-wide leading-tight`} placeholder="Title Overlay" tag="h2" readOnly={readOnly} />
                                  </div>
                              </div>
                         </div>
                    </div>
                );
            case LayoutVariant.IMG_SPLIT_VERTICAL:
                return (
                    <div className={`${paperBase} flex flex-col`}>
                        <div className={`h-[55%] w-full relative ${theme.softBg} overflow-hidden`}><SafeImage index={0} className="w-full h-full" /></div>
                        <div className={`h-[45%] w-full ${PAD.text} flex items-start pt-8`} style={OPENTYPE}><EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Description..." tag="p" readOnly={readOnly} /></div>
                    </div>
                );
            case LayoutVariant.IMG_SPLIT_HORIZONTAL:
                return (
                    <div className={`${paperBase} flex flex-col`}>
                         <div className="h-1/2 w-full relative overflow-hidden"><SafeImage index={0} className="w-full h-full" /></div>
                         <div className={`h-1/2 w-full ${PAD.text} flex flex-col justify-start pt-8 bg-tea-gold/3`} style={OPENTYPE}>
                              <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Text below image..." tag="p" readOnly={readOnly} />
                         </div>
                    </div>
                );
            case LayoutVariant.IMG_GRID_MONDRIAN:
                return (
                    <div className={`${paperBase} grid h-full gap-[2px] bg-tea-gold/8`} style={{ gridTemplateColumns: '70% 1fr', gridTemplateRows: '1fr 1fr' }}>
                        <div className="row-span-2 relative bg-black"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="relative bg-black"><SafeImage index={1} className="w-full h-full" /></div>
                        <div className={`relative ${theme.bg} flex items-center justify-center p-6 text-center`}>
                             <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${CAPTION_CLASS}`} placeholder="GRID CAPTION" tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );
            
            case LayoutVariant.IMG_CIRCLE_MASK:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center`} data-page-type="mixed">
                        <div className="w-[70%] aspect-square relative mb-12 reader-image-reveal">
                             <div className="absolute inset-0 rounded-full overflow-hidden shadow-inner bg-tea-text/5">
                                 <SafeImage index={0} className="w-full h-full object-cover scale-105" />
                             </div>
                        </div>
                        <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.body} ${LH.normal} text-center font-caption max-w-lg mx-auto opacity-80`} placeholder="Caption..." tag="p" readOnly={readOnly} />
                    </div>
                );

            case LayoutVariant.IMG_ARCH_MASK:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center`}>
                        <div className="w-[80%] aspect-[3/4] relative mb-10">
                             <div className="absolute inset-0 rounded-t-[2000px] overflow-hidden border-x-2 border-t-2 border-current/8 bg-tea-text/5">
                                 <SafeImage index={0} className="w-full h-full object-cover" />
                             </div>
                        </div>
                        <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${CAPTION_CLASS} text-center max-w-lg mx-auto`} placeholder="Caption..." tag="p" readOnly={readOnly} />
                    </div>
                );

            case LayoutVariant.IMG_FILM_STRIP_VERTICAL:
                return (
                    <div className={`${paperBase} py-12 px-8 flex flex-col items-center overflow-hidden`}>
                         <div className="flex flex-col gap-6 w-[65%] mb-8 shrink-0">
                             {[0, 1, 2].map(i => (
                                 <div key={i} className="aspect-[3/2] bg-black p-3 shadow-lg shrink-0">
                                     <div className="w-full h-full relative overflow-hidden bg-tea-gold/8">
                                         <SafeImage index={i} className="w-full h-full object-cover" />
                                     </div>
                                 </div>
                             ))}
                         </div>
                         <div className="w-[80%] text-center">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={CAPTION_CLASS} placeholder="Strip Caption" tag="p" readOnly={readOnly} />
                         </div>
                    </div>
                );

            case LayoutVariant.CHAPTER_SPLIT: {
                const [chTitle, chSub] = content.split('|');
                const chineseNameSplit = page.chineseName;
                return (
                    <div className={`${paperBase} flex flex-col relative`} data-page-type="text">
                         <div className={`h-[45%] bg-tea-gold/[0.04] flex items-end p-16 pb-8 relative overflow-hidden`}>
                             <EditableText value={chTitle || content} onChange={isEditable ? (v) => updateContent(v + '|' + (chSub||'')) : undefined} className={`${TYPE.display} font-display font-bold leading-none relative z-10`} style={{ marginLeft: '-2px' }} placeholder="Chapter" tag="h1" readOnly={readOnly} />
                         </div>
                         {/* Vertical accent line from boundary */}
                         <div className="relative h-[55%] p-16 pt-10">
                             <div className="absolute top-0 left-24 w-[1px] h-16 bg-tea-gold opacity-40"></div>
                             <EditableText value={chSub || ''} onChange={isEditable ? (v) => updateContent((chTitle||'') + '|' + v) : undefined} className={`${TYPE.caption} uppercase tracking-[0.15em] opacity-50`} placeholder="Subtitle" tag="p" readOnly={readOnly} />
                         </div>
                         {/* Vertical CJK accent strip */}
                         <div className="vertical-cjk absolute left-3 top-0 bottom-0 flex items-center justify-center pointer-events-none select-none" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                             <span className="text-[20px] font-display tracking-[0.4em] opacity-15">{chineseNameSplit || '茶茶茶茶茶'}</span>
                         </div>
                    </div>
                );
            }

            case LayoutVariant.TOC_MINIMAL: {
                const chapters = content.split('|');
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col justify-center`}>
                         <h2 className={`font-display font-light tracking-[0.1em] text-[28px] mb-16 text-center border-b border-current/8 pb-6 mx-8`}>Contents</h2>
                         <div className="space-y-8 px-6">
                             {isEditable ? (
                                 <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.body} leading-loose`} placeholder="Chapter 1|Chapter 2..." tag="div" readOnly={readOnly} />
                             ) : (
                                 chapters.map((chap, i) => (
                                     <div key={i} className="flex items-baseline justify-between border-b border-current/6 pb-3">
                                         <span className={`font-display ${TYPE.headlineSm} italic opacity-90`}>{chap}</span>
                                         <span className={`font-caption ${TYPE.caption} opacity-30`}>{(i+1).toString().padStart(2, '0')}</span>
                                     </div>
                                 ))
                             )}
                         </div>
                    </div>
                );
            }

            case LayoutVariant.QUOTE_MINIMAL:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex items-center justify-center`} data-page-type="text">
                        <div className="max-w-[80%] pl-8 border-l-2 border-tea-gold/20">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.headlineSm} font-display tracking-wide font-light italic ${LH.normal} opacity-80 hang-punct`} placeholder="Quote..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );

            case LayoutVariant.COPYRIGHT_PAGE:
            case LayoutVariant.CREDITS_PAGE:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col justify-end text-center pb-20`}>
                         <div className="w-8 h-8 bg-current mx-auto mb-12 opacity-10 rounded-full"></div>
                         <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.caption} font-caption leading-loose tracking-[0.12em] opacity-40`} placeholder="Credits..." tag="div" readOnly={readOnly} />
                    </div>
                );

            case LayoutVariant.MAP_CARTOGRAPHY: {
                const locations = content.split('|').filter(Boolean);
                const gridPositions = [
                    { top: '15%', left: '20%', coord: '24.5° N, 103.8° E' },
                    { top: '30%', left: '65%', coord: '32.4° N, 118.2° E' },
                    { top: '55%', left: '35%', coord: '23.1° N, 113.3° E' },
                    { top: '70%', left: '72%', coord: '30.3° N, 120.2° E' },
                    { top: '45%', left: '12%', coord: '25.0° N, 102.7° E' },
                    { top: '20%', left: '48%', coord: '34.3° N, 108.9° E' },
                ];
                return (
                    <div className={`${paperBase} flex flex-col`}>
                         <div className="flex-1 relative bg-tea-surface text-tea-text p-12 overflow-hidden">
                             <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/notebook.png')]"></div>
                             <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                                 <path d="M0,50 Q25,40 50,50 T100,50" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 2" />
                                 <path d="M20,0 Q30,50 20,100" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 3" />
                                 <path d="M80,0 Q70,50 80,100" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 3" />
                                 <path d="M0,25 L100,25" fill="none" stroke="currentColor" strokeWidth="0.2" strokeDasharray="1 4" />
                                 <path d="M0,75 L100,75" fill="none" stroke="currentColor" strokeWidth="0.2" strokeDasharray="1 4" />
                                 <path d="M50,0 L50,100" fill="none" stroke="currentColor" strokeWidth="0.2" strokeDasharray="1 4" />
                             </svg>
                             {/* Title */}
                             <div className="relative z-10 mb-6">
                                 {isEditable ? (
                                     <EditableText value={content} onChange={updateContent} className={`${TYPE.headline} font-display tracking-[0.15em] uppercase font-bold`} placeholder="Location 1|Location 2|..." tag="h2" readOnly={readOnly} />
                                 ) : (
                                     <h2 className={`${CAPTION_CLASS} text-center`}>Cartography</h2>
                                 )}
                             </div>
                             {/* Positioned location markers */}
                             {!isEditable && locations.map((loc, i) => {
                                 const pos = gridPositions[i % gridPositions.length];
                                 return (
                                     <div key={i} className="absolute z-10 flex items-start gap-2" style={{ top: pos.top, left: pos.left }}>
                                         <div className="flex flex-col items-center">
                                             <div className="w-3 h-3 rounded-full bg-tea-gold/60 border-2 border-tea-surface shadow-sm"></div>
                                             <div className="w-[1px] h-4 bg-tea-gold/30"></div>
                                         </div>
                                         <div className="-mt-1">
                                             <span className={`${TYPE.bodyDense} font-body font-bold opacity-90 block`}>{loc.trim()}</span>
                                             <span className={`${TYPE.micro} font-mono opacity-40 block`}>{pos.coord}</span>
                                         </div>
                                     </div>
                                 );
                             })}
                             {/* Compass rose */}
                             <div className="absolute bottom-8 right-8 z-10 opacity-20">
                                 <div className="w-12 h-12 border border-current/30 rounded-full flex items-center justify-center">
                                     <span className={`${TYPE.micro} font-display italic`}>N</span>
                                 </div>
                             </div>
                         </div>
                    </div>
                );
            }

            case LayoutVariant.RECIPE_CARD: {
                const recipeLines = content.split('\n').filter(Boolean);
                const isStep = (line: string) => /^\d+[\.\)]/.test(line.trim());
                const isSectionHeader = (line: string) => line.trim().endsWith(':') || line.trim().toUpperCase() === line.trim();
                const hasMeasurement = (line: string) => /\d+\s*(ml|g|oz|°[CF]|min|sec|tsp|tbsp)/i.test(line);
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex items-center justify-center`}>
                         <div className="w-full border border-current/8 p-12 relative">
                             <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-6 ${theme.bg} flex items-center gap-2`}>
                                 <span className="text-[20px]">🍵</span>
                                 <span className={CAPTION_CLASS}>Brewing Guide</span>
                             </div>
                             {isEditable ? (
                                 <EditableText value={content} onChange={updateContent} className={`${BODY_CLASS} whitespace-pre-wrap`} placeholder="Ingredients:\n5g tea\n200ml water\n\nSteps:\n1. Heat water to 90°C\n2. Steep for 3 min" tag="div" readOnly={readOnly} />
                             ) : (
                                 <div className="space-y-2 mt-4">
                                     {recipeLines.map((line, i) => {
                                         if (isSectionHeader(line)) {
                                             return <h3 key={i} className={`${TYPE.bodyLarge} font-body font-bold mt-6 mb-2 border-b border-current/8 pb-2`}>{line}</h3>;
                                         }
                                         if (isStep(line)) {
                                             const stepNum = line.match(/^(\d+)/)?.[1];
                                             const stepText = line.replace(/^\d+[\.\)]\s*/, '');
                                             return (
                                                 <div key={i} className="flex items-start gap-3 py-1">
                                                     <span className={`${TYPE.caption} font-mono text-tea-gold/70 font-bold w-8 shrink-0 text-right`}>{stepNum}.</span>
                                                     <span className={`${BODY_CLASS} ${hasMeasurement(stepText) ? '' : ''}`}>{hasMeasurement(stepText) ? stepText.split(/(\d+\s*(?:ml|g|oz|°[CF]|min|sec|tsp|tbsp))/i).map((part, j) => /\d+\s*(?:ml|g|oz|°[CF]|min|sec|tsp|tbsp)/i.test(part) ? <span key={j} className="font-mono font-bold">{part}</span> : part) : stepText}</span>
                                                 </div>
                                             );
                                         }
                                         return <p key={i} className={`${BODY_CLASS} opacity-80 py-0.5 ${hasMeasurement(line) ? '' : ''}`}>{hasMeasurement(line) ? line.split(/(\d+\s*(?:ml|g|oz|°[CF]|min|sec|tsp|tbsp))/i).map((part, j) => /\d+\s*(?:ml|g|oz|°[CF]|min|sec|tsp|tbsp)/i.test(part) ? <span key={j} className="font-mono font-bold">{part}</span> : part) : line}</p>;
                                     })}
                                 </div>
                             )}
                         </div>
                    </div>
                );
            }

            case LayoutVariant.TEXT_INVERTED:
                return (
                    <div className={`w-full h-full ${!isDarkText ? 'bg-tea-bg text-tea-text' : 'bg-tea-surface text-tea-text'} ${PAD.text} flex flex-col justify-center items-center text-center overflow-hidden relative`} style={OPENTYPE}>
                         {/* Subtle radial gradient */}
                         <div className="absolute inset-0 pointer-events-none" style={{ background: !isDarkText ? 'radial-gradient(ellipse at center, var(--tea-accent-sub) 0%, transparent 70%)' : 'none' }}></div>
                         <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${BODY_CLASS} leading-[1.6] relative z-10 max-w-[580px]`} placeholder="Inverted text..." tag="p" readOnly={readOnly} />
                    </div>
                );

            case LayoutVariant.NEXT_READS:
                return (
                    <div className={`${paperBase} ${PAD.text} flex flex-col pt-16`}>
                        <div className="mb-10 border-b border-current/8 pb-4 flex justify-between items-end">
                            <h2 className={CAPTION_CLASS}>Journal Index</h2>
                            <span className={`${FOLIO_CLASS}`}>Issue 03</span>
                        </div>

                        <div className="flex-1 overflow-y-auto no-scrollbar">
                            <div className="flex flex-col">
                                {recommendations?.map((story, i) => (
                                    <div
                                        key={story.id}
                                        onClick={() => onNavigate && onNavigate(story)}
                                        className="group cursor-pointer py-5 border-b border-current/5 flex items-start gap-4 hover:pl-3 transition-all duration-300"
                                    >
                                        <span className={`font-mono ${TYPE.micro} opacity-25 pt-1`}>{(i + 1).toString().padStart(2, '0')}</span>
                                        <h3 className={`${TYPE.headlineSm} font-display leading-tight group-hover:text-tea-gold transition-colors`}>
                                            {story.title}
                                        </h3>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="mt-auto pt-16 flex justify-center opacity-20">
                            <Icons.Seal className="w-16 h-16 text-current" />
                        </div>
                    </div>
                );

            // --- CURATED CONTENT ---
            case LayoutVariant.CURATED_LINKS: {
                // Format: title|url|source|note,title|url|source|note,...
                const links = content.split(',').map(link => {
                    const [title, url, source, note] = link.split('|');
                    return { title: title?.trim(), url: url?.trim(), source: source?.trim(), note: note?.trim() };
                }).filter(link => link.title && link.url);

                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col pt-20`}>
                        <div className="mb-12 pb-6 border-b border-current/10">
                            <h2 className={`${TYPE.caption} uppercase tracking-[0.25em] opacity-60`}>Curated Reads</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
                            {links.length > 0 ? links.map((link, i) => (
                                <a
                                    key={i}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`block p-6 border ${theme.border} rounded-sm hover:bg-current/5 transition-all duration-300 group cursor-pointer`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <h3 className={`${TYPE.caption} font-body leading-snug group-hover:text-tea-gold transition-colors`}>
                                            {link.title}
                                        </h3>
                                        <Icons.ExternalLink className="w-5 h-5 opacity-40 group-hover:opacity-80 flex-shrink-0 mt-1" />
                                    </div>
                                    {link.source && (
                                        <div className={`${TYPE.micro} uppercase tracking-[0.15em] ${theme.subtext} mb-3`}>
                                            {link.source}
                                        </div>
                                    )}
                                    {link.note && (
                                        <p className={`${TYPE.caption} leading-relaxed ${theme.subtext} font-caption`}>
                                            "{link.note}"
                                        </p>
                                    )}
                                </a>
                            )) : (
                                <div className="text-center py-12 opacity-40">
                                    <Icons.Link className="w-12 h-12 mx-auto mb-4" />
                                    <p className={TYPE.caption}>Add curated links in format:</p>
                                    <p className={`${TYPE.micro} font-mono mt-2`}>title|url|source|note,...</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-auto pt-8 text-center">
                            <p className={`${TYPE.micro} uppercase tracking-[0.15em] ${theme.subtext}`}>
                                Curated with care
                            </p>
                        </div>
                    </div>
                );
            }

            // --- VIDEO LAYOUTS ---
            case LayoutVariant.TEXT_WITH_VIDEO:
            case LayoutVariant.TEXT_WITH_VIDEO_VERTICAL: {
                const isVertical = variant === LayoutVariant.TEXT_WITH_VIDEO_VERTICAL;
                const parts = content.split('|');
                const textAbove = parts[0] || '';
                const textBelow = parts[1] || '';
                const { videoId, instagramId, videoCaption } = page;
                const hasVideo = videoId || instagramId;

                return (
                    <div className={`${paperBase} ${PAD.text} flex flex-col justify-start pt-16`} style={OPENTYPE}>
                        {textAbove && (
                            <div className="mb-6">
                                <EditableText value={textAbove} onChange={isEditable ? (v) => updateContent(v + '|' + textBelow) : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Text above video..." tag="p" readOnly={readOnly} />
                            </div>
                        )}
                        {hasVideo ? (
                            <div className={`w-full flex justify-center ${isVertical ? 'my-3' : 'my-4'}`}>
                                <VideoEmbed videoId={videoId} instagramId={instagramId} isVertical={isVertical} className={isVertical ? 'w-[55%] rounded-sm shadow-lg' : 'w-full rounded-sm shadow-lg'} />
                            </div>
                        ) : (
                            <div className="w-full flex justify-center my-4">
                                <div className={`${isVertical ? 'w-[60%] aspect-[9/16]' : 'w-full aspect-video'} bg-tea-text/10 rounded-sm flex items-center justify-center border-2 border-dashed border-current/20`}>
                                    <div className="text-center opacity-40"><Icons.Play className="w-12 h-12 mx-auto mb-2" /><span className={CAPTION_CLASS}>Video ID required</span></div>
                                </div>
                            </div>
                        )}
                        {videoCaption && <p className={`text-center ${TYPE.caption} italic ${theme.subtext} mb-4 font-caption`}>{videoCaption}</p>}
                        {textBelow && (
                            <div className="mt-3">
                                <EditableText value={textBelow} onChange={isEditable ? (v) => updateContent(textAbove + '|' + v) : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Text below video..." tag="p" readOnly={readOnly} />
                            </div>
                        )}
                    </div>
                );
            }

            // ===================================================================
            // NEWLY IMPLEMENTED LAYOUTS (previously fell through to default)
            // ===================================================================

            // --- TEXT LAYOUTS: Missing implementations ---
            case LayoutVariant.TEXT_TRIPLE_COL:
                return (
                    <div className={`${paperBase} px-8 py-10 pt-16`} data-page-type="text" style={OPENTYPE}>
                        <div className={`${FOLIO_CLASS} mb-6 flex justify-between`}>
                            <span>{storyTitle || ''}</span>
                            <span>{page.index + 1}</span>
                        </div>
                        <div className="columns-3 gap-6 h-[calc(100%-3rem)] text-left [column-fill:auto] col-rule">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.bodySm} ${LH.relaxed} font-body [font-optical-sizing:auto] font-[420] opacity-90`} placeholder="Triple column text..." tag="p" readOnly={readOnly} />
                        </div>
                        <div className={getBottomTreatment(variant, theme.fadeBg)}></div>
                    </div>
                );

            case LayoutVariant.TEXT_SIDEBAR_LEFT:
                return (
                    <div className={`${paperBase} flex h-full relative overflow-hidden`} style={OPENTYPE}>
                        <div className={`w-1/3 p-8 ${theme.softBg} flex flex-col justify-center text-center`}>
                             <div className="w-10 h-[0.5px] bg-current mx-auto mb-6 opacity-20"></div>
                             <EditableText value={content.split('|')[1] || ''} onChange={isEditable ? (v) => updateContent((content.split('|')[0] || '') + '|' + v) : undefined} className={`${TYPE.bodySm} opacity-70 leading-[1.5] font-caption`} placeholder="Sidebar note..." tag="p" readOnly={readOnly} />
                        </div>
                        <div className={`w-2/3 ${PAD.text} pt-20 border-l border-tea-gold/10`}>
                             <EditableText value={content.split('|')[0] || content} onChange={isEditable ? (v) => updateContent(v + '|' + (content.split('|')[1] || '')) : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Main text..." tag="p" readOnly={readOnly} />
                        </div>
                        <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t ${theme.fadeBg} to-transparent pointer-events-none z-10`} />
                    </div>
                );

            case LayoutVariant.TEXT_ASYMMETRIC_LEFT:
            case LayoutVariant.TEXT_ASYMMETRIC_RIGHT: {
                const isRight = variant === LayoutVariant.TEXT_ASYMMETRIC_RIGHT;
                const mainText = content.split('|')[0] || content;
                const marginNote = content.split('|')[1] || '';
                const mainCol = (
                    <div className={`w-[65%] ${PAD.text} pt-20`}>
                        <EditableText value={mainText} onChange={isEditable ? (v) => updateContent(v + '|' + marginNote) : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Main text..." tag="p" readOnly={readOnly} />
                    </div>
                );
                const marginCol = (
                    <div className={`w-[35%] p-8 pt-24 ${theme.softBg}`}>
                        <EditableText value={marginNote} onChange={isEditable ? (v) => updateContent(mainText + '|' + v) : undefined} className={`${TYPE.bodyDense} font-sans leading-[1.5] opacity-60`} placeholder="Marginal note..." tag="p" readOnly={readOnly} />
                    </div>
                );
                return (
                    <div className={`${paperBase} flex h-full`} style={OPENTYPE}>
                        {isRight ? <>{mainCol}{marginCol}</> : <>{marginCol}{mainCol}</>}
                    </div>
                );
            }

            case LayoutVariant.TEXT_BLOCKQUOTE_CENTER: {
                const bqParts = content.split('|');
                return (
                    <div className={`${paperBase} ${PAD.text} flex flex-col pt-16`} style={OPENTYPE}>
                        {bqParts[0] && <EditableText value={bqParts[0]} onChange={isEditable ? (v) => updateContent(v + '|' + (bqParts[1]||'') + '|' + (bqParts[2]||'')) : undefined} className={`${BODY_CLASS} opacity-90 mb-8`} placeholder="Text above..." tag="p" readOnly={readOnly} />}
                        <div className={`w-full ${theme.softBg} py-10 px-12 my-4 border-y border-current/5`}>
                            <EditableText value={bqParts[1] || ''} onChange={isEditable ? (v) => updateContent((bqParts[0]||'') + '|' + v + '|' + (bqParts[2]||'')) : undefined} className={`${TYPE.headline} font-display italic leading-[1.4] text-center opacity-80`} placeholder="Centered quote..." tag="p" readOnly={readOnly} />
                        </div>
                        {bqParts[2] && <EditableText value={bqParts[2]} onChange={isEditable ? (v) => updateContent((bqParts[0]||'') + '|' + (bqParts[1]||'') + '|' + v) : undefined} className={`${BODY_CLASS} opacity-90 mt-8`} placeholder="Text below..." tag="p" readOnly={readOnly} />}
                    </div>
                );
            }

            case LayoutVariant.TEXT_BLOCKQUOTE_LEFT:
                return (
                    <div className={`${paperBase} flex h-full`} style={OPENTYPE}>
                        <div className={`w-1/3 ${PAD.spacious} flex items-center`}>
                            <EditableText value={content.split('|')[0] || content} onChange={isEditable ? (v) => updateContent(v + '|' + (content.split('|')[1] || '')) : undefined} className={`${TYPE.headlineSm} font-display italic leading-[1.5] opacity-70`} placeholder="Quote..." tag="p" readOnly={readOnly} />
                        </div>
                        <div className={`w-2/3 ${PAD.text} pt-20 border-l border-tea-gold/10`}>
                            <EditableText value={content.split('|')[1] || ''} onChange={isEditable ? (v) => updateContent((content.split('|')[0] || '') + '|' + v) : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Body text..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );

            case LayoutVariant.TEXT_TYPEWRITER: {
                const typewriterLines = content ? content.split('\n') : ['The field notes begin...'];
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col pt-16 bg-tea-surface`} data-page-type="text" style={OPENTYPE}>
                        <div className="flex justify-between mb-8">
                            <span className={`${FOLIO_CLASS}`}>{storyTitle || 'Field Notes'}</span>
                            <span className={`${TYPE.micro} font-caption text-red-800/40`}>Rev. 03</span>
                        </div>
                        <div className="max-w-[600px] mx-auto w-full">
                            {isEditable ? (
                                <EditableText value={content} onChange={updateContent} className={`${TYPE.body} font-mono leading-[1.7] opacity-80 whitespace-pre-wrap`} placeholder="The field notes begin..." tag="p" readOnly={readOnly} />
                            ) : (
                                <div>
                                    {typewriterLines.map((line, i) => (
                                        <div key={i} className="typewriter-line" style={{ animationDelay: `${i * 1.2}s` }}>
                                            <p className={`${TYPE.body} font-mono leading-[1.7] opacity-80`}>{line || '\u00A0'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            case LayoutVariant.TEXT_HIGHLIGHTED:
                return (
                    <div className={`${paperBase} ${PAD.text} flex flex-col justify-start pt-16 text-highlight`} style={OPENTYPE}>
                        <div className={`${FOLIO_CLASS} mb-4 flex justify-between`}>
                            <span>{storyTitle || ''}</span>
                            <span>{page.index + 1}</span>
                        </div>
                        <div className="max-w-[640px] mx-auto w-full">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Text with highlights..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );

            case LayoutVariant.TEXT_CENTER_NARROW:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex items-center justify-center`} style={OPENTYPE}>
                        <div className="max-w-[380px] text-center">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.body} font-body leading-[2] opacity-85 text-center`} placeholder="Meditative text..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );

            case LayoutVariant.MAGAZINE_INTERVIEW_Q_A:
            case LayoutVariant.INTERVIEW_STANDARD: {
                const qaPairs = content.split('\n\n').filter(Boolean);
                return (
                    <div className={`${paperBase} ${PAD.text} flex flex-col pt-16`} style={OPENTYPE}>
                        <div className={`${FOLIO_CLASS} mb-6 flex justify-between`}>
                            <span>{storyTitle || 'Interview'}</span>
                            <span>{page.index + 1}</span>
                        </div>
                        <div className="flex-1 space-y-1">
                            {qaPairs.length > 1 ? qaPairs.map((block, i) => {
                                const isQuestion = block.startsWith('Q:') || block.startsWith('Q ') || i % 2 === 0;
                                return (
                                    <div key={i} className={`py-3 px-4 ${isQuestion ? '' : 'bg-tea-gold/3'}`}>
                                        <p className={`${TYPE.bodyDense} ${isQuestion ? 'font-caption font-semibold uppercase' : 'font-body'} leading-[1.4] opacity-90`}>{block}</p>
                                    </div>
                                );
                            }) : (
                                <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${BODY_DENSE_CLASS} opacity-90`} placeholder="Q: Question here\n\nA: Answer here..." tag="div" readOnly={readOnly} />
                            )}
                        </div>
                    </div>
                );
            }

            case LayoutVariant.TEXT_SIDEBAR_IMAGE:
                return (
                    <div className={`${paperBase} flex h-full`} style={OPENTYPE}>
                        <div className={`w-2/3 ${PAD.text} pt-20`}>
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Text beside image..." tag="p" readOnly={readOnly} />
                        </div>
                        <div className="w-1/3 relative">
                            <SafeImage index={0} className="w-full h-full" />
                            <div className="absolute bottom-4 left-4 right-4">
                                <span className={`${CAPTION_CLASS} text-tea-text/70 bg-black/40 px-2 py-1 backdrop-blur-sm`}>Caption</span>
                            </div>
                        </div>
                    </div>
                );

            case LayoutVariant.TEXT_OVERLAPPING_IMAGES:
                return (
                    <div className={`${paperBase} ${PAD.text} pt-20 relative`} style={OPENTYPE}>
                        {/* Overlapping images */}
                        <div className="absolute top-16 right-8 w-[200px] h-[260px] rotate-[2deg] shadow-lg z-10 overflow-hidden"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="absolute top-[180px] right-[60px] w-[160px] h-[200px] -rotate-[1.5deg] shadow-lg z-20 overflow-hidden"><SafeImage index={1} className="w-full h-full" /></div>
                        <div className="max-w-[55%]">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Text with overlapping images..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );

            // --- IMAGE LAYOUTS: Missing implementations ---
            case LayoutVariant.IMG_DIAGONAL_SPLIT:
                return (
                    <div className={`${paperBase} relative bg-black`}>
                        <div className="absolute inset-0" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="absolute inset-0" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}><SafeImage index={1} className="w-full h-full" /></div>
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <div className={`bg-black/60 backdrop-blur-sm px-6 py-3 ${readOnly ? '' : 'pointer-events-auto'}`}>
                                <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${CAPTION_CLASS} text-tea-text/90`} placeholder="Caption" tag="span" readOnly={readOnly} />
                            </div>
                        </div>
                    </div>
                );

            case LayoutVariant.IMG_GRID_2x2:
                return (
                    <div className={`${paperBase} flex flex-col`}>
                        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-[2px] bg-current/5">
                            {[0,1,2,3].map(i => <div key={i} className="relative bg-black"><SafeImage index={i} className="w-full h-full" /></div>)}
                        </div>
                        <div className={`py-4 px-8 text-center`}>
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={CAPTION_CLASS} placeholder="Grid caption" tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );

            case LayoutVariant.IMG_GRID_3x3:
                return (
                    <div className={`${paperBase} grid grid-cols-3 grid-rows-3 gap-[2px] bg-current/5`}>
                        {[0,1,2,3,4,5,6,7,8].map(i => (
                            <div key={i} className="relative bg-black">
                                <SafeImage index={i} className="w-full h-full" />
                                <span className={`absolute top-2 left-2 ${TYPE.micro} font-mono text-white/50`}>{i+1}</span>
                            </div>
                        ))}
                    </div>
                );

            case LayoutVariant.IMG_QUAD_GRID:
                return (
                    <div className={`${paperBase} grid gap-[2px] bg-current/5`} style={{ gridTemplateColumns: '60% 1fr', gridTemplateRows: '60% 1fr' }}>
                        <div className="relative bg-black"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="row-span-2 relative bg-black"><SafeImage index={1} className="w-full h-full" /></div>
                        <div className="relative bg-black grid grid-cols-2 gap-[2px]">
                            <div className="relative bg-black"><SafeImage index={2} className="w-full h-full" /></div>
                            <div className="relative bg-black"><SafeImage index={3} className="w-full h-full" /></div>
                        </div>
                    </div>
                );

            case LayoutVariant.IMG_OVAL_VIGNETTE:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center`}>
                        <div className="w-[75%] aspect-[3/4] relative mb-10" style={{ maskImage: 'radial-gradient(ellipse 70% 80% at center, black 50%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse 70% 80% at center, black 50%, transparent 80%)' }}>
                            <SafeImage index={0} className="w-full h-full object-cover" />
                        </div>
                        <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${CAPTION_CLASS} text-center max-w-md mx-auto`} placeholder="Caption..." tag="p" readOnly={readOnly} />
                    </div>
                );

            case LayoutVariant.IMG_POLAROID_SCATTER:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex items-center justify-center relative`}>
                        {[0,1,2].map((i) => {
                            const rotations = ['-rotate-[3deg]', 'rotate-[2deg]', '-rotate-[1deg]'];
                            const positions = ['top-[15%] left-[10%]', 'top-[25%] right-[8%]', 'bottom-[15%] left-[25%]'];
                            return (
                                <div key={i} className={`absolute ${positions[i]} ${rotations[i]} w-[40%] bg-tea-surface p-3 pb-12 shadow-xl`}>
                                    <div className="aspect-square overflow-hidden"><SafeImage index={i} className="w-full h-full object-cover" /></div>
                                </div>
                            );
                        })}
                        <div className="absolute bottom-8 right-8">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${CAPTION_CLASS}`} placeholder="Caption..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );

            case LayoutVariant.IMG_WITH_CAPTION_BOTTOM:
                return (
                    <div className={`${paperBase} flex flex-col`}>
                        <div className="h-[70%] relative bg-black"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className={`h-[30%] ${PAD.text} flex flex-col justify-center`}>
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.body} font-body italic leading-[1.5] opacity-80 mb-3`} placeholder="Caption text..." tag="p" readOnly={readOnly} />
                            <span className={`${CAPTION_CLASS} opacity-30`}>Photographer — Location</span>
                        </div>
                    </div>
                );

            case LayoutVariant.IMG_OVERLAY_TEXT:
                return (
                    <div className={`${paperBase} bg-black relative`}>
                        <div className="absolute inset-0"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="absolute inset-0 bg-black/30 z-10"></div>
                        <div className={`absolute inset-0 z-20 ${PAD.spacious} flex items-center pointer-events-none`}>
                            <div className={`bg-black/50 backdrop-blur-sm p-10 max-w-[70%] ${readOnly ? '' : 'pointer-events-auto'}`}>
                                <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${BODY_CLASS} text-tea-text/90 text-left`} placeholder="Text over image..." tag="p" readOnly={readOnly} />
                            </div>
                        </div>
                    </div>
                );

            case LayoutVariant.IMG_GALLERY_MOSAIC:
                return (
                    <div className={`${paperBase} grid gap-[3px] p-4`} style={{ gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr' }}>
                        <div className="row-span-2 relative bg-black"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="relative bg-black"><SafeImage index={1} className="w-full h-full" /></div>
                        <div className="row-span-2 relative bg-black"><SafeImage index={2} className="w-full h-full" /></div>
                        <div className="relative bg-black"><SafeImage index={3} className="w-full h-full" /></div>
                        <div className="col-span-2 relative bg-black"><SafeImage index={4} className="w-full h-full" /></div>
                    </div>
                );

            case LayoutVariant.IMG_DUOTONE:
                return (
                    <div className={`${paperBase} relative bg-black`} data-page-type="image">
                        {/* SVG duotone filter definition */}
                        <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
                            <defs>
                                <filter id="duotone-teatype">
                                    <feColorMatrix type="saturate" values="0"/>
                                    <feColorMatrix type="matrix" values="
                                        0.35 0 0 0 0.45
                                        0.25 0 0 0 0.30
                                        0.10 0 0 0 0.15
                                        0    0 0 1 0
                                    "/>
                                </filter>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 z-0 reader-image-reveal" style={{ filter: 'url(#duotone-teatype)' }}><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="absolute bottom-0 left-0 w-full px-6 py-4 z-30 pointer-events-none">
                            <div className={`inline-block bg-black/50 px-4 py-2 backdrop-blur-sm ${readOnly ? '' : 'pointer-events-auto'}`}>
                                <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${CAPTION_CLASS} text-tea-text/80`} placeholder="Caption" tag="span" readOnly={readOnly} />
                            </div>
                        </div>
                    </div>
                );

            case LayoutVariant.IMG_PANORAMIC:
                return (
                    <div className={`${paperBase} flex flex-col items-center justify-center ${PAD.spacious}`}>
                        <div className="w-full aspect-[3/1] relative overflow-hidden mb-8"><SafeImage index={0} className="w-full h-full object-cover" /></div>
                        <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${CAPTION_CLASS} text-center`} placeholder="Panoramic caption..." tag="p" readOnly={readOnly} />
                    </div>
                );

            case LayoutVariant.IMG_VIGNETTE_SOFT:
                return (
                    <div className={`${paperBase} bg-black relative`}>
                        <div className="absolute inset-0"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)' }}></div>
                        <div className="absolute bottom-12 left-0 right-0 text-center z-20 pointer-events-none">
                            <div className={readOnly ? '' : 'pointer-events-auto inline-block'}>
                                <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${CAPTION_CLASS} text-tea-text/70`} placeholder="Caption..." tag="p" readOnly={readOnly} />
                            </div>
                        </div>
                    </div>
                );

            // --- CHAPTER LAYOUTS: Missing implementations ---
            case LayoutVariant.CHAPTER_MINIMAL: {
                const [cNum, cTitle] = content.split('|');
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center text-center`}>
                        <span className={`${TYPE.headline} font-display font-light opacity-40 mb-6`}>{cNum || '01'}</span>
                        <div className="w-32 h-[0.5px] bg-tea-gold opacity-25 mb-6"></div>
                        <EditableText value={cTitle || ''} onChange={isEditable ? (v) => updateContent((cNum||'') + '|' + v) : undefined} className={`${TYPE.headlineSm} font-display italic tracking-[0.08em] opacity-70`} placeholder="Chapter Title" tag="h2" readOnly={readOnly} />
                    </div>
                );
            }

            case LayoutVariant.CHAPTER_CENTERED_SMALL: {
                const [csNum, csTitle] = content.split('|');
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex items-center justify-center`}>
                        <div className="flex items-center gap-6 w-full">
                            <div className="flex-1 h-[0.5px] bg-current opacity-10"></div>
                            <div className="text-center">
                                <span className={`${TYPE.caption} font-mono opacity-30 block mb-2`}>{csNum || '01'}</span>
                                <EditableText value={csTitle || ''} onChange={isEditable ? (v) => updateContent((csNum||'') + '|' + v) : undefined} className={`${TYPE.headlineSm} font-display tracking-wide`} placeholder="Title" tag="h2" readOnly={readOnly} />
                            </div>
                            <div className="flex-1 h-[0.5px] bg-current opacity-10"></div>
                        </div>
                    </div>
                );
            }

            case LayoutVariant.CHAPTER_IMAGE_BG:
                return (
                    <div className={`${paperBase} bg-black relative`}>
                        <div className="absolute inset-0"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="absolute inset-0 z-10 pointer-events-none" style={{ boxShadow: 'inset 0 0 200px rgba(0,0,0,0.7)' }}></div>
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center pointer-events-none">
                            <div className={readOnly ? '' : 'pointer-events-auto'}>
                                <div style={{ textShadow: '0 2px 30px rgba(0,0,0,0.8)' }}>
                                    <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.display} font-display text-white leading-none mb-4`} placeholder="01" tag="h1" readOnly={readOnly} />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case LayoutVariant.CHAPTER_LARGE_NUMBER: {
                const [clNum, clTitle] = content.split('|');
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex items-center relative`}>
                        {/* Large number — left edge, clear grid layout */}
                        <div className="flex items-center gap-10 w-full">
                            <span className="text-[200px] font-display font-light leading-none select-none opacity-[0.12] shrink-0">{clNum || '01'}</span>
                            <div className="relative z-10">
                                <div className="w-20 h-[0.5px] bg-tea-gold opacity-40 mb-6"></div>
                                <EditableText value={clTitle || ''} onChange={isEditable ? (v) => updateContent((clNum||'') + '|' + v) : undefined} className={`${TYPE.headlineSm} font-display tracking-[0.06em]`} placeholder="Chapter Title" tag="h2" readOnly={readOnly} />
                            </div>
                        </div>
                    </div>
                );
            }

            case LayoutVariant.DEDICATION_SIMPLE:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center text-center`}>
                        <div className="w-12 h-[0.5px] bg-tea-gold/10 mb-12"></div>
                        <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.subtitle} font-display italic font-light opacity-60 max-w-[400px] leading-[1.8]`} placeholder="For those who take the time to steep." tag="p" readOnly={readOnly} />
                        <div className="w-12 h-[0.5px] bg-tea-gold/10 mt-12"></div>
                    </div>
                );

            case LayoutVariant.TOC_IMAGE: {
                const tocEntries = content.split('|');
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col justify-center`}>
                        <h2 className={`${CAPTION_CLASS} mb-12 text-center`}>Contents</h2>
                        <div className="space-y-6">
                            {tocEntries.map((entry, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="w-16 h-16 shrink-0 bg-current/5 rounded-sm overflow-hidden"><SafeImage index={i} className="w-full h-full object-cover" /></div>
                                    <span className={`font-body ${TYPE.body} flex-1 opacity-90`}>{entry}</span>
                                    <span className="flex-1 border-b border-dotted border-current/15 mx-2"></span>
                                    <span className={`font-caption ${TYPE.caption} opacity-30`}>{(i+1).toString().padStart(2,'0')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            }

            // --- POETRY & QUOTES: Missing implementations ---
            case LayoutVariant.POEM_LEFT_ALIGN:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex items-center`} data-page-type="text" style={OPENTYPE}>
                        <div className="ml-[25%] w-[60%]">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.headlineSm} font-display font-light ${LH.loose} whitespace-pre-wrap opacity-85`} placeholder="Each line / on its own..." tag="p" readOnly={readOnly} />
                            <div className={`${TYPE.caption} font-caption text-right mt-12 opacity-30`}>— Author</div>
                        </div>
                    </div>
                );

            case LayoutVariant.POEM_SCATTERED: {
                const words = content.split(/\s+/).filter(Boolean);
                return (
                    <div className={`${paperBase} ${PAD.spacious} relative`}>
                        {isEditable ? (
                            <EditableText value={content} onChange={updateContent} className={`${TYPE.body} font-display`} placeholder="Scattered words..." tag="p" readOnly={readOnly} />
                        ) : (
                            words.map((word, i) => {
                                const top = 10 + ((i * 37 + i * i * 7) % 70);
                                const left = 5 + ((i * 23 + i * 13) % 75);
                                const size = i % 3 === 0 ? TYPE.headline : i % 2 === 0 ? TYPE.headlineSm : TYPE.body;
                                return <span key={i} className={`absolute ${size} font-display italic opacity-${30 + (i % 4) * 20}`} style={{ top: `${top}%`, left: `${left}%` }}>{word}</span>;
                            })
                        )}
                    </div>
                );
            }

            case LayoutVariant.POEM_VISUAL:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex items-center justify-center`}>
                        <svg viewBox="0 0 400 400" className="w-[70%] h-auto">
                            <defs><path id="circlePath" d="M200,200 m-150,0 a150,150 0 1,1 300,0 a150,150 0 1,1 -300,0" /></defs>
                            <text className="fill-current opacity-50" style={{ fontSize: '18px', fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                                <textPath href="#circlePath">{content || 'Words arranged in a circle path flowing endlessly'}</textPath>
                            </text>
                        </svg>
                    </div>
                );

            case LayoutVariant.POEM_HAIKU_MINIMAL: {
                const lines = content.split('/').map(l => l.trim());
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center text-center`}>
                        <div className="space-y-16">
                            {lines.map((line, i) => (
                                <p key={i} className={`${TYPE.headline} font-display italic font-light opacity-80`}>{line}</p>
                            ))}
                        </div>
                        <div className="absolute bottom-16">
                            <span className={`${TYPE.micro} font-caption opacity-20`}>— kigo</span>
                        </div>
                    </div>
                );
            }

            case LayoutVariant.QUOTE_IMAGE_BG:
                return (
                    <div className={`${paperBase} bg-black relative`}>
                        <div className="absolute inset-0"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="absolute inset-0 bg-black/60 z-10"></div>
                        <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center text-center ${PAD.spacious} pointer-events-none`}>
                            <div className={readOnly ? '' : 'pointer-events-auto'}>
                                <div style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
                                    <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.headline} font-display tracking-wide font-light italic text-white leading-[1.3] mb-8 hang-punct`} placeholder="Quote..." tag="p" readOnly={readOnly} />
                                </div>
                            </div>
                            <span className={`${TYPE.caption} font-caption text-white/50`}>— Attribution</span>
                        </div>
                    </div>
                );

            // --- EDITORIAL / DATA: Missing implementations ---
            case LayoutVariant.LIST_TIMELINE: {
                const events = content.split('|');
                return (
                    <div className={`${paperBase} ${PAD.text} pt-16`} style={OPENTYPE}>
                        <div className={`${FOLIO_CLASS} mb-4`}>{storyTitle || 'Timeline'}</div>
                        <div className="relative pl-12">
                            {/* Gold vertical line */}
                            <div className="absolute left-4 top-0 bottom-0 w-[2px] bg-tea-gold/40"></div>
                            <div className="space-y-8">
                                {events.map((event, i) => {
                                    const [date, ...descParts] = event.split('—').map(s => s.trim());
                                    const desc = descParts.join('—') || date;
                                    return (
                                        <div key={i} className="relative flex items-start gap-6">
                                            {/* Gold dot on the line */}
                                            <div className="absolute -left-[2.15rem] top-2 w-3 h-3 rounded-full bg-tea-gold border-[3px] border-tea-bg shadow-sm"></div>
                                            <div className="ml-2">
                                                {descParts.length > 0 && <span className={`${TYPE.caption} font-caption opacity-40 block mb-1`}>{date}</span>}
                                                <span className={`${TYPE.bodyDense} font-body opacity-90`}>{descParts.length > 0 ? desc : date}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            }

            case LayoutVariant.LIST_CHECKLIST: {
                const items = content.split('|');
                return (
                    <div className={`${paperBase} ${PAD.text} pt-16`} style={OPENTYPE}>
                        <div className={`${FOLIO_CLASS} mb-4`}>{storyTitle || 'Checklist'}</div>
                        <div className="space-y-5 max-w-[600px] mx-auto">
                            {items.map((item, i) => {
                                const isChecked = item.startsWith('[x]');
                                const text = item.replace(/^\[x?\]\s*/, '');
                                return (
                                    <div key={i} className={`flex items-start gap-4 ${isChecked ? 'opacity-40' : ''}`}>
                                        <div className={`w-5 h-5 rounded-full border-2 ${isChecked ? 'border-tea-gold bg-tea-gold/20' : 'border-current/20'} shrink-0 mt-1 flex items-center justify-center`}>
                                            {isChecked && <div className="w-2 h-2 rounded-full bg-tea-gold"></div>}
                                        </div>
                                        <span className={`${TYPE.body} font-body ${isChecked ? 'line-through' : ''} opacity-90`}>{text}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            }

            case LayoutVariant.STAT_CHART_MINIMAL:
            case LayoutVariant.DATA_BAR_CHART: {
                const dataEntries = content.split('|');
                return (
                    <div className={`${paperBase} ${PAD.text} pt-16 flex flex-col`} style={OPENTYPE}>
                        <div className={`${FOLIO_CLASS} mb-4`}>{storyTitle || 'Data'}</div>
                        <div className="flex-1 flex flex-col justify-center space-y-6 max-w-[600px] mx-auto w-full">
                            {dataEntries.map((entry, i) => {
                                const [label, value] = entry.split(':').map(s => s.trim());
                                const numVal = parseInt(value) || ((i + 1) * 20);
                                return (
                                    <div key={i}>
                                        <div className="flex justify-between mb-2">
                                            <span className={`${TYPE.bodyDense} font-body opacity-80`}>{label}</span>
                                            <span className={`${TYPE.caption} font-caption opacity-40`}>{value || numVal}</span>
                                        </div>
                                        <div className="h-2 bg-current/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-tea-gold/40 rounded-full" style={{ width: `${Math.min(numVal, 100)}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            }

            case LayoutVariant.INDEX_GRID: {
                const gridItems = content.split('|');
                return (
                    <div className={`${paperBase} ${PAD.text} pt-16`} style={OPENTYPE}>
                        <div className={`${FOLIO_CLASS} mb-4`}>Index</div>
                        <div className="grid grid-cols-3 gap-4">
                            {gridItems.map((item, i) => (
                                <div key={i} className={`p-4 ${theme.softBg} text-center`}>
                                    <span className={`${TYPE.bodyDense} font-body opacity-80`}>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            }

            case LayoutVariant.TASTING_NOTES_GRID: {
                const notes = content.split('|');
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center`}>
                        <h2 className={`${CAPTION_CLASS} mb-10`}>Tasting Notes</h2>
                        <div className="flex flex-wrap justify-center gap-3 max-w-[550px]">
                            {notes.map((note, i) => (
                                <span key={i} className={`${TYPE.bodyDense} font-caption px-5 py-2 bg-tea-gold/[0.06] opacity-80`}>{note}</span>
                            ))}
                        </div>
                    </div>
                );
            }

            // --- SPECIAL: Missing implementations ---
            case LayoutVariant.NOTE_PAPER: {
                const noteLines = content ? content.split('\n') : ['Notes here...'];
                return (
                    <div className={`${paperBase} relative bg-tea-surface`} data-page-type="text" style={{ transform: 'rotate(1deg)' }}>
                        {/* Faint horizontal ruled lines */}
                        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 38px, rgba(0,0,0,0.06) 38px, rgba(0,0,0,0.06) 39px)', backgroundPosition: '0 28px' }}></div>
                        {/* Red margin line */}
                        <div className="absolute top-0 bottom-0 left-[15%] w-[1px] bg-red-300/30 pointer-events-none"></div>
                        <div className="p-10 pl-[18%] pt-16">
                            {isEditable ? (
                                <EditableText value={content} onChange={updateContent} className={`${TYPE.body} font-[Ma_Shan_Zheng] italic leading-[39px] opacity-70 whitespace-pre-wrap`} placeholder="Notes here..." tag="p" readOnly={readOnly} />
                            ) : (
                                <div>
                                    {noteLines.map((line, i) => (
                                        <div key={i} className="typewriter-line" style={{ animationDelay: `${i * 1.2}s` }}>
                                            <p className={`${TYPE.body} font-[Ma_Shan_Zheng] italic leading-[39px] opacity-70`}>{line || '\u00A0'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            case LayoutVariant.POSTCARD_STYLE:
                return (
                    <div className={`${paperBase} flex border border-tea-border/40`}>
                        <div className="w-1/2 relative"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="w-1/2 p-8 flex flex-col relative bg-tea-surface/30">
                            {/* Stamp area */}
                            <div className="absolute top-4 right-4 w-18 h-20 border-[3px] border-dashed border-current/15 flex flex-col items-center justify-center opacity-40 p-1">
                                <div className="w-full h-full border border-current/10 flex items-center justify-center">
                                    <span className={`${TYPE.micro} font-mono opacity-60`}>STAMP</span>
                                </div>
                            </div>
                            <div className={`${CAPTION_CLASS} mb-4 opacity-30 tracking-[0.3em]`}>AIR MAIL</div>
                            <div className="flex-1 mt-4">
                                <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.body} font-body italic leading-[1.6] opacity-80`} placeholder="Dear..." tag="p" readOnly={readOnly} />
                            </div>
                            <div className="mt-auto space-y-4">
                                {[1,2,3].map(i => <div key={i} className="h-[1px] bg-current/10"></div>)}
                            </div>
                        </div>
                    </div>
                );

            case LayoutVariant.BOTANICAL_SKETCH:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center`}>
                        {/* Measurement marks at edges */}
                        <div className="absolute top-0 left-4 bottom-0 flex flex-col justify-between py-8 opacity-10">
                            {[...Array(10)].map((_, i) => <div key={i} className="w-3 h-[1px] bg-current"></div>)}
                        </div>
                        <div className="w-[60%] aspect-square border border-current/10 mb-6 relative overflow-hidden">
                            <SafeImage index={0} className="w-full h-full object-cover" />
                        </div>
                        <div className="text-center">
                            <EditableText value={content.split('|')[0] || content} onChange={isEditable ? (v) => updateContent(v + '|' + (content.split('|')[1]||'')) : undefined} className={`${TYPE.headlineSm} font-display italic opacity-70 mb-2`} placeholder="Camellia sinensis" tag="h3" readOnly={readOnly} />
                            <EditableText value={content.split('|')[1] || ''} onChange={isEditable ? (v) => updateContent((content.split('|')[0]||'') + '|' + v) : undefined} className={`${CAPTION_CLASS}`} placeholder="Common name" tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );

            case LayoutVariant.EPILOGUE_CENTERED:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center text-center`}>
                        <span className={`${TYPE.headlineSm} opacity-20 mb-12`}>·</span>
                        <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${TYPE.body} font-body italic opacity-70 max-w-[450px] leading-[1.7]`} placeholder="Closing text..." tag="p" readOnly={readOnly} />
                        <span className={`${TYPE.caption} font-caption mt-12 opacity-25`}>{storyTitle || 'Teajia'}</span>
                    </div>
                );

            case LayoutVariant.BACK_COVER:
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center text-center`}>
                        <div className="w-16 h-16 bg-current opacity-8 rounded-sm flex items-center justify-center mb-8">
                            <span className="text-[40px] font-display font-light opacity-30">T</span>
                        </div>
                        <span className={`${TYPE.caption} font-caption mb-2`}>Teajia Journal — Issue 03</span>
                        <span className={`${TYPE.micro} opacity-15 font-caption`}>2024</span>
                    </div>
                );

            // ===================================================================
            // NEW LAYOUT VARIANTS (Groups 16–17)
            // ===================================================================

            case LayoutVariant.SPREAD_PANORAMIC:
                return (
                    <div className={`${paperBase} bg-black relative overflow-hidden`} data-page-type="image">
                        <div className="absolute inset-0 z-0 reader-image-reveal">
                            <img
                                src={images[0] || ''}
                                className="w-full h-full object-cover object-center"
                                alt="panoramic"
                                style={{ filter: 'saturate(0.9) contrast(1.05)' }}
                            />
                        </div>
                        {/* Gradient overlay for readability */}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/20 z-[5] pointer-events-none"></div>
                        {/* Swipe hint arrow */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
                            <span className="text-white/40 text-[32px] font-light">→</span>
                        </div>
                    </div>
                );

            case LayoutVariant.PULL_QUOTE_MARGINAL:
                return (
                    <div className={`${paperBase} ${PAD.text} pt-16 grid`} data-page-type="mixed" style={{ gridTemplateColumns: '60% 40%', ...OPENTYPE }}>
                        <div className="pr-8">
                            <EditableText value={content.split('|')[0] || content} onChange={isEditable ? (v) => updateContent(v + '|' + (content.split('|')[1] || '')) : undefined} className={`${BODY_CLASS} opacity-90`} placeholder="Main body text..." tag="p" readOnly={readOnly} />
                        </div>
                        <div className="pl-6 flex items-center" style={{ marginLeft: '-1.5rem' }}>
                            <EditableText value={content.split('|')[1] || ''} onChange={isEditable ? (v) => updateContent((content.split('|')[0] || '') + '|' + v) : undefined} className={`text-[36px] ${LH.normal} font-display italic text-tea-gold font-light hang-punct`} placeholder="Pull quote here..." tag="p" readOnly={readOnly} />
                        </div>
                        <div className={getBottomTreatment(variant, theme.fadeBg)}></div>
                    </div>
                );

            case LayoutVariant.LETTERPRESS_DEBOSS: {
                const [lpTitle, lpBody] = content.split('|');
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center text-center bg-tea-surface`} data-page-type="text">
                        {/* Warm textured background */}
                        <div className="absolute inset-0 opacity-[0.04] bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>
                        <div className="relative z-10">
                            <EditableText
                                value={lpTitle || content}
                                onChange={isEditable ? (v) => updateContent(v + '|' + (lpBody || '')) : undefined}
                                className={`${TYPE.display} font-display font-bold leading-none tracking-tight mb-8`}
                                style={{ textShadow: '0 -1px 0 rgba(0,0,0,0.25), 0 1px 1px rgba(255,255,255,0.06)', marginLeft: '-2px' }}
                                placeholder="TITLE"
                                tag="h1"
                                readOnly={readOnly}
                            />
                            {lpBody && (
                                <EditableText value={lpBody} onChange={isEditable ? (v) => updateContent((lpTitle || '') + '|' + v) : undefined} className={`${TYPE.caption} uppercase tracking-[0.2em] opacity-40`} placeholder="Subtitle" tag="p" readOnly={readOnly} />
                            )}
                        </div>
                    </div>
                );
            }

            case LayoutVariant.ANNOTATED_IMAGE: {
                // Parse: IMAGE_URL||x1,y1,label1||x2,y2,label2
                const parts = content.split('||');
                const imageUrl = parts[0] || (images[0] || '');
                const annotations = parts.slice(1).map(a => {
                    const [x, y, ...labelParts] = a.split(',');
                    return { x: parseFloat(x) || 50, y: parseFloat(y) || 50, label: labelParts.join(',') || '' };
                });
                return (
                    <div className={`${paperBase} flex flex-col`} data-page-type="image">
                        <div className="flex-1 relative bg-black overflow-hidden">
                            {imageUrl ? (
                                <img src={imageUrl} className="w-full h-full object-cover reader-image-reveal" alt="annotated" />
                            ) : (
                                <SafeImage index={0} className="w-full h-full" />
                            )}
                            {/* Annotation circles */}
                            {annotations.map((ann, i) => (
                                <div key={i} className="absolute z-20 pointer-events-none" style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: 'translate(-50%, -50%)' }}>
                                    <div className="w-8 h-8 rounded-full bg-tea-gold text-tea-bg flex items-center justify-center text-[14px] font-bold shadow-lg border-2 border-tea-bg">
                                        {i + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {annotations.length > 0 && (
                            <div className={`${PAD.tight} bg-tea-surface`}>
                                <div className="space-y-2">
                                    {annotations.map((ann, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <span className="w-5 h-5 rounded-full bg-tea-gold/20 text-tea-gold flex items-center justify-center text-[12px] font-bold shrink-0">{i + 1}</span>
                                            <span className={`${TYPE.caption} ${LH.tight} opacity-70`}>{ann.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            case LayoutVariant.CONVERSATION_BUBBLE: {
                // Parse: SPEAKER_A: text\nSPEAKER_B: text\n...
                const dialogueLines = content.split('\n').filter(Boolean);
                const speakers = new Set<string>();
                dialogueLines.forEach(line => {
                    const match = line.match(/^([^:]+):/);
                    if (match) speakers.add(match[1].trim());
                });
                const speakerList = Array.from(speakers);
                return (
                    <div className={`${paperBase} ${PAD.card} pt-16 flex flex-col gap-4 overflow-hidden`} data-page-type="text" style={OPENTYPE}>
                        <div className={`${FOLIO_CLASS} mb-2`}>{storyTitle || 'Conversation'}</div>
                        <div className="flex-1 space-y-4 overflow-hidden">
                            {isEditable ? (
                                <EditableText value={content} onChange={updateContent} className={`${BODY_CLASS} opacity-90 whitespace-pre-wrap`} placeholder="SPEAKER_A: Hello\nSPEAKER_B: Hi there..." tag="p" readOnly={readOnly} />
                            ) : (
                                dialogueLines.map((line, i) => {
                                    const match = line.match(/^([^:]+):\s*(.*)/);
                                    if (!match) return null;
                                    const [, speaker, text] = match;
                                    const isFirst = speaker.trim() === speakerList[0];
                                    const initials = speaker.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
                                    return (
                                        <div key={i} className={`flex items-end gap-3 ${isFirst ? 'flex-row' : 'flex-row-reverse'}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${isFirst ? 'bg-tea-gold/20 text-tea-gold' : 'bg-tea-text/10 text-tea-text-sec'}`}>
                                                {initials}
                                            </div>
                                            <div className={`max-w-[70%] px-5 py-3 ${isFirst ? 'bg-tea-gold/8 text-tea-text' : 'bg-tea-surface text-tea-text-sec'}`}>
                                                <p className={`${TYPE.body} ${LH.relaxed} opacity-90`}>{text}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                );
            }

            case LayoutVariant.TIMELINE_VISUAL: {
                // Parse: date—event pairs, pipe separated
                const tlEvents = content.split('|').filter(Boolean);
                return (
                    <div className={`${paperBase} ${PAD.text} pt-16`} data-page-type="mixed" style={OPENTYPE}>
                        <div className={`${FOLIO_CLASS} mb-4`}>{storyTitle || 'Timeline'}</div>
                        <div className="relative pl-10 flex-1">
                            <div className="absolute left-4 top-0 bottom-0 w-[1px] bg-gradient-to-b from-tea-gold/60 via-tea-gold/30 to-transparent"></div>
                            <div className="space-y-10">
                                {tlEvents.map((event, i) => {
                                    const [date, ...descParts] = event.split('—').map(s => s.trim());
                                    const desc = descParts.join('—') || date;
                                    const isLast = i === tlEvents.length - 1;
                                    return (
                                        <div key={i} className="relative flex items-start gap-4">
                                            <div className={`absolute -left-[1.8rem] top-1.5 w-4 h-4 rounded-full ${isLast ? 'bg-tea-gold' : 'bg-tea-gold/50 border-2 border-tea-bg'} shadow-sm`}></div>
                                            <div>
                                                {descParts.length > 0 && <span className={`${TYPE.caption} ${LH.tight} font-mono opacity-40 block mb-1`}>{date}</span>}
                                                <span className={`${TYPE.body} ${LH.relaxed} font-body opacity-90`}>{descParts.length > 0 ? desc : date}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            }

            case LayoutVariant.COMPARISON_SPLIT: {
                // Parse: imageUrl1|imageUrl2|label1|label2
                const csParts = content.split('|');
                const csImg1 = csParts[0] || images[0] || '';
                const csImg2 = csParts[1] || images[1] || '';
                const csLabel1 = csParts[2] || 'Before';
                const csLabel2 = csParts[3] || 'After';
                return (
                    <div className={`${paperBase} flex`} data-page-type="image">
                        <div className="w-1/2 relative overflow-hidden bg-black">
                            {csImg1 ? <img src={csImg1} className="w-full h-full object-cover reader-image-reveal" alt={csLabel1} /> : <SafeImage index={0} className="w-full h-full" />}
                            <div className="absolute bottom-4 left-4 z-10">
                                <span className={`${CAPTION_CLASS} bg-black/60 px-3 py-1 backdrop-blur-sm text-tea-text/80`}>{csLabel1}</span>
                            </div>
                        </div>
                        <div className="w-[1px] bg-tea-gold/40 z-20 shrink-0"></div>
                        <div className="w-1/2 relative overflow-hidden bg-black">
                            {csImg2 ? <img src={csImg2} className="w-full h-full object-cover reader-image-reveal" alt={csLabel2} /> : <SafeImage index={1} className="w-full h-full" />}
                            <div className="absolute bottom-4 right-4 z-10">
                                <span className={`${CAPTION_CLASS} bg-black/60 px-3 py-1 backdrop-blur-sm text-tea-text/80`}>{csLabel2}</span>
                            </div>
                        </div>
                    </div>
                );
            }

            case LayoutVariant.STACKED_CARDS: {
                // Parse: title|subtitle pairs separated by ;;
                const cardItems = content.split(';;').filter(Boolean);
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center`} data-page-type="mixed" style={OPENTYPE}>
                        <div className="relative w-full max-w-[500px]">
                            {cardItems.map((card, i) => {
                                const [cardTitle, cardSub] = card.split('|');
                                const zIndex = cardItems.length - i;
                                const offset = i * 8;
                                return (
                                    <div
                                        key={i}
                                        className="absolute inset-x-0 bg-tea-surface border border-tea-border/20 shadow-lg p-8"
                                        style={{ top: offset, zIndex, transform: `rotate(${(i - Math.floor(cardItems.length / 2)) * 1.5}deg)` }}
                                    >
                                        <h3 className={`${TYPE.headline} font-display leading-none mb-2 opacity-90`}>{cardTitle}</h3>
                                        {cardSub && <p className={`${TYPE.caption} ${LH.tight} opacity-50`}>{cardSub}</p>}
                                    </div>
                                );
                            })}
                            {/* Spacer for absolute positioned cards */}
                            <div style={{ paddingTop: `${cardItems.length * 8 + 140}px` }}></div>
                        </div>
                    </div>
                );
            }

            case LayoutVariant.FULL_BLEED_TEXT: {
                // Position: top-left, center, bottom (from content after first ||)
                const [fbImageUrl, fbText, fbPosition = 'bottom'] = content.split('||');
                const posClass = fbPosition === 'top' ? 'items-start pt-20' : fbPosition === 'center' ? 'items-center' : 'items-end pb-16';
                const displayImg = fbImageUrl || images[0] || '';
                return (
                    <div className={`${paperBase} bg-black relative flex flex-col ${posClass} px-16`} data-page-type="image">
                        <div className="absolute inset-0 z-0 reader-image-reveal">
                            {displayImg ? <img src={displayImg} className="w-full h-full object-cover" alt="full bleed" /> : <SafeImage index={0} className="w-full h-full" />}
                        </div>
                        <div className="relative z-20 max-w-[80%]">
                            <EditableText
                                value={fbText || (isEditable ? '' : '')}
                                onChange={isEditable ? (v) => updateContent(`${fbImageUrl}||${v}||${fbPosition}`) : undefined}
                                className={`${TYPE.display} font-display text-white leading-none font-bold`}
                                style={{ textShadow: '0 4px 40px rgba(0,0,0,0.8), 0 2px 10px rgba(0,0,0,0.6)', marginLeft: '-2px' }}
                                placeholder="Display text"
                                tag="h2"
                                readOnly={readOnly}
                            />
                        </div>
                    </div>
                );
            }

            case LayoutVariant.INFOGRAPHIC_CIRCLE: {
                // Parse: title|value1,label1|value2,label2|... (values 0-100)
                const icParts = content.split('|');
                const icTitle = icParts[0] || 'Data';
                const icData = icParts.slice(1).map(p => {
                    const [val, ...labelP] = p.split(',');
                    return { value: Math.min(parseFloat(val) || 0, 100), label: labelP.join(',') };
                });
                const r = 80;
                const circumference = 2 * Math.PI * r;
                return (
                    <div className={`${paperBase} ${PAD.spacious} flex flex-col items-center justify-center`} data-page-type="mixed" style={OPENTYPE}>
                        <h2 className={`${CAPTION_CLASS} mb-10`}>{icTitle}</h2>
                        <div className="grid grid-cols-2 gap-10">
                            {icData.map((d, i) => {
                                const dashArray = `${(d.value / 100) * circumference} ${circumference}`;
                                const colors = ['text-tea-gold', 'text-tea-text-sec', 'text-tea-gold/60', 'text-tea-text/40'];
                                const strokeColors = ['var(--tea-gold)', 'var(--tea-text-sec)', 'rgba(184,146,78,0.5)', 'rgba(184,146,78,0.3)'];
                                return (
                                    <div key={i} className="flex flex-col items-center">
                                        <div className="relative w-[120px] h-[120px]">
                                            <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                                                <circle cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="opacity-10" />
                                                <circle cx="100" cy="100" r={r} fill="none" stroke={strokeColors[i % strokeColors.length]} strokeWidth="8" strokeDasharray={dashArray} strokeLinecap="round" />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className={`${TYPE.bodyLarge} font-mono font-bold ${colors[i % colors.length]}`}>{d.value.toFixed(0)}</span>
                                            </div>
                                        </div>
                                        <span className={`${TYPE.caption} ${LH.tight} text-center opacity-60 mt-2 max-w-[100px]`}>{d.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            }

            default: // Generic Fallback
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col`}>
                        <div className="mb-12 pb-6 border-b border-current/10 opacity-30">
                            <h3 className={`${TYPE.caption} uppercase tracking-[0.15em] select-none`}>{variant}</h3>
                        </div>
                        <div className="flex-1">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className={`${BODY_CLASS} leading-loose opacity-90`} placeholder="Content..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );
          }
        })()}
      </div>
    );
};
