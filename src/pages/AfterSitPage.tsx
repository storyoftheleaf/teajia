import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/shared/Button';
import { GuestBook } from '../components/events/GuestBook';
import { PrivateKeptSetup } from '../components/events/PrivateKeptSetup';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { afterSitDeviceKey, getAfterSitCredential, lookupAfterSitRecap, subscribeAfterSitCredential, type AfterSitRecap } from '../lib/afterSitAccess';

type RecapState =
  | { status: 'loading' | 'missing' | 'error' }
  | { status: 'device-copy'; deviceKey: string }
  | { status: 'ready'; recap: AfterSitRecap; deviceKey: string };

export default function AfterSitPage() {
  const { credential, revision } = useSyncExternalStore(subscribeAfterSitCredential, getAfterSitCredential);
  return <AfterSitContent key={revision} credential={credential} />;
}

function AfterSitContent({ credential }: { credential: string }) {
  const [state, setState] = useState<RecapState>({ status: credential ? 'loading' : 'missing' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!credential) return;
    let current = true;
    void Promise.all([lookupAfterSitRecap(credential), afterSitDeviceKey(credential)]).then(
      ([recap, deviceKey]) => {
        if (!current) return;
        if (recap) setState({ status: 'ready', recap, deviceKey });
        else {
          const saved = readDeviceSetup(deviceKey);
          setState(saved ? { status: 'device-copy', deviceKey } : { status: 'missing' });
        }
      },
      () => { if (current) setState({ status: 'error' }); },
    );
    return () => { current = false; };
  }, [credential, attempt]);

  return (
    <article aria-label="After the sit" className="mx-auto flex w-full max-w-xl flex-col gap-4 py-6">
      {state.status === 'loading' && <p role="status" className={TYPOGRAPHY_CLASSES.body}>Opening your recap…</p>}
      {state.status === 'missing' && (
        <>
          <h1 className={TYPOGRAPHY_CLASSES.h1}>After the sit</h1>
          <p className={TYPOGRAPHY_CLASSES.body}>Open the personal link from your host. If it has expired, ask your host for a new one.</p>
        </>
      )}
      {state.status === 'error' && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className={TYPOGRAPHY_CLASSES.body}>Couldn’t open your recap.</p>
          <Button variant="secondary" type="button" className="tap-target" onClick={() => {
            setState({ status: 'loading' });
            setAttempt(value => value + 1);
          }}>Try again</Button>
        </div>
      )}
      {state.status === 'device-copy' && (
        <>
          <h1 className={TYPOGRAPHY_CLASSES.h1}>After the sit</h1>
          <p className={TYPOGRAPHY_CLASSES.body}>Ask your host for a new recap link. You still have a copy of the setup on this device.</p>
          <DeviceSetup key={state.deviceKey} deviceKey={state.deviceKey} onRemoved={() => setState({ status: 'missing' })} />
        </>
      )}
      {state.status === 'ready' && <SitRecap {...state} credential={credential} />}
    </article>
  );
}

function SitRecap({ recap, deviceKey, credential }: { recap: AfterSitRecap; deviceKey: string; credential: string }) {
  const date = new Date(recap.event.event_date);
  const displayDate = Number.isNaN(date.getTime()) ? recap.event.event_date : date.toLocaleDateString(undefined, {
    dateStyle: 'long',
    ...(recap.event.event_date.length === 10 ? { timeZone: 'UTC' } : {}),
  });

  return (
    <>
      <header>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} break-words`}>{recap.event.title}</h1>
        <time dateTime={recap.event.event_date} className={TYPOGRAPHY_CLASSES.bodyLight}>{displayDate}</time>
      </header>
      {recap.host_note && <p className={`${TYPOGRAPHY_CLASSES.body} whitespace-pre-wrap break-words`}>{recap.host_note}</p>}
      {recap.teas.length > 0 && (
        <section aria-labelledby="after-sit-teas" className="border-t border-tea-border pt-3">
          <h2 id="after-sit-teas" className={TYPOGRAPHY_CLASSES.h2}>Teas served</h2>
          <ul className={`${TYPOGRAPHY_CLASSES.body} mt-2 grid gap-1`}>
            {recap.teas.map(tea => <li key={tea.id} className="break-words">{tea.name}</li>)}
          </ul>
        </section>
      )}
      <PrivateKeptSetup token={credential} setupId={recap.event.id} teas={recap.teas}
        afterSit={{ cacheKey: deviceKey, deviceFallback: <DeviceSetup key={deviceKey} recap={recap} deviceKey={deviceKey} /> }} />
      <GuestBook token={credential} afterSitKey={deviceKey} setupId={recap.event.id} />
    </>
  );
}

function readDeviceSetup(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function DeviceSetup({ recap, deviceKey, onRemoved }: { recap?: AfterSitRecap; deviceKey: string; onRemoved?: () => void }) {
  const [saved, setSaved] = useState(() => readDeviceSetup(deviceKey));
  const [error, setError] = useState(false);

  function change(keep: boolean) {
    try {
      const snapshot = keep && recap ? [recap.event.title, recap.event.event_date, ...recap.teas.map(tea => tea.name)].join('\n') : null;
      if (snapshot) localStorage.setItem(deviceKey, snapshot);
      else localStorage.removeItem(deviceKey);
      setSaved(snapshot);
      setError(false);
      if (!keep) onRemoved?.();
    } catch {
      setError(true);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {saved ? (
          <>
            <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Saved on this device</p>
            <a className="btn-secondary tap-target" href={`data:text/plain;charset=utf-8,${encodeURIComponent(saved)}`}
              download="teajia-sit.txt">Download setup</a>
            <Button variant="quiet" type="button" className="tap-target" onClick={() => change(false)}>Undo</Button>
          </>
        ) : recap && (
          <Button type="button" className="tap-target" onClick={() => change(true)}>Save on this device</Button>
        )}
      </div>
      {recap && (
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2`}>
          To save in Journey, <Link to="/signin" className={TYPOGRAPHY_CLASSES.link}>sign in</Link> with the account linked to your seat, then reopen the message from your host.
        </p>
      )}
      {error && <p role="alert" className={TYPOGRAPHY_CLASSES.bodyLight}>This browser couldn’t update your saved setup.</p>}
    </>
  );
}
