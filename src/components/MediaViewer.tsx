
import React, { useState, useEffect } from 'react';
import { Story, ContentType } from '../types';
import { Icons } from './Icons';

interface MediaViewerProps {
  story: Story;
  onBack: () => void;
  onShare?: (story: Story) => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  enableKeyboard?: boolean;
}

// --- Shared Components ---

const DesktopSidebar: React.FC<{ story: Story; onBack: () => void; onShare?: () => void; isSaved?: boolean; onToggleSave?: () => void }> = ({ story, onBack, onShare, isSaved, onToggleSave }) => (
  <aside className="w-24 xl:w-32 h-full bg-tea-moss text-tea-paper flex flex-col items-center py-10 relative shadow-[4px_0_15px_rgba(0,0,0,0.5)] z-30 shrink-0">
    {/* Back Button - Moved to Top */}
    <button 
      onClick={onBack}
      className="mb-8 p-3 rounded-full hover:bg-white/10 transition-colors group"
      title="Exit View"
    >
      <Icons.Back className="w-6 h-6 text-tea-paper/70 group-hover:text-tea-paper" />
    </button>

    {/* Vertical Title */}
    <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
      <h1 className="writing-vertical text-2xl xl:text-4xl font-serif tracking-[0.15em] uppercase text-tea-paper whitespace-nowrap leading-normal truncate-vertical py-4">
        {story.title}
      </h1>
    </div>
    
    {/* Interaction Column - Bottom */}
    <div className="mt-8 mb-0 flex flex-col space-y-6 items-center pt-4 border-t border-white/10 w-12">
         {onToggleSave && (
             <button onClick={onToggleSave} className={`p-2 rounded-full transition-colors ${isSaved ? 'text-tea-gold' : 'text-tea-paper/40 hover:text-white'}`} title="Collect">
               <Icons.Leaf filled={isSaved} className="w-5 h-5" />
             </button>
         )}
         <button onClick={onShare} className="p-2 rounded-full text-tea-paper/40 hover:text-tea-paper transition-colors" title="Share">
           <Icons.Share className="w-5 h-5" />
         </button>
    </div>
  </aside>
);

const MobileHeader: React.FC<{ title: string; onBack: () => void; transparent?: boolean }> = ({ title, onBack, transparent }) => (
  <header className={`absolute top-0 left-0 w-full z-50 flex items-center justify-between px-4 h-16 transition-all duration-300 ${transparent ? 'bg-gradient-to-b from-black/80 to-transparent' : 'bg-tea-moss shadow-lg'}`}>
    <button onClick={onBack} className="p-2 opacity-90 hover:opacity-100 text-tea-paper">
      <Icons.Back className="w-6 h-6" />
    </button>
    {!transparent && (
       <h1 className="text-xs uppercase tracking-[0.2em] font-serif text-tea-paper opacity-90 truncate max-w-[200px]">
         {title}
       </h1>
    )}
    <div className="w-10"></div>
  </header>
);

// --- Layouts ---

// 1. REEL LAYOUT (Vertical Video - Instagram Support)
const ReelLayout: React.FC<{ story: Story; isMobile: boolean; onBack: () => void; onShare?: () => void; isSaved?: boolean; onToggleSave?: () => void }> = ({ story, isMobile, onBack, onShare, isSaved, onToggleSave }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const hasEmbed = !!story.externalId;

  // Logic to handle external platforms
  const renderPlayer = () => {
    if (isPlaying && hasEmbed) {
      if (story.platform === 'Instagram') {
         return (
            <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
               <iframe 
                 src={`https://www.instagram.com/reel/${story.externalId}/embed/`}
                 className="w-full h-full border-0 min-h-[100%]"
                 scrolling="no"
                 allowTransparency={true}
                 allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                 title={story.title}
                 style={{ aspectRatio: '9/16' }}
               ></iframe>
            </div>
         );
      }
      // Fallback for YouTube if configured as Reel
      if (story.platform === 'YouTube') {
         // Use safe origin handling
         const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : undefined;
         const originParam = origin ? `&origin=${origin}` : '';
         
         return (
            <iframe 
              width="100%" 
              height="100%" 
              src={`https://www.youtube.com/embed/${story.externalId}?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1${originParam}`}
              title="YouTube video player" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              allowFullScreen
              className="w-full h-full"
            ></iframe>
         );
      }
    }

    // Default / Thumbnail State
    return (
        <>
            <img src={story.thumbnailUrl} className="w-full h-full object-cover opacity-60" alt="bg" />
            <div className="absolute inset-0 flex items-center justify-center">
                <button 
                    onClick={() => setIsPlaying(true)}
                    className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-transform cursor-pointer group"
                >
                    <Icons.Play className="w-8 h-8 text-tea-paper ml-1 group-hover:text-tea-paper" />
                </button>
            </div>
        </>
    );
  };

  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-black z-[60]">
        {/* Video Background */}
        <div className="absolute inset-0 bg-zinc-900">
           {renderPlayer()}
        </div>
        
        {/* Overlays - Hide when playing to avoid covering controls */}
        {!isPlaying && <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none"></div>}
        
        <MobileHeader title={story.title} onBack={onBack} transparent />
        
        {/* Mobile Side Actions - Hide during play if it's immersive */}
        <div className={`absolute right-4 bottom-32 flex flex-col space-y-6 items-center text-tea-paper/90 z-20 transition-opacity ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
            <button onClick={onToggleSave} className={`flex flex-col items-center space-y-1 ${isSaved ? 'text-tea-gold' : ''}`}>
               <Icons.Leaf filled={isSaved} className="w-7 h-7" />
            </button>
            <button onClick={onShare} className="flex flex-col items-center space-y-1">
               <Icons.Share className="w-7 h-7" />
            </button>
        </div>

        {/* Bottom Info - Hide during play */}
        {!isPlaying && (
            <div className="absolute bottom-0 left-0 w-full p-6 pb-10 text-tea-paper pointer-events-none bg-gradient-to-t from-black/90 to-transparent">
            <div className="flex items-center space-x-2 mb-3 opacity-90">
                <span className="px-2 py-0.5 border border-white/30 text-[9px] uppercase tracking-[0.15em] rounded-full">
                    {story.type}
                </span>
            </div>
            <h2 className="text-3xl font-serif mb-1 leading-tight text-shadow-md">{story.title}</h2>
            <p className="text-base font-serif italic opacity-90 mb-4 text-shadow-sm">{story.subtitle}</p>
            <p className="text-sm opacity-90 line-clamp-3 leading-relaxed max-w-[80%] font-light">{story.description}</p>
            </div>
        )}
      </div>
    );
  }

  // Desktop: Sidebar + Centered Vertical Player
  return (
    <div className="fixed inset-0 z-[60] bg-[#121212] flex">
      <DesktopSidebar story={story} onBack={onBack} onShare={onShare} isSaved={isSaved} onToggleSave={onToggleSave} />
      
      <main className="flex-1 relative flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] p-12">
        <div className="flex flex-row h-full max-h-[80vh] w-full max-w-5xl items-center justify-center gap-12">
            
            {/* Player Frame */}
            <div className="h-full aspect-[9/16] bg-black relative rounded-sm shadow-2xl overflow-hidden border border-white/5 shrink-0 group">
               {renderPlayer()}
               
               {/* Progress Bar Placeholder (Only in thumb mode) */}
               {!isPlaying && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
                    <div className="w-1/3 h-full bg-tea-gold"></div>
                </div>
               )}
            </div>

            {/* Info Panel */}
            <div className="max-w-sm text-tea-paper flex flex-col justify-center h-full">
                <div className="w-8 h-[1px] bg-tea-gold mb-6"></div>
                <div className="flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-tea-paper/70 mb-2">
                    <span>{story.origin}</span>
                    <span>•</span>
                    <span>{story.durationOrTime}</span>
                </div>
                <h2 className="text-4xl font-serif mb-2 leading-tight">{story.title}</h2>
                <p className="text-lg font-serif italic text-tea-paper/70 mb-8">{story.subtitle}</p>
                <p className="text-base leading-relaxed text-tea-paper/90 font-light">{story.description}</p>
            </div>
        </div>
      </main>
    </div>
  );
};

// 2. FILM LAYOUT (Cinematic Landscape - YouTube Support)
const FilmLayout: React.FC<{ story: Story; isMobile: boolean; onBack: () => void; onShare?: () => void; isSaved?: boolean; onToggleSave?: () => void }> = ({ story, isMobile, onBack, onShare, isSaved, onToggleSave }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const hasEmbed = !!story.externalId;

  const renderPlayer = () => {
      if (isPlaying && hasEmbed) {
          // YouTube Default for Film
          if (story.platform === 'YouTube' || !story.platform) {
             // Use safe origin handling
             const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : undefined;
             const originParam = origin ? `&origin=${origin}` : '';
             
             return (
                <iframe 
                  width="100%" 
                  height="100%" 
                  src={`https://www.youtube.com/embed/${story.externalId}?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1${originParam}`}
                  title="YouTube video player" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
             );
          }
          // Instagram Support for Film (if requested)
          if (story.platform === 'Instagram') {
             return (
                <div className="w-full h-full bg-black flex items-center justify-center">
                   <iframe 
                     src={`https://www.instagram.com/reel/${story.externalId}/embed`}
                     className="w-full h-full border-0 max-w-[500px]" // Limit width for vertical content in landscape container
                     scrolling="no"
                     allowTransparency={true}
                   ></iframe>
                </div>
             );
          }
      }

      return (
        <>
            <img src={story.thumbnailUrl} className="w-full h-full object-cover opacity-40 mask-image-b-gradient transition-opacity duration-500" alt="film"/>
            <div className="absolute inset-0 flex items-center justify-center">
                <button 
                    onClick={() => setIsPlaying(true)}
                    className="w-24 h-24 border border-white/20 rounded-full flex items-center justify-center hover:bg-white/5 transition-all cursor-pointer group"
                >
                    <Icons.Play className="w-10 h-10 text-tea-paper ml-1 group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </>
      );
  };

  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-tea-bg z-[60] flex flex-col overflow-y-auto">
         <MobileHeader title={story.title} onBack={onBack} />
         
         {/* Player */}
         <div className="w-full aspect-video bg-black relative shrink-0">
             {renderPlayer()}
         </div>

         {/* Content */}
         <div className="p-6 text-tea-paper flex-1">
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] tracking-[0.15em] uppercase opacity-70 block">{story.type} • {story.durationOrTime}</span>
                <div className="flex gap-4">
                    <button onClick={onToggleSave} className={isSaved ? 'text-tea-gold' : ''}>
                       <Icons.Leaf filled={isSaved} className="w-5 h-5" />
                    </button>
                    <button onClick={onShare}>
                       <Icons.Share className="w-5 h-5 opacity-70" />
                    </button>
                </div>
            </div>
            <h2 className="text-2xl font-serif mb-1">{story.title}</h2>
            <p className="text-sm font-serif italic opacity-70 mb-6">{story.subtitle}</p>
            <div className="w-full h-[1px] bg-white/10 mb-6"></div>
            <p className="leading-relaxed opacity-90 font-serif">{story.description}</p>
         </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-[#050505] flex">
       <DesktopSidebar story={story} onBack={onBack} onShare={onShare} isSaved={isSaved} onToggleSave={onToggleSave} />
       
       <main className="flex-1 flex flex-col items-center overflow-y-auto">
          {/* Cinema Player */}
          <div className="w-full h-[70vh] bg-black relative shadow-2xl shrink-0 group">
              {renderPlayer()}
          </div>

          {/* Info Section */}
          <div className="w-full max-w-4xl p-12 text-tea-paper">
             <div className="flex justify-between items-start mb-8">
                <div>
                   <h2 className="text-5xl font-serif mb-2">{story.title}</h2>
                   <p className="text-xl font-serif italic text-tea-paper/60">{story.subtitle}</p>
                </div>
                <div className="flex items-center space-x-6 text-tea-paper/70">
                   <button onClick={onToggleSave} className={`hover:text-tea-paper transition-colors ${isSaved ? 'text-tea-gold' : ''}`}>
                      <Icons.Leaf filled={isSaved} className="w-5 h-5" />
                   </button>
                   <button onClick={onShare} className="hover:text-tea-paper transition-colors">
                      <Icons.Share className="w-5 h-5" />
                   </button>
                </div>
             </div>
             <p className="text-lg leading-loose font-light opacity-90 font-serif max-w-2xl">{story.description}</p>
          </div>
       </main>
    </div>
  );
};

// 3. AUDIO LAYOUT (Listening Room)
const AudioLayout: React.FC<{ story: Story; isMobile: boolean; onBack: () => void; onShare?: () => void; isSaved?: boolean; onToggleSave?: () => void }> = ({ story, isMobile, onBack, onShare, isSaved, onToggleSave }) => {
  // Simple visualizer bars
  const bars = Array.from({ length: 40 });

  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-tea-bg z-[60] flex flex-col">
         <MobileHeader title="Now Playing" onBack={onBack} transparent />
         
         {/* Main Art Area */}
         <div className="flex-1 relative flex flex-col items-center justify-center">
            <div className="absolute inset-0 bg-tea-moss">
               <img src={story.thumbnailUrl} className="w-full h-full object-cover opacity-30 blur-3xl scale-110" alt="bg" />
            </div>
            
            {/* Vinyl / Cover Art */}
            <div className="relative z-10 w-[70vw] max-w-[300px] aspect-square shadow-2xl rounded-sm overflow-hidden border border-white/10 mt-[-10vh]">
               <img src={story.thumbnailUrl} className="w-full h-full object-cover" alt="cover" />
            </div>
         </div>

         {/* Controls */}
         <div className="bg-gradient-to-t from-tea-bg via-tea-bg to-transparent pt-12 px-8 pb-12 z-20">
             <div className="flex justify-between items-end mb-8">
                <div className="flex-1 pr-4">
                    <h2 className="text-3xl font-serif text-tea-paper mb-2 leading-tight">{story.title}</h2>
                    <p className="text-base text-tea-paper/70 font-serif italic">{story.subtitle}</p>
                </div>
             </div>
             
             {/* Progress */}
             <div className="w-full h-[2px] bg-white/10 rounded-full mb-2 relative group cursor-pointer">
                <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1/3 h-[2px] bg-tea-bg group-hover:h-[4px] transition-all">
                   <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-tea-bg rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
             </div>
             <div className="flex justify-between text-[10px] text-tea-paper/50 mb-10 font-mono tracking-[0.15em]">
                <span>04:20</span>
                <span>{story.durationOrTime}</span>
             </div>

             {/* Buttons */}
             <div className="flex items-center justify-between px-4">
                <button onClick={onToggleSave} className={`text-tea-paper/40 hover:text-tea-paper transition-colors ${isSaved ? 'text-tea-gold' : ''}`}>
                     <Icons.Leaf filled={isSaved} className="w-6 h-6" />
                </button>

                <div className="flex items-center space-x-8">
                   <Icons.Back className="w-8 h-8 text-tea-paper/50 rotate-180 hover:text-tea-paper transition-colors cursor-pointer" /> {/* Prev */}
                   <button className="w-20 h-20 bg-tea-bg rounded-full flex items-center justify-center text-tea-text shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-95 transition-transform hover:bg-white">
                      <Icons.Play className="w-8 h-8 fill-current ml-1" />
                   </button>
                   <Icons.Next className="w-8 h-8 text-tea-paper/50 hover:text-tea-paper transition-colors cursor-pointer" />
                </div>

                <button onClick={onShare} className="text-tea-paper/40 hover:text-tea-paper transition-colors">
                     <Icons.Share className="w-6 h-6" />
                </button>
             </div>
         </div>
      </div>
    );
  }

  // Desktop Audio
  return (
    <div className="fixed inset-0 z-[60] bg-[#1a1a1a] flex">
      <DesktopSidebar story={story} onBack={onBack} onShare={onShare} isSaved={isSaved} onToggleSave={onToggleSave} />
      
      <main className="flex-1 flex flex-col items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] relative overflow-hidden">
         
         {/* Background Ambience */}
         <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-tea-gold rounded-full blur-[150px] opacity-20 animate-pulse duration-[10s]"></div>
            <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-tea-green rounded-full blur-[120px] opacity-20 animate-pulse duration-[8s]"></div>
         </div>

         <div className="w-full max-w-6xl px-12 flex items-center justify-center gap-20 z-10">
            
            {/* Art - Left Side */}
            <div className="w-[400px] h-[400px] shrink-0 shadow-[0_30px_60px_rgba(0,0,0,0.5)] rounded-sm relative group perspective-1000">
               <div className="absolute inset-0 bg-tea-beige/5 transform translate-x-4 translate-y-4 rounded-sm border border-white/5 -z-10"></div>
               <img src={story.thumbnailUrl} className="w-full h-full object-cover rounded-sm border border-white/10" alt="album art" />
               
               {/* Vinyl shine effect overlay */}
               <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>
            </div>

            {/* Controls & Info - Right Side */}
            <div className="flex flex-col flex-1 max-w-lg">
               <div className="flex flex-col mb-10">
                    <span className="text-xs tracking-[0.3em] uppercase text-tea-paper/50 mb-4 border-l-2 border-tea-gold pl-3">Now Playing</span>
                    <h2 className="text-5xl xl:text-6xl font-serif text-tea-paper mb-4 leading-[1.1] tracking-tight">{story.title}</h2>
                    <p className="text-2xl font-serif italic text-tea-paper/60 font-light">{story.subtitle}</p>
               </div>

               {/* Visualizer - Make it subtler */}
               <div className="flex items-end space-x-[2px] h-16 mb-10 opacity-50 mask-image-b-gradient">
                  {bars.map((_, i) => (
                     <div 
                       key={i} 
                       className="flex-1 bg-tea-bg rounded-t-[1px]" 
                       style={{
                         height: `${10 + Math.random() * 90}%`, 
                         opacity: Math.random() * 0.5 + 0.5,
                         animation: `bounce ${1 + Math.random()}s infinite ease-in-out alternate`
                       }}
                     ></div>
                  ))}
               </div>

               {/* Progress Bar */}
               <div className="mb-4 group">
                    <div className="flex justify-between text-[10px] text-tea-paper/40 mb-2 font-mono tracking-[0.15em]">
                        <span>00:00</span>
                        <span>{story.durationOrTime}</span>
                    </div>
                    <div className="w-full h-[2px] bg-white/10 relative cursor-pointer">
                        <div className="absolute top-0 left-0 w-0 h-full bg-tea-bg group-hover:bg-tea-gold transition-colors"></div>
                        {/* Fake progress for visuals */}
                         <div className="absolute top-0 left-0 w-[30%] h-full bg-tea-bg">
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-tea-bg rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                         </div>
                    </div>
               </div>

               {/* Main Controls */}
               <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center space-x-8">
                      <button className="text-tea-paper/50 hover:text-tea-paper transition-colors"><Icons.Back className="w-6 h-6 rotate-180" /></button>
                      <button className="w-16 h-16 bg-tea-bg rounded-full flex items-center justify-center hover:scale-105 hover:bg-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                         <Icons.Play className="w-6 h-6 text-tea-text ml-1 fill-current" />
                      </button>
                      <button className="text-tea-paper/50 hover:text-tea-paper transition-colors"><Icons.Next className="w-6 h-6" /></button>
                  </div>

                  <div className="flex items-center space-x-6 border-l border-white/10 pl-8">
                      <button onClick={onToggleSave} className={`text-tea-paper/40 hover:text-tea-paper transition-colors ${isSaved ? 'text-tea-gold' : ''}`}>
                          <Icons.Leaf filled={isSaved} className="w-5 h-5" />
                      </button>
                      <button onClick={onShare} className="text-tea-paper/40 hover:text-tea-paper transition-colors">
                          <Icons.Share className="w-5 h-5" />
                      </button>
                  </div>
               </div>
            </div>
         </div>
      </main>
    </div>
  );
};

export const MediaViewer: React.FC<MediaViewerProps> = (props) => {
  const { story, onBack, onShare, isSaved, onToggleSave, enableKeyboard = true } = props;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!enableKeyboard) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, enableKeyboard]);

  const handleShareClick = () => {
    if (onShare) onShare(story);
  };

  if (story.type === ContentType.Audio) {
    return (
      <AudioLayout 
        story={story} 
        isMobile={isMobile} 
        onBack={onBack} 
        onShare={handleShareClick} 
        isSaved={isSaved}
        onToggleSave={onToggleSave}
      />
    );
  }

  if (story.type === ContentType.Film) {
    return (
      <FilmLayout 
        story={story} 
        isMobile={isMobile} 
        onBack={onBack} 
        onShare={handleShareClick} 
        isSaved={isSaved}
        onToggleSave={onToggleSave}
      />
    );
  }

  return (
    <ReelLayout 
      story={story} 
      isMobile={isMobile} 
      onBack={onBack} 
      onShare={handleShareClick} 
      isSaved={isSaved}
      onToggleSave={onToggleSave}
    />
  );
};
