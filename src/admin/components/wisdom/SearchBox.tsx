import React from 'react';
import { Search, X as XIcon } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

/**
 * The Wisdom toolbar's find field. An underlined bare input rather than a boxed
 * control, matching the inventory search: it costs a third of the height and
 * the toolbar row stays a toolbar rather than becoming a form.
 */
export const SearchBox: React.FC<Props> = ({ value, onChange, placeholder }) => (
  <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-tea-border py-1.5">
    <Search size={15} className="shrink-0 text-tea-text-dim" aria-hidden="true" />
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="min-w-0 flex-1 bg-transparent font-mono text-ui-12 text-tea-text outline-none placeholder:text-tea-text-dim"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="tap-target shrink-0 text-tea-text-sec hover:text-tea-text"
      >
        <XIcon size={14} />
      </button>
    )}
  </div>
);
