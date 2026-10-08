import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api, hasToken } from '../../lib/api';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { Section } from './TodayView';
import { VendorCard } from './VendorCard';
import type { TeaCompassEntry } from './types';

interface Vendor { id?: string; name: string; tags?: string[] | string }

interface VendorsViewProps {
  onOpenTea: (entryId: string) => void;
  onAddTea: (vendor: { id?: string; name: string }) => void;
  onAddTeaware: (vendor: { id?: string; name: string }) => void;
  /** Open straight onto one vendor's card (from Today). */
  initialVendor?: { id?: string; name: string } | null;
  onCloseVendor?: () => void;
}

const isVendorTagged = (tags: Vendor['tags']) => {
  const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[,\[\]"]+/) : [];
  return list.some((t) => String(t).trim().toLowerCase() === 'vendor');
};

/**
 * Vendors as a tab: one line each, searchable, so fifty still work. A vendor
 * can be only a name; its card grows over time. The card reuses Curate's own
 * vendor panel (photos, contact, location) so nothing it could do is lost, and
 * lists every tea and piece of teaware captured with that vendor.
 */
export const VendorsView: React.FC<VendorsViewProps> = ({ onOpenTea, onAddTea, onAddTeaware, initialVendor, onCloseVendor }) => {
  const entries = useTeaCompassStore((s) => s.entries);
  const [remote, setRemote] = useState<Vendor[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Vendor | null>(initialVendor ?? null);
  useEffect(() => { if (initialVendor) setOpen(initialVendor); }, [initialVendor]);

  useEffect(() => {
    if (!hasToken()) return;
    api.customers.list()
      .then((res: any) => setRemote(((res?.customers || res || []) as any[])
        .filter((c) => isVendorTagged(c.tags))
        .map((c) => ({ id: c.id, name: c.name, tags: c.tags }))))
      .catch(() => {});
  }, []);

  // Every vendor anyone has captured with, known to the shop or only typed.
  const vendors = useMemo(() => {
    const byKey = new Map<string, Vendor & { teas: TeaCompassEntry[] }>();
    const keyOf = (id: string | undefined, name: string) => id || `name:${name.trim().toLowerCase()}`;
    for (const v of remote) byKey.set(keyOf(v.id, v.name), { ...v, teas: [] });
    for (const e of entries) {
      const name = e.vendorName?.trim();
      if (!name && !e.vendorId) continue;
      const key = keyOf(e.vendorId, name || '');
      const found = byKey.get(key) ?? { id: e.vendorId, name: name || 'Vendor', teas: [] };
      found.teas.push(e);
      byKey.set(key, found);
    }
    return Array.from(byKey.values()).sort((a, b) => b.teas.length - a.teas.length || a.name.localeCompare(b.name));
  }, [remote, entries]);

  const shown = query.trim()
    ? vendors.filter((v) => v.name.toLowerCase().includes(query.trim().toLowerCase()))
    : vendors;

  if (open) {
    const v = vendors.find((x) => (open.id && x.id === open.id) || x.name === open.name) ?? { ...open, teas: [] };
    return <VendorCard vendor={{ id: v.id, name: v.name }} teas={v.teas} onBack={() => { setOpen(null); onCloseVendor?.(); }} onOpenTea={onOpenTea} onAddTea={onAddTea} onAddTeaware={onAddTeaware} />;
  }

  return (
    <div className="curate-v2 -mx-4">
      <div className="px-4 pb-2">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors"
            aria-label="Search vendors"
            className="min-h-11 w-full rounded-[3px] border border-tea-border bg-transparent py-2 pl-3 pr-9 font-mono text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="tap-target absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      <Section title="Vendors" count={shown.length} />
      {shown.length === 0 && (
        <p className="px-4 py-4 text-ui-13 text-tea-text-sec">
          {query ? 'No vendor by that name yet. Pick one when you start a table, and it appears here.' : 'Vendors appear here as you taste with them. A name is enough to start.'}
        </p>
      )}
      {shown.map((v) => (
        <button key={v.id || v.name} type="button" onClick={() => setOpen(v)} className="curate-v2-row w-full text-left">
          <span className="curate-v2-name">{v.name}</span>
          <span className="flex-1" />
          <span className="text-ui-12 text-tea-text-sec tabular-nums">{v.teas.length ? `${v.teas.length} ${v.teas.length === 1 ? 'tea' : 'teas'}` : 'name only'}</span>
        </button>
      ))}
    </div>
  );
};
