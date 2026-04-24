import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X as XIcon, User } from 'lucide-react';
import { api } from '../../../lib/api';
import type { CollectionRecipient } from '../../../types';

interface RecipientTypeaheadProps {
  value: CollectionRecipient[];
  onChange: (next: CollectionRecipient[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

interface CustomerRow {
  id: string;
  name: string;
  phone?: string;
}

export const RecipientTypeahead: React.FC<RecipientTypeaheadProps> = ({
  value, onChange, placeholder = 'Type a name…', autoFocus,
}) => {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.customers.list('customer')
      .then((rows: any) => {
        if (cancelled) return;
        const list: CustomerRow[] = Array.isArray(rows) ? rows : (rows?.customers ?? rows?.results ?? []);
        setCustomers(list);
      })
      .catch(() => { if (!cancelled) setCustomers([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const alreadyAddedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const r of value) {
      if (r.customer_id) keys.add(`c:${r.customer_id}`);
      keys.add(`n:${r.name.trim().toLowerCase()}`);
    }
    return keys;
  }, [value]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter(c => {
        if (alreadyAddedKeys.has(`c:${c.id}`)) return false;
        return c.name.toLowerCase().includes(q);
      })
      .slice(0, 6);
  }, [customers, query, alreadyAddedKeys]);

  useEffect(() => { setActiveIdx(0); }, [query, suggestions.length]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const addFromCustomer = (c: CustomerRow) => {
    if (alreadyAddedKeys.has(`c:${c.id}`)) return;
    onChange([...value, { customer_id: c.id, name: c.name, phone: c.phone }]);
    setQuery('');
    setOpen(false);
  };

  const addAsFreeform = () => {
    const raw = query.trim();
    if (!raw) return;
    if (alreadyAddedKeys.has(`n:${raw.toLowerCase()}`)) {
      setQuery('');
      return;
    }
    onChange([...value, { name: raw }]);
    setQuery('');
    setOpen(false);
  };

  const remove = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
      setOpen(true);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && suggestions[activeIdx]) {
        addFromCustomer(suggestions[activeIdx]);
      } else {
        addAsFreeform();
      }
    } else if (e.key === 'Backspace' && !query && value.length) {
      remove(value.length - 1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="min-h-[44px] flex flex-wrap gap-1.5 px-2 py-1.5 bg-tea-bg border border-tea-border rounded-lg focus-within:ring-1 focus-within:ring-tea-gold/40">
        {value.map((r, i) => (
          <span
            key={`${r.customer_id ?? 'n'}_${i}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-tea-elevated text-tea-text text-[12px]"
          >
            {r.customer_id && <User size={10} className="text-tea-gold" />}
            <span className="truncate max-w-[180px]">{r.name}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label={`Remove ${r.name}`}
            >
              <XIcon size={11} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={value.length === 0 ? placeholder : ''}
          autoFocus={autoFocus}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-xs text-tea-text placeholder:text-tea-text-dim py-1"
        />
      </div>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-dropdown bg-tea-elevated border border-tea-border rounded-lg shadow-lg max-h-[220px] overflow-y-auto">
          {loading && suggestions.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-tea-text-dim">Loading contacts…</p>
          ) : suggestions.length === 0 ? (
            <button
              type="button"
              onClick={addAsFreeform}
              className="w-full text-left px-3 py-2 text-xs text-tea-text hover:bg-tea-surface transition-colors"
            >
              Add <span className="text-tea-gold">"{query.trim()}"</span> as recipient
            </button>
          ) : (
            <>
              {suggestions.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => addFromCustomer(c)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    i === activeIdx ? 'bg-tea-surface' : 'hover:bg-tea-surface'
                  }`}
                >
                  <User size={11} className="text-tea-gold flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-tea-text truncate">{c.name}</p>
                    {c.phone && <p className="text-[10px] text-tea-text-dim truncate">{c.phone}</p>}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={addAsFreeform}
                className="w-full text-left px-3 py-2 text-[11px] text-tea-text-sec border-t border-tea-border hover:bg-tea-surface transition-colors"
              >
                Or add <span className="text-tea-gold">"{query.trim()}"</span> as a new recipient
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
