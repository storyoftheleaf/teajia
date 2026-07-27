import React, { useMemo, useState } from 'react';
import { REGIONS } from '../../../wisdom';
import type { Region } from '../../../wisdom';
import { AuthorshipTag } from './AuthorshipTag';
import { SearchBox } from './SearchBox';

const matchesQuery = (region: Region, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    region.name.toLowerCase().includes(q) ||
    region.country.toLowerCase().includes(q) ||
    (region.province?.toLowerCase().includes(q) ?? false)
  );
};

/** Regions tab: the merged 167 growing places (researched origins + working list). */
export const RegionBrowser: React.FC = () => {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => REGIONS.filter(r => matchesQuery(r, query)), [query]);

  return (
    <div>
      <SearchBox value={query} onChange={setQuery} placeholder="Search by name, country, or province" />

      <p className="text-ui-11 text-tea-text-dim mt-3 mb-2">{filtered.length} of {REGIONS.length} regions</p>

      <div className="divide-y divide-tea-border border-t border-tea-border">
        {filtered.map(region => (
          <div key={region.id} className="min-h-[36px] py-2 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-ui-12 text-tea-text font-medium">{region.name}</span>
                <span className="text-ui-11 text-tea-text-dim">
                  {[region.province, region.country].filter(Boolean).join(', ')}
                </span>
              </div>
              {region.climate && (
                <p className="text-ui-11 text-tea-text-dim mt-0.5 line-clamp-2">{region.climate}</p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {region.altitude && <span className="text-ui-11 text-tea-text-sec whitespace-nowrap">{region.altitude}</span>}
              <AuthorshipTag id={region.id} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-ui-13 text-tea-text-dim italic py-8 text-center">No regions match &quot;{query}&quot;.</p>
        )}
      </div>
    </div>
  );
};
