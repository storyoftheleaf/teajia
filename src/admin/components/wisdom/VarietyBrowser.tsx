import React, { useMemo, useState } from 'react';
import { TEA_VARIETIES } from '../../../data/teaVarieties';
import { getThemeTextColor } from '../../themeUtils';
import { AuthorshipTag } from './AuthorshipTag';
import { SearchBox } from './SearchBox';

interface FlatVariety {
  id: string;
  type: string;
  name: string;
  chineseName?: string;
  altNames?: string[];
  region?: string;
}

const slug = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Flattens the type-keyed variety record into rows, with ids computed the
 * same way scripts/export-wisdom-dataset.mjs does (type-slug + name-slug,
 * numbered on collision). Keeping the same formula means an authorship entry
 * added for a variety id later will resolve here without any change.
 */
function flattenVarieties(): FlatVariety[] {
  const seen = new Map<string, number>();
  const out: FlatVariety[] = [];
  for (const [type, entries] of Object.entries(TEA_VARIETIES)) {
    for (const entry of entries) {
      const base = `${slug(type)}-${slug(entry.name)}`;
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count + 1}`;
      out.push({ id, type, name: entry.name, chineseName: entry.chineseName, altNames: entry.altNames, region: entry.region });
    }
  }
  return out;
}

const ALL_VARIETIES = flattenVarieties();

const matchesQuery = (variety: FlatVariety, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    variety.name.toLowerCase().includes(q) ||
    (variety.chineseName?.toLowerCase().includes(q) ?? false) ||
    (variety.altNames?.some(alias => alias.toLowerCase().includes(q)) ?? false) ||
    (variety.region?.toLowerCase().includes(q) ?? false) ||
    variety.type.toLowerCase().includes(q)
  );
};

/** Varieties tab: the 316 named teas that power capture autocomplete. */
export const VarietyBrowser: React.FC = () => {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => ALL_VARIETIES.filter(v => matchesQuery(v, query)), [query]);

  return (
    <div>
      <SearchBox value={query} onChange={setQuery} placeholder="Search by name, Chinese name, type, or region" />

      <p className="text-ui-11 text-tea-text-dim mt-3 mb-2">{filtered.length} of {ALL_VARIETIES.length} varieties</p>

      <div className="divide-y divide-tea-border border-t border-tea-border">
        {filtered.map(variety => (
          <div key={variety.id} className="min-h-[36px] py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-ui-12 text-tea-text font-medium">{variety.name}</span>
                {variety.chineseName && <span className="text-ui-11 text-tea-text-sec">{variety.chineseName}</span>}
              </div>
              {variety.region && <p className="text-ui-11 text-tea-text-dim">{variety.region}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-ui-11 font-bold whitespace-nowrap" style={{ color: getThemeTextColor(variety.type) }}>{variety.type}</span>
              <AuthorshipTag id={variety.id} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-ui-13 text-tea-text-dim italic py-8 text-center">No varieties match &quot;{query}&quot;.</p>
        )}
      </div>
    </div>
  );
};
