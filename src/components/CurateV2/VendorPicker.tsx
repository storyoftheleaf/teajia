import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, hasToken } from '../../lib/api';
import { useTeaCompassStore } from '../../lib/teaCompassStore';

interface VendorPickerProps {
  /**
   * A vendor was chosen. A known vendor calls this once. A new one calls it
   * at once with no id (capture never waits on the network), then again with
   * the id when its record exists, so a caller that stores the id simply
   * stores it the second time.
   */
  onPick: (id: string | undefined, name: string) => void;
  /** Escape, or the close button. Absent: no close button. */
  onCancel?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

interface Vendor { id?: string; name: string }

/** True when a customer's tags say vendor, whether they arrive as an array or a string. */
export const isVendorTagged = (tags: unknown): boolean => {
  const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[,[\]"]+/) : [];
  return list.some((t) => String(t).trim().toLowerCase() === 'vendor');
};

/**
 * The one vendor picker, in Curate: used for the table's vendor and for a
 * tea's. A search input; first row "New vendor…" (or `New vendor "x"` once
 * something is typed); then up to five recent vendors; then the shop's own
 * vendors. A known vendor is one tap. A new one is created as a real vendor
 * record (a customer tagged vendor) in one tap.
 */
export const VendorPicker: React.FC<VendorPickerProps> = ({ onPick, onCancel, autoFocus = true, placeholder = 'Search vendors' }) => {
  const entries = useTeaCompassStore((s) => s.entries);
  const pendingEntries = useTeaCompassStore((s) => s.pendingEntries);
  const [shopVendors, setShopVendors] = useState<Vendor[]>([]);
  const [query, setQuery] = useState('');
  // "New vendor…" with nothing typed: the same input becomes the name field.
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasToken()) return;
    let live = true;
    api.customers.list()
      .then((res: any) => {
        if (!live) return;
        setShopVendors(((res?.customers || res || []) as any[])
          .filter((c) => isVendorTagged(c.tags))
          .map((c) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  // The vendors on the five most recently captured teas, newest first.
  const recent = useMemo(() => {
    const seen = new Map<string, Vendor>();
    const all = [...pendingEntries, ...entries];
    for (const e of all) {
      const name = e.vendorName?.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.set(name.toLowerCase(), { id: e.vendorId || undefined, name });
      if (seen.size >= 5) break;
    }
    return Array.from(seen.values());
  }, [entries, pendingEntries]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const seen = new Set<string>();
    const out: Array<Vendor & { recent?: boolean }> = [];
    for (const v of recent) {
      const key = v.name.toLowerCase();
      if (seen.has(key) || (q && !key.includes(q))) continue;
      seen.add(key);
      // A recent name the shop knows carries the shop's id.
      const known = shopVendors.find((s) => s.name.toLowerCase() === key);
      out.push({ id: v.id ?? known?.id, name: v.name, recent: true });
    }
    for (const v of shopVendors) {
      const key = v.name.toLowerCase();
      if (seen.has(key) || (q && !key.includes(q))) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  }, [recent, shopVendors, query]);

  const createVendor = async (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    setQuery('');
    setAdding(false);
    onPick(undefined, name);
    if (!hasToken()) return;
    try {
      const res = await api.customers.create({ name, tags: ['vendor'], source: 'compass' });
      const id = (res as { id?: string } | null)?.id;
      if (id) {
        setShopVendors((prev) => [{ id, name }, ...prev]);
        onPick(id, name);
      }
    } catch {
      // Offline: the vendor stays name-only on the teas and can be linked later.
    }
  };

  const choose = (v: Vendor) => {
    setQuery('');
    setAdding(false);
    onPick(v.id, v.name);
  };

  const typed = query.trim();

  return (
    <div className="curate-v2" data-testid="vendor-picker">
      <div className="flex items-center gap-2 px-4 py-2">
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && typed) { e.preventDefault(); void createVendor(typed); }
            if (e.key === 'Escape') onCancel?.();
          }}
          placeholder={adding ? 'Vendor name' : placeholder}
          aria-label={adding ? 'New vendor name' : 'Search or add a vendor'}
          enterKeyHint={adding ? 'done' : 'search'}
          className="min-h-11 min-w-0 flex-1 rounded-[3px] border border-tea-border bg-transparent px-3 py-2 font-mono text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold"
        />
        {adding && (
          <button
            type="button"
            disabled={!typed}
            onClick={() => void createVendor(typed)}
            className="curate-v2-frame is-on is-tall tap-target disabled:opacity-40"
          >
            Add
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label="Close vendor list" className="curate-v2-word tap-target flex min-h-11 items-center justify-center text-tea-text-sec hover:text-tea-text">
            close
          </button>
        )}
      </div>
      {!adding && (
        <>
          <button
            type="button"
            onClick={() => {
              if (typed) void createVendor(typed);
              else { setAdding(true); window.setTimeout(() => inputRef.current?.focus(), 0); }
            }}
            data-testid="vendor-picker-new"
            className="curate-v2-row w-full text-left"
          >
            <span className="font-mono text-ui-14 text-tea-gold">{typed ? `+ New vendor "${typed}"` : '+ New vendor…'}</span>
          </button>
          <div className="max-h-[50vh] overflow-y-auto">
            {rows.map((v) => (
              <button key={v.id ?? v.name} type="button" onClick={() => choose(v)} className="curate-v2-row w-full text-left">
                <span className="curate-v2-name">{v.name}</span>
                <span className="flex-1" />
                {v.recent && <span className="curate-v2-label">recent</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
