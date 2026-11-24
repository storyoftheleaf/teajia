import { Link } from 'react-router-dom';
import { useConnectedSitDemoAvailability } from './demo/useConnectedSitDemoAvailability';
import { SessionCards } from '../components/sessions/SessionCards';
import { TYPOGRAPHY_CLASSES } from '../designTokens';

export default function TeaFeedPage() {
  const demo = useConnectedSitDemoAvailability();
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-6 pb-nav-gap md:px-6">
      <h1 className={`${TYPOGRAPHY_CLASSES.h1} mb-4`}>Brewing experiences</h1>
      {demo.data === true && !demo.isError && (
        <section aria-labelledby="connected-sit-demo-heading" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-tea-border bg-tea-surface p-4">
          <div>
            <h2 id="connected-sit-demo-heading" className={TYPOGRAPHY_CLASSES.h3}>Connected sit demo</h2>
            <p className={TYPOGRAPHY_CLASSES.bodyLight + ' text-tea-text-sec'}>Try the host and guest flow with sample teas and a sample photo.</p>
          </div>
          <Link className="btn-secondary btn-sm tap-target" to="/demo/connected-sit">Open demo</Link>
        </section>
      )}
      <SessionCards />
    </div>
  );
}
