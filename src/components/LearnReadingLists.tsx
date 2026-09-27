import React, { useState } from 'react';
import { Icons } from './Icons';
import { CURATED_LISTS, FORMAT_COLORS, FORMAT_ICONS, type CuratedList, type MediaFormat } from '../data/readingListening';

const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-text/5 px-2 -ml-2';

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

interface LearnReadingListsProps {
  onBack: () => void;
}

export const LearnReadingLists: React.FC<LearnReadingListsProps> = ({ onBack }) => {
  const [activeListId, setActiveListId] = useState<string>(CURATED_LISTS[0]?.id || '');

  const activeList = CURATED_LISTS.find(l => l.id === activeListId) as CuratedList | undefined;

  return (
    <div>
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-text-sec" />
        <span className="font-serif text-sm text-tea-text-sec">Craft</span>
      </button>

      {/* List selector pills */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-4">
        {CURATED_LISTS.map(list => (
          <button
            key={list.id}
            onClick={() => setActiveListId(list.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
              activeListId === list.id
                ? 'cta-solid'
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

          <div className="flex flex-col divide-y divide-tea-gold/[0.06]">
            {activeList.items.map(item => (
              <div
                key={item.id}
                className="flex items-start gap-4 py-3.5 px-1 group hover:bg-tea-elevated/50 transition-colors"
              >
                {/* Format icon */}
                <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                  item.format === 'book' ? 'bg-tea-gold/10 dark:bg-tea-gold/20 text-tea-gold dark:text-tea-gold' :
                  item.format === 'podcast' ? 'bg-tea-readgold/10 dark:bg-tea-readgold/20 text-tea-readgold dark:text-tea-readgold' :
                  item.format === 'playlist' ? 'bg-tea-readgold/10 dark:bg-tea-readgold/20 text-tea-readgold dark:text-tea-readgold' :
                  item.format === 'documentary' ? 'bg-tea-leaf/10 dark:bg-tea-leaf/20 text-tea-leaf dark:text-tea-leaf' :
                  item.format === 'article' ? 'bg-tea-readgold/10 dark:bg-tea-readgold/20 text-tea-readgold dark:text-tea-readgold' :
                  'bg-tea-elevated/10 dark:bg-tea-elevated/20 text-tea-text-sec dark:text-tea-text-sec'
                }`}>
                  {getFormatIcon(item.format)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="font-serif text-sm text-tea-text truncate">
                      {item.title}
                    </h4>
                    <span className={`text-ui-9 uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 hidden sm:inline ${FORMAT_COLORS[item.format]}`}>
                      {item.format}
                    </span>
                  </div>
                  {item.author && (
                    <p className="text-ui-11 text-tea-text/40 mb-0.5">
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
                    <span className="text-ui-10 text-tea-text/30 hidden sm:inline">
                      {item.duration}
                    </span>
                  )}
                  <Icons.Next className="w-4 h-4 text-tea-text-sec group-hover:text-tea-gold transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
