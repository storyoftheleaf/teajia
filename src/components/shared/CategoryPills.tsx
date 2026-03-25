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
          className={`flex-shrink-0 pill ${activeId === cat.id ? 'pill-active' : ''}`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
};
