import React, { useState, useMemo } from 'react';
import { Icons } from '../Icons';
import { searchLibrary } from '../../utils/librarySearch';
import type { LibrarySubView, LibrarySearchResult } from '../../types/library';

interface LibrarySearchProps {
  onNavigateToSection: (section: LibrarySubView) => void;
}

export const LibrarySearch: React.FC<LibrarySearchProps> = ({ onNavigateToSection }) => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchLibrary(query), [query]);

  const grouped = useMemo(() => {
    const map: Record<string, LibrarySearchResult[]> = {};
    for (const r of results) {
      if (!map[r.sectionLabel]) map[r.sectionLabel] = [];
      map[r.sectionLabel].push(r);
    }
    return map;
  }, [results]);

  return (
    <div className="relative">
      {/* Search input */}
      <div className="relative">
        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-ink/30 dark:text-tea-paper/30" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search the library..."
          className="w-full pl-10 pr-10 py-2.5 bg-tea-ink/5 dark:bg-white/5 rounded-lg text-sm text-tea-ink dark:text-tea-paper placeholder:text-tea-ink/30 dark:placeholder:text-tea-paper/30 outline-none focus:ring-2 focus:ring-tea-seal/30 transition-shadow"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[28px] min-h-[28px] flex items-center justify-center"
          >
            <Icons.Close className="w-4 h-4 text-tea-ink/40 dark:text-tea-paper/40" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {query.trim() && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-tea-paper dark:bg-[#242424] rounded-lg shadow-lg border border-tea-ink/10 dark:border-white/10 max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-xs text-tea-ink/40 dark:text-tea-paper/40">
              No results found
            </p>
          ) : (
            Object.keys(grouped).map(label => (
              <div key={label}>
                <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-tea-ink/40 dark:text-tea-paper/40">
                  {label}
                </p>
                {grouped[label].slice(0, 5).map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigateToSection(item.section);
                      setQuery('');
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-tea-ink/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="font-serif text-sm text-tea-ink dark:text-tea-paper block truncate">
                      {item.title}
                    </span>
                    <span className="text-xs text-tea-ink/40 dark:text-tea-paper/40 block truncate">
                      {item.description}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
