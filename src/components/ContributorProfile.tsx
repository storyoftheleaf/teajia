
import React, { useEffect } from 'react';
import { Person } from '../types';
import { Icons } from './Icons';

interface ContributorProfileProps {
  person: Person;
  onClose: () => void;
}

export const ContributorProfile: React.FC<ContributorProfileProps> = ({ person, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 md:p-8 animate-[fadeIn_0.3s_ease-out]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-tea-charcoal/95 backdrop-blur-md" 
        onClick={onClose}
      ></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-tea-paper shadow-2xl border border-white/10 overflow-hidden flex flex-col items-center text-center p-8 md:p-12 animate-[slideUp_0.4s_ease-out]">
        {/* Texture Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.08] bg-[url('https://www.transparenttextures.com/patterns/shattered-island.png')] mix-blend-multiply"></div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-tea-ink/40 hover:text-tea-ink transition-colors"
        >
          <Icons.Close className="w-6 h-6" />
        </button>

        {/* Avatar */}
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white/50 shadow-inner mb-6 relative z-10">
          {person.avatarUrl ? (
             <img src={person.avatarUrl} alt={person.name} className="w-full h-full object-cover sepia-[0.2]" loading="lazy" />
          ) : (
             <div className="w-full h-full bg-tea-beige flex items-center justify-center text-tea-ink/20">
                <Icons.Seal className="w-12 h-12" />
             </div>
          )}
        </div>

        {/* Info */}
        <div className="relative z-10 max-w-sm">
            <span className="text-[10px] uppercase tracking-[0.2em] text-tea-ink-light/60 block mb-3">
              {person.role}
            </span>
            <h2 className="text-3xl font-serif text-tea-ink mb-6 leading-tight">
              {person.name}
            </h2>
            
            <div className="w-8 h-[1px] bg-tea-seal/50 mx-auto mb-6"></div>

            <p className="font-serif text-lg leading-relaxed text-tea-ink-light/90 italic">
              {person.bio}
            </p>
        </div>

        {/* Decorative Stamp */}
        <div className="mt-8 opacity-80">
             <Icons.Seal className="w-8 h-8 text-tea-seal" />
        </div>
      </div>
    </div>
  );
};
