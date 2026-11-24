import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BookOpen, Camera, Check, ChevronRight, FileText, Fingerprint, List, PenLine, Search } from 'lucide-react';
import { TeaCard } from '../../components/tea/TeaCard';
import { Button } from '../../components/shared/Button';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { API_URL, authedFetch } from '../../lib/api';
import { usePrivateQueryScope } from '../hooks/usePrivateQueryScope';
import { TeaDecisionConnection } from './TeaDecisionConnection';
import type { EditorialPassage, TeaCitation, TeaEditorialBoard, TeaVerdict } from '../../../shared/catalog/teaEditorial';
import type { TeaIntakePage, TeaReviewProgress, TeaReviewRef } from '../../../shared/catalog/teaConnection';

const ROOT = '/admin/catalog-review/teas';
const API_ROOT = API_URL + '/api' + ROOT;
const labels: Record<TeaVerdict, string> = { approved: 'Approved', declined: 'Declined', withdrawn: 'Withdrawn' };
const kinds = {
  intake: { icon: Camera, label: 'Photo intake' },
  editorial: { icon: PenLine, label: 'Editorial review' },
  holds: { icon: Fingerprint, label: 'Identity check' },
  histories: { icon: BookOpen, label: 'Named history' },
};

export type TeaIntakeEntry = { id: string; title: string; status: string };
type History = TeaEditorialBoard['histories'][number];
type Review = { ref: TeaReviewRef; title: string; next: string; lot?: string } & (
  { kind: 'intake' } |
  { kind: 'editorial'; passage: EditorialPassage } |
  { kind: 'holds'; hold: TeaEditorialBoard['holds'][number] } |
  { kind: 'histories'; history: History }
);

function selectionHref(ref: TeaReviewRef, queue = false, unconfirmed = false) {
  const params = new URLSearchParams({ view: ref.view, item: ref.id });
  if (queue) params.set('queue', '1');
  if (unconfirmed) params.set('unconfirmed', '1');
  return ROOT + '?' + params;
}

function reviewKey(review: Review) {
  return review.ref.view + ':' + review.ref.id;
}

function lotAddress(address?: string) {
  if (!address) return undefined;
  try {
    const url = new URL(address, 'https://www.teajia.com');
    if (['teajia.com', 'www.teajia.com'].includes(url.hostname) && url.protocol === 'https:' && /^\/shop\/product\/[a-z0-9_-]+\/?$/i.test(url.pathname)) {
      return url.pathname.replace(/\/$/, '');
    }
  } catch { /* Ignore a citation without a Teajia listing address. */ }
  return undefined;
}

function reviewsFor(entries: TeaIntakeEntry[], board?: TeaEditorialBoard): Review[] {
  return [
    ...(board?.holds ?? []).map((hold): Review => ({ kind: 'holds', ref: { view: 'holds', id: hold.url }, title: hold.title, next: 'Check identity evidence', lot: lotAddress(hold.url), hold })),
    ...entries.map((entry): Review => ({ kind: 'intake', ref: { view: 'intake', id: entry.id }, title: entry.title, next: board?.intake[entry.id]?.nextCheck || entry.status })),
    ...(board?.passages ?? []).map((passage): Review => ({
      kind: 'editorial', ref: { view: 'editorial', id: passage.id }, title: passage.title,
      next: board?.verdicts[passage.id] ? labels[board.verdicts[passage.id].decision] : 'Review wording',
      lot: passage.kind === 'Lot opening' && passage.lots.length === 1 ? lotAddress(passage.lots[0].url) : undefined, passage,
    })),
    ...(board?.histories ?? []).map((history): Review => ({ kind: 'histories', ref: { view: 'histories', id: history.url }, title: history.title, next: 'Read history', lot: lotAddress(history.url), history })),
  ];
}

function SourceList({ sources, label = 'Sources' }: { sources: TeaCitation[]; label?: string }) {
  if (!sources.length) return null;
  return <section className="space-y-1">
    <h3 className={T.label}>{label}</h3>
    <ul className="space-y-1 text-tea-text-sec">
      {sources.map(source => <li key={source.url + (source.locator || '')} className="break-words">
        <a className="underline hover:text-tea-gold" href={source.url}>{source.title}</a>
        {source.locator && <span> · {source.locator}</span>}
      </li>)}
    </ul>
  </section>;
}

function IntakeReading({ id }: { id: string }) {
  const scope = usePrivateQueryScope();
  const [accountId, userId] = scope.key;
  const query = useQuery<TeaIntakePage>({
    queryKey: ['private-tea-review-page', ...scope.key, id], enabled: scope.ready, retry: false,
    queryFn: ({ signal }) => authedFetch(API_ROOT + '/' + encodeURIComponent(id), {
      expectedAuth: { accountId, userId }, signal, cache: 'no-store', reportIncident: false,
    }),
  });
  const [photo, setPhoto] = useState(0);
  const page = scope.ready ? query.data : undefined;
  if (!page) return <p role="status">{query.isError ? 'Intake evidence is unavailable.' : 'Opening intake evidence…'}</p>;
  return <TeaDecisionConnection title={page.title} target={{ view: 'intake', id }} intake={{ page, photo }}
    source={(openMatch, matched) => <section aria-label="Intake evidence" className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
    {page.photos.length > 0 && <figure className="min-w-0 space-y-1">
      <img className="aspect-square w-full rounded-md bg-tea-bg object-contain" src={page.photos[photo] || page.photos[0]}
        alt={(page.packageOnly ? 'Package for ' : '') + page.title} />
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-ui-12 text-tea-text-sec">
        <span>{page.packageOnly ? 'Private package reference' : 'Intake photograph'}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-1">
          {openMatch && <Button type="button" variant="quiet" size="sm" onClick={openMatch}>
            <Search size={14} aria-hidden="true" />Compare with Stock</Button>}
          {page.photos.length > 1 && <Button variant="quiet" size="sm" onClick={() => setPhoto(value => (value + 1) % page.photos.length)}>
            Photo {photo + 1} of {page.photos.length}<ArrowRight size={14} aria-hidden="true" /></Button>}
        </span>
      </figcaption>
    </figure>}
    <div className="min-w-0 space-y-3">
      <p className={T.bodyLight}>{page.introduction}</p>
      <p className="text-ui-13 text-tea-text-sec">{page.evidence}</p>
      <p className={T.label}>{matched ? 'Stock match confirmed' : page.status}</p>
      {!matched && page.nextCheck && <p className="text-ui-14 text-tea-text">{page.nextCheck}</p>}
      {page.facts.length > 0 && <dl className="flex flex-wrap gap-x-3 text-ui-12 text-tea-text-sec">
        {page.facts.map(fact => <div key={fact.label} className="flex gap-1"><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
      </dl>}
    </div>
  </section>} />;
}

function PassageReading({ passage, verdict, decide }: {
  passage: EditorialPassage; verdict?: TeaVerdict;
  decide: (passage: EditorialPassage, decision: TeaVerdict) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(decision: TeaVerdict) {
    setBusy(true);
    setError('');
    try { await decide(passage, decision); }
    catch { setError('The wording decision could not be saved. Review the current passage and try again.'); }
    finally { setBusy(false); }
  }
  return <article aria-label={passage.title} className="space-y-3">
    <p className={T.body}>{passage.text}</p>
    <p className="text-ui-13 text-tea-text-sec">{passage.scope}</p>
    <SourceList sources={passage.sources} />
    {passage.lots.length > 1 && <SourceList sources={passage.lots} label="Referenced listings" />}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-tea-border pt-3">
      <span role="status" className="text-ui-13">{verdict ? labels[verdict] : 'Unreviewed'}</span>
      <div className="flex flex-wrap items-center gap-2">
        {verdict && verdict !== 'withdrawn' &&
          <Button variant="quiet" size="sm" disabled={busy} onClick={() => void save('withdrawn')}>Withdraw decision</Button>}
        <Button variant="secondary" size="sm" disabled={busy || verdict === 'declined'} onClick={() => void save('declined')}>Decline</Button>
        <Button variant="primary" size="sm" icon={<Check size={16} aria-hidden="true" />} disabled={busy || verdict === 'approved'} onClick={() => void save('approved')}>
          Approve wording
        </Button>
      </div>
    </div>
    <p className="text-ui-12 text-tea-text-sec">Your decision stays private. Publication is a separate step.</p>
    {error && <p role="alert" className="text-ui-13">{error}</p>}
  </article>;
}

export function TeaDecisions({ entries, groupId }: { entries: TeaIntakeEntry[]; groupId?: string }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const scope = usePrivateQueryScope();
  const [accountId, userId] = scope.key;
  const auth = { expectedAuth: { accountId, userId }, reportIncident: false, cache: 'no-store' as const };
  const query = useQuery<TeaEditorialBoard>({
    queryKey: ['private-tea-decisions', ...scope.key], enabled: scope.ready, retry: false,
    queryFn: ({ signal }) => authedFetch(API_ROOT + '/decisions', { ...auth, signal }),
  });
  const board = scope.ready ? query.data : undefined;
  const unconfirmed = params.get('unconfirmed') === '1';
  const progress = useQuery<TeaReviewProgress>({
    queryKey: ['tea-review-progress', ...scope.key], enabled: scope.ready && unconfirmed, retry: false,
    queryFn: ({ signal }) => authedFetch(API_ROOT + '/connection?queue=1', { ...auth, signal }),
  });
  const reviews = reviewsFor(entries, board);
  const confirmedIntake = new Set([
    ...entries.filter(entry => /^(?:stock match confirmed|confirmed stock lot)$/i.test(entry.status)).map(entry => entry.id),
    ...(progress.data?.matchedIntake ?? []),
  ]);
  const resolvedHolds = new Set(progress.data?.resolvedHolds);
  const isUnconfirmed = (review: Review) => (
    review.kind === 'intake' ? !confirmedIntake.has(review.ref.id) :
      review.kind === 'holds' && !resolvedHolds.has(review.ref.id)
  );
  const view = groupId ? 'intake' : params.get('view');
  const id = groupId || params.get('item');
  const queueOnly = params.get('queue') === '1';
  const selected = reviews.find(review => review.kind === view && (!id || review.ref.id === id))
    ?? (id ? undefined : reviews[0]);

  const groups = new Map<string, Review[]>();
  for (const review of reviews) {
    const key = review.lot || reviewKey(review);
    groups.set(key, [...(groups.get(key) ?? []), review]);
  }
  const rows = Array.from(groups.values()).filter(items => items.some(review =>
    (!unconfirmed || isUnconfirmed(review)) &&
      (review.title + ' ' + review.next).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  ));
  const related = selected?.lot ? groups.get(selected.lot)?.filter(review => review !== selected) ?? [] : [];
  const next = selected && rows[rows.findIndex(group => group.includes(selected)) + 1]?.[0];

  async function decide(passage: EditorialPassage, decision: TeaVerdict) {
    const version = board?.verdicts[passage.id]?.version ?? 0;
    try {
      await authedFetch(API_ROOT + '/decisions/' + encodeURIComponent(passage.id), {
        ...auth, method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, revision: passage.revision, version }),
      });
    } finally {
      await query.refetch({ throwOnError: true });
    }
  }

  return <section className="mx-auto w-full max-w-7xl space-y-4 px-4 pt-4 pb-nav-gap lg:px-8">
    <header className="space-y-2 border-b border-tea-border pb-3">
      <Link className="btn-quiet btn-sm" to="/admin/capture"><ArrowLeft size={16} aria-hidden="true" />Drafts</Link>
      <h1 className={T.h1}>Tea decisions</h1>
    </header>
    {!board && <p role="status" className="text-ui-13 text-tea-text-sec">{query.isError ? 'Editorial notes are unavailable.' : 'Opening decision notes…'}</p>}
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <aside aria-label="Tea queue" className={queueOnly || !selected ? 'min-w-0 lg:border-r lg:border-tea-border lg:pr-4' : 'hidden min-w-0 lg:block lg:border-r lg:border-tea-border lg:pr-4'}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={T.h2}>Teas</h2><span className="text-ui-12 text-tea-text-dim">{rows.length} in review</span>
        </div>
        <div className="mb-2">
          <Button type="button" variant="chip" aria-pressed={unconfirmed} onClick={() => {
            setParams(current => {
              const nextParams = new URLSearchParams(current);
              if (unconfirmed) nextParams.delete('unconfirmed');
              else nextParams.set('unconfirmed', '1');
              return nextParams;
            });
          }}>Unconfirmed</Button>
        </div>
        {unconfirmed && progress.isError && <p role="alert" className="text-ui-12 text-tea-text-sec">
          The latest check status could not load. <Button type="button" variant="quiet" size="sm" onClick={() => void progress.refetch()}>Retry</Button>
        </p>}
        <label className="relative block">
          <Search size={16} className="pointer-events-none absolute inset-y-0 my-auto ml-2 text-tea-text-sec" aria-hidden="true" />
          <input className="input-field min-h-tap py-2 pl-8 pr-3" type="search" aria-label="Search teas" placeholder="Search teas" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <ul className="mt-2 divide-y divide-tea-border lg:max-h-screen lg:overflow-y-auto">
          {rows.map(group => {
            const row = group.find(item => item === selected && (!unconfirmed || isUnconfirmed(item))) || group.find(item => !unconfirmed || isUnconfirmed(item))!;
            const Icon = kinds[row.kind].icon;
            return <li key={row.lot || reviewKey(row)}><Link className="flex min-h-tap min-w-0 items-center gap-2 px-2 py-2 hover:bg-tea-accent-sub aria-[current]:bg-tea-accent-sub"
              to={selectionHref(row.ref, false, unconfirmed)} aria-current={row === selected && !queueOnly ? 'true' : undefined}>
              <Icon size={16} className="shrink-0 text-tea-text-dim" aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words"><strong className="block text-ui-13 text-tea-text">{row.title}</strong>
                <span className="line-clamp-2 text-ui-12 text-tea-text-sec">{row.next}</span></span>
              <ChevronRight size={14} className="shrink-0 text-tea-text-dim" aria-hidden="true" />
            </Link></li>;
          })}
        </ul>
        {!rows.length && <p className="pt-3 text-ui-13 text-tea-text-sec">No teas match your search.</p>}
      </aside>
      {selected && <div key={reviewKey(selected)} className={queueOnly ? 'hidden min-w-0 space-y-4 lg:block' : 'min-w-0 space-y-4'}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link className="btn-quiet btn-sm lg:hidden" to={selectionHref(selected.ref, true, unconfirmed)}><List size={16} aria-hidden="true" />Tea queue</Link>
          {next && <Link className="btn-quiet btn-sm ml-auto" to={selectionHref(next.ref, false, unconfirmed)}>Next tea<ArrowRight size={16} aria-hidden="true" /></Link>}
        </div>
        <TeaCard className="!bg-tea-surface" title={<div className="min-w-0 px-4 pt-4">
          <p className={T.label}>{selected.kind === 'editorial' ? selected.passage.kind : kinds[selected.kind].label}</p>
          <h2 className={T.h2 + ' break-words'}>{selected.title}</h2>
        </div>}>
          <div className="space-y-4 p-4">
            {selected.kind === 'intake' && <IntakeReading id={selected.ref.id} />}
            {selected.kind === 'editorial' && <PassageReading passage={selected.passage} verdict={board?.verdicts[selected.ref.id]?.decision} decide={decide} />}
            {selected.kind !== 'intake' && <TeaDecisionConnection title={selected.title} target={selected.ref}
              shop={selected.kind === 'editorial' && selected.passage.lots.length === 1 ? selected.passage.lots[0].url :
                selected.kind === 'holds' ? selected.hold.url : selected.kind === 'histories' ? selected.history.url : undefined}
              wisdom={selected.kind === 'histories' ? selected.history.wisdom : undefined}
              identity={selected.kind === 'holds' ? {
                evidence: selected.hold.locator || 'Check the identity against the available evidence.',
                action: selected.hold.locator?.match(/\bask\b/i) ? 'Record supplier answer' :
                  selected.hold.locator?.match(/\b(label|receipt)\b/i) ? 'Record label finding' : 'Record finding',
                label: selected.hold.locator?.match(/\bask\b/i) ? 'Supplier answer' : 'Finding',
              } : undefined}
            />}
            {selected.kind === 'holds' && <SourceList sources={selected.hold.sources ?? []} />}
            {related.length > 0 && <nav className="flex flex-wrap gap-2 border-t border-tea-border pt-2" aria-label="Other decisions for this tea">
              {related.map(item => <Link className="btn-quiet btn-sm" key={reviewKey(item)} to={selectionHref(item.ref, false, unconfirmed)}>
                {kinds[item.kind].label}<ChevronRight size={14} aria-hidden="true" /></Link>)}
            </nav>}
          </div>
        </TeaCard>
      </div>}
    </div>
  </section>;
}
