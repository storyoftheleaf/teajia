import React from 'react';
import { Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

/** Shared search input for the Wisdom browsers (cultivars, regions, varieties). */
export const SearchBox: React.FC<Props> = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim" />
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full bg-tea-bg border border-tea-border rounded-md text-tea-text pl-9 pr-3 py-2 text-ui-14 placeholder:text-tea-text-dim focus:outline-none focus:border-tea-gold/40"
    />
  </div>
);
