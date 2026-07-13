import React, { useId, useMemo, useState } from 'react';
import type { LookupState } from '../../../lib/api';
import { rankImportMatches, type ImportMatchOption } from './importReviewDomain';

interface Props<T extends ImportMatchOption> {
  label: string;
  lookup: LookupState<T>;
  selectedId: string;
  proposedId?: string | null;
  proposedName?: string | null;
  placeholder?: string;
  newOptionLabel?: string;
  disabled?: boolean;
  onRetry: () => void;
  onSelect: (id: string) => void;
}

const inputClass = 'min-h-11 w-full rounded-md border border-tea-border bg-tea-elevated px-3 text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold lg:text-ui-13';

export const ImportMatchPicker = <T extends ImportMatchOption>({ label, lookup, selectedId, proposedId, proposedName, placeholder, newOptionLabel, disabled, onRetry, onSelect }: Props<T>) => {
  const id = useId();
  const listId = `${id}-listbox`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ranked = useMemo(() => rankImportMatches(lookup.options, query, proposedName || ''), [lookup.options, proposedName, query]);
  const selected = lookup.options.find(option => option.id === selectedId);
  const choices: ImportMatchOption[] = [...ranked, ...(newOptionLabel && (lookup.status === 'ready' || lookup.status === 'empty') ? [{ id: 'new', name: newOptionLabel }] : [])];
  const choose = (option: ImportMatchOption) => {
    onSelect(option.id);
    setQuery('');
    setOpen(false);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => Math.min(index + 1, Math.max(choices.length - 1, 0))); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => index <= 0 ? Math.max(choices.length - 1, 0) : index - 1); }
    else if (event.key === 'Enter' && open && choices[active]) { event.preventDefault(); choose(choices[active]); }
    else if (event.key === 'Escape') setOpen(false);
  };
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-ui-11 text-tea-text-sec">{label}</label>
      {selected && <p className="break-words text-ui-12 text-tea-text"><span className="text-tea-text-sec">Selected:</span> {selected.name}</p>}
      {proposedName && <p className="break-words text-ui-11 text-tea-text-sec">Suggested: {proposedName}</p>}
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 && choices[active] ? `${id}-option-${active}` : undefined}
        disabled={disabled || lookup.status === 'loading' || lookup.status === 'error'}
        value={query}
        placeholder={lookup.status === 'loading' ? 'Loading existing records…' : placeholder || `Search ${label.toLocaleLowerCase()}`}
        onFocus={() => { setOpen(true); setActive(-1); }}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={onKeyDown}
        className={inputClass}
      />
      {lookup.status === 'error' && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-ui-11 text-tea-text-sec"><span>{lookup.error || `Could not load ${label.toLocaleLowerCase()}.`}</span><button type="button" disabled={disabled} onClick={onRetry} className="tap-target min-h-11 text-tea-gold disabled:opacity-50">Retry</button></div>}
      {lookup.status === 'empty' && <p className="text-ui-11 text-tea-text-sec">No existing records yet.</p>}
      {open && lookup.status !== 'loading' && lookup.status !== 'error' && (
        <ul id={listId} role="listbox" aria-label={`${label} matches`} className="max-h-52 overflow-y-auto rounded-md border border-tea-border bg-tea-surface p-1">
          {choices.map((option, index) => <li key={option.id} id={`${id}-option-${index}`} role="option" aria-selected={option.id === selectedId} onMouseDown={event => event.preventDefault()} onClick={() => { if (!disabled) choose(option); }} className={`tap-target min-h-11 w-full cursor-pointer rounded px-3 py-2 text-left ${index === active ? 'bg-tea-accent-sub' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
            <span className="block break-words text-ui-13 text-tea-text">{option.name}</span>
            {(option.matchReason || option.subtitle || option.id === proposedId) && <span className="block text-ui-10 text-tea-text-sec">{option.id === proposedId ? 'AI proposed match' : option.matchReason || option.subtitle}</span>}
          </li>)}
          {!choices.length && <li className="px-3 py-2 text-ui-11 text-tea-text-sec">No matching existing records.</li>}
        </ul>
      )}
    </div>
  );
};
