// A sit, opened by its one link (Adrian, 2026-11-27): the teas that were
// poured, the host's note and, until the day is over, the way in. Anyone
// holding the link sees this. A signed-in person who was there takes their
// seat with one press and lands on the thank-you page a seated guest already
// has, where notes, photographs and keeping a tea live.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/shared/Button';
import VenueGuide from '../components/events/VenueGuide';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { useAuth } from '../hooks/useAuth';
import { currentSignInToken } from '../lib/api';
import { holdAfterSitCredential } from '../lib/afterSitAccess';
import { authPagePath } from '../lib/authNavigation';
import { mediaUrl } from '../lib/mediaUrl';
import { joinSit, readSitLink, type SitLink } from '../lib/sitLink';
import type { PublicSessionTea } from '../../shared/sessionTea';

type State = { status: 'loading' | 'missing' | 'error' } | { status: 'ready'; sit: SitLink };

export default function SitLinkPage() {
  const { code = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [joining, setJoining] = useState(false);
  const [refused, setRefused] = useState(false);
  const userId = user?.email ?? null;

  useEffect(() => {
    let current = true;
    readSitLink(code, currentSignInToken()).then(
      sit => { if (current) setState(sit ? { status: 'ready', sit } : { status: 'missing' }); },
      () => { if (current) setState({ status: 'error' }); },
    );
    return () => { current = false; };
  }, [code, attempt, userId]);

  async function takeSeat() {
    const token = currentSignInToken();
    if (!token || joining) return;
    setJoining(true);
    setRefused(false);
    const credential = await joinSit(code, token).catch(() => null);
    setJoining(false);
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
          <Button variant="secondary" type="button" className="tap-target" onClick={() => {
            setState({ status: 'loading' });
            setAttempt(value => value + 1);
          }}>Try again</Button>
        </div>
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
              <ol className="mt-3 flex flex-col divide-y divide-tea-border">
                {state.sit.teas.map((tea, index) => <Tea key={tea.id ?? index} tea={tea} place={index + 1} />)}
              </ol>
            </section>
          )}
          {state.sit.happened && (
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

function Tea({ tea, place }: { tea: PublicSessionTea; place: number }) {
  const product = tea.kind === 'tea' ? tea.offer?.product : undefined;
  const image = typeof product?.imageUrl === 'string' ? product.imageUrl : typeof product?.image_url === 'string' ? product.image_url : null;
  const facts = tea.kind === 'tea' ? [tea.type, tea.year, tea.place].filter(Boolean).join(' · ') : '';
  // Led by words: the numeral and the name carry the row, a picture joins only where one exists.
  const body = (
    <>
      <span aria-hidden="true" className="w-10 shrink-0 font-display text-5xl leading-none text-tea-gold">{place}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {facts && <span className="text-ui-11 uppercase tracking-widest text-tea-text-sec">{facts}</span>}
        <span className="break-words font-display text-ui-24 leading-tight text-tea-text">{tea.name}</span>
      </span>
      {image && <img src={mediaUrl(image)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-md object-cover" />}
    </>
  );
  return (
    <li className="py-4">
      {tea.kind === 'tea' && tea.href
        ? <Link to={tea.href} className="flex items-center gap-4 tap-target">{body}</Link>
        : <div className="flex items-center gap-4">{body}</div>}
    </li>
  );
}
