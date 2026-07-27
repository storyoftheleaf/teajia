import React, { useMemo, useState } from 'react';
import { CULTIVARS, findCultivarById } from '../../../wisdom';
import type { Cultivar } from '../../../wisdom';
import { AuthorshipTag } from './AuthorshipTag';
import { CultivarDetailPanel } from './CultivarDetailPanel';
import { SearchBox } from './SearchBox';

const matchesQuery = (cultivar: Cultivar, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    cultivar.name.toLowerCase().includes(q) ||
    (cultivar.chineseName?.toLowerCase().includes(q) ?? false) ||
    cultivar.altNames.some(name => name.toLowerCase().includes(q))
  );
};

/** Cultivars tab: search, browse the 79 plants, open one for full detail. */
export const CultivarBrowser: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => CULTIVARS.filter(c => matchesQuery(c, query)), [query]);
  const selected = selectedId ? findCultivarById(selectedId) : null;

  return (
    <div>
      <SearchBox value={query} onChange={setQuery} placeholder="Search by name, Chinese name, or alias" />

      <p className="text-ui-11 text-tea-text-dim mt-3 mb-2">{filtered.length} of {CULTIVARS.length} cultivars</p>

      <div className="divide-y divide-tea-border border-t border-tea-border">
        {filtered.map(cultivar => (
          <button
            key={cultivar.id}
            type="button"
            onClick={() => setSelectedId(cultivar.id)}
            className="tap-target w-full min-h-[36px] flex items-center justify-between gap-3 py-2 text-left hover:bg-tea-accent-sub transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-ui-12 text-tea-text font-medium truncate">{cultivar.name}</span>
                {cultivar.chineseName && <span className="text-ui-11 text-tea-text-sec">{cultivar.chineseName}</span>}
              </div>
              {(cultivar.originRegion || cultivar.originCountry) && (
                <p className="text-ui-11 text-tea-text-dim truncate">
                  {[cultivar.originRegion, cultivar.originCountry].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            <AuthorshipTag id={cultivar.id} className="shrink-0" />
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-ui-13 text-tea-text-dim italic py-8 text-center">No cultivars match &quot;{query}&quot;.</p>
        )}
      </div>

      {selected && (
        <CultivarDetailPanel
          cultivar={selected}
          onClose={() => setSelectedId(null)}
          onSelectCultivar={setSelectedId}
        />
      )}
    </div>
  );
};
