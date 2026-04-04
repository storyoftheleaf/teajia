import React from 'react';
import { Story, ContentType } from '../types';
import { Icons } from './Icons';

interface StoryModalProps {
  story: Story;
  onClose: () => void;
  onRead: () => void;
}

export const StoryModal: React.FC<StoryModalProps> = ({ story, onClose, onRead }) => {
  // Stop click propagation to prevent closing when clicking content
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 transition-opacity duration-300"
      onClick={onClose} // Close on backdrop click
    >
      {/* Backdrop Dim */}
      <div className="absolute inset-0 bg-tea-bg/90 backdrop-blur-sm"></div>

      {/* Modal Content */}
      <div 
        className="relative w-full max-w-5xl bg-tea-bg overflow-hidden shadow-2xl rounded-sm flex flex-col md:flex-row max-h-[90vh]"
        onClick={handleContentClick}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 rounded-full bg-tea-bg/50 hover:bg-tea-bg text-tea-text transition-colors"
        >
          <Icons.Close className="w-6 h-6" />
        </button>

        {/* Left Side: Media (Or Top on Mobile) */}
        <div className="w-full md:w-1/2 bg-black flex items-center justify-center relative min-h-[300px] md:min-h-[600px]">
           {/* Media Placeholder Logic */}
           {(story.type === ContentType.Reel || story.type === ContentType.Film) && (
             <div className="w-full h-full flex items-center justify-center bg-zinc-900 relative group">
                <img src={story.thumbnailUrl} className="w-full h-full object-cover opacity-50" alt="video thumb"/>
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-16 h-16 border border-tea-border rounded-full flex items-center justify-center hover:bg-tea-bg/10 transition-all cursor-pointer">
                     <Icons.Play className="w-8 h-8 text-tea-text fill-tea-text/20" />
                   </div>
                </div>
                {/* Custom Player Frame */}
                <div className="absolute inset-4 border border-tea-border pointer-events-none"></div>
             </div>
           )}

           {story.type === ContentType.Audio && (
             <div className="w-full h-full bg-zinc-800 flex flex-col items-center justify-center p-8 relative overflow-hidden">
               {/* Abstract Waveform */}
               <div className="flex space-x-1 h-16 items-center mb-8">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="w-1 bg-tea-elevated animate-pulse" style={{height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s`}}></div>
                  ))}
               </div>
               <div className="flex items-center space-x-6">
                 <Icons.Play className="w-10 h-10 text-tea-text cursor-pointer hover:text-tea-green transition-colors" />
                 <div className="w-48 h-1 bg-tea-text-sec/15 rounded-full overflow-hidden">
                   <div className="w-1/3 h-full bg-tea-bg"></div>
                 </div>
                 <span className="text-xs text-tea-text/60 font-mono">08:12 / {story.durationOrTime}</span>
               </div>
               <img src={story.thumbnailUrl || 'https://picsum.photos/400/400'} className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay" alt="audio bg"/>
             </div>
           )}

           {/* Fallback for other types if they slip through */}
           {story.type === ContentType.Article && (
              <div className="w-full h-full relative">
                 {story.thumbnailUrl ? (
                   <img src={story.thumbnailUrl} className="w-full h-full object-cover" alt="article cover"/>
                 ) : (
                   <div className="w-full h-full bg-tea-bg-dark flex items-center justify-center">
                     <Icons.Leaf className="w-32 h-32 text-tea-text opacity-10" />
                   </div>
                 )}
                 <div className="absolute inset-0 bg-gradient-to-t from-tea-bg/60 to-transparent"></div>
              </div>
           )}
        </div>

        {/* Right Side: Info (Or Bottom on Mobile) */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col bg-tea-bg relative overflow-y-auto">
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="px-3 py-1 border border-tea-text/20 text-xs uppercase tracking-[0.15em] rounded-full text-tea-text-light">
                {story.type}
              </span>
              <span className="text-xs text-tea-text-light/60 font-serif italic">
                {story.origin} • {story.durationOrTime}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-serif text-tea-text leading-tight mb-2">
              {story.title}
            </h2>
            <h3 className="text-xl font-serif text-tea-text-light italic font-light">
              {story.subtitle}
            </h3>
          </div>

          {/* Description */}
          <div className="prose prose-stone prose-lg flex-grow mb-8 text-tea-text-light/90 font-serif leading-relaxed">
            <p>{story.description}</p>
          </div>

          {/* Actions */}
          <div className="mt-auto pt-8 border-t border-tea-elevated flex items-center justify-between">
             <button className="p-2 hover:bg-tea-elevated/20 rounded-full transition-colors text-tea-text-light">
               <Icons.Share className="w-5 h-5" />
             </button>
          </div>

          {/* Decorative Stamp */}
          <div className="absolute top-8 right-8 opacity-20 pointer-events-none">
             <Icons.Seal className="w-16 h-16 text-tea-gold" />
          </div>

        </div>
      </div>
    </div>
  );
};