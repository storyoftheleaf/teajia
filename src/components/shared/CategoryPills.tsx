import React from 'react';

interface Category {
  id: string;
  label: string;
}

interface CategoryPillsProps {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  categories,
  activeId,
  onSelect,
  className = '',
}) => {
  return (
    <div className={`flex gap-2 overflow-x-auto hide-scrollbar pb-1 ${className}`}>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-sans tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 ${
            activeId === cat.id
              ? 'bg-tea-seal text-white dark:text-tea-ink'
              : 'bg-tea-ink/5 dark:bg-white/8 text-tea-ink/70 dark:text-tea-paper/70 hover:bg-tea-ink/10 dark:hover:bg-white/15'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
};
