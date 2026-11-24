import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { API_URL, authedFetch } from '../../lib/api';
import { usePrivateQueryScope } from '../hooks/usePrivateQueryScope';

interface WordingReview {
  id: string;
  title: string;
  listing: string;
  wisdom: string | null;
  scope: string;
  before: string;
  wasLive: boolean;
  proposed: string | null;
  revision: string | null;
  approved: boolean;
}

const REVIEW = '/admin/wisdom?wording=review';
const label = `${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`;
const link = `${TYPOGRAPHY_CLASSES.link} inline-flex min-h-tap items-center text-tea-gold`;
const passage = `${TYPOGRAPHY_CLASSES.bodyLight} m-0 whitespace-pre-line text-tea-text`;

export function WisdomWordingReview() {
  const [search] = useSearchParams();
  const auth = usePrivateQueryScope();
  const [accountId, userId] = auth.key;
  const { data: rows, isError } = useQuery<WordingReview[]>({
    queryKey: ['wisdom-listing-wording', ...auth.key],
    enabled: auth.ready,
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) => authedFetch(`${API_URL}/api/admin/wisdom/listing-wording`, {
      signal, cache: 'no-store', reportIncident: false, expectedAuth: { accountId, userId },
    }),
  });
  const selected = search.get('wording');
  const index = selected === 'review' ? 0 : rows?.findIndex(row => row.id === selected) ?? -1;
  const row = auth.ready && !isError ? rows?.[index] : undefined;
  const next = rows?.[index + 1];

  return (
    <section className="h-full overflow-y-auto bg-tea-bg" aria-label="Listing wording review">
      <div className="pb-nav-gap mx-auto min-w-0 max-w-screen-lg px-4 pt-2 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <Link to="/admin/wisdom" className={`${TYPOGRAPHY_CLASSES.link} inline-flex min-h-tap items-center text-tea-text-sec`}>← Wisdom</Link>
          {row && <Link to={row.listing} className={link}>Open listing ↗</Link>}
        </div>
        <header className="mt-2 border-b border-tea-border pb-3 sm:mt-5 sm:pb-4">
          <p className={`${label} m-0`}>Review listing wording</p>
          <h1 className={`${TYPOGRAPHY_CLASSES.h1} mb-1 mt-1`}>{row?.title ?? 'Listing wording'}</h1>
          {row && <p className={`${TYPOGRAPHY_CLASSES.bodyLight} m-0 text-tea-text-sec`}>{index + 1} of {rows?.length}</p>}
        </header>
        {!row && (
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-4 text-tea-text-sec`} role="status">
            {!auth.ready || isError ? 'Listing wording is unavailable for this session.' : rows ? 'This lot is outside the review batch.' : 'Loading listing wording…'}
          </p>
        )}
        {row && (
          <>
            <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2 sm:mt-6">
              <section className="min-w-0 rounded-md border border-tea-border p-3 sm:p-5">
                <h2 className={`${label} mb-2 mt-0`}>{row.wasLive ? 'Before this revision' : 'Previous draft'}</h2>
                <p className={passage}>{row.before}</p>
              </section>
              <section className="min-w-0 rounded-md border border-tea-border bg-tea-surface p-3 sm:p-5">
                <h2 className={`${label} mb-2 mt-0`}>{row.approved ? 'Approved wording' : 'Wording for review'}</h2>
                <p className={passage}>{row.proposed ?? 'The current claim set does not support this revision.'}</p>
              </section>
            </div>
            <section className="mt-4 border-y border-tea-border py-3 sm:mt-6 sm:py-4" aria-label="Evidence">
              <p className={passage}>{row.scope}</p>
              <div className="flex flex-wrap gap-x-5">
                <Link to={`/admin/stock?panel=${row.id}`} className={link}>Exact Stock lot ↗</Link>
                {row.wisdom && <Link to={row.wisdom} className={link}>Wisdom source ↗</Link>}
              </div>
            </section>
            <footer className="grid grid-cols-[1fr_auto] items-center gap-x-3 py-3 sm:py-4">
              <p className={`${TYPOGRAPHY_CLASSES.bodyLight} m-0 min-w-0 text-tea-text-sec`} role="status">
                {row.approved ? 'Approved in the editorial batch.' : 'Editorial approval is needed for this revision.'}
              </p>
              <Link className="btn-primary" to={next ? `/admin/wisdom?wording=${next.id}` : REVIEW}>
                {next ? 'Next tea' : 'First tea'}
              </Link>
            </footer>
          </>
        )}
      </div>
    </section>
  );
}
