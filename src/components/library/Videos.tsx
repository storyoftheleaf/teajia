import React from 'react';
import { Icons } from '../Icons';
import { VIDEOS } from '../../data/videos';

const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-text/5 px-2 -ml-2';

const FORMAT_COLORS: Record<string, string> = {
  documentary: 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-400/30',
  video: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-400/30',
};

interface VideosProps {
  onBack: () => void;
}

export const Videos: React.FC<VideosProps> = ({ onBack }) => {
  return (
    <div className="w-full">
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-text-sec" />
        <span className="font-serif text-sm text-tea-text-sec">Learn</span>
      </button>

      <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-3 text-tea-text">
        Videos
      </h1>
      <p className="font-serif text-base text-tea-text/60 mb-8">
        Curated watching
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {VIDEOS.map(item => (
          <a
            key={item.id}
            href={item.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-[1px] p-5 bg-tea-bg-dark/50 hover:bg-tea-bg-dark/80 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Icons.Film className="w-4 h-4" />
              </div>
              <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${FORMAT_COLORS[item.format] || ''}`}>
                {item.format}
              </span>
              <span className="text-[10px] text-tea-text/30 ml-auto">
                {item.duration}
              </span>
            </div>

            <h3 className="font-serif text-sm font-medium text-tea-text mb-1.5">
              {item.title}
            </h3>
            <p className="text-xs text-tea-text/50 leading-relaxed line-clamp-3">
              {item.description}
            </p>

            <div className="mt-3 flex items-center gap-1 text-tea-gold">
              <span className="font-serif text-xs group-hover:underline">Watch</span>
              <Icons.Next className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
