import React, { useState, useMemo } from 'react';
import { Icons } from '../Icons';
import { ArticleCard } from '../shared/ArticleCard';
import { READING_LIST, READING_LIST_CATEGORIES } from '../../data/readingList';

const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-text/5 px-2 -ml-2';

const PILL_ICONS: Record<string, React.ReactNode> = {
  'Beginner Reading': <Icons.Book className="w-3.5 h-3.5" />,
  'Deep Dive Podcasts': <Icons.Audio className="w-3.5 h-3.5" />,
  'Philosophy & Culture': <Icons.BookOpen className="w-3.5 h-3.5" />,
};

interface ReadingListProps {
  onBack: () => void;
}

export const ReadingList: React.FC<ReadingListProps> = ({ onBack }) => {
  const [activeCategory, setActiveCategory] = useState<string>(READING_LIST_CATEGORIES[0]);

  const filteredItems = useMemo(
    () => READING_LIST.filter(item => item.category === activeCategory),
    [activeCategory]
  );

  return (
    <div className="w-full">
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-text/70" />
        <span className="font-serif text-sm text-tea-text/70">Learn</span>
      </button>

      <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-3 text-tea-text">
        Reading
      </h1>
      <p className="font-serif text-base text-tea-text/60 mb-8">
        Articles from around the web
      </p>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-4">
        {READING_LIST_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-tea-gold text-white'
                : 'bg-tea-text/5 text-tea-text/60 hover:bg-tea-text/10'
            }`}
          >
            {PILL_ICONS[cat]}
            <span>{cat}</span>
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="animate-[fadeIn_0.3s_ease-out]" key={activeCategory}>
        <div className="grid grid-cols-2 gap-4 items-start">
          {filteredItems.map(item => (
            <ArticleCard
              key={item.id}
              title={item.title}
              description={item.author || item.description}
              imageUrl={item.imageUrl}
              aspectRatio={item.format === 'article' ? 'portrait' : 'square'}
              onClick={item.externalUrl ? () => window.open(item.externalUrl, '_blank') : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
