import { useMemo, useState } from 'react';
import { Search, X, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { useProducts } from '../../hooks/useAdminData';

interface PickedTea {
  id: string;
  name: string;
}

interface TeaPickerProps {
  picked: PickedTea[];
  onChange: (next: PickedTea[]) => void;
}

export function TeaPicker({ picked, onChange }: TeaPickerProps) {
  const { data: products = [], isLoading } = useProducts();
  const [query, setQuery] = useState('');

  const pickedIds = useMemo(() => new Set(picked.map(p => p.id)), [picked]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter(p => !pickedIds.has(p.id));
    if (!q) return list.slice(0, 50);
    return list.filter(p =>
      (p.givenName || '').toLowerCase().includes(q) ||
      (p.productName || '').toLowerCase().includes(q) ||
      (p.chineseName || '').toLowerCase().includes(q) ||
      (p.type || '').toLowerCase().includes(q) ||
      (p.originRegion || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [products, query, pickedIds]);

  const add = (id: string, name: string) => {
    onChange([...picked, { id, name }]);
    setQuery('');
  };

  const remove = (id: string) => {
    onChange(picked.filter(p => p.id !== id));
  };

  const move = (id: string, direction: -1 | 1) => {
    const idx = picked.findIndex(p => p.id === id);
    if (idx < 0) return;
    const next = [...picked];
    const swap = idx + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Order pills */}
      {picked.length > 0 && (
        <div className="space-y-2">
          <p className="text-ui-11 uppercase tracking-[0.14em] text-tea-text-sec">
            Order ({picked.length})
          </p>
          <ul className="space-y-1.5">
            {picked.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-xl bg-tea-elevated px-3 py-2"
              >
                <span className="font-display text-ui-13 text-tea-gold-lt w-7 text-center">
                  {romanShort(i)}
                </span>
                <span className="flex-1 text-ui-13 text-tea-text truncate">{p.name}</span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(p.id, -1)}
                    className="p-1 text-tea-text-sec hover:text-tea-text disabled:opacity-30 tap-target"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === picked.length - 1}
                    onClick={() => move(p.id, 1)}
                    className="p-1 text-tea-text-sec hover:text-tea-text disabled:opacity-30 tap-target"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => remove(p.id)}
                    className="p-1 text-tea-text-sec hover:text-tea-text tap-target"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Search */}
      <label className="block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tea-text-sec" />
          <input
            type="text"
            placeholder="Search teas"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-tea-elevated rounded-xl pl-9 pr-3 py-2 text-ui-13 text-tea-text placeholder-tea-text-sec focus:outline-none focus:ring-1 focus:ring-tea-gold"
          />
        </div>
      </label>

      <div className="max-h-72 overflow-auto rounded-xl border border-tea-border divide-y divide-tea-border">
        {isLoading && <p className="px-3 py-2 text-ui-12 text-tea-text-sec">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="px-3 py-2 text-ui-12 text-tea-text-sec">No matches.</p>
        )}
        {filtered.map(p => {
          const name = p.givenName || p.productName || 'Tea';
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => add(p.id, name)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-tea-elevated transition-colors"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-ui-13 text-tea-text truncate">{name}</span>
                <span className="block text-ui-11 text-tea-text-sec mt-0.5">
                  {[p.type, p.year, p.originRegion].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Check className="w-3.5 h-3.5 text-tea-gold opacity-0 group-hover:opacity-100" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
function romanShort(i: number): string { return ROMAN[i] ?? String(i + 1); }
