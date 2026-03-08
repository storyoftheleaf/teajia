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
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-sans tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 ${
            activeId === cat.id
              ? 'bg-tea-gold text-white'
              : 'bg-tea-text/5 text-tea-text/70 hover:bg-tea-text/10'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
};
