
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
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 md:p-8 animate-[fadeIn_0.3s_ease-out]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-tea-bg/95 backdrop-blur-md" 
        onClick={onClose}
      ></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-tea-bg shadow-2xl border border-tea-border overflow-hidden flex flex-col items-center text-center p-8 md:p-12 animate-[slideUp_0.4s_ease-out]">
        {/* Texture Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.08] mix-blend-multiply" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}></div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-tea-text/40 hover:text-tea-text transition-colors"
        >
          <Icons.Close className="w-6 h-6" />
        </button>

        {/* Avatar */}
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-tea-border shadow-inner mb-6 relative z-10">
          {person.avatarUrl ? (
             <img src={person.avatarUrl} alt={person.name} className="w-full h-full object-cover sepia-[0.2]" loading="lazy" />
          ) : (
             <div className="w-full h-full bg-tea-elevated flex items-center justify-center text-tea-text-dim">
                <Icons.Seal className="w-12 h-12" />
             </div>
          )}
        </div>

        {/* Info */}
        <div className="relative z-10 max-w-sm">
            <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-light/60 block mb-3">
              {person.role}
            </span>
            <h2 className="text-3xl text-tea-text mb-6 leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {person.name}
            </h2>
            
            <div className="w-8 h-[1px] bg-tea-gold/50 mx-auto mb-6"></div>

            <p className="text-lg leading-relaxed text-tea-text-light/90 italic" style={{ fontFamily: 'var(--font-body)' }}>
              {person.bio}
            </p>
        </div>

        {/* Decorative Stamp */}
        <div className="mt-8 opacity-80">
             <Icons.Seal className="w-8 h-8 text-tea-gold" />
        </div>
      </div>
    </div>
  );
};
