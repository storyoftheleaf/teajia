
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutVariant, Story } from '../types';
import { Icons } from './Icons';
import { SkeletonLoader } from './shared/SkeletonLoader';
import { sanitizeHTML } from '../utils/sanitize';

export interface PageData {
  variant: LayoutVariant;
  content?: string;
  title?: string;
  images?: string[];
  index: number;
  textColor?: 'light' | 'dark';
  // Video support
  videoId?: string;         // YouTube video ID
  instagramId?: string;     // Instagram Reel shortcode
  videoCaption?: string;
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
  .rich-text-content:empty:before {
    content: attr(placeholder);
    opacity: 0.4;
    pointer-events: none;
    display: block; 
  }
`;

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
        <div className="flex gap-1 border-r border-tea-gold/10 pr-2 mr-1">
            <button onClick={() => onFormat('font', 'font-serif')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-paper/70 hover:text-tea-paper" title="Serif"><span className="font-serif text-sm">S</span></button>
            <button onClick={() => onFormat('font', 'font-sans')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-paper/70 hover:text-tea-paper" title="Sans"><span className="font-sans text-sm">S</span></button>
            <button onClick={() => onFormat('font', 'font-mono')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-paper/70 hover:text-tea-paper" title="Mono"><span className="font-mono text-sm">M</span></button>
        </div>
        <div className="flex gap-1 border-r border-tea-gold/10 pr-2 mr-1">
            <button onClick={() => onFormat('weight', 'font-bold')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-paper/70 hover:text-tea-paper font-bold text-sm">B</button>
            <button onClick={() => onFormat('style', 'italic')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-paper/70 hover:text-tea-paper italic font-serif text-sm">I</button>
        </div>
        <div className="flex gap-1">
             <button onClick={() => onFormat('size', 'text-2xl')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-paper/70 hover:text-tea-paper text-xs">S</button>
             <button onClick={() => onFormat('size', 'text-4xl')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-paper/70 hover:text-tea-paper text-sm">M</button>
             <button onClick={() => onFormat('size', 'text-6xl')} className="p-2 hover:bg-tea-gold/10 rounded-sm text-tea-paper/70 hover:text-tea-paper text-base">L</button>
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpdate) {
      const reader = new FileReader();
      reader.onloadend = () => onImageUpdate(index, reader.result as string);
      reader.readAsDataURL(file);
    }
  };

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
          className="w-full h-full object-cover transition-opacity duration-300"
          style={{opacity: imageLoading ? 0.5 : 1}}
          alt={`img-${index}`}
          onLoad={() => setImageLoading(false)}
          onError={() => setImageLoading(false)}
        />
      ) : (
        <div className={`w-full h-full bg-black/5 flex items-center justify-center ${readOnly ? 'opacity-50' : ''}`}>
          <Icons.Camera className="w-12 h-12 opacity-20" />
        </div>
      )}

      {/* Edit overlay for editable mode */}
      {onImageUpdate && !readOnly && (
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30">
          <Icons.Camera className="w-10 h-10 text-tea-paper" />
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
      bg: isDarkText ? 'bg-tea-bg' : 'bg-tea-bg',
      text: isDarkText ? 'text-tea-text' : 'text-tea-paper',
      subtext: isDarkText ? 'text-tea-text/60' : 'text-tea-paper/60',
      border: isDarkText ? 'border-tea-text/10' : 'border-tea-gold/10',
      softBg: isDarkText ? 'bg-tea-text/5' : 'bg-tea-gold/5',
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
    const paperBase = `w-full h-full ${theme.bg} ${theme.text} overflow-hidden relative font-serif transition-colors duration-300 ${readOnly ? 'pointer-events-none' : ''}`;
    
    // Standard Padding - Adjusted for 800px scale
    const STD_PAD = "p-16"; 

    return (
      <div key={page.index} className="w-full h-full relative group/page overflow-hidden">
        <style>{ANIMATION_STYLES}</style>
        {isEditable && !readOnly && (<button onClick={toggleColor} onMouseDown={(e) => e.stopPropagation()} className="absolute top-4 right-4 z-modal p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-tea-paper border border-tea-gold/10 opacity-0 group-hover/page:opacity-100 transition-all"><Icons.Sun className="w-5 h-5" /></button>)}
        <div className="absolute inset-0 pointer-events-none z-[5] opacity-[0.05] mix-blend-overlay"><div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div></div>

        {(() => {
          switch (variant) {
            // --- COVERS ---
            case LayoutVariant.COVER_MAIN:
                return (
                    <div className={`${paperBase} flex flex-col justify-between ${STD_PAD}`}>
                        <div className="absolute inset-0 z-0"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className={`absolute bottom-0 left-0 w-full h-2/3 bg-gradient-to-t from-black/90 to-transparent z-10 pointer-events-none`}></div>
                        <div className="relative z-20 border-t border-tea-gold/20 pt-6 flex justify-between items-center mt-auto mb-8">
                            <div className="w-12 h-12 bg-tea-bg text-black flex items-center justify-center font-bold text-xl">T</div>
                            <span className="text-2xl uppercase tracking-[0.3em] text-tea-paper opacity-80">Journal</span>
                        </div>
                        <div className="relative z-20 pb-8">
                            <EditableText value={storyTitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('title', val) : undefined} className="text-8xl font-serif tracking-tight leading-[0.9] mb-6 text-tea-paper" placeholder="Title" tag="h1" readOnly={readOnly} />
                            <EditableText value={storySubtitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('subtitle', val) : undefined} className="text-4xl italic font-serif text-tea-paper/80" placeholder="Subtitle" tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );
            case LayoutVariant.COVER_TYPOGRAPHIC:
                return (
                    <div className={`${paperBase} ${isDarkText ? 'bg-tea-bg text-tea-gold' : 'bg-tea-gold text-tea-paper'} ${STD_PAD} flex flex-col justify-center`}>
                        <div className="flex-1 flex items-center"><EditableText value={storyTitle || 'Title'} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('title', val) : undefined} className="text-[120px] font-serif leading-[0.8] tracking-tighter uppercase opacity-90 break-words w-full" placeholder="TITLE" tag="h1" readOnly={readOnly} /></div>
                        <div className="border-t-4 border-current/20 pt-8"><EditableText value={storySubtitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('subtitle', val) : undefined} className="text-5xl font-serif italic opacity-80" placeholder="Subtitle" tag="p" readOnly={readOnly} /></div>
                    </div>
                );
            case LayoutVariant.COVER_MINIMAL:
                return (
                    <div className={`${paperBase} flex flex-col items-center justify-center ${STD_PAD} text-center border-[20px] ${isDarkText ? 'border-tea-border' : 'border-tea-border'}`}>
                        <div className={`w-[2px] h-32 ${theme.border} bg-current mb-12 opacity-20`}></div>
                        <EditableText value={storyTitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('title', val) : undefined} className="text-7xl font-serif mb-6 tracking-wide leading-tight" placeholder="Title" tag="h1" readOnly={readOnly} />
                        <EditableText value={storySubtitle || ''} onChange={isEditable && onStoryUpdate ? (val) => onStoryUpdate('subtitle', val) : undefined} className={`text-2xl uppercase tracking-[0.3em] ${theme.subtext}`} placeholder="Subtitle" tag="p" readOnly={readOnly} />
                    </div>
                );

            // --- TEXT LAYOUTS (Standard Body: 3xl) ---
            // Use flex-start (top) for main text to avoid center-overflow issues
            case LayoutVariant.TEXT_SINGLE_COL:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col justify-start pt-32`}>
                        <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-4xl leading-relaxed text-justify opacity-90 font-serif indent-20" placeholder="Start writing..." tag="p" readOnly={readOnly} />
                    </div>
                );
            case LayoutVariant.TEXT_DOUBLE_COL:
                return (
                    <div className={`${paperBase} ${STD_PAD} pt-24`}>
                         <div className="columns-2 gap-12 h-full text-justify [column-fill:auto]">
                             <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-3xl leading-relaxed opacity-90 font-serif" placeholder="Double column text..." tag="p" readOnly={readOnly} />
                         </div>
                    </div>
                );
            case LayoutVariant.TEXT_DROP_CAP:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col justify-center`}>
                        <div className="relative">
                            <span className={`float-left text-[160px] font-serif leading-[0.8] pr-8 pt-2 ${theme.seal}`}>{content.charAt(0) || "T"}</span>
                            <EditableText value={content.slice(1)} onChange={isEditable ? (v) => updateContent(content.charAt(0) + v) : undefined} className="text-4xl leading-loose text-justify opacity-90 font-serif" placeholder="he story begins..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );
            case LayoutVariant.TEXT_SIDEBAR_RIGHT:
                return (
                    <div className={`${paperBase} flex h-full`}>
                        <div className={`w-2/3 ${STD_PAD} pt-32 border-r ${theme.border}`}>
                             <EditableText value={content.split('|')[0] || content} onChange={isEditable ? (v) => updateContent(v + '|' + (content.split('|')[1] || '')) : undefined} className="text-4xl leading-relaxed text-justify opacity-90" placeholder="Main text..." tag="p" readOnly={readOnly} />
                        </div>
                        <div className={`w-1/3 p-12 ${theme.softBg} flex flex-col justify-center text-center`}>
                             <div className={`w-12 h-[1px] ${theme.border} bg-current mx-auto mb-8 opacity-30`}></div>
                             <EditableText value={content.split('|')[1] || ''} onChange={isEditable ? (v) => updateContent((content.split('|')[0] || '') + '|' + v) : undefined} className="text-3xl italic opacity-80 leading-relaxed" placeholder="Sidebar note..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );
            case LayoutVariant.TEXT_VERTICAL_CJK:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-row-reverse items-start justify-center pt-24`}>
                         <div className="h-[85%] writing-vertical text-4xl font-serif leading-[3rem] tracking-[0.15em] text-justify opacity-90">
                             <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="" placeholder="Vertical text..." tag="p" readOnly={readOnly} />
                         </div>
                    </div>
                );
            case LayoutVariant.TEXT_JUSTIFIED_NARROW:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex items-center justify-center`}>
                        <div className="max-w-[70%]">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-3xl leading-loose text-justify font-serif" placeholder="Narrow text..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );

            case LayoutVariant.QUOTE_BIG:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex items-center justify-center text-center`}>
                        <div className="w-full px-8">
                            <div className={`w-24 h-[2px] bg-current mx-auto mb-12 opacity-20`}></div>
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-6xl font-serif italic leading-tight" placeholder="Quote goes here..." tag="p" readOnly={readOnly} />
                            <div className={`w-24 h-[2px] bg-current mx-auto mt-12 opacity-20`}></div>
                        </div>
                    </div>
                );
            case LayoutVariant.CHAPTER_BOLD:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col justify-center pl-24`}>
                        <span className="text-2xl uppercase tracking-[0.2em] opacity-50 mb-8 block">Chapter</span>
                        <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-[150px] font-serif font-bold leading-none mb-12" placeholder="01" tag="h1" readOnly={readOnly} />
                         <div className={`w-32 h-3 bg-tea-gold opacity-80`}></div>
                    </div>
                );
            case LayoutVariant.POEM_CENTERED:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex items-center justify-center`}>
                         <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-4xl font-serif italic leading-[2.5] text-center whitespace-pre-wrap" placeholder="Poem lines..." tag="p" readOnly={readOnly} />
                    </div>
                );
            case LayoutVariant.DEFINITION_LARGE:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col justify-center pl-24`}>
                         <EditableText value={content.split('|')[0] || ''} onChange={isEditable ? (v) => updateContent(v + '|' + (content.split('|')[1] || '')) : undefined} className="text-8xl font-serif font-bold mb-4 leading-none" placeholder="Word" tag="h2" readOnly={readOnly} />
                         <div className="text-3xl font-mono opacity-50 mb-12">[noun]</div>
                         <EditableText value={content.split('|')[1] || ''} onChange={isEditable ? (v) => updateContent((content.split('|')[0] || '') + '|' + v) : undefined} className="text-4xl leading-relaxed opacity-90 max-w-2xl" placeholder="Definition..." tag="p" readOnly={readOnly} />
                    </div>
                );
            case LayoutVariant.STAT_BIG_NUMBER:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col items-center justify-center`}>
                         <EditableText value={content.split('|')[0] || ''} onChange={isEditable ? (v) => updateContent(v + '|' + (content.split('|')[1] || '')) : undefined} className="text-[240px] font-serif font-bold opacity-10 leading-none select-none" placeholder="00" tag="h1" readOnly={readOnly} />
                         <EditableText value={content.split('|')[1] || ''} onChange={isEditable ? (v) => updateContent((content.split('|')[0] || '') + '|' + v) : undefined} className="text-4xl uppercase tracking-[0.3em] -mt-20 z-10 text-center font-bold" placeholder="LABEL" tag="p" readOnly={readOnly} />
                    </div>
                );

            // --- IMAGE LAYOUTS ---
            case LayoutVariant.IMG_FULL_BLEED:
                return (
                    <div className={`${paperBase} bg-black`}>
                        <div className="absolute inset-0 z-0"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="absolute bottom-0 left-0 w-full p-12 pt-32 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none">
                            <div className={readOnly ? "" : "pointer-events-auto"}><EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-2xl uppercase tracking-[0.15em] text-tea-paper/90" placeholder="Caption" tag="span" readOnly={readOnly} /></div>
                        </div>
                    </div>
                );
            case LayoutVariant.IMG_FULL_BLEED_TITLE:
                return (
                    <div className={`${paperBase} bg-black`}>
                         <div className="absolute inset-0 z-0"><SafeImage index={0} className="w-full h-full" /></div>
                         <div className="absolute inset-0 bg-black/30 z-10"></div>
                         <div className="absolute inset-0 z-20 flex items-center justify-center p-12 text-center pointer-events-none">
                              <div className={`bg-black/40 backdrop-blur-md p-16 border border-tea-gold/15 ${readOnly ? '' : 'pointer-events-auto'}`}>
                                  <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-7xl font-serif text-tea-paper tracking-wide leading-tight" placeholder="Title Overlay" tag="h2" readOnly={readOnly} />
                              </div>
                         </div>
                    </div>
                );
            case LayoutVariant.IMG_SPLIT_VERTICAL:
                return (
                    <div className={`${paperBase} flex flex-col`}>
                        <div className={`h-[55%] w-full relative ${theme.softBg} overflow-hidden`}><SafeImage index={0} className="w-full h-full" /></div>
                        <div className={`h-[45%] w-full ${STD_PAD} flex items-center`}><EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-3xl leading-relaxed text-justify opacity-90" placeholder="Description..." tag="p" readOnly={readOnly} /></div>
                    </div>
                );
            case LayoutVariant.IMG_SPLIT_HORIZONTAL:
                return (
                    <div className={`${paperBase} flex flex-col`}>
                         <div className={`h-1/2 w-full relative overflow-hidden`}><SafeImage index={0} className="w-full h-full" /></div>
                         <div className={`h-1/2 w-full ${STD_PAD} flex flex-col justify-center bg-tea-gold/5`}>
                              <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-3xl leading-loose text-justify opacity-90" placeholder="Text below image..." tag="p" readOnly={readOnly} />
                         </div>
                    </div>
                );
            case LayoutVariant.IMG_GRID_MONDRIAN:
                return (
                    <div className={`${paperBase} grid grid-cols-2 grid-rows-2 h-full gap-2 bg-tea-gold/10`}>
                        <div className="row-span-2 relative bg-black"><SafeImage index={0} className="w-full h-full" /></div>
                        <div className="relative bg-black"><SafeImage index={1} className="w-full h-full" /></div>
                        <div className={`relative ${theme.bg} flex items-center justify-center p-8 text-center`}>
                             <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-xl uppercase tracking-[0.15em] opacity-80" placeholder="GRID CAPTION" tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );
            
            case LayoutVariant.IMG_CIRCLE_MASK:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col items-center justify-center`}>
                        <div className="w-[80%] aspect-square relative mb-16 shrink-0">
                             <div className="absolute inset-0 rounded-full overflow-hidden border-4 border-current/10 shadow-inner bg-black/5">
                                 <SafeImage index={0} className="w-full h-full object-cover scale-105" />
                             </div>
                        </div>
                        <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-4xl leading-relaxed text-center font-serif italic max-w-lg mx-auto opacity-90" placeholder="Caption..." tag="p" readOnly={readOnly} />
                    </div>
                );

            case LayoutVariant.IMG_ARCH_MASK:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col items-center justify-center`}>
                        <div className="w-[85%] aspect-[3/4] relative mb-12 shrink-0">
                             <div className="absolute inset-0 rounded-t-[2000px] overflow-hidden border-x-4 border-t-4 border-current/10 shadow-sm bg-black/5">
                                 <SafeImage index={0} className="w-full h-full object-cover" />
                             </div>
                        </div>
                        <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-3xl leading-relaxed text-center font-serif max-w-lg mx-auto opacity-90" placeholder="Caption..." tag="p" readOnly={readOnly} />
                    </div>
                );

            case LayoutVariant.IMG_FILM_STRIP_VERTICAL:
                return (
                    <div className={`${paperBase} py-16 px-8 flex flex-col items-center overflow-hidden`}>
                         <div className="flex flex-col gap-8 w-[70%] mb-12 shrink-0">
                             {[0, 1, 2].map(i => (
                                 <div key={i} className="aspect-[3/2] bg-black p-4 shadow-lg shrink-0">
                                     <div className="w-full h-full relative overflow-hidden bg-tea-gold/10">
                                         <SafeImage index={i} className="w-full h-full object-cover" />
                                     </div>
                                 </div>
                             ))}
                         </div>
                         <div className="w-[80%] text-center">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-2xl uppercase tracking-[0.15em] opacity-80" placeholder="Strip Caption" tag="p" readOnly={readOnly} />
                         </div>
                    </div>
                );

            case LayoutVariant.CHAPTER_SPLIT:
                const [chTitle, chSub] = content.split('|');
                return (
                    <div className={`${paperBase} flex flex-col`}>
                         <div className={`h-[45%] ${theme.softBg} flex items-end p-16 pb-8 border-b border-current/5`}>
                             <EditableText value={chTitle || content} onChange={isEditable ? (v) => updateContent(v + '|' + (chSub||'')) : undefined} className="text-9xl font-serif font-bold leading-none" placeholder="Chapter" tag="h1" readOnly={readOnly} />
                         </div>
                         <div className="h-[55%] p-16 pt-12">
                             <EditableText value={chSub || ''} onChange={isEditable ? (v) => updateContent((chTitle||'') + '|' + v) : undefined} className="text-3xl uppercase tracking-[0.2em] opacity-60" placeholder="Subtitle" tag="p" readOnly={readOnly} />
                             <div className="w-32 h-3 bg-current mt-16 opacity-20"></div>
                         </div>
                    </div>
                );

            case LayoutVariant.TOC_MINIMAL:
                const chapters = content.split('|');
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col justify-center`}>
                         <h2 className="text-2xl uppercase tracking-[0.3em] mb-24 text-center opacity-50 border-b border-current/10 pb-8 mx-12">Contents</h2>
                         <div className="space-y-12 px-8">
                             {isEditable ? (
                                 <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-3xl leading-loose" placeholder="Chapter 1|Chapter 2..." tag="div" readOnly={readOnly} />
                             ) : (
                                 chapters.map((chap, i) => (
                                     <div key={i} className="flex items-baseline justify-between border-b border-current/10 pb-4">
                                         <span className="font-serif text-4xl italic opacity-90">{chap}</span>
                                         <span className="font-mono text-2xl opacity-40">0{i+1}</span>
                                     </div>
                                 ))
                             )}
                         </div>
                    </div>
                );

            case LayoutVariant.QUOTE_MINIMAL:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex items-center justify-center text-center`}>
                        <div className="max-w-[85%]">
                            <span className="text-9xl opacity-20 font-serif block mb-12 leading-none">“</span>
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-5xl font-serif italic leading-relaxed" placeholder="Quote..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );

            case LayoutVariant.COPYRIGHT_PAGE:
            case LayoutVariant.CREDITS_PAGE:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col justify-end text-center pb-24`}>
                         <div className="w-16 h-16 bg-current mx-auto mb-16 mask-icon-seal opacity-20 rounded-full"></div>
                         <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-2xl leading-loose uppercase tracking-[0.15em] opacity-60 font-sans" placeholder="Credits..." tag="div" readOnly={readOnly} />
                    </div>
                );

            case LayoutVariant.MAP_CARTOGRAPHY:
                return (
                    <div className={`${paperBase} flex flex-col`}>
                         <div className="flex-1 relative bg-tea-surface text-tea-text p-12 flex items-center justify-center overflow-hidden">
                             <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/notebook.png')]"></div>
                             <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
                                 <path d="M0,50 Q25,40 50,50 T100,50" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
                                 <path d="M20,0 Q30,50 20,100" fill="none" stroke="currentColor" strokeWidth="0.5" />
                                 <path d="M80,0 Q70,50 80,100" fill="none" stroke="currentColor" strokeWidth="0.5" />
                             </svg>
                             <div className="relative z-10 text-center bg-tea-surface/60 backdrop-blur-sm p-16 border border-tea-border shadow-sm rounded-sm">
                                 <Icons.Grid className="w-16 h-16 mx-auto mb-6 opacity-50" />
                                 <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-5xl font-serif tracking-[0.15em] uppercase font-bold" placeholder="Location Name" tag="h2" readOnly={readOnly} />
                                 <p className="text-2xl font-mono mt-6 opacity-60">32.4° N, 118.2° E</p>
                             </div>
                         </div>
                    </div>
                );

            case LayoutVariant.RECIPE_CARD:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex items-center justify-center`}>
                         <div className={`w-full border-4 border-current/20 p-16 relative`}>
                             <div className={`absolute -top-6 left-1/2 -translate-x-1/2 px-8 ${theme.bg} text-2xl uppercase tracking-[0.15em] border-x-4 border-current/10`}>Brewing Guide</div>
                             <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-3xl font-serif leading-loose whitespace-pre-wrap" placeholder="1. Boil water..." tag="div" readOnly={readOnly} />
                         </div>
                    </div>
                );

            case LayoutVariant.TEXT_INVERTED:
                return (
                    <div className={`w-full h-full ${!isDarkText ? 'bg-tea-bg text-black' : 'bg-black text-tea-text'} ${STD_PAD} flex flex-col justify-center items-center text-center`}>
                         <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-4xl font-serif leading-relaxed" placeholder="Inverted text..." tag="p" readOnly={readOnly} />
                    </div>
                );

            case LayoutVariant.NEXT_READS:
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col`}>
                        <div className="mb-12 border-b border-current/10 pb-6 flex justify-between items-end">
                            <h2 className="text-xl uppercase tracking-[0.25em] opacity-60">Journal Index</h2>
                            <span className="text-xs font-mono opacity-40">Issue 03</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto no-scrollbar">
                            <div className="flex flex-col">
                                {recommendations?.map((story, i) => (
                                    <div 
                                        key={story.id} 
                                        onClick={() => onNavigate && onNavigate(story)}
                                        className="group cursor-pointer py-6 border-b border-current/5 flex items-start gap-6 hover:pl-4 transition-all duration-300"
                                    >
                                        <span className="font-mono text-sm opacity-30 pt-1">{(i + 1).toString().padStart(2, '0')}</span>
                                        <h3 className="text-3xl md:text-4xl font-serif leading-tight group-hover:text-tea-gold transition-colors">
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
                            <h2 className="text-2xl uppercase tracking-[0.25em] opacity-60">Curated Reads</h2>
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
                                        <h3 className="text-2xl font-serif leading-snug group-hover:text-tea-gold transition-colors">
                                            {link.title}
                                        </h3>
                                        <Icons.ExternalLink className="w-5 h-5 opacity-40 group-hover:opacity-80 flex-shrink-0 mt-1" />
                                    </div>
                                    {link.source && (
                                        <div className={`text-sm uppercase tracking-[0.15em] ${theme.subtext} mb-3`}>
                                            {link.source}
                                        </div>
                                    )}
                                    {link.note && (
                                        <p className={`text-xl leading-relaxed ${theme.subtext} italic font-serif`}>
                                            "{link.note}"
                                        </p>
                                    )}
                                </a>
                            )) : (
                                <div className="text-center py-12 opacity-40">
                                    <Icons.Link className="w-12 h-12 mx-auto mb-4" />
                                    <p className="text-xl">Add curated links in format:</p>
                                    <p className="text-sm font-mono mt-2">title|url|source|note,...</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-auto pt-8 text-center">
                            <p className={`text-sm uppercase tracking-[0.15em] ${theme.subtext}`}>
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
                    <div className={`${paperBase} ${STD_PAD} flex flex-col justify-start pt-16`}>
                        {/* Text above video */}
                        {textAbove && (
                            <div className="mb-8">
                                <EditableText
                                    value={textAbove}
                                    onChange={isEditable ? (v) => updateContent(v + '|' + textBelow) : undefined}
                                    className="text-3xl leading-relaxed text-justify opacity-90 font-serif"
                                    placeholder="Text above video..."
                                    tag="p"
                                    readOnly={readOnly}
                                />
                            </div>
                        )}

                        {/* Video embed */}
                        {hasVideo ? (
                            <div className={`w-full flex justify-center ${isVertical ? 'my-4' : 'my-6'}`}>
                                <VideoEmbed
                                    videoId={videoId}
                                    instagramId={instagramId}
                                    isVertical={isVertical}
                                    className={isVertical ? 'w-[55%] rounded-sm shadow-lg' : 'w-full rounded-sm shadow-lg'}
                                />
                            </div>
                        ) : (
                            <div className={`w-full flex justify-center my-6`}>
                                <div className={`${isVertical ? 'w-[60%] aspect-[9/16]' : 'w-full aspect-video'} bg-black/10 rounded-sm flex items-center justify-center border-2 border-dashed border-current/20`}>
                                    <div className="text-center opacity-40">
                                        <Icons.Play className="w-12 h-12 mx-auto mb-2" />
                                        <span className="text-sm uppercase tracking-[0.15em]">Video ID required</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Video caption */}
                        {videoCaption && (
                            <p className={`text-center text-xl italic ${theme.subtext} mb-6 font-serif`}>
                                {videoCaption}
                            </p>
                        )}

                        {/* Text below video */}
                        {textBelow && (
                            <div className="mt-4">
                                <EditableText
                                    value={textBelow}
                                    onChange={isEditable ? (v) => updateContent(textAbove + '|' + v) : undefined}
                                    className="text-3xl leading-relaxed text-justify opacity-90 font-serif"
                                    placeholder="Text below video..."
                                    tag="p"
                                    readOnly={readOnly}
                                />
                            </div>
                        )}
                    </div>
                );
            }

            default: // Generic Fallback
                return (
                    <div className={`${paperBase} ${STD_PAD} flex flex-col`}>
                        <div className="mb-12 pb-6 border-b border-current/10 opacity-30">
                            <h3 className="text-xl uppercase tracking-[0.15em] select-none">{variant}</h3>
                        </div>
                        <div className="flex-1">
                            <EditableText value={content} onChange={isEditable ? updateContent : undefined} className="text-4xl leading-loose text-justify opacity-90" placeholder="Content..." tag="p" readOnly={readOnly} />
                        </div>
                    </div>
                );
          }
        })()}
      </div>
    );
};
