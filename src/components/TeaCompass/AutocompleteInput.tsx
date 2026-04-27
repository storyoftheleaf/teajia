import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';

// Persisted set of dismissed suggestions (typos, etc.)
const DISMISSED_KEY = 'teajia-autocomplete-dismissed';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function dismissSuggestion(text: string) {
  const set = getDismissed();
  set.add(text.toLowerCase());
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
}

function isNotDismissed(text: string): boolean {
  return !getDismissed().has(text.toLowerCase());
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  onSelect?: (item: any) => void;
  itemData?: Record<string, any>;
  /** Shown as browseable hints when focused but nothing is typed yet (e.g. first 6 varieties for selected type) */
  hintSuggestions?: string[];
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  onSelect,
  itemData,
  hintSuggestions,
}) => {
  const [focused, setFocused] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState(0);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isSearching = value.length > 0;

  // Filter: case-insensitive contains on display name OR Chinese characters in itemData
  const filtered = isSearching
    ? suggestions
        .filter((s) => {
          if (!isNotDismissed(s)) return false;
          if (s.toLowerCase().includes(value.toLowerCase())) return true;
          // Also match on chineseName so typing characters like "铁观音" finds "Tie Guan Yin"
          const cn = itemData?.[s]?.chineseName as string | undefined;
          if (cn && cn.includes(value)) return true;
          return false;
        })
        .slice(0, 10)
    : [];
  void dismissedVersion;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setHighlightedIndex(-1);
    },
    [onChange]
  );

  const handleSelect = useCallback(
    (suggestion: string) => {
      onChange(suggestion);
      if (onSelect && itemData?.[suggestion]) {
        onSelect(itemData[suggestion]);
      }
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    },
    [onChange, onSelect, itemData]
  );

  const handleDismiss = useCallback(
    (suggestion: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dismissSuggestion(suggestion);
      setDismissedVersion((v) => v + 1);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isSearching) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
          handleSelect(filtered[highlightedIndex]);
        } else if (filtered.length > 0) {
          handleSelect(filtered[0]);
        }
      } else if (e.key === 'Escape') {
        setFocused(false);
        inputRef.current?.blur();
      }
    },
    [isSearching, filtered, highlightedIndex, handleSelect]
  );

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setFocused(false);
      setHighlightedIndex(-1);
    }, 150);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => { if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current); };
  }, []);

  const renderHighlighted = (text: string) => {
    if (!value) return text;
    const idx = text.toLowerCase().indexOf(value.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-medium text-tea-gold">{text.slice(idx, idx + value.length)}</span>
        {text.slice(idx + value.length)}
      </>
    );
  };

  // Subtitle: show chineseName and/or region for variety data, type+year for inventory
  const buildSubtitle = (data: Record<string, any>): string | null => {
    const parts: string[] = [];
    const type = data.type || data.product_type;
    const cn = data.chineseName as string | undefined;
    const region = data.originRegion || data.origin_region;
    const year = data.year;
    if (type) parts.push(type);
    if (cn) parts.push(cn);
    else if (region) parts.push(region);
    if (year) parts.push(String(year));
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  const showSearchDropdown = focused && isSearching;
  const showHints = focused && !isSearching && hintSuggestions && hintSuggestions.length > 0;

  return (
    <div className="flex-1 min-w-0 relative" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        className={`text-base ${className ?? ''}`}
      />

      {/* Search results dropdown */}
      {showSearchDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-tea-surface border border-tea-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-tea-text-dim italic">No matches — add as new</div>
          ) : (
            filtered.map((suggestion, idx) => {
              const data = itemData?.[suggestion];
              const subtitle = data ? buildSubtitle(data) : null;

              return (
                <div
                  key={suggestion}
                  className={`flex items-center justify-between group px-3 py-2 cursor-pointer transition-colors ${
                    idx === highlightedIndex ? 'bg-tea-gold/10' : 'hover:bg-tea-gold/10'
                  }`}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(suggestion); }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <div>
                    <div className="text-sm text-tea-text">{renderHighlighted(suggestion)}</div>
                    {subtitle && (
                      <div className="text-[11px] text-tea-text-dim">{subtitle}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => handleDismiss(suggestion, e)}
                    className="text-tea-text-dim/0 group-hover:text-tea-text-dim hover:!text-tea-text transition-colors ml-2 shrink-0"
                    aria-label="Remove suggestion"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Hint chips — shown on empty focus when a type is selected */}
      {showHints && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-tea-surface border border-tea-border rounded-lg shadow-lg p-2">
          <p className="text-[10px] text-tea-text-dim uppercase tracking-[0.1em] mb-1.5 px-1">Examples</p>
          <div className="flex flex-wrap gap-1.5">
            {hintSuggestions.map((hint) => (
              <button
                key={hint}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(hint); }}
                className="text-[12px] text-tea-text-sec bg-tea-elevated px-2.5 py-1 rounded-full hover:text-tea-text transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutocompleteInput;
