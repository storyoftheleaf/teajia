
import React, { useState, useEffect, useRef } from 'react';
import { Story, ContentType } from '../types';
import { Icons } from './Icons';
import { LogoEmblem } from './Logos';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ShareModalProps {
  story: Story;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ story, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(true);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const shareUrl = window.location.href;
  const shareText = `Discover "${story.title}" on Teajia.`;

  const generateImage = async (elementId: string, fileName: string): Promise<File | null> => {
    const element = document.getElementById(elementId);
    // @ts-ignore
    if (!element || !window.html2canvas) return null;

    try {
      // @ts-ignore
      const canvas = await window.html2canvas(element, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      return new Promise((resolve) => {
        canvas.toBlob((blob: Blob | null) => {
          if (!blob) resolve(null);
          else resolve(new File([blob], fileName, { type: 'image/png' }));
        }, 'image/png');
      });
    } catch (e) {
      console.error("Image generation failed", e);
      return null;
    }
  };

  const handleNativeShare = async () => {
    setIsGenerating(true);
    
    // 1. Try to generate the square card image
    const file = await generateImage('share-card-preview', `teajia-${story.id}.png`);
    
    setIsGenerating(false);

    // Initialize base share data
    const shareData: any = {
      title: story.title,
    };

    // 2. Attach file if supported
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
       shareData.files = [file];
       // When sharing files, many apps (WhatsApp, Instagram) treat 'text' as the caption.
       // The 'url' field is often ignored if files are present, or worse, prevents the file from sending on some Android versions.
       // Best practice: Combine message and URL into 'text'.
       shareData.text = `${story.title} - ${story.subtitle}\n${shareUrl}`;
    } else {
       // Text-only fallback
       shareData.text = `${story.title} - ${story.subtitle}`;
       shareData.url = shareUrl;
    }

    // 3. Trigger Share
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        onClose();
      } catch (err) {
        console.log('Error sharing', err);
      }
    } else {
      // Fallback for desktop without native share: Just copy link
      handleCopy();
    }
  };

  const handleStoryShare = async () => {
      setIsGenerating(true);
      const file = await generateImage('story-format-export', `teajia-story-${story.id}.png`);
      setIsGenerating(false);

      if (!file) return;

      // If mobile, try to share the file directly (Instagram often picks this up from system sheet)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
              await navigator.share({
                  files: [file],
                  title: 'Share to Story',
                  // No text for story share usually, just image
              });
              return;
          } catch (e) {
              console.log('Native share cancelled, falling back to download');
          }
      }

      // Fallback: Download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = `teajia-story-${story.id}.png`;
      link.click();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const handleWhatsApp = () => {
    // On mobile/supported devices, use native share to allow image attachment
    if (navigator.share) {
        handleNativeShare();
    } else {
        // Desktop fallback: Text link
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-tea-bg/95 backdrop-blur-md"
        onClick={onClose}
      ></div>

      {/* Hidden Container for Story Generation (9:16 Layout) */}
      <div className="fixed left-[-9999px] top-0">
          <div id="story-format-export" className="w-[450px] h-[800px] relative bg-tea-bg flex flex-col items-center justify-center p-12 overflow-hidden">
              {/* Background */}
              <img src={story.thumbnailUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-xl" crossOrigin="anonymous" />
              <div className="absolute inset-0 bg-tea-text/20"></div>
              
              {/* Card */}
              <div className="relative z-10 bg-tea-bg p-6 shadow-2xl w-full aspect-[3/4] flex flex-col">
                  <div className="relative w-full flex-1 overflow-hidden mb-4 bg-tea-bg">
                     <img src={story.thumbnailUrl} className="w-full h-full object-cover sepia-[0.15]" crossOrigin="anonymous" />
                  </div>
                  <h2 className="text-3xl font-serif text-tea-text leading-none mb-2">{story.title}</h2>
                  <p className="text-sm font-serif italic text-tea-text/60">{story.subtitle}</p>
              </div>

              {/* Footer Brand */}
              <div className="absolute bottom-12 left-0 w-full text-center z-10">
                  <div className="flex items-center justify-center gap-2 mb-2 opacity-80">
                     <div className="w-6 h-6 bg-tea-bg rounded-lg flex items-center justify-center">
                        <span className="text-tea-text font-serif font-bold text-xs mt-0.5">T</span>
                     </div>
                     <span className="text-tea-text text-xs tracking-[0.3em] font-serif">TEAJIA</span>
                  </div>
                  <p className="text-[10px] text-tea-text/40 font-mono tracking-[0.15em]">JOURNAL OF TEA</p>
              </div>
          </div>
      </div>

      {/* Modal */}
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Share "${story.title}"`}
        className="relative w-full max-w-sm bg-tea-bg rounded-sm shadow-2xl overflow-hidden flex flex-col animate-[slideUp_0.3s_ease-out]"
      >
        {/* Header with Logo */}
        <div className="h-12 bg-tea-elevated border-b border-tea-border flex items-center px-4 justify-between">
          <LogoEmblem size={20} ariaLabel="Teajia" className="opacity-70 hover:opacity-90 transition-opacity" />
          <span className="flex-1 text-center text-tea-text/80 text-xs uppercase tracking-wider font-semibold">Share</span>
          {/* Close */}
          <button
            onClick={onClose}
            className="p-1 text-tea-text/50 hover:text-tea-text transition-colors"
          >
            <Icons.Close className="w-5 h-5" />
          </button>
        </div>

        {/* Visual Card Preview - Enhanced with more prominent preview */}
        <div id="share-card-preview" className="relative p-6 pb-8 bg-gradient-to-b from-tea-bg to-tea-surface border-b border-tea-text/10 flex flex-col items-center text-center">
           <div className="absolute inset-0 opacity-[0.05] mix-blend-multiply pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}></div>

           {/* Featured Article Preview */}
           <div className="w-full mb-4">
             <div className="bg-tea-surface rounded-sm shadow-md overflow-hidden border border-tea-border">
               {/* Image Section */}
               <div className="w-full h-32 bg-tea-bg overflow-hidden relative">
                 {story.thumbnailUrl ? (
                   <img src={story.thumbnailUrl} className="w-full h-full object-cover sepia-[0.15]" alt="story" crossOrigin="anonymous" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center bg-tea-elevated"><Icons.Seal className="w-8 h-8 text-tea-text/30" /></div>
                 )}
               </div>
               {/* Content Section */}
               <div className="p-4">
                 <h3 className="text-lg font-serif text-tea-text font-bold leading-tight mb-2 line-clamp-2">{story.title}</h3>
                 <p className="text-sm font-serif italic text-tea-text/70 line-clamp-2">{story.subtitle}</p>
                 <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-tea-text/50">
                   <Icons.Seal className="w-3 h-3" />
                   <span>Teajia Journal</span>
                 </div>
               </div>
             </div>
           </div>

           {/* Share Info Text */}
           <span className="text-[10px] uppercase tracking-[0.2em] text-tea-text-light/50">Tap below to share this story</span>
        </div>

        {/* Actions */}
        <div className="p-6 bg-tea-bg space-y-3 relative">
           
           {/* Loading Overlay */}
           {isGenerating && (
              <div className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm z-30 flex items-center justify-center">
                  <div className="flex flex-col items-center">
                      <div className="w-6 h-6 border-2 border-tea-text/20 border-t-tea-text rounded-full animate-spin mb-2"></div>
                      <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text/60">Preparing Leaf...</span>
                  </div>
              </div>
           )}

           {/* 1. Native Share / Mobile Priority */}
           <button 
             onClick={handleNativeShare}
             className="w-full py-3.5 bg-tea-bg text-tea-text flex items-center justify-center gap-3 hover:bg-tea-elevated transition-colors shadow-lg group"
           >
             <Icons.Share className="w-4 h-4 group-hover:scale-110 transition-transform" />
             <span className="text-xs uppercase tracking-[0.15em]">Share</span>
           </button>

           {/* 2. Story / Visual Share */}
           <button
             onClick={handleStoryShare}
             className="w-full py-3 bg-tea-text/5 border border-tea-text/10 text-tea-text flex items-center justify-center gap-2 hover:bg-tea-text/10 transition-colors"
           >
             <Icons.Instagram className="w-4 h-4 text-tea-text/70" />
             <span className="text-[10px] uppercase tracking-[0.15em] font-medium">Share to Story</span>
           </button>

           {/* 3. Desktop / Direct Links Grid - with platform colors */}
           <div className="grid grid-cols-3 gap-3 pt-2">
              {/* Copy Link Button */}
              <button
                onClick={handleCopy}
                className={`flex flex-col items-center justify-center p-3 border-2 rounded-sm transition-all duration-300 gap-2 h-20 group ${
                  copied
                    ? 'bg-tea-green/10 border-tea-green text-tea-green'
                    : 'border-tea-text/20 hover:border-tea-text/40 hover:bg-tea-text/5'
                }`}
              >
                {copied ? <Icons.Check className="w-5 h-5" /> : <Icons.Link className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                <span className="text-[9px] uppercase tracking-wider font-semibold">{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>

              {/* Twitter Button */}
              <button
                onClick={handleTwitter}
                className="flex flex-col items-center justify-center p-3 border-2 border-tea-text/20 hover:border-tea-text/40 bg-tea-text/5 hover:bg-tea-text/10 transition-all duration-300 gap-2 h-20 group rounded-sm"
              >
                <Icons.Twitter className="w-5 h-5 text-tea-text/60 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] uppercase tracking-wider font-semibold text-tea-text/70">Post</span>
              </button>

              {/* WhatsApp Button */}
              <button
                onClick={handleWhatsApp}
                className="flex flex-col items-center justify-center p-3 border-2 border-tea-text/20 hover:border-tea-text/40 bg-tea-text/5 hover:bg-tea-text/10 transition-all duration-300 gap-2 h-20 group rounded-sm"
              >
                <Icons.Message className="w-5 h-5 text-tea-text/60 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] uppercase tracking-wider font-semibold text-tea-text/70">Chat</span>
              </button>
           </div>

           {/* Optional: Share Count Info */}
           <div className="pt-3 border-t border-tea-text/10 text-center">
             <p className="text-[9px] uppercase tracking-wider text-tea-text/50">
               Share this story with your tea community
             </p>
           </div>

        </div>
      </div>
    </div>
  );
};
