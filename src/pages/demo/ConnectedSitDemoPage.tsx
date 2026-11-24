import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/shared/Button';
import { TYPOGRAPHY_CLASSES as type } from '../../designTokens';
import { useConnectedSitDemoAvailability } from './useConnectedSitDemoAvailability';

const chestTea = 'Spring Shui Xian';
const shopTea = 'Aged Liu Bao Tea';
const shopPath = '/shop/product/2ec4bcf5-1773-453c-b710-5b859203cb4e?store=bali';
const photoPath = '/read/porcelain-and-tea/teapot-on-gold-dish.jpg';
const stageTitles = ['Add the teas served', 'Offer a guest photo', 'Review the guest photo', 'See where the photo appears'] as const;
const surfaceLabels = ['Session recap', 'Brewing experiences', 'Photo essay'] as const;

type Stage = 0 | 1 | 2 | 3;
type Surface = typeof surfaceLabels[number];

function SamplePhoto({ tea }: { tea: string }) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-md border border-tea-border bg-tea-bg">
      <img src={photoPath} alt="A teapot resting in a glazed dish" className="max-h-[40dvh] w-full object-contain" />
      <figcaption className={`${type.bodyLight} px-3 py-2 text-tea-text-sec`}>
        Photo by Demo guest · {tea}
      </figcaption>
    </figure>
  );
}

function ConnectedSitWalkthrough() {
  const [stage, setStage] = useState<Stage>(0);
  const [teas, setTeas] = useState<string[]>([]);
  const [tea, setTea] = useState(chestTea);
  const [attached, setAttached] = useState(false);
  const [recapConsent, setRecapConsent] = useState(false);
  const [widerConsent, setWiderConsent] = useState(false);
  const [surface, setSurface] = useState<Surface>('Session recap');
  const [withdrawn, setWithdrawn] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStage = useRef(stage);

  useEffect(() => {
    if (previousStage.current !== stage) heading.current?.focus();
    previousStage.current = stage;
  }, [stage]);

  const hasPhoto = !withdrawn && (surface === 'Session recap' || widerConsent);

  return (
    <section aria-labelledby="connected-demo-step" className="space-y-4 rounded-md border border-tea-border bg-tea-surface p-4 sm:p-6">
      <h2 id="connected-demo-step" ref={heading} tabIndex={-1} className={type.h2}>{stageTitles[stage]}</h2>

      {stage === 0 && (
        <>
          <ul className="divide-y divide-tea-border">
            {[{ tea: chestTea, source: 'Demo Tea Chest' }, { tea: shopTea, source: 'Bali Shop' }].map(item => (
              <li key={item.tea} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className={type.h3}>{item.tea}</p>
                  <p className={`${type.bodyLight} text-tea-text-sec`}>
                    {item.tea === shopTea ? <Link className="tap-target underline" to={shopPath}>{item.source}</Link> : item.source}
                  </p>
                </div>
                <Button size="sm" variant="secondary" disabled={teas.includes(item.tea)}
                  onClick={() => setTeas(current => [...current, item.tea])}>
                  {teas.includes(item.tea) ? `Added ${item.tea}` : `Add ${item.tea}`}
                </Button>
              </li>
            ))}
          </ul>
          <Button disabled={teas.length !== 2} onClick={() => setStage(1)}>Save teas and continue as guest</Button>
        </>
      )}

      {stage === 1 && (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block">
              <span className={type.bodyLight}>Photo subject</span>
              <select value={tea} onChange={event => setTea(event.currentTarget.value)} className="btn-field mt-1 block w-full">
                {teas.map(item => <option key={item}>{item}</option>)}
                <option>Whole session</option>
              </select>
            </label>
            <Button variant="secondary" size="sm" disabled={attached} onClick={() => setAttached(true)}>
              {attached ? 'Sample photo attached' : 'Attach sample photo'}
            </Button>
            {attached && (
              <div className="space-y-2">
                <label className="flex min-h-tap cursor-pointer items-start gap-2">
                  <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-tea-gold" checked={recapConsent}
                    onChange={event => setRecapConsent(event.currentTarget.checked)} />
                  <span className={type.bodyLight}>Allow this photo and credit in the public recap.</span>
                </label>
                <label className="flex min-h-tap cursor-pointer items-start gap-2">
                  <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-tea-gold" checked={widerConsent} disabled={!recapConsent}
                    onChange={event => setWiderConsent(event.currentTarget.checked)} />
                  <span className={type.bodyLight}>Also allow this photo and credit in Brewing experiences and the photo essay.</span>
                </label>
              </div>
            )}
            <Button disabled={!attached || !recapConsent} onClick={() => setStage(2)}>Offer to the host</Button>
          </div>
          {attached && <SamplePhoto tea={tea} />}
        </div>
      )}

      {stage === 2 && (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <SamplePhoto tea={tea} />
          <div className="space-y-3">
            <p className={`${type.bodyLight} text-tea-text-sec`}>
              {widerConsent ? 'Offered for the session recap, Brewing experiences and the photo essay.' : 'Offered for the session recap only.'}
            </p>
            <Button onClick={() => setStage(3)}>Approve demo photo</Button>
          </div>
        </div>
      )}

      {stage === 3 && (
        <>
          <div aria-label="Demo placement" className="flex flex-wrap gap-2">
            {surfaceLabels.map(label => (
              <Button key={label} variant={surface === label ? 'secondary' : 'quiet'} size="sm"
                aria-pressed={surface === label} onClick={() => setSurface(label)}>
                {label}
              </Button>
            ))}
          </div>
          <h3 className={type.h3}>{surface}</h3>
          {surface === 'Session recap' && <p className={`${type.bodyLight} text-tea-text-sec`}>{teas.join(' · ')}</p>}
          {hasPhoto ? <SamplePhoto tea={tea} /> : (
            <p role="status" className={`${type.bodyLight} text-tea-text-sec`}>
              {withdrawn ? 'The guest withdrew the photo from every placement.' : 'The guest gave permission for the session recap only.'}
            </p>
          )}
          <Button variant="secondary" disabled={withdrawn} onClick={() => setWithdrawn(true)}>Withdraw demo photo as guest</Button>
        </>
      )}
    </section>
  );
}

export default function ConnectedSitDemoPage() {
  const availability = useConnectedSitDemoAvailability();
  const [run, setRun] = useState(0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-6 pb-nav-gap sm:px-6">
      <Link to="/tea-feed" className="btn-quiet btn-sm tap-target">Back to Brewing experiences</Link>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`${type.label} text-tea-gold`}>Demo</p>
          <h1 className={type.h1}>Practice connected sit</h1>
          {availability.data === true && <p className={`${type.bodyLight} mt-1 text-tea-text-sec`}>Try the host and guest steps using sample data.</p>}
        </div>
        {availability.data === true && !availability.isError && <Button variant="quiet" size="sm" onClick={() => setRun(current => current + 1)}>Restart demo</Button>}
      </header>
      {availability.isPending ? <p role="status" className={type.bodyLight}>Checking demo availability…</p> : availability.isError ? (
        <div className="space-y-2">
          <p role="status" className={type.bodyLight}>Demo availability could not be checked.</p>
          <Button variant="secondary" size="sm" onClick={() => void availability.refetch()}>Try again</Button>
        </div>
      ) : availability.data === true ? <ConnectedSitWalkthrough key={run} /> : (
        <p role="status" className={type.bodyLight}>This demo is no longer available.</p>
      )}
    </div>
  );
}
