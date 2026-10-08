import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { BottomSheet } from '../shared/BottomSheet';
import { api, hasToken } from '../../lib/api';
import { useTeaCompassStore } from '../../lib/teaCompassStore';

interface VendorPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen vendor, or nulls for "no one yet". */
  onPick: (id: string | null, name: string | null) => void;
}

interface Option { id?: string; name: string; teas: number }

const isVendor = (tags: unknown) => {
  const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[,\[\]"]+/) : [];
  return list.some((t) => String(t).trim().toLowerCase() === 'vendor');
};

/**
 * "Whose table?" A search, never a row of buttons, so fifty vendors still
 * work. Known vendors and every name typed on a tea are offered; a new name is
 * one tap and becomes a vendor with nothing else filled in.
 */
export const VendorPickerSheet: React.FC<VendorPickerSheetProps> = ({ open, onOpenChange, onPick }) => {
  const entries = useTeaCompassStore((s) => s.entries);
  const [remote, setRemote] = useState<Array<{ id: string; name: string }>>([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  // "New vendor" sits first, so a vendor you know is new is one tap and a
  // name, without searching the list for someone who is not on it.
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !hasToken()) return;
    setQuery('');
    setAdding(false);
    api.customers.list()
      .then((res: any) => setRemote(((res?.customers || res || []) as any[]).filter((c) => isVendor(c.tags)).map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, [open]);

  const options = useMemo(() => {
    const byKey = new Map<string, Option>();
    for (const v of remote) byKey.set(v.id, { id: v.id, name: v.name, teas: 0 });
    for (const e of entries) {
      const name = e.vendorName?.trim();
      if (!name) continue;
      const key = e.vendorId || `name:${name.toLowerCase()}`;
      const found = byKey.get(key) ?? { id: e.vendorId, name, teas: 0 };
      found.teas += 1;
      byKey.set(key, found);
    }
    const q = query.trim().toLowerCase();
    return Array.from(byKey.values())
      .filter((o) => !q || o.name.toLowerCase().includes(q))
      .sort((a, b) => b.teas - a.teas || a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [remote, entries, query]);

  const exact = options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase());

  const addNew = async () => {
    const name = query.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = hasToken() ? await api.customers.create({ name, tags: ['vendor'], source: 'compass' }) : null;
      onPick((res as any)?.id ?? null, name);
    } catch {
      onPick(null, name);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Whose table?" description="Optional. Add it later if you don't know yet." large>
      <div className="curate-v2 pb-nav-gap">
        <button
          type="button"
          onClick={() => { setAdding((v) => !v); window.setTimeout(() => inputRef.current?.focus(), 0); }}
          aria-pressed={adding}
          data-testid="vendor-picker-new"
          className="curate-v2-row w-full text-left"
        >
          <Plus size={16} className="text-tea-gold" />
          <span className="text-ui-15 font-medium text-tea-gold">New vendor</span>
          <span className="flex-1" />
          {adding && <span className="text-ui-12 text-tea-text-dim">type the name below</span>}
        </button>
        <div className="relative px-4 py-2">
          {adding
            ? <Plus size={13} className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-tea-gold" />
            : <Search size={13} className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-tea-text-dim" />}
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && query.trim() && (adding || !exact)) void addNew(); }}
            placeholder={adding ? 'New vendor’s name' : 'Search your vendors'}
            aria-label={adding ? 'New vendor name' : 'Search or add a vendor'}
            enterKeyHint={adding ? 'done' : 'search'}
            className="min-h-11 w-full rounded-md border border-tea-border bg-tea-surface py-2 pl-9 pr-3 text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold"
          />
        </div>
        {adding && query.trim() && (
          <div className="px-4 pb-3">
            <button type="button" disabled={saving} onClick={() => void addNew()} className="cta-solid min-h-11 w-full rounded-md text-ui-14 font-semibold">
              Add {query.trim()}
            </button>
          </div>
        )}
        {!adding && query.trim() && !exact && (
          <button type="button" disabled={saving} onClick={() => void addNew()} className="curate-v2-row w-full text-left">
            <span className="text-ui-13 font-medium text-tea-gold">＋ Add “{query.trim()}” as a new vendor</span>
          </button>
        )}
        {!adding && options.map((o) => (
          <button key={o.id || o.name} type="button" onClick={() => onPick(o.id ?? null, o.name)} className="curate-v2-row w-full text-left">
            <span className="curate-v2-name">{o.name}</span>
            <span className="flex-1" />
            <span className="text-ui-12 text-tea-text-dim tabular-nums">{o.teas ? `${o.teas} ${o.teas === 1 ? 'tea' : 'teas'}` : 'name only'}</span>
          </button>
        ))}
        <button type="button" onClick={() => onPick(null, null)} className="curate-v2-row w-full text-left">
          <span className="text-ui-13 text-tea-text-sec">No one yet, add it later</span>
        </button>
      </div>
    </BottomSheet>
  );
};
