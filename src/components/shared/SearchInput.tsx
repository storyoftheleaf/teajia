import React from 'react';
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
  return (
    <div className={`relative ${className}`}>
      <Icons.Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-text/40 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 bg-tea-bg border border-tea-border rounded-[1px] text-sm text-tea-text placeholder:text-tea-text/40 font-sans focus:outline-none focus:border-tea-gold/50 focus:ring-1 focus:ring-tea-gold/20 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text/40 hover:text-tea-text/70/70 transition-colors"
        >
          <Icons.Close className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
