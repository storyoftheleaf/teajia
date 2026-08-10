import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type PublicWisdomNodeState, type PublicWisdomNodeType } from '../../lib/api';
import { PAGE } from './wisdomShared';

export type { PublicWisdomNodeState } from '../../lib/api';

type WisdomEntry = { id: string; name: string };

export function filterPublicWisdomEntries<T extends WisdomEntry>(
  nodeType: PublicWisdomNodeType,
  entries: readonly T[],
  states: readonly PublicWisdomNodeState[],
): T[] {
  const withheld = new Set(
    states
      .filter(state => state.node_type === nodeType && (state.public_state === 'hidden' || state.is_public === false))
      .map(state => state.node_id),
  );
  return entries.filter(entry => !withheld.has(entry.id));
}

export function buildWisdomCollectionData<T extends WisdomEntry>({
  name,
  description,
  entries,
  pathFor,
}: {
  name: string;
  description: string;
  entries: readonly T[];
  pathFor: (entry: T) => string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Teajia' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: entries.length,
      itemListElement: entries.map((entry, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: entry.name,
        url: pathFor(entry),
      })),
    },
  };
}

type VisibilityStatus = 'loading' | 'ready' | 'error';

export function usePublicWisdomEntries<T extends WisdomEntry>(
  nodeType: PublicWisdomNodeType,
  entries: readonly T[],
) {
  const [request, setRequest] = useState<{ status: VisibilityStatus; states: PublicWisdomNodeState[]; retry: number }>(() =>
    typeof window === 'undefined'
      ? { status: 'ready', states: [], retry: 0 }
      : { status: 'loading', states: [], retry: 0 },
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let active = true;
    setRequest(current => ({ ...current, status: 'loading', states: [] }));
    api.publicWisdom.states().then(
      data => {
        if (active) setRequest(current => ({ ...current, status: 'ready', states: data.states }));
      },
      () => {
        if (active) setRequest(current => ({ ...current, status: 'error', states: [] }));
      },
    );
    return () => { active = false; };
  }, [request.retry]);

  const publicEntries = useMemo(
    () => request.status === 'ready' ? filterPublicWisdomEntries(nodeType, entries, request.states) : [],
    [entries, nodeType, request.states, request.status],
  );
  const retry = useCallback(() => setRequest(current => ({ ...current, retry: current.retry + 1 })), []);
  return { status: request.status, entries: publicEntries, retry };
}

export const WisdomIndexVisibilityNotice: React.FC<{
  status: Exclude<VisibilityStatus, 'ready'>;
  onRetry: () => void;
}> = ({ status, onRetry }) => (
  <article className={PAGE}>
    {status === 'loading' ? (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-6 py-16" aria-label="Wisdom index loading">
        <div className="h-40 animate-pulse rounded-md bg-tea-accent-sub" />
      </main>
    ) : (
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center" role="alert">
        <h1 className="font-display text-ui-28 text-tea-text">Wisdom index cannot be checked</h1>
        <p className="mt-3 text-ui-13 leading-relaxed text-tea-text-sec">
          Its publication state is temporarily unavailable, so the index is withheld.
        </p>
        <button type="button" onClick={onRetry} className="tap-target mt-5 text-ui-12 text-tea-gold hover:text-tea-gold-lt">
          Try again
        </button>
      </main>
    )}
  </article>
);
