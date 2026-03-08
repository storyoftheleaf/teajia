import React from 'react';
import { Icons } from '../Icons';
import { PLAYLISTS } from '../../data/playlists';

const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-text/5 px-2 -ml-2';

const PLATFORM_COLORS: Record<string, string> = {
  spotify: 'bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-400/30',
  'apple-music': 'bg-pink-500/10 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-400/30',
  youtube: 'bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-400/30',
  soundcloud: 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-400/30',
};

interface PlaylistsProps {
  onBack: () => void;
}

export const Playlists: React.FC<PlaylistsProps> = ({ onBack }) => {
  return (
    <div className="w-full">
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-text/70" />
        <span className="font-serif text-sm text-tea-text/70">Learn</span>
      </button>

      <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-3 text-tea-text">
        Playlists
      </h1>
      <p className="font-serif text-base text-tea-text/60 mb-8">
        Music for tea moments
      </p>

      <div className="flex flex-col divide-y divide-tea-border">
        {PLAYLISTS.map(item => (
          <a
            key={item.id}
            href={item.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 py-4 px-1 group hover:bg-tea-elevated/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0 mt-0.5 bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <Icons.Music className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-serif text-sm text-tea-text truncate">
                  {item.title}
                </h3>
                <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0 hidden sm:inline ${PLATFORM_COLORS[item.platform] || ''}`}>
                  {item.platform.replace('-', ' ')}
                </span>
              </div>
              <p className="text-xs text-tea-text/50 line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 mt-1">
              <span className="text-[10px] text-tea-text/30 hidden sm:inline">
                {item.duration}
              </span>
              <Icons.Next className="w-4 h-4 text-tea-text/20 group-hover:text-tea-gold transition-colors" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
