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
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useScrollLock } from '../hooks/useScrollLock';
import { useStepParam } from '../hooks/useStepParam';
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
  // An open tea is a step: back closes it, and a link can carry it.
  const [teaStep, setTeaStep] = useStepParam('tea');

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
                {state.sit.teas.map((tea, index) => (
                  <Tea key={tea.id ?? index} tea={tea} place={index + 1} onOpen={() => setTeaStep(String(index + 1))} />
                ))}
              </ol>
            </section>
          )}
          {openTea(state.sit.teas, teaStep) && (
            <TeaReader teas={state.sit.teas} place={Number(teaStep)}
              onPlace={place => setTeaStep(String(place), { refine: true })} onClose={() => setTeaStep(null)} />
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

const teaFacts = (tea: PublicSessionTea) => (tea.kind === 'tea' ? [tea.type, tea.year, tea.place].filter(Boolean).join(' · ') : '');
const teaImage = (tea: PublicSessionTea) => {
  const product = tea.kind === 'tea' ? tea.offer?.product : undefined;
  return typeof product?.imageUrl === 'string' ? product.imageUrl : typeof product?.image_url === 'string' ? product.image_url : null;
};
const openTea = (teas: PublicSessionTea[], step: string) => (/^[1-9]\d*$/.test(step) ? teas[Number(step) - 1] ?? null : null);

function Tea({ tea, place, onOpen }: { tea: PublicSessionTea; place: number; onOpen: () => void }) {
  const facts = teaFacts(tea);
  const image = teaImage(tea);
  // Led by words: the numeral and the name carry the row, a picture joins only where one exists.
  return (
    <li>
      <Button type="button" variant="plain" onClick={onOpen} className="flex w-full items-center gap-4 py-4 text-left">
        <span aria-hidden="true" className="w-10 shrink-0 font-display text-5xl leading-none text-tea-gold">{place}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {facts && <span className="text-ui-11 uppercase tracking-widest text-tea-text-sec">{facts}</span>}
          <span className="break-words font-display text-ui-24 leading-tight text-tea-text">{tea.name}</span>
        </span>
        {image && <img src={mediaUrl(image)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-md object-cover" />}
      </Button>
    </li>
  );
}

/** One tea to a screen: its number, what it is and its name, with its picture behind only where it has one. */
function TeaReader({ teas, place, onPlace, onClose }: {
  teas: PublicSessionTea[]; place: number; onPlace: (place: number) => void; onClose: () => void;
}) {
  const tea = teas[place - 1];
  const facts = teaFacts(tea);
  const image = teaImage(tea);
  useScrollLock(true);
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={tea.name} className="fixed inset-0 z-modal flex flex-col bg-tea-bg">
      {image && (
        <>
          <img src={mediaUrl(image)} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-tea-bg via-tea-bg/60 to-transparent" />
        </>
      )}
      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col p-4">
        <div aria-hidden="true" className="flex gap-1">
          {teas.map((_, index) => (
            <span key={index} className={`h-0.5 flex-1 ${index < place ? 'bg-tea-gold' : 'bg-tea-border'}`} />
          ))}
        </div>
        <div className="mt-3">
          <Button type="button" variant="quiet" size="sm" className="tap-target" onClick={onClose}>The teas</Button>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-3 pb-6">
          <span aria-hidden="true" className={`font-display leading-none text-tea-gold ${image ? 'text-7xl' : 'text-9xl'}`}>{place}</span>
          <p className="text-ui-11 uppercase tracking-widest text-tea-text-sec">
            {[`Tea ${place} of ${teas.length}`, facts].filter(Boolean).join(' · ')}
          </p>
          <h2 className="break-words font-display text-5xl leading-tight text-tea-text">{tea.name}</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-nav-gap">
          <Button type="button" variant="secondary" className="tap-target" disabled={place <= 1} onClick={() => onPlace(place - 1)}>Back</Button>
          <div className="flex flex-wrap items-center gap-2">
            {tea.kind === 'tea' && tea.href && <Link to={tea.href} className="btn-secondary tap-target">About this tea</Link>}
            {place < teas.length
              ? <Button type="button" className="tap-target" onClick={() => onPlace(place + 1)}>Next</Button>
              : <Button type="button" className="tap-target" onClick={onClose}>Done</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
