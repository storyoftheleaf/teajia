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
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  onSelect,
  itemData,
}) => {
  const [focused, setFocused] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState(0);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter: case-insensitive contains, exclude dismissed, max 8
  const filtered = value.length >= 2
    ? suggestions
        .filter((s) => s.toLowerCase().includes(value.toLowerCase()) && isNotDismissed(s))
        .slice(0, 8)
    : [];
  void dismissedVersion;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleSelect = useCallback(
    (suggestion: string) => {
      onChange(suggestion);
      if (onSelect && itemData?.[suggestion]) {
        onSelect(itemData[suggestion]);
      }
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
      if (e.key === 'Enter' && focused && filtered.length > 0) {
        e.preventDefault();
        handleSelect(filtered[0]);
      }
    },
    [focused, filtered, handleSelect]
  );

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => setFocused(false), 150);
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

  const showSuggestions = focused && filtered.length > 0;

  return (
    <div className="flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {filtered.map((suggestion) => (
            <div key={suggestion} className="flex items-center gap-0.5 group">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(suggestion);
                }}
                className="text-[11px] text-tea-text-sec bg-tea-surface/60 hover:bg-tea-surface px-2.5 py-1 rounded-full transition-colors cursor-pointer"
              >
                {renderHighlighted(suggestion)}
              </button>
              <button
                type="button"
                onMouseDown={(e) => handleDismiss(suggestion, e)}
                className="text-tea-text-dim/0 group-hover:text-tea-text-dim hover:!text-tea-text transition-colors -ml-1"
                aria-label="Remove suggestion"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutocompleteInput;
