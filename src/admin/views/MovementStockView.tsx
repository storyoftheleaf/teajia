import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, RefreshCw, Search, MapPin, User, Store, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/api';
import type { PlatformStockRow } from '../../lib/api';
import { useAppStore } from '../store';

// Stock spine step 3, the movement: Adrian's read-only master lens over every
// location's stock at once, each tea labelled by where it lives and who owns it.
// The movement holds no stock and sells nothing; to change anything the operator
// steps into the location via the AccountSwitcher. No cart, no buy button.

const locationLabel = (row: PlatformStockRow): string => {
  const where = [row.location_city, row.location_country].filter(Boolean).join(', ');
  return where ? `${row.account_name} · ${where}` : row.account_name;
};

const ownerLabel = (row: PlatformStockRow): string =>
  row.owner_name || row.owner_email || 'House stock';

const stockLabel = (row: PlatformStockRow): string => {
  if (row.type === 'Teaware') {
    const units = Number(row.quantity_units) || 0;
    return `${units} unit${units === 1 ? '' : 's'}`;
  }
  return `${Math.round(Number(row.stock_grams) || 0)}g`;
};

const productLabel = (row: PlatformStockRow): string =>
  row.given_name || row.product_name || row.chinese_name || 'Untitled';

export const MovementStockView: React.FC = () => {
  const navigate = useNavigate();
  const { platformRole } = useAppStore();
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const isPlatform = platformRole === 'platform_owner' || platformRole === 'platform_admin';

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['platform', 'all-stock'],
    queryFn: () => api.platform.allStock(),
    enabled: isPlatform,
    staleTime: 1000 * 60 * 2,
  });

  const rows = data?.stock ?? [];

  // Distinct locations for the filter dropdown.
  const locations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.account_id)) seen.set(r.account_id, r.account_name);
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (locationFilter && r.account_id !== locationFilter) return false;
      if (!q) return true;
      return (
        productLabel(r).toLowerCase().includes(q) ||
        (r.origin_region || '').toLowerCase().includes(q) ||
        (r.origin_country || '').toLowerCase().includes(q) ||
        ownerLabel(r).toLowerCase().includes(q) ||
        r.account_name.toLowerCase().includes(q)
      );
    });
  }, [rows, search, locationFilter]);

  // Group rows by location so the list reads as a movement-wide lens.
  const grouped = useMemo(() => {
    const groups = new Map<string, { label: string; items: PlatformStockRow[] }>();
    for (const r of filtered) {
      const g = groups.get(r.account_id) ?? { label: locationLabel(r), items: [] };
      g.items.push(r);
      groups.set(r.account_id, g);
    }
    return Array.from(groups.values());
  }, [filtered]);

  if (!isPlatform) {
    return (
      <div className="p-10 text-center text-tea-text-sec font-serif">
        Platform access required.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto hide-scrollbar px-4 md:px-6 py-6 pb-nav-gap">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/platform')}
          className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors tap-target"
          aria-label="Back to platform admin"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg text-tea-text font-serif">The Movement: All Stock</h1>
          <p className="text-ui-11 text-tea-text-dim uppercase tracking-[0.12em]">
            Read-only · every location · step into a location to change anything
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto p-1.5 text-tea-text-sec hover:text-tea-text transition-colors tap-target"
          aria-label="Refresh"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tea, origin, owner…"
            className="w-full bg-tea-surface border border-tea-border rounded-md pl-8 pr-3 py-2 text-ui-14 text-tea-text outline-none focus:ring-2 focus:ring-tea-gold/40 placeholder-tea-text-dim"
          />
        </div>
        <select
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          className="bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text outline-none focus:ring-2 focus:ring-tea-gold/40"
        >
          <option value="">All locations</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-tea-text-dim">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-tea-text-sec font-serif">
          No stock matches.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <section key={group.label}>
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-tea-border">
                <MapPin size={13} className="text-tea-gold" />
                <span className="font-display text-ui-15 text-tea-text">{group.label}</span>
                <span className="text-ui-11 text-tea-text-dim">{group.items.length}</span>
              </div>
              <div className="divide-y divide-tea-border">
                {group.items.map(row => (
                  <div key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                    <div className="flex-1 min-w-[160px]">
                      <div className="text-ui-14 text-tea-text">
                        {productLabel(row)}
                        {row.year ? <span className="text-tea-text-dim"> · {row.year}</span> : null}
                      </div>
                      <div className="text-ui-11 text-tea-text-dim">
                        {[row.type, row.origin_region, row.origin_country].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-ui-12 text-tea-text-sec min-w-[120px]">
                      <User size={12} className="text-tea-text-dim" />
                      {ownerLabel(row)}
                    </div>
                    <div className="text-ui-13 text-tea-text-sec tabular-nums w-[80px] text-right">
                      {stockLabel(row)}
                    </div>
                    <div className="flex items-center gap-1.5 w-[150px] justify-end">
                      <span className="text-ui-11 text-tea-text-dim">{row.status}</span>
                      <span
                        className={`inline-flex items-center gap-0.5 text-ui-10 px-1.5 py-0.5 rounded ${row.is_public ? 'text-tea-gold' : 'text-tea-text-dim'}`}
                        title={row.is_public ? 'Listed (is_public)' : 'Not listed'}
                      >
                        {row.is_public ? <Eye size={10} /> : <EyeOff size={10} />}
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 text-ui-10 px-1.5 py-0.5 rounded ${row.shown_in_shop ? 'text-tea-gold' : 'text-tea-text-dim'}`}
                        title={row.shown_in_shop ? 'Shown by the owner' : 'Held, not shown in shop'}
                      >
                        <Store size={10} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
