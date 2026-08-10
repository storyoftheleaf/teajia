import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from '@phosphor-icons/react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PaymentChooser } from '../components/profile/PaymentChooser';
import { buildPaymentPageUrl, parsePaymentContext } from '../components/profile/profileDomain';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { api } from '../lib/api';

export default function ProfilePaymentPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [search] = useSearchParams();
  const accountSlug = search.get('account') || search.get('store');
  const context = parsePaymentContext(search);
  const query = useQuery({ queryKey: ['profile', slug, 'public-payment-methods', accountSlug], queryFn: () => api.profile.getPublicPaymentMethods(slug, accountSlug), enabled: Boolean(slug) });
  const destination = buildPaymentPageUrl(slug, accountSlug, undefined, context);

  useEffect(() => { if (query.data) document.title = `Pay ${query.data.contributor.display_name} · Teajia`; }, [query.data]);

  if (query.isLoading) return <PaymentPageLoading />;
  if (query.isError || !query.data) return <Unavailable message={query.error instanceof Error ? query.error.message : 'The payment methods could not be loaded.'} onRetry={() => query.refetch()} />;
  const data = query.data;
  const associationRows = data.contributor.associations ?? [];
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-nav-gap-lg md:px-6 md:pt-14">
      <a href={`/people/${encodeURIComponent(slug)}`} className="tap-target inline-flex items-center gap-2 text-ui-12 text-tea-text-sec hover:text-tea-text"><ArrowLeft size={16} /> {data.contributor.display_name}</a>
      <header className="mt-12 max-w-2xl">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-gold`}>Transfer details</p>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} mt-3 text-tea-text`}>Pay {data.contributor.display_name}</h1>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-4 text-tea-text-sec`}>Choose the transfer method that works for you. Every method below is maintained by the recipient.</p>
        {associationRows.length > 0 && (
          <nav aria-label="Payment account" className="mt-6 flex flex-wrap gap-2">
            <a href={(() => { const url = new URL(buildPaymentPageUrl(slug, null, 'https://teajia.com', context)); return `${url.pathname}${url.search}`; })()} className={`tap-target rounded-md border px-3 py-2 text-ui-12 ${!accountSlug ? 'border-tea-gold bg-tea-accent-sub text-tea-text' : 'border-tea-border text-tea-text-sec hover:text-tea-text'}`}>Personal default</a>
            {associationRows.map(association => {
              const url = new URL(buildPaymentPageUrl(slug, association.account_slug, 'https://teajia.com', context));
              return <a key={association.account_id} href={`${url.pathname}${url.search}`} className={`tap-target rounded-md border px-3 py-2 text-ui-12 ${accountSlug === association.account_slug ? 'border-tea-gold bg-tea-accent-sub text-tea-text' : 'border-tea-border text-tea-text-sec hover:text-tea-text'}`}>{association.account_name}</a>;
            })}
          </nav>
        )}
      </header>
      <div className="mt-12"><PaymentChooser contributorName={data.contributor.display_name} methods={data.methods} destination={destination} context={context} accountName={data.account?.name} resolution={data.resolution} /></div>
    </main>
  );
}

function PaymentPageLoading() { return <main className="mx-auto w-full max-w-3xl animate-pulse px-4 pt-14 pb-nav-gap-lg md:px-6"><div className="h-5 w-32 rounded-md bg-tea-surface" /><div className="mt-10 h-12 w-72 rounded-md bg-tea-surface" /><div className="mt-12 h-96 rounded-md border border-tea-border bg-tea-surface" /></main>; }
function Unavailable({ onRetry }: { message: string; onRetry: () => void }) { return <main className="mx-auto w-full max-w-3xl px-4 py-20 pb-nav-gap-lg text-center md:px-6"><h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Payment page unavailable</h1><p role="alert" className={`${TYPOGRAPHY_CLASSES.subtitle} mt-3 text-tea-text-sec`}>We could not load the public payment methods. Nothing has been changed.</p><button type="button" onClick={onRetry} className="tap-target mt-5 text-ui-13 text-tea-gold hover:text-tea-gold-lt">Retry</button></main>; }
