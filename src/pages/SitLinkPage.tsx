// A host's shared sit. Scheduled guests sign in to use their approved seat.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/shared/Button';
import VenueGuide from '../components/events/VenueGuide';
import { SessionTeaRow, sessionOfferItem } from '../components/sessions/SessionTeaRow';
import { LinkTeaPage } from '../components/shop/LinkTeaPage';
import { useOpenLinkTea } from '../components/shop/useOpenLinkTea';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { useAuth } from '../hooks/useAuth';
import { currentSignInToken } from '../lib/api';
import { holdAfterSitCredential } from '../lib/afterSitAccess';
import { authPagePath } from '../lib/authNavigation';
import { joinSit, readSitLink, type SitLink } from '../lib/sitLink';
import type { PublicSessionTea } from '../../shared/sessionTea';
import type { InventoryItem } from '../types';

type Loaded = { status: 'missing' | 'error' } | { status: 'approval'; rsvpPath: string | null } | { status: 'ready'; sit: SitLink };

export default function SitLinkPage({ onAddToCart }: { onAddToCart?: (item: InventoryItem, grams: number, totalUsd: number) => void }) {
  const { code = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<{ key: string; result: Loaded } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [joining, setJoining] = useState(false);
  const [refused, setRefused] = useState(false);
  const userId = user?.email ?? null;
  const key = JSON.stringify([code, attempt, userId]);
  const state = loaded?.key === key ? loaded.result : { status: 'loading' as const };

  useEffect(() => {
    let current = true;
    readSitLink(code, currentSignInToken()).then(
      sit => {
        if (!current) return;
        const result = !sit ? { status: 'missing' as const }
          : sit.access === 'approval' ? { status: 'approval' as const, rsvpPath: sit.rsvp_path }
          : { status: 'ready' as const, sit };
        setLoaded({ key, result });
      },
      () => { if (current) setLoaded({ key, result: { status: 'error' } }); },
    );
    return () => { current = false; };
  }, [code, key]);

  async function takeSeat() {
    const token = currentSignInToken();
    if (!token || joining) return;
    setJoining(true);
    setRefused(false);
    const credential = await joinSit(code, token).catch(() => null);
    setJoining(false);
    if (token !== currentSignInToken()) return;
    if (!credential) { setRefused(true); return; }
    holdAfterSitCredential(credential);
    navigate('/after-sit');
  }

  return (
    <article aria-label="A tea sit" className="mx-auto flex w-full max-w-xl flex-col gap-6 py-6">
      {state.status === 'loading' && <p role="status" className={TYPOGRAPHY_CLASSES.body}>Opening the sit…</p>}
      {state.status === 'missing' && (
        <>
          <h1 className={TYPOGRAPHY_CLASSES.h1}>This sit is not here</h1>
          <p className={TYPOGRAPHY_CLASSES.body}>Ask your host to send the link again.</p>
        </>
      )}
      {state.status === 'error' && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className={TYPOGRAPHY_CLASSES.body}>Couldn’t open the sit.</p>
          <Button variant="secondary" type="button" className="tap-target" onClick={() => setAttempt(value => value + 1)}>Try again</Button>
        </div>
      )}
      {state.status === 'approval' && (
        <>
          <h1 className={TYPOGRAPHY_CLASSES.h1}>Private tea sit</h1>
          <p className={TYPOGRAPHY_CLASSES.body}>
            {userId ? 'Your host needs to confirm your seat before you can open the sit.' : 'Sign in to open the sit with your confirmed seat.'}
            {userId && !state.rsvpPath && ' Ask your host about your seat.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {!userId && (
              <Link to={authPagePath('signin', `/sit/${encodeURIComponent(code)}`)} className="btn-primary tap-target">Sign in</Link>
            )}
            {state.rsvpPath && <Link to={state.rsvpPath} className="btn-secondary tap-target">Open RSVP</Link>}
            {userId && (
              <Button variant="quiet" type="button" className="tap-target" onClick={() => setAttempt(value => value + 1)}>Check again</Button>
            )}
          </div>
        </>
      )}
      {state.status === 'ready' && (
        <>
          <header className="flex flex-col gap-3 pt-6">
            <p className="text-ui-11 uppercase tracking-widest text-tea-text-sec">
              <time dateTime={state.sit.date}>{sitDay(state.sit)}</time>
              {state.sit.way?.place && <> · {state.sit.way.place}</>}
            </p>
            <h1 className="break-words font-display text-5xl leading-tight text-tea-text">{state.sit.title}</h1>
          </header>
          {state.sit.note && (
            <p className="whitespace-pre-wrap break-words font-display text-ui-20 italic leading-relaxed text-tea-text">{state.sit.note}</p>
          )}
          {state.sit.way && <Way way={state.sit.way} />}
          {state.sit.teas.length > 0 && (
            <section aria-labelledby="sit-teas" className="border-t border-tea-border pt-4">
              <h2 id="sit-teas" className={TYPOGRAPHY_CLASSES.h2}>The teas</h2>
              <Teas teas={state.sit.teas} onAddToCart={onAddToCart} />
            </section>
          )}
          {state.sit.happened && (state.sit.access === 'casual' || state.sit.seated) && (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-tea-border pt-4">
              {refused && <p role="alert" className={`${TYPOGRAPHY_CLASSES.bodyLight} flex-1`}>Ask your host about this sit.</p>}
              {userId ? (
                <Button type="button" size="lg" className="tap-target" loading={joining} onClick={takeSeat}>
                  {state.sit.seated ? 'Your notes and photographs' : 'I was at this table'}
                </Button>
              ) : (
                <Link to={authPagePath('signin', `/sit/${encodeURIComponent(code)}`)} className="btn-primary btn-lg tap-target">
                  Sign in to keep these teas
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

function sitDay(sit: SitLink) {
  const dateOnly = sit.date.length === 10;
  const date = new Date(sit.date);
  if (Number.isNaN(date.getTime())) return sit.date;
  return date.toLocaleDateString(undefined, { dateStyle: 'full', timeZone: dateOnly ? 'UTC' : sit.timezone ?? undefined });
}

function Way({ way }: { way: NonNullable<SitLink['way']> }) {
  return (
    <section aria-label="The way in" className="border-t border-tea-border pt-4">
      {(way.place || way.address) && (
        <p className={`${TYPOGRAPHY_CLASSES.body} mb-3 break-words`}>
          {[way.place, way.address].filter(Boolean).join(', ')}
        </p>
      )}
      {way.guide
        ? <VenueGuide venueGuide={way.guide} mapLink={way.map_link ?? undefined} />
        : way.map_link && (
          <a href={way.map_link} target="_blank" rel="noopener noreferrer" className="btn-secondary tap-target">Open in maps</a>
        )}
    </section>
  );
}

/**
 * The teas of the sit, each the shop's own row: its Save box and, where it is
 * sold, its price. A tea the shop sells opens as the shop's own page over the
 * link, to read about it, taste it and order it (Adrian, 2026-11-27: "a place
 * to read about it and buy it and save it").
 */
function Teas({ teas, onAddToCart }: { teas: PublicSessionTea[]; onAddToCart?: (item: InventoryItem, grams: number, totalUsd: number) => void }) {
  const { openId, open, move, close } = useOpenLinkTea();
  // One entry per product: a tea poured twice is one page, so the arrows never step onto the page already open.
  const sold = useMemo(() => {
    const seen = new Set<string>();
    return teas.flatMap(tea => {
      if (tea.kind !== 'tea' || !tea.offer) return [];
      const item = sessionOfferItem(tea.offer.product);
      if (seen.has(item.id)) return [];
      seen.add(item.id);
      return [item];
    });
  }, [teas]);
  const at = openId ? sold.findIndex(item => item.id === openId) : -1;
  return (
    <div className="mt-3">
      {teas.map((tea, index) => {
        const item = tea.kind === 'tea' && tea.offer ? sessionOfferItem(tea.offer.product) : null;
        return <SessionTeaRow key={tea.id ?? index} tea={tea} onOpen={item ? () => open(item.id) : undefined} />;
      })}
      {at >= 0 && (
        <LinkTeaPage
          item={sold[at]}
          onClose={close}
          onAddToCart={onAddToCart}
          yoursLine="Poured at this sit"
          yoursNav={{
            index: at + 1,
            count: sold.length,
            onPrev: at > 0 ? () => move(sold[at - 1].id) : undefined,
            onNext: at < sold.length - 1 ? () => move(sold[at + 1].id) : undefined,
          }}
        />
      )}
    </div>
  );
}
