import React, { useCallback, useMemo } from 'react';
import { useTeaReferenceCatalogue } from '../../wisdom/reference/client';
import type { TeaReferenceCatalogue } from '../../wisdom/reference/types';
import {
  PUBLISHED_WISDOM_HOLDINGS,
  WisdomHomeContent,
  type Holding,
} from './WisdomHomePage';
import { searchHoldings, type HoldingHit } from './wisdomShared';
import { PREVIEW_PAGE } from './frame';

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

function visibleHitRank(hit: HoldingHit, needle: string): number {
  return Math.min(
    matchRank(hit.name, needle),
    matchRank(hit.chineseName, needle),
    matchRank(hit.where, needle, 4),
  );
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
  if (!needle || limit <= 0) return [];
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

  const staticQueue = staticHits.map(hit => {
    const visibleRank = visibleHitRank(hit, needle);
    return {
      hit,
      // searchHoldings also matches aliases and short internal context fields
      // that are not necessarily printed in the result. Keep those between
      // visible name and context matches, then retain searchHoldings' original
      // index as the authoritative order among all static results.
      rank: visibleRank === MISS ? 3 : visibleRank,
    };
  });
  const previewQueue = previewHits
    .map(hit => ({
      hit,
      rank: Math.min(matchRank(hit.name, needle), matchRank(hit.where, needle, 4)),
    }))
    .sort((left, right) => left.rank - right.rank || codePointCompare(left.hit.to, right.hit.to));

  const merged: HoldingHit[] = [];
  const seen = new Set<string>();
  let staticIndex = 0;
  let previewIndex = 0;
  while (merged.length < limit && (staticIndex < staticQueue.length || previewIndex < previewQueue.length)) {
    const staticResult = staticQueue[staticIndex];
    const previewResult = previewQueue[previewIndex];
    const next = !previewResult || (staticResult && staticResult.rank <= previewResult.rank)
      ? staticQueue[staticIndex++]
      : previewQueue[previewIndex++];
    if (!next || seen.has(next.hit.to)) continue;
    seen.add(next.hit.to);
    merged.push(next.hit);
  }
  return merged;
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
      pageClassName={PREVIEW_PAGE}
      previewDiagnostic={isError && !catalogue
        ? 'The local cited preview is unavailable. The established Wisdom holdings remain ready to browse.'
        : undefined}
    />
  );
};

export default PreviewWisdomHomePage;
