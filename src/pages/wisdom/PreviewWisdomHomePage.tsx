import React, { useCallback, useMemo } from 'react';
import { useTeaReferenceCatalogue } from '../../wisdom/reference/client';
import type { TeaReferenceCatalogue } from '../../wisdom/reference/types';
import {
  PUBLISHED_WISDOM_HOLDINGS,
  WisdomHomeContent,
  type Holding,
} from './WisdomHomePage';
import { searchHoldings, type HoldingHit } from './wisdomShared';

const MISS = 9;

function searchKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function matchRank(value: string | undefined, needle: string, offset = 0): number {
  if (!value) return MISS;
  const key = searchKey(value);
  if (key === needle) return offset;
  if (key.startsWith(needle)) return offset + 1;
  if (key.includes(needle)) return offset + 2;
  return MISS;
}

function codePointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function previewWisdomHomeHoldings(catalogue: TeaReferenceCatalogue | null): Holding[] {
  return PUBLISHED_WISDOM_HOLDINGS.flatMap(holding => {
    const current = holding.to === '/wisdom/regions'
      ? {
          ...holding,
          label: 'Origins',
          description: 'Tea places, from broad growing regions toward the areas and localities the reference can establish.',
        }
      : holding;
    if (holding.to !== '/wisdom/cultivars' || !catalogue) return [current];
    return [
      current,
      {
        label: 'Tea Types',
        to: '/wisdom/types',
        count: catalogue.families.length + catalogue.types.length,
        description: 'Tea families and the sellable identities they contain, connected to teas in the public shop.',
      },
    ];
  });
}

export function searchPreviewWisdomHome(
  query: string,
  catalogue: TeaReferenceCatalogue | null,
  limit: number,
): HoldingHit[] {
  const needle = searchKey(query);
  if (!needle) return [];
  const staticHits = searchHoldings(query, Number.MAX_SAFE_INTEGER);
  const previewHits: HoldingHit[] = catalogue ? [
    ...catalogue.families.map(family => ({
      name: family.name,
      holding: 'Types',
      to: `/wisdom/family/${family.id}`,
      where: 'Tea family',
    })),
    ...catalogue.types.map(type => ({
      name: type.name,
      holding: 'Types',
      to: `/wisdom/type/${type.id}`,
      where: catalogue.families.find(family => family.id === type.familyId)?.name,
    })),
  ].filter(hit => Math.min(matchRank(hit.name, needle), matchRank(hit.where, needle, 4)) < MISS) : [];

  const byPath = new Map<string, HoldingHit>();
  for (const hit of [...staticHits, ...previewHits]) byPath.set(hit.to, hit);
  return [...byPath.values()]
    .map(hit => ({
      hit,
      rank: Math.min(matchRank(hit.name, needle), matchRank(hit.where, needle, 4)),
    }))
    .sort((left, right) => left.rank - right.rank || codePointCompare(left.hit.to, right.hit.to))
    .slice(0, limit)
    .map(result => result.hit);
}

const PreviewWisdomHomePage: React.FC = () => {
  const { catalogue, isError } = useTeaReferenceCatalogue();
  const holdings = useMemo(() => previewWisdomHomeHoldings(catalogue), [catalogue]);
  const search = useCallback(
    (query: string, limit: number) => searchPreviewWisdomHome(query, catalogue, limit),
    [catalogue],
  );

  return (
    <WisdomHomeContent
      holdings={holdings}
      search={search}
      previewDataset
      previewDiagnostic={isError && !catalogue
        ? 'The local cited preview is unavailable. The established Wisdom holdings remain ready to browse.'
        : undefined}
    />
  );
};

export default PreviewWisdomHomePage;
