import React, { useState } from 'react';
import { Icons } from './Icons';
import { CURATED_LISTS, FORMAT_COLORS, FORMAT_ICONS, type CuratedList, type MediaFormat } from '../data/readingListening';

const ICON_MAP: Record<string, React.ReactNode> = {
  Book: <Icons.Book className="w-4 h-4" />,
  Audio: <Icons.Audio className="w-4 h-4" />,
  Play: <Icons.Play className="w-4 h-4" />,
  Music: <Icons.Music className="w-4 h-4" />,
  BookOpen: <Icons.BookOpen className="w-4 h-4" />,
  Film: <Icons.Film className="w-4 h-4" />,
};

const getFormatIcon = (format: MediaFormat) => {
  const iconName = FORMAT_ICONS[format];
  return ICON_MAP[iconName] || <Icons.Book className="w-4 h-4" />;
};

export const LearnReadingLists: React.FC = () => {
  const [activeListId, setActiveListId] = useState<string>(CURATED_LISTS[0]?.id || '');

  const activeList = CURATED_LISTS.find(l => l.id === activeListId) as CuratedList | undefined;

  return (
    <div>
      {/* List selector pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4">
        {CURATED_LISTS.map(list => (
          <button
            key={list.id}
            onClick={() => setActiveListId(list.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
              activeListId === list.id
                ? 'bg-tea-gold text-white'
                : 'bg-tea-text/5 text-tea-text/60 hover:bg-tea-text/10'
            }`}
          >
            {ICON_MAP[list.iconName]}
            <span>{list.title}</span>
          </button>
        ))}
      </div>

      {/* Active list content */}
      {activeList && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <p className="text-sm text-tea-text/50 font-serif italic mb-4">
            {activeList.subtitle}
          </p>

          <div className="flex flex-col divide-y divide-tea-border">
            {activeList.items.map(item => (
              <div
                key={item.id}
                className="flex items-start gap-4 py-3.5 px-1 group hover:bg-tea-elevated/50 transition-colors"
              >
                {/* Format icon */}
                <div className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 mt-0.5 ${
                  item.format === 'book' ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                  item.format === 'podcast' ? 'bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' :
                  item.format === 'playlist' ? 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' :
                  item.format === 'documentary' ? 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400' :
                  item.format === 'article' ? 'bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400' :
                  'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                }`}>
                  {getFormatIcon(item.format)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="font-serif text-sm text-tea-text truncate">
                      {item.title}
                    </h4>
                    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0 hidden sm:inline ${FORMAT_COLORS[item.format]}`}>
                      {item.format}
                    </span>
                  </div>
                  {item.author && (
                    <p className="text-[11px] text-tea-text/40 mb-0.5">
                      {item.author}
                    </p>
                  )}
                  <p className="text-xs text-tea-text/50 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Duration & arrow */}
                <div className="flex items-center gap-2 shrink-0 mt-1">
                  {item.duration && (
                    <span className="text-[10px] text-tea-text/30 hidden sm:inline">
                      {item.duration}
                    </span>
                  )}
                  <Icons.Next className="w-4 h-4 text-tea-text/20 group-hover:text-tea-gold transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
