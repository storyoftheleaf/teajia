/**
 * The articles that cite a Wisdom page, and the other Wisdom pages those
 * articles cite ("Read alongside"). One section for every page built from
 * claims: grades, tea types, families, regions and tea areas.
 *
 * Signed out: published articles and public pages only. Signed in with the
 * publish bundle: the account's drafts too, linked into the Magazine room.
 * Shown in DEV and the tea-reference-preview build while the pilot runs.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePrivateQueryScope } from '../../admin/hooks/usePrivateQueryScope';
import { selectHasBundle, useAppStore } from '../../lib/store';
import { wisdomClaimUsesApi } from '../../lib/wisdomClaimUsesApi';
import { HoldingRow, IndexList, SPACE, SectionHead } from './wisdomShared';
import { wisdomDestinations } from './articleClaimUses';
import { WISDOM_PILOT_PREVIEW, useWisdomPilotData } from './wisdomPilotData';

export function articleHref(article: { id: string; slug: string; status?: string }): string {
  return article.status === 'draft'
    ? `/admin/magazine?article=${encodeURIComponent(article.id)}`
    : `/article/${encodeURIComponent(article.slug)}`;
}

const CitedInSection: React.FC<{ pageId: string }> = ({ pageId }) => {
  const scope = usePrivateQueryScope();
  const canPublish = useAppStore(state => selectHasBundle(state, 'publish'));
  const signedIn = scope.ready && canPublish;
  const data = useWisdomPilotData();
  const citing = useQuery({
    queryKey: ['wisdom-citing-articles', pageId, ...(signedIn ? scope.key : ['public'])],
    queryFn: () => wisdomClaimUsesApi.citingPage(pageId, signedIn),
    staleTime: 60_000,
  });
  const articles = (citing.data?.articles ?? []).filter(article => (
    article.status === undefined || article.status === 'published' || (signedIn && article.status === 'draft')
  ));
  const alongside = useMemo(() => {
    if (!data) return [];
    const claimIds = articles.flatMap(article => article.claim_ids).filter(claimId => !claimId.startsWith(`${pageId}:`));
    return wisdomDestinations(claimIds, data.pages, signedIn);
  }, [articles, data, pageId, signedIn]);

  if (articles.length === 0) return null;
  return (
    <>
      <section className={SPACE.section} aria-labelledby={`cited-in-${pageId}`} data-wisdom-cited-in={pageId}>
        <SectionHead id={`cited-in-${pageId}`} label="Cited in" count={articles.length} />
        <IndexList>
          {articles.map(article => (
            <HoldingRow key={article.id} to={articleHref(article)} name={article.title} cells={[article.status === 'draft' ? 'Draft' : undefined]} />
          ))}
        </IndexList>
      </section>
      {alongside.length > 0 && (
        <section className={SPACE.section} aria-labelledby={`alongside-${pageId}`} data-wisdom-alongside={pageId}>
          <SectionHead id={`alongside-${pageId}`} label="Read alongside" count={alongside.length} />
          <IndexList>
            {alongside.map(destination => (
              <HoldingRow key={destination.pageId} to={destination.href} name={destination.label} cells={[destination.visibility === 'draft' ? 'Draft' : undefined]} />
            ))}
          </IndexList>
        </section>
      )}
    </>
  );
};

export const WisdomCitedIn: React.FC<{ pageId: string }> = ({ pageId }) => (
  WISDOM_PILOT_PREVIEW ? <CitedInSection pageId={pageId} /> : null
);

export default WisdomCitedIn;
