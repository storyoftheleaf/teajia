import React from 'react';
import { Search } from 'lucide-react';

const TEA_TYPES = ['All', 'Green', 'White', 'Yellow', 'Oolong', 'Red', 'Sheng', 'Shou', 'Dark', 'Herbal', 'Matcha', 'Flower'];

interface ShopSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeType: string;
  onTypeChange: (type: string) => void;
  resultCount?: number;
  placeholder?: string;
}

export const ShopSearch: React.FC<ShopSearchProps> = ({
  searchQuery,
  onSearchChange,
  activeType,
  onTypeChange,
  resultCount,
  placeholder = 'Search teas...',
}) => {
  return (
    <div className="px-4 py-3 space-y-3">
      {/* Search input */}
      <div className="relative group">
        <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-tea-ink/30 group-focus-within:text-tea-seal transition-colors" size={14} />
        <input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-6 pr-2 py-2 bg-transparent border-b border-tea-ink/10 focus:border-tea-seal outline-none font-serif italic text-sm text-tea-ink dark:text-tea-paper placeholder:text-tea-ink/30 dark:placeholder:text-tea-paper/30 transition-colors"
        />
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2 items-center">
        {TEA_TYPES.map(type => (
          <button
            key={type}
            onClick={() => onTypeChange(type)}
            className={`px-3 py-1 text-xs uppercase tracking-wider rounded-sm transition-colors ${
              activeType === type
                ? 'bg-tea-ink dark:bg-tea-paper text-tea-paper dark:text-tea-ink font-medium'
                : 'border border-tea-ink/15 dark:border-tea-paper/15 text-tea-ink/60 dark:text-tea-paper/60 hover:border-tea-ink/30 dark:hover:border-tea-paper/30 hover:text-tea-ink dark:hover:text-tea-paper'
            }`}
          >
            {type}
          </button>
        ))}
        {resultCount !== undefined && (
          <span className="text-xs text-tea-ink/40 dark:text-tea-paper/40 ml-auto">
            {resultCount} {resultCount === 1 ? 'tea' : 'teas'}
          </span>
        )}
      </div>
    </div>
  );
};
