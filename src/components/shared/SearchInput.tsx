import React, { useState } from 'react';
import { Icons } from '../Icons';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className={`relative transition-all duration-300 ${isFocused ? 'ring-1 ring-tea-gold/30' : ''} rounded-[1px] ${className}`}
    >
      <Icons.Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors duration-300 ${isFocused ? 'text-tea-gold/60' : 'text-tea-text-sec'}`} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 bg-tea-surface rounded-[1px] text-sm text-tea-text placeholder:text-tea-text-sec font-sans focus:outline-none transition-all duration-300"
        style={{ boxShadow: 'inset 0 1px 3px rgb(var(--tea-bg-rgb) / 0.2), inset 0 1px 0 var(--tea-accent-sub)' }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text-sec hover:text-tea-text transition-colors"
        >
          <Icons.Close className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
