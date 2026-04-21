import React from 'react';
import { Icons } from '../Icons';
import { PLAYLISTS } from '../../data/playlists';

const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-text/5 px-2 -ml-2';

const PLATFORM_COLORS: Record<string, string> = {
  spotify: 'badge-format badge-format-green',
  'apple-music': 'badge-format badge-format-pink',
  youtube: 'badge-format badge-format-red',
  soundcloud: 'badge-format badge-format-orange',
};

interface PlaylistsProps {
  onBack: () => void;
}

export const Playlists: React.FC<PlaylistsProps> = ({ onBack }) => {
  return (
    <div className="w-full">
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-text-sec" />
        <span className="font-serif text-sm text-tea-text-sec">Learn</span>
      </button>

      <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-3 text-tea-text">
        Playlists
      </h1>
      <p className="font-serif text-base text-tea-text/60 mb-8">
        Music for tea moments
      </p>

      <div className="flex flex-col divide-y divide-tea-gold/[0.06]">
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
