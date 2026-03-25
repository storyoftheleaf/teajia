import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions: case-insensitive contains, max 6
  const filtered = value.length >= 2
    ? suggestions
        .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 6)
    : [];

  const showDropdown = open && focused && filtered.length > 0;

  useEffect(() => {
    setOpen(filtered.length > 0);
  }, [filtered.length]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setOpen(true);
    },
    [onChange]
  );

  const handleSelect = useCallback(
    (suggestion: string) => {
      onChange(suggestion);
      setOpen(false);
      if (onSelect && itemData?.[suggestion]) {
        onSelect(itemData[suggestion]);
      }
      inputRef.current?.blur();
    },
    [onChange, onSelect, itemData]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && showDropdown && filtered.length > 0) {
        e.preventDefault();
        handleSelect(filtered[0]);
      }
    },
    [showDropdown, filtered, handleSelect]
  );

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocused(true);
    setOpen(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Small delay so tap on suggestion registers before close
    blurTimeoutRef.current = setTimeout(() => {
      setFocused(false);
      setOpen(false);
    }, 180);
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  // Highlight matching portion of text
  const renderHighlighted = (text: string) => {
    if (!value) return text;
    const idx = text.toLowerCase().indexOf(value.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-semibold text-tea-gold">{text.slice(idx, idx + value.length)}</span>
        {text.slice(idx + value.length)}
      </>
    );
  };

  return (
    <div className="relative flex-1 min-w-0">
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
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 z-20 bg-tea-surface border border-tea-border rounded-lg shadow-lg mt-1 overflow-hidden"
          >
            {filtered.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onMouseDown={(e) => {
                  // Prevent blur from firing before select
                  e.preventDefault();
                  handleSelect(suggestion);
                }}
                className="w-full text-left px-3 py-2 text-sm text-tea-text hover:bg-tea-elevated cursor-pointer transition-colors"
              >
                {renderHighlighted(suggestion)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AutocompleteInput;
