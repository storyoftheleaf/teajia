/**
 * /wisdom/grade/:id. One leaf grade (Tea Wisdom pilot, plan Phase 3).
 *
 * Built from claims, not from a hand-written entry: every statement is one
 * claim shown with its scope and, where it has them, its Chinese terms
 * (original, pinyin, gloss) beside the English. The pattern is the region
 * page's: facts first, then where the grade connects, then the teas.
 *
 * Until a leaf_grade page is public, the page renders only in DEV or the
 * tea-reference-preview build, from the draft module or the pilot fixtures
 * (wisdomPilotData.ts). A production visitor gets the not-found page.
 *
 * Links out: the place the grade is used (Menghai County), the parent
 * tea type when it is public, and the articles that cite the grade. A
 * signed-out reader gets published articles and public pages only.
 */
import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePrivateQueryScope } from '../../admin/hooks/usePrivateQueryScope';
import { selectHasBundle, useAppStore } from '../../lib/store';
import { wisdomClaimUsesApi } from '../../lib/wisdomClaimUsesApi';
import type { PublicReferenceStatement } from '../../wisdom/receiving/previewImporter';
import type { DraftClaim, PublicClaim, PublicTeaReferenceSource } from '../../wisdom/reference/claims';
import {
  AXIS_INDENT,
  FACT,
  FOOTNOTE,
  Fact,
  HoldingNotFound,
  LABEL,
  MEASURE,
  PREVIEW_PAGE,
  PageHead,
  ProseSkeleton,
  QUIET_LINK,
  SPACE,
  WisdomSubNav,
} from './wisdomShared';
import ReferenceFactSections from './ReferenceFactSections';
import { wisdomDestinations } from './articleClaimUses';
import { useWisdomPilotData } from './wisdomPilotData';

/** Where the grade name is used: the pilot grades are Menghai loose ripe pu'er grades. */
const STANDARD_PLACE: Record<string, string> = {
  'gong-ting': 'menghai-county',
  'special-grade': 'menghai-county',
  'seventh-grade': 'menghai-county',
};

type AnyClaim = DraftClaim | PublicClaim;

function asStatement(claim: AnyClaim, sources: readonly PublicTeaReferenceSource[]): PublicReferenceStatement {
  const source = sources.find(candidate => candidate.sourceId === claim.sourceIds[0]);
  return {
    id: claim.claimId,
    label: claim.label,
    text: claim.text,
    citation: { sourceId: source?.sourceId ?? '', label: source?.title ?? '', url: source?.url ?? '' },
  };
}

const ClaimDetail: React.FC<{ claim: AnyClaim; sources: readonly PublicTeaReferenceSource[] }> = ({ claim, sources }) => {
  // Trade knowledge is written in our own words and carries no citation line.
  const cited = (claim.basis === 'trade_knowledge' ? [] : claim.sourceIds)
    .map(sourceId => sources.find(source => source.sourceId === sourceId))
    .filter((source): source is PublicTeaReferenceSource => Boolean(source));
  return (
    <div className={`mt-2 space-y-2 ${MEASURE} min-w-0`} data-claim-id={claim.claimId}>
      {claim.scope && (
        <p className={`${FOOTNOTE} min-w-0 break-words`}>
          <span className={LABEL}>Scope</span>{' '}
          <span data-claim-scope>{claim.scope}</span>
        </p>
      )}
      {claim.attribution && (
        <p className={`${FOOTNOTE} min-w-0 break-words`}>
          <span className={LABEL}>Observed on</span> {claim.attribution.sample}
        </p>
      )}
      {claim.terms.length > 0 && (
        <ul className="list-none m-0 p-0 flex flex-wrap gap-x-6 gap-y-1" aria-label="Chinese terms">
          {claim.terms.map(term => (
            <li key={term.original} lang="zh" className={`${FOOTNOTE} min-w-0 break-words`} data-claim-term>
              <span className="text-tea-text-sec">{term.original}</span>{' '}
              <span lang="zh-Latn-pinyin" className="italic">{term.pinyin}</span>{' '}
              <span lang="en">{term.gloss}</span>
            </li>
          ))}
        </ul>
      )}
      {cited.length > 0 && (
        <p className={`${FOOTNOTE} min-w-0 break-words`}>
          {cited.map((source, index) => (
            <React.Fragment key={source.sourceId}>
              {index > 0 && ' · '}
              <a href={source.url} target="_blank" rel="noreferrer" className={QUIET_LINK}>{source.title}</a>
            </React.Fragment>
          ))}
        </p>
      )}
    </div>
  );
};

const GradePage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const data = useWisdomPilotData();
  const scope = usePrivateQueryScope();
  const canPublish = useAppStore(state => selectHasBundle(state, 'publish'));
  const canReadDraftArticles = scope.ready && canPublish;

  const page = data?.pages.find(candidate => candidate.id === id && candidate.kind === 'leaf_grade');
  const claims = useMemo(
    () => {
      if (!page || !data) return [];
      // Keep the Markdown page's section order.
      const order = new Map(page.sections.map((section, index) => [section.key, index]));
      return data.claims
        .filter(claim => claim.pageId === page.id && claim.reviewState !== 'withdrawn' && claim.rev !== null)
        .sort((left, right) => (order.get(left.sectionKey) ?? 99) - (order.get(right.sectionKey) ?? 99));
    },
    [data, page],
  );
  const claimById = useMemo(() => new Map(claims.map(claim => [claim.claimId, claim])), [claims]);
  const statements = useMemo(() => claims.map(claim => asStatement(claim, data?.sources ?? [])), [claims, data]);

  const places = useMemo(() => {
    if (!page || !data) return [];
    const candidates = [STANDARD_PLACE[page.id], page.parentId].filter((value): value is string => Boolean(value));
    return wisdomDestinations(candidates.map(pageId => `${pageId}:page`), data.pages, false);
  }, [data, page]);
  const standardPlace = places.find(place => place.pageId === STANDARD_PLACE[page?.id ?? '']);
  const parentType = places.find(place => place.pageId === page?.parentId);

  const citing = useQuery({
    queryKey: ['wisdom-citing-articles', id, ...(canReadDraftArticles ? scope.key : ['public'])],
    queryFn: () => wisdomClaimUsesApi.citingPage(id, canReadDraftArticles),
    enabled: Boolean(page),
    staleTime: 60_000,
  });
  const articles = (citing.data?.articles ?? []).filter(article => (
    article.status === undefined || article.status === 'published' || (canReadDraftArticles && article.status === 'draft')
  ));

  if (data && !page) {
    return (
      <HoldingNotFound
        section="marks"
        heading="Leaf grade not found"
        backTo="/wisdom/marks"
        backLabel="All marks"
        subject="A leaf grade that is missing"
      />
    );
  }

  return (
    <article className={PREVIEW_PAGE} data-wisdom-grade-page="true">
      <Helmet>
        <title>{page ? `${page.label} · Leaf grades · Teajia` : 'Leaf grade · Teajia'}</title>
        {page?.visibility === 'draft' && <meta name="robots" content="noindex" />}
      </Helmet>
      <WisdomSubNav active="marks" />
      <div className="mt-7">
        <PageHead kind="Leaf grade" title={page?.label ?? 'Leaf grade'} chineseName={page?.nativeName} />
        {page?.visibility === 'draft' && (
          <p className={`${FOOTNOTE} mt-3 ${MEASURE}`} data-wisdom-draft-notice>
            Draft. Shown in preview only{data?.usesFixtures ? ', from pilot fixtures' : ''}.
          </p>
        )}
      </div>

      {!data && <div className={`${SPACE.section} ${AXIS_INDENT}`}><ProseSkeleton /></div>}

      {page && data && (
        <>
          <div className="mt-8">
            {parentType && (
              <Fact label="Tea type">
                <Link to={parentType.href} className={`${QUIET_LINK} tap-target`}>{parentType.label}</Link>
              </Fact>
            )}
            {standardPlace && (
              <Fact label="Graded in">
                <Link to={standardPlace.href} className={`${QUIET_LINK} tap-target`} data-grade-standard-place>
                  {standardPlace.label}
                </Link>
              </Fact>
            )}
            {articles.length > 0 && (
              <Fact label="Cited in">
                <span className="flex flex-col gap-1">
                  {articles.map(article => (
                    <span key={article.id}>
                      <Link
                        to={article.status === 'draft'
                          ? `/admin/magazine?article=${encodeURIComponent(article.id)}`
                          : `/article/${encodeURIComponent(article.slug)}`}
                        className={`${QUIET_LINK} tap-target`}
                        data-grade-citing-article={article.slug}
                      >
                        {article.title}
                      </Link>
                      {article.status === 'draft' && <span className={FOOTNOTE}> Draft</span>}
                    </span>
                  ))}
                </span>
              </Fact>
            )}
          </div>

          <ReferenceFactSections
            facts={statements}
            sources={data.sources}
            products={[]}
            reportIdentity={`Leaf grade: ${page.label}`}
            factDetail={fact => {
              const claim = claimById.get(fact.id);
              return claim ? <ClaimDetail claim={claim} sources={data.sources} /> : null;
            }}
          />

          {citing.isError && (
            <p role="status" className={`${FACT} ${MEASURE} ${AXIS_INDENT} ${SPACE.section}`}>
              The articles citing this grade could not be loaded.
            </p>
          )}
        </>
      )}
    </article>
  );
};

export default GradePage;
