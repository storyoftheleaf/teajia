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
  /** The one action on an empty list: sit down with a vendor. */
  onStartTable?: () => void;
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
export const VendorsView: React.FC<VendorsViewProps> = ({ onOpenTea, onAddTea, onAddTeaware, initialVendor, onCloseVendor, onStartTable }) => {
  const entries = useTeaCompassStore((s) => s.entries);
  const [remote, setRemote] = useState<Vendor[]>([]);
  const [remoteState, setRemoteState] = useState<'loading' | 'ready' | 'error'>(hasToken() ? 'loading' : 'ready');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Vendor | null>(initialVendor ?? null);
  useEffect(() => { if (initialVendor) setOpen(initialVendor); }, [initialVendor]);

  const loadVendors = React.useCallback(() => {
    if (!hasToken()) return;
    setRemoteState('loading');
    api.customers.list()
      .then((res: any) => {
        setRemote(((res?.customers || res || []) as any[])
          .filter((c) => isVendorTagged(c.tags))
          .map((c) => ({ id: c.id, name: c.name, tags: c.tags })));
        setRemoteState('ready');
      })
      .catch(() => setRemoteState('error'));
  }, []);
  useEffect(() => { loadVendors(); }, [loadVendors]);

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
      {(shown.length > 0 || query) && <Section title="Vendors" count={shown.length} />}
      {shown.length === 0 && remoteState === 'loading' && !query && (
        <p role="status" className="px-4 py-6 text-ui-13 text-tea-text-sec">Loading your vendors…</p>
      )}
      {remoteState === 'error' && (
        <div role="alert" className="flex items-baseline justify-between gap-3 px-4 py-3">
          <p className="text-ui-13 text-tea-text-sec">Your vendor list could not be loaded.</p>
          <button type="button" onClick={loadVendors} className="curate-v2-word tap-target shrink-0">Try again</button>
        </div>
      )}
      {shown.length === 0 && remoteState !== 'loading' && (
        <div className="grid gap-4 px-4 py-6" data-testid="vendors-empty">
          <p className="text-ui-13 leading-relaxed text-tea-text-sec">
            {query ? 'No vendor by that name yet. Pick one when you start a table, and it appears here.' : 'No vendors yet. A vendor appears here as soon as you start a table with them.'}
          </p>
          {!query && onStartTable && <button type="button" onClick={onStartTable} className="curate-v2-frame is-on is-tall is-wide uppercase tracking-[0.16em]">Start a table</button>}
        </div>
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
