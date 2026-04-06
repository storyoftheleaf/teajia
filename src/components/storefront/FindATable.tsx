import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Account } from '../../types';
import { fetchNetworkStores } from '../../lib/storefrontApi';
import { SectionSkeleton } from '../shared/SectionSkeleton';
import { Icons } from '../Icons';

export const FindATable: React.FC = () => {
  const { data: stores = [], isLoading, isError } = useQuery<Account[]>({
    queryKey: ['network', 'stores'],
    queryFn: fetchNetworkStores,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="w-full animate-[fadeIn_0.5s_ease-out]">
      <Helmet>
        <title>Find a Teajia table</title>
        <meta
          name="description"
          content="The Teajia network: a lineage of tea houses, each with its own character, curation, and table."
        />
      </Helmet>

      <header className="text-center pt-10 pb-8 px-6 max-w-3xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.3em] text-tea-text-dim mb-3">
          The Teajia network
        </p>
        <h1
          className="text-3xl md:text-5xl text-tea-text mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Find a table
        </h1>
        <p className="text-base md:text-lg text-tea-text-sec leading-relaxed">
          Teajia is a lineage of tea houses — each independent, each with its own voice.
          Choose a table.
        </p>
      </header>

      <section className="max-w-5xl mx-auto px-4 pb-16">
        {isLoading && <SectionSkeleton variant="grid" />}

        {isError && (
          <p className="text-center text-sm text-tea-text-dim italic py-12">
            Could not load the network right now.
          </p>
        )}

        {!isLoading && !isError && stores.length === 0 && (
          <p className="text-center text-sm text-tea-text-dim italic py-12">
            No public tables yet — the first are being set.
          </p>
        )}

        {stores.length > 0 && (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {stores.map(store => (
              <li key={store.id}>
                <Link
                  to={`/store/${store.slug}`}
                  className="card-grid-item block p-5 md:p-6 group transition-colors hover:border-tea-gold"
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
                      <h2
                        className="text-xl text-tea-text mb-1 group-hover:text-tea-gold transition-colors"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {store.name}
                      </h2>
                      {(store.location_city || store.location_country) && (
                        <p className="text-[11px] uppercase tracking-[0.2em] text-tea-text-dim mb-2 flex items-center gap-1.5">
                          <Icons.Location className="w-3 h-3 text-tea-gold" />
                          {[store.location_city, store.location_country].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {store.tagline && (
                        <p className="text-sm text-tea-text-sec italic leading-snug">
                          {store.tagline}
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
