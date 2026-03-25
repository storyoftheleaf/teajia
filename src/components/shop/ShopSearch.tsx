import React from 'react';
import { Search } from 'lucide-react';

const TEA_TYPES = ['All', 'Green', 'White', 'Yellow', 'Oolong', 'Red', 'Sheng', 'Shou', 'Dark', 'Herbal'];

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
        <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-tea-text/30 group-focus-within:text-tea-gold transition-colors" size={14} />
        <input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-6 pr-2 py-2 bg-transparent border-b border-tea-text/10 focus:border-tea-gold outline-none font-serif italic text-sm text-tea-text placeholder:text-tea-text/30 dark:placeholder:text-tea-text/30 transition-colors"
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
                ? 'bg-tea-elevated text-tea-text font-medium'
                : 'border border-tea-text/15  text-tea-text/60 hover:border-tea-text/30 dark:hover:border-tea-border/30 hover:text-tea-text'
            }`}
          >
            {type}
          </button>
        ))}
        {resultCount !== undefined && (
          <span className="text-xs text-tea-text/40 ml-auto">
            {resultCount} {resultCount === 1 ? 'tea' : 'teas'}
          </span>
        )}
      </div>
    </div>
  );
};
