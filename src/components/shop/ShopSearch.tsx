import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import Fuse from 'fuse.js';
import type { InventoryItem } from '../../types';
import { TeaPlaceholder } from './TeaPlaceholder';

const TEA_TYPES = ['All', 'Green', 'White', 'Yellow', 'Oolong', 'Red', 'Sheng', 'Shou', 'Dark', 'Herbal'];

interface ShopSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeType: string;
  onTypeChange: (type: string) => void;
  resultCount?: number;
  placeholder?: string;
  /** Inventory items for inline preview results */
  items?: InventoryItem[];
  /** Called when a preview result is selected */
  onItemSelect?: (item: InventoryItem) => void;
}

export const ShopSearch: React.FC<ShopSearchProps> = ({
  searchQuery,
  onSearchChange,
  activeType,
  onTypeChange,
  resultCount,
  placeholder = 'Search teas...',
  items = [],
  onItemSelect,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Build fuse index for inline preview
  const fuse = useMemo(
    () => new Fuse(items, {
      keys: [
        { name: 'name', weight: 2 },
        { name: 'variant', weight: 1.5 },
        { name: 'type', weight: 1 },
        { name: 'tags', weight: 0.5 },
      ],
      threshold: 0.35,
      includeScore: true,
      ignoreLocation: true,
    }),
    [items]
  );

  const previewResults = useMemo(() => {
    if (!searchQuery.trim() || !isFocused) return [];
    return fuse.search(searchQuery, { limit: 5 }).map(r => r.item);
  }, [searchQuery, isFocused, fuse]);

  // Reset active index when results change
  useEffect(() => { setActiveIndex(-1); }, [previewResults]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!previewResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, previewResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      onItemSelect?.(previewResults[activeIndex]);
      setIsFocused(false);
    } else if (e.key === 'Escape') {
      setIsFocused(false);
    }
  };

  const showPreview = isFocused && previewResults.length > 0 && items.length > 0;

  return (
    <div className="px-4 py-3 space-y-3" ref={wrapperRef}>
      {/* Search input */}
      <div className="relative group">
        <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-tea-text/30 group-focus-within:text-tea-gold transition-colors" size={14} />
        <input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          className="w-full pl-6 pr-8 py-2 bg-transparent border-b border-tea-text/10 focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg font-serif italic text-sm text-tea-text placeholder:text-tea-text/30 dark:placeholder:text-tea-text/30 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => { onSearchChange(''); setIsFocused(false); }}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-tea-text/30 hover:text-tea-text transition-colors"
          >
            <X size={14} />
          </button>
        )}

        {/* Inline preview dropdown */}
        {showPreview && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-tea-elevated border border-tea-border rounded-lg shadow-xl z-30 overflow-hidden">
            {previewResults.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => { onItemSelect?.(item); setIsFocused(false); }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  idx === activeIndex ? 'bg-tea-gold/10' : 'hover:bg-tea-gold/5'
                }`}
              >
                {item.image ? (
                  <img src={item.image} alt="" className="w-8 h-8 rounded object-cover shrink-0 border border-tea-border" />
                ) : (
                  <div className="w-8 h-8 rounded bg-tea-surface border border-tea-border flex items-center justify-center shrink-0">
                    <TeaPlaceholder type={item.type} size={16} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-tea-text truncate">{item.name}</p>
                  <p className="text-[10px] text-tea-text-sec truncate">{[item.variant, item.type, item.origin].filter(Boolean).join(' · ')}</p>
                </div>
                {item.price_per_gram && (
                  <span className="text-xs text-tea-text-sec num shrink-0">${parseFloat(item.price_per_gram).toFixed(2)}/g</span>
                )}
              </button>
            ))}
          </div>
        )}
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
                : 'border border-tea-border text-tea-text/60 hover:border-tea-border hover:text-tea-text'
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
