import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { useStepParam } from '../hooks/useStepParam';
import { useAuth } from '../hooks/useAuth';
import { authPagePath } from '../lib/authNavigation';
import { familyApi } from '../lib/familyApi';
import { mediaUrl } from '../lib/mediaUrl';
import { recapPath } from '../lib/publicSitConnections';
import { TEA_TABLE_MINE_KEY, teaTableApi, useTeaTableMine } from '../lib/teaTableApi';
import {
  TEA_TABLE_SHOWS, teaTableKey, teaTableMoment,
  type TeaTableItem, type TeaTableRecap, type TeaTableShow, type TeaTableTasting,
} from '../lib/teaTableContract';
import { Button } from '../components/shared/Button';
import { PhotographThumb, PhotographZoom, type ZoomPhotograph } from '../components/shared/Photographs';
import { SessionPhoto } from '../components/sessions/SessionPhoto';
import { TeaCard, TeaCardMeta, TeaCardTitle } from '../components/tea/TeaCard';

// The Tea Table (todo/plans/tea-table.md; the rule is "The Tea Table" in
// CLAUDE.md). What people chose to put on the table, newest first, grouped by
// the day it was put there: shared tastings in their own words and
// photographs, and sessions their hosts put on the table. A host, or Adrian,
// may hold a piece at the top for a while; it sits above the days without a
// word about why. Anyone signed in may keep a piece; nobody sees how many did.
//
// What a piece offers is the plan's short list: open the tea, open the person,
// open the session, keep it. The author can take their own piece off. There
// are no likes, replies, follows, counts or scores anywhere on this page, and
// "Earlier" is a step in the address, never an endless scroll.

const SHOW_LABEL: Record<TeaTableShow, string> = { all: 'All', tastings: 'Tastings', sessions: 'Sessions' };
const CHINESE_FONT_STACK = "'Noto Serif SC','Cormorant Garamond',serif";
const quietLink = 'tap-target text-tea-text underline decoration-tea-border underline-offset-4 hover:text-tea-gold-lt';

function dayOf(at: string): string {
  const date = teaTableMoment(at);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function calendarDay(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The day heading: a spaced caps date and a hairline. */
function DayRule({ label }: { label: string }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-3.5">
      <h2 className="font-sans text-ui-10 font-medium uppercase tracking-[0.24em] text-tea-text-dim">{label}</h2>
      <span aria-hidden="true" className="h-px flex-1 bg-tea-border" />
    </div>
  );
}

/** "Keep" and "Kept": the private keep. Signed out, it leads to sign in and back. */
function KeepControl({ item, kept }: { item: TeaTableItem; kept: boolean }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const client = useQueryClient();
  const keep = useMutation({
    mutationFn: () => teaTableApi.keep(item.kind, item.id, !kept),
    onSuccess: () => client.invalidateQueries({ queryKey: TEA_TABLE_MINE_KEY }),
  });
  if (!isAuthenticated) {
    return <Link to={authPagePath('signin', `${location.pathname}${location.search}`)} className="btn-quiet btn-sm tap-target" data-testid="tea-table-keep">Keep</Link>;
  }
  return (
    <Button variant="quiet" size="sm" type="button" className="tap-target" aria-pressed={kept} disabled={keep.isPending}
      onClick={() => keep.mutate()} data-testid="tea-table-keep">
      {kept ? 'Kept' : 'Keep'}
    </Button>
  );
}

/**
 * The author's own way off the table. Their page keeps the tasting only when
 * they had put it on their page by itself before; when the table was the only
 * reason it was public, it goes private everywhere (worker/src/teaTable.ts).
 */
function TakeOffControl({ item }: { item: TeaTableTasting }) {
  const client = useQueryClient();
  const takeOff = useMutation({
    mutationFn: () => teaTableApi.takeOff(item.id),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['tea-table', 'page'] }),
      client.invalidateQueries({ queryKey: TEA_TABLE_MINE_KEY }),
      client.invalidateQueries({ queryKey: ['contributor'] }),
      client.invalidateQueries({ queryKey: ['family'] }),
    ]),
  });
  return (
    <Button variant="quiet" size="sm" type="button" className="tap-target" disabled={takeOff.isPending}
      onClick={() => takeOff.mutate()} data-testid="tea-table-take-off">
      Take off the table
    </Button>
  );
}

/** The one report line, as on a person's page: one tap tells Teajia. */
function ReportControl({ item }: { item: TeaTableTasting }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  if (state === 'sent') return <span className="text-ui-12 text-tea-text-sec" role="status">Teajia has been told.</span>;
  return (
    <Button variant="plain" type="button" className="tap-target text-ui-12 text-tea-text-sec underline decoration-tea-border underline-offset-4 hover:text-tea-text"
      disabled={state === 'sending'} data-testid="tea-table-report"
      onClick={async () => {
        setState('sending');
        try { await familyApi.report({ target_kind: 'tasting', target_id: item.id }); setState('sent'); } catch { setState('failed'); }
      }}>
      {state === 'failed' ? 'Report did not go through. Try again' : 'Report'}
    </Button>
  );
}

function TastingPhotographs({ item }: { item: TeaTableTasting }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!item.photographs.length) return null;
  const toZoom = (photo: TeaTableTasting['photographs'][number]): ZoomPhotograph => ({
    id: photo.id, smallSrc: mediaUrl(photo.small_url), fullSrc: mediaUrl(photo.full_url),
    width: photo.small_width, height: photo.small_height, shape: photo.shape, frame: photo.frame,
    alt: `${item.tea.name}, photographed by ${item.person.name}`,
  });
  const open = item.photographs.find(photo => photo.id === openId) ?? null;
  return (
    <>
      <ul className="photo-row px-3 pt-3" aria-label={`Photographs of ${item.tea.name}`} data-testid="tea-table-photographs">
        {item.photographs.map(photo => <li key={photo.id}><PhotographThumb photo={toZoom(photo)} size="page" onOpen={setOpenId} /></li>)}
      </ul>
      <PhotographZoom photo={open ? toZoom(open) : null} onClose={() => setOpenId(null)}>
        Photograph by {item.person.name}
      </PhotographZoom>
    </>
  );
}

function TastingPiece({ item, kept, mine }: { item: TeaTableTasting; kept: boolean; mine: boolean }) {
  const words = item.words.slice(-3);
  return (
    <TeaCard teaType={item.tea.type ?? undefined} testId="tea-table-piece"
      title={<TeaCardTitle as="h3">
        <Link to={item.tea.path} className="tap-target flex flex-wrap items-baseline gap-x-2 hover:text-tea-gold">
          <span className="min-w-0 break-words">{item.tea.name}</span>
          {item.tea.chinese_name && <span className="text-ui-14 text-tea-text-sec" style={{ fontFamily: CHINESE_FONT_STACK }}>{item.tea.chinese_name}</span>}
        </Link>
      </TeaCardTitle>}
      meta={<TeaCardMeta primary={<>Tasted by <Link to={item.person.path} className={quietLink}>{item.person.name}</Link></>} />}
      actions={<div className="flex flex-wrap items-center gap-2">
        <KeepControl item={item} kept={kept} />
        {mine ? <TakeOffControl item={item} /> : <ReportControl item={item} />}
      </div>}>
      {words.length > 0 && (
        <div className="space-y-3 px-3 pt-3" data-testid="tea-table-words">
          {words.map((word, index) => <p key={`${word.date ?? ''}-${index}`} className="whitespace-pre-line break-words font-body text-ui-15 leading-[1.65] text-tea-text">{word.text}</p>)}
        </div>
      )}
      <TastingPhotographs item={item} />
      <div className="h-3" />
    </TeaCard>
  );
}

function RecapPiece({ item, kept }: { item: TeaTableRecap; kept: boolean }) {
  const href = recapPath(item.slug);
  return (
    <TeaCard teaType={item.tea_type ?? undefined} testId="tea-table-piece"
      title={<TeaCardTitle as="h3">
        <Link to={href} className="tap-target flex items-center gap-2 hover:text-tea-gold">
          <span className="min-w-0 break-words">{item.title}</span>
          <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        </Link>
      </TeaCardTitle>}
      meta={<TeaCardMeta primary={[calendarDay(item.session_date), item.host ? `Hosted by ${item.host}` : null].filter(Boolean).join(' · ')} />}
      actions={<div className="flex flex-wrap items-center gap-2"><KeepControl item={item} kept={kept} /></div>}>
      <SessionPhoto source={{ kind: 'formal', slug: item.slug, placement: 'brewing' }} />
      {(item.writing || item.teas.length > 0) && (
        <div className="space-y-2 px-3 py-3">
          {item.writing && <p className="line-clamp-3 break-words text-ui-14 text-tea-text-sec">{item.writing}</p>}
          {item.teas.length > 0 && <p className="break-words text-ui-13 text-tea-text">{item.teas.join(' · ')}</p>}
        </div>
      )}
    </TeaCard>
  );
}

function Piece({ item, kept, mine }: { item: TeaTableItem; kept: Set<string>; mine: Set<string> }) {
  const key = teaTableKey(item);
  return item.kind === 'tasting'
    ? <TastingPiece item={item} kept={kept.has(key)} mine={mine.has(key)} />
    : <RecapPiece item={item} kept={kept.has(key)} />;
}

function groupByDay(items: TeaTableItem[]) {
  const days: Array<{ day: string; items: TeaTableItem[] }> = [];
  for (const item of items) {
    const day = dayOf(item.at);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(item);
    else days.push({ day, items: [item] });
  }
  return days;
}

export default function TeaTablePage() {
  const [showParam, setShow] = useStepParam('show', 'all');
  const [before, setBefore] = useStepParam('before');
  const show: TeaTableShow = (TEA_TABLE_SHOWS as readonly string[]).includes(showParam) ? showParam as TeaTableShow : 'all';
  const page = useQuery({
    queryKey: ['tea-table', 'page', show, before || null],
    queryFn: ({ signal }) => teaTableApi.page(show, before || null, signal),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: 'always',
  });
  const mineQuery = useTeaTableMine();
  const kept = useMemo(() => new Set((mineQuery.data?.kept ?? []).map(teaTableKey)), [mineQuery.data]);
  const mine = useMemo(() => new Set(mineQuery.data?.mine ?? []), [mineQuery.data]);
  const data = page.data;
  const empty = !!data && data.held.length === 0 && data.items.length === 0;

  return (
    <main className="min-h-screen bg-tea-bg pb-nav-gap" data-testid="tea-table-page">
      <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6">
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text`}>The Tea Table</h1>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 text-tea-text-sec`}>What people have put on the table: tastings in their own words, and sessions poured. Newest first.</p>

        <div role="group" aria-label="The Tea Table and around it" className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-tea-border" data-testid="tea-table-views">
          <span aria-current="page" className="btn-tab">On the table</span>
          <Link to="/events" className="btn-tab">Sessions</Link>
          <Link to="/people" className="btn-tab">People</Link>
        </div>


        <div role="group" aria-label="Show" className="mt-4 flex flex-wrap items-center gap-2" data-testid="tea-table-show">
          {TEA_TABLE_SHOWS.map(option => (
            <button key={option} type="button" className="btn-chip tap-target" aria-pressed={show === option}
              // history: refine
              onClick={() => setShow(option === 'all' ? null : option, { refine: true })}>
              {SHOW_LABEL[option]}
            </button>
          ))}
        </div>

        {page.isPending && <p role="status" className="mt-8 text-ui-14 text-tea-text-sec">Opening the table…</p>}
        {page.isError && (
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <p role="alert" className="text-ui-14 text-tea-text-sec">Could not open the Tea Table.</p>
            <Button variant="secondary" size="sm" type="button" onClick={() => void page.refetch()}>Try again</Button>
          </div>
        )}
        {empty && (
          <p className={`${TYPOGRAPHY_CLASSES.body} mt-8 text-tea-text-sec`} data-testid="tea-table-empty">
            {before ? 'Nothing earlier on the table.' : 'Nothing is on the table yet.'} Meet <Link to="/people" className={quietLink}>the people</Link>, or find <Link to="/events" className={quietLink}>a session</Link>.
          </p>
        )}

        {data && data.held.length > 0 && (
          <section aria-label="Held at the top for now" className="mt-8 grid gap-4" data-testid="tea-table-held">
            {data.held.map(item => <Piece key={teaTableKey(item)} item={item} kept={kept} mine={mine} />)}
          </section>
        )}

        {data && groupByDay(data.items).map(group => (
          <section key={group.day} aria-label={group.day} data-testid="tea-table-day">
            <DayRule label={group.day} />
            <div className="grid gap-4">
              {group.items.map(item => <Piece key={teaTableKey(item)} item={item} kept={kept} mine={mine} />)}
            </div>
          </section>
        ))}

        {data && (data.earlier || before) && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            {before ? <Button variant="quiet" size="sm" type="button" className="tap-target" onClick={() => setBefore(null)}>The newest</Button> : <span />}
            {data.earlier && <Button variant="secondary" size="sm" type="button" className="tap-target" onClick={() => setBefore(data.earlier)} data-testid="tea-table-earlier">Earlier</Button>}
          </div>
        )}
      </div>
    </main>
  );
}
