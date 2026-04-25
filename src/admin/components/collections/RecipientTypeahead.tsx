import React, { useEffect, useMemo, useState } from 'react';
import { X as XIcon, Check, Search, Plus, Loader2 } from 'lucide-react';
import { api } from '../../../lib/api';
import type { CollectionRecipient } from '../../../types';

// Kept the original filename + export name so existing imports (Share sheet,
// AddPublicationSheet) keep working without churn. The component is the
// "RecipientPicker": a checkbox list of customers plus an inline freeform-name
// input — better suited to small contact sets than a typeahead dropdown.

interface RecipientTypeaheadProps {
  value: CollectionRecipient[];
  onChange: (next: CollectionRecipient[]) => void;
  /** Unused now but kept in the signature for source-compatibility. */
  placeholder?: string;
  /** Unused now — there's no single input to focus. */
  autoFocus?: boolean;
}

interface CustomerRow {
  id: string;
  name: string;
  phone?: string;
}

export const RecipientTypeahead: React.FC<RecipientTypeaheadProps> = ({
  value, onChange,
}) => {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [freeform, setFreeform] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.customers.list('customer')
      .then((rows: any) => {
        if (cancelled) return;
        const list: CustomerRow[] = Array.isArray(rows) ? rows : (rows?.customers ?? rows?.results ?? []);
        // Sort alphabetically — small list, predictable order beats recency.
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setCustomers(list);
      })
      .catch(() => { if (!cancelled) setCustomers([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selectedCustomerIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of value) if (r.customer_id) s.add(r.customer_id);
    return s;
  }, [value]);

  const freeformAlreadyAdded = useMemo(() => {
    const s = new Set<string>();
    for (const r of value) if (!r.customer_id) s.add(r.name.trim().toLowerCase());
    return s;
  }, [value]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c => c.name.toLowerCase().includes(q));
  }, [customers, filter]);

  const toggleCustomer = (c: CustomerRow) => {
    if (selectedCustomerIds.has(c.id)) {
      onChange(value.filter(r => r.customer_id !== c.id));
    } else {
      onChange([...value, { customer_id: c.id, name: c.name, phone: c.phone }]);
    }
  };

  const removeAt = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const addFreeform = () => {
    const raw = freeform.trim();
    if (!raw) return;
    if (freeformAlreadyAdded.has(raw.toLowerCase())) {
      setFreeform('');
      return;
    }
    onChange([...value, { name: raw }]);
    setFreeform('');
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Selected chips — only render when there's something selected */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((r, i) => (
            <span
              key={`${r.customer_id ?? 'n'}_${i}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-tea-elevated text-tea-text text-[12px]"
            >
              <span className="truncate max-w-[180px]">{r.name}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="text-tea-text-sec hover:text-tea-text transition-colors"
                aria-label={`Remove ${r.name}`}
              >
                <XIcon size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Customer list */}
      <div className="border border-tea-border rounded-lg bg-tea-bg overflow-hidden">
        {customers.length > 6 && (
          <div className="relative border-b border-tea-border">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter contacts…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              name="recipient-filter"
              className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-transparent border-none outline-none text-tea-text placeholder:text-tea-text-dim"
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-tea-text-dim text-[11px]">
            <Loader2 size={11} className="animate-spin" /> Loading contacts…
          </div>
        ) : customers.length === 0 ? (
          <p className="px-3 py-4 text-[11px] text-tea-text-dim italic">
            No contacts yet — add a recipient by name below.
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-4 text-[11px] text-tea-text-dim italic">
            No contacts match "{filter}". Add by name below.
          </p>
        ) : (
          <ul className="max-h-[260px] overflow-y-auto divide-y divide-tea-border">
            {filtered.map(c => {
              const isSelected = selectedCustomerIds.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggleCustomer(c)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-tea-gold-lt' : 'hover:bg-tea-elevated'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-sm flex-shrink-0 flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-tea-gold' : 'bg-tea-surface border border-tea-border'
                    }`}>
                      {isSelected && <Check size={9} className="text-tea-bg" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-tea-text truncate">{c.name}</p>
                      {c.phone && <p className="text-[10px] text-tea-text-dim truncate">{c.phone}</p>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Freeform — add by name */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={freeform}
          onChange={e => setFreeform(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFreeform(); } }}
          placeholder="Or add a name not in your contacts…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          name="recipient-freeform"
          className="flex-1 px-3 py-2 text-xs bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
        />
        <button
          type="button"
          onClick={addFreeform}
          disabled={!freeform.trim()}
          className="flex items-center gap-1 px-3 py-2 text-[11px] text-tea-gold hover:text-tea-gold-lt transition-colors disabled:text-tea-text-dim disabled:cursor-not-allowed"
        >
          <Plus size={11} /> Add
        </button>
      </div>
    </div>
  );
};
