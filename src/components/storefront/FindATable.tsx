import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Account } from '../../types';
import { fetchNetworkStores } from '../../lib/storefrontApi';
import { SectionSkeleton } from '../shared/SectionSkeleton';
import { Icons } from '../Icons';
import { api } from '../../lib/api';

interface NetworkReview {
  product_account_id?: string;
  tea_key?: string;
  product_id?: string;
}

export const FindATable: React.FC = () => {
  const { data: stores = [], isLoading, isError } = useQuery<Account[]>({
    queryKey: ['network', 'stores'],
    queryFn: fetchNetworkStores,
    staleTime: 1000 * 60 * 5,
  });

  const [searchName, setSearchName] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterCountry, setFilterCountry] = useState('');

  const { data: reviewsData } = useQuery<{ reviews?: NetworkReview[] }>({
    queryKey: ['tea-reviews', 'network'],
    queryFn: () => api.teaReviews.list({ visibility: 'network' }),
    staleTime: 1000 * 60 * 5,
  });

  // Count unique teas-with-reviews per account
  const reviewCountByAccount = useMemo(() => {
    const counts: Record<string, number> = {};
    (reviewsData?.reviews ?? []).forEach((r: NetworkReview) => {
      const acct = r.product_account_id;
      if (!acct) return;
      const key = r.tea_key ?? r.product_id ?? '';
      if (!counts[acct]) counts[acct] = 0;
      counts[acct] += 1;
      void key; // tea_key grouping left to detail page
    });
    return counts;
  }, [reviewsData]);

  // Derive unique cities and countries
  const cities = useMemo(() => {
    const set = new Set<string>();
    stores.forEach(s => { if (s.location_city) set.add(s.location_city); });
    return Array.from(set).sort();
  }, [stores]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    stores.forEach(s => { if (s.location_country) set.add(s.location_country); });
    return Array.from(set).sort();
  }, [stores]);

  // Client-side filtered stores
  const filtered = useMemo(() => {
    return stores.filter(s => {
      if (filterCity && s.location_city !== filterCity) return false;
      if (filterCountry && s.location_country !== filterCountry) return false;
      if (searchName && !s.name.toLowerCase().includes(searchName.toLowerCase())) return false;
      return true;
    });
  }, [stores, filterCity, filterCountry, searchName]);

  const hasFilters = !!filterCity || !!filterCountry || !!searchName;

  const clearFilters = () => {
    setSearchName('');
    setFilterCity('');
    setFilterCountry('');
  };

  return (
    <div className="w-full animate-[fadeIn_0.5s_ease-out]">
      <Helmet>
        <title>Find a Teajia table</title>
        <meta
          name="description"
          content="The Teajia network: a lineage of tea houses, each with its own character, curation, and table."
        />
      </Helmet>

      <header className="text-center pt-12 pb-3 px-4 md:px-6 max-w-3xl mx-auto">
        <p className="label-caps text-tea-text-dim mb-3">
          The Teajia network
        </p>
        <h1 className="h2 mb-4">
          Find a table
        </h1>
        <p className="subtitle">
          Teajia is a lineage of tea houses — each independent, each with its own voice.
          Choose a table.
        </p>
      </header>

      <section className="max-w-5xl mx-auto px-4 md:px-6 lg:px-10 pb-16">
        {/* Filter bar */}
        {!isLoading && !isError && stores.length > 0 && (
          <div className="mb-6 space-y-3">
            {/* Text search */}
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-text-dim pointer-events-none"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="22" y2="22" />
              </svg>
              <input
                type="text"
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                placeholder="Search by name…"
                className="w-full bg-tea-surface border border-tea-border rounded-md pl-9 pr-4 py-2 text-ui-14 text-tea-text outline-none focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 placeholder:text-tea-text-dim transition-colors"
              />
              {searchName && (
                <button
                  type="button"
                  onClick={() => setSearchName('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text transition-colors"
                  aria-label="Clear name search"
                >
                  <Icons.Close className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* City / Country chips row */}
            {(cities.length > 0 || countries.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {/* City pills */}
                {cities.map(city => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setFilterCity(prev => prev === city ? '' : city)}
                    className={`inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[1.2px] transition-colors ${
                      filterCity === city
                        ? 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40'
                        : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'
                    }`}
                  >
                    {city}
                  </button>
                ))}

                {/* Country pills */}
                {countries.map(country => (
                  <button
                    key={country}
                    type="button"
                    onClick={() => setFilterCountry(prev => prev === country ? '' : country)}
                    className={`inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[1.2px] transition-colors flex items-center gap-1 ${
                      filterCountry === country
                        ? 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40'
                        : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'
                    }`}
                  >
                    <Icons.Location className="w-2.5 h-2.5" />
                    {country}
                  </button>
                ))}
              </div>
            )}

            {/* Active filter summary */}
            {hasFilters && (
              <div className="flex items-center justify-between">
                <p className="text-ui-12 text-tea-text-dim">
                  {filtered.length} {filtered.length === 1 ? 'store' : 'stores'} found
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}

        {isLoading && <SectionSkeleton variant="grid" />}

        {isError && (
          <p className="text-center subtitle py-12">
            Could not load the network right now.
          </p>
        )}

        {!isLoading && !isError && stores.length === 0 && (
          <p className="text-center subtitle py-12">
            No public tables yet — the first are being set.
          </p>
        )}

        {!isLoading && !isError && stores.length > 0 && filtered.length === 0 && (
          <p className="text-center subtitle py-12">
            No stores match your filters.
          </p>
        )}

        {filtered.length > 0 && (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {filtered.map(store => (
              <li key={store.id}>
                <Link
                  to={`/store/${store.slug}`}
                  className="block bg-tea-surface border border-tea-border rounded-xl p-5 group hover:bg-tea-accent-sub transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {store.logo_url ? (
                      <img
                        src={store.logo_url}
                        alt=""
                        className="w-14 h-14 object-contain flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 flex items-center justify-center flex-shrink-0 text-tea-gold">
                        <Icons.Seal className="w-8 h-8" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="h3 mb-1 group-hover:text-tea-readgold transition-colors">
                        {store.name}
                      </h2>
                      {(store.location_city || store.location_country) && (
                        <p className="label-caps text-tea-text-dim mb-2 flex items-center gap-1.5">
                          <Icons.Location className="w-3 h-3 text-tea-gold" />
                          {[store.location_city, store.location_country].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {store.tagline && (
                        <p className="subtitle text-ui-14">
                          {store.tagline}
                        </p>
                      )}
                      {(reviewCountByAccount[store.id] ?? 0) > 0 && (
                        <p className="label-caps text-tea-text-dim mt-2">
                          {reviewCountByAccount[store.id]} network {reviewCountByAccount[store.id] === 1 ? 'review' : 'reviews'}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default FindATable;
