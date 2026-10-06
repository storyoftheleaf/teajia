import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { api, hasToken } from '../../lib/api';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { Section } from './TodayView';
import { VendorInfoPanel } from './VendorInfoPanel';
import type { TeaCompassEntry, VendorDetails } from './types';

interface Vendor { id?: string; name: string; tags?: string[] | string }

interface VendorsViewProps {
  onOpenTea: (entryId: string) => void;
  onAddTea: (vendor: { id?: string; name: string }) => void;
  onAddTeaware: (vendor: { id?: string; name: string }) => void;
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
export const VendorsView: React.FC<VendorsViewProps> = ({ onOpenTea, onAddTea, onAddTeaware }) => {
  const entries = useTeaCompassStore((s) => s.entries);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const [remote, setRemote] = useState<Vendor[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Vendor | null>(null);

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
    const teas = v.teas.filter((t) => t.category === 'tea');
    const ware = v.teas.filter((t) => t.category === 'teaware');
    const detailsSource = v.teas.find((t) => t.vendorDetails && Object.values(t.vendorDetails).some((x) => x != null));
    const saveDetails = (details: VendorDetails) => {
      for (const t of v.teas) updateEntry(t.id, { vendorDetails: details });
    };
    return (
      <div className="curate-v2 -mx-4">
        <div className="flex items-baseline gap-2 px-4 pb-2">
          <button type="button" onClick={() => setOpen(null)} className="tap-target -ml-1 self-center text-tea-text-sec hover:text-tea-text" aria-label="Back to vendors">
            <ArrowLeft size={18} />
          </button>
          <span className="min-w-0 flex-1 truncate font-display text-ui-26 text-tea-text">{v.name}</span>
          <span className="text-ui-12 text-tea-text-dim tabular-nums">{teas.length} teas</span>
        </div>
        <div className="border-t border-tea-border px-4 py-3">
          <VendorInfoPanel
            vendorName={v.name}
            vendorId={v.id}
            vendorDetails={detailsSource?.vendorDetails}
            onDetailsChange={saveDetails}
          />
        </div>
        <Section title="Teas" count={teas.length} />
        {teas.map((t) => (
          <button key={t.id} type="button" onClick={() => onOpenTea(t.id)} className="curate-v2-row w-full text-left">
            <span className="curate-v2-name">{t.name || 'Untitled tea'}</span>
            {t.year != null && <span className="text-ui-12 text-tea-text-dim tabular-nums">{t.year}</span>}
            <span className="flex-1" />
            <span className="text-ui-12 text-tea-gold">Open</span>
          </button>
        ))}
        <Section title="Teaware" count={ware.length} />
        {ware.map((t) => (
          <button key={t.id} type="button" onClick={() => onOpenTea(t.id)} className="curate-v2-row w-full text-left">
            <span className="curate-v2-name">{t.name || 'Untitled piece'}</span>
            <span className="flex-1" />
            <span className="text-ui-12 text-tea-gold">Open</span>
          </button>
        ))}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <button type="button" onClick={() => onAddTeaware({ id: v.id, name: v.name })} className="min-h-11 rounded-md border border-tea-border text-ui-13 text-tea-text-sec hover:text-tea-text">＋ Teaware</button>
          <button type="button" onClick={() => onAddTea({ id: v.id, name: v.name })} className="min-h-11 rounded-md border border-tea-border text-ui-13 text-tea-text-sec hover:text-tea-text">＋ Tea</button>
        </div>
      </div>
    );
  }

  return (
    <div className="curate-v2 -mx-4">
      <div className="px-4 pb-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors"
            aria-label="Search vendors"
            className="min-h-11 w-full rounded-md border border-tea-border bg-tea-surface py-2 pl-9 pr-9 text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold"
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
