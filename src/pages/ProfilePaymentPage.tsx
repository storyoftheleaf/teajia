import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from '@phosphor-icons/react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PaymentChooser } from '../components/profile/PaymentChooser';
import { buildPaymentPageUrl, isTrackingTokenShaped, normalizeLocalAmount, parsePaymentContext, toPaymentOrderSummary } from '../components/profile/profileDomain';
import { accountSlugFromPayUrl, recipientSlugFromPayUrl } from '../components/shared/paymentClaimDomain';
import { recallPayOrderToken } from '../components/shared/payOrderHandoff';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { api } from '../lib/api';

export default function ProfilePaymentPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [search] = useSearchParams();
  const accountSlug = search.get('account') || search.get('store');
  const context = parsePaymentContext(search);
  // The amount and the customer's currency travel with the request, because the
  // conversion is the worker's to make: it holds the live rate table and the
  // hour it was refreshed, and a rate worked out on this side would be a second
  // opinion about money.
  const query = useQuery({
    queryKey: ['profile', slug, 'public-payment-methods', accountSlug, context.amount, context.display],
    queryFn: () => api.profile.getPublicPaymentMethods(slug, accountSlug, { amount: context.amount, display: context.display }),
    enabled: Boolean(slug),
  });
  const destination = buildPaymentPageUrl(slug, accountSlug, undefined, context);

  // The customer's own key, handed over in session storage by the order page
  // they came from and deliberately kept out of `context`. Every field in
  // `context` is rebuilt by buildPaymentPageUrl into the QR code and the "Copy
  // payment page link" button at the foot of this page, so a token living
  // there would be handed to whoever the customer shares the page with.
  // Reading it from a separate store makes that impossible rather than merely
  // unlikely, and keeps it out of the address bar, the history entry and our
  // own edge access log at the same time.
  const trackingToken = useMemo(() => recallPayOrderToken(context.reference), [context.reference]);
  const summaryQuery = useQuery({
    // Keyed on the reference, NEVER on the token. This app persists its query
    // cache to local storage, which unlike the session store survives a browser
    // restart and is shared across tabs. A token in the key would be written
    // there with the rest of the key, and a filter that happens to exclude it
    // today is a rule someone has to keep remembering. Keeping the token out of
    // the key makes that impossible instead. The reference identifies exactly
    // one order, so it is the correct key on its own merits too.
    queryKey: ['profile-payment-order', context.reference],
    queryFn: () => api.inquiries.getByTrackingToken(trackingToken as string),
    enabled: isTrackingTokenShaped(trackingToken),
    // One attempt. A token that does not resolve is a stale link, not a blip,
    // and this block is a courtesy on a page that is complete without it.
    retry: false,
    staleTime: 60_000,
  });
  // The lookup is keyed on the token alone, with no account and no recipient in
  // the query, so nothing else stops one order from being summarised above
  // somebody else's transfer details. That is the wrong-recipient mistake this
  // feature exists to prevent, so anything that does not match suppresses the
  // block entirely.
  //
  // Both halves of the link are checked. The shop catches an order from one
  // store shown beside another store's details. The recipient catches the
  // hand-edited case: same shop, same reference, different person's bank
  // account, which would otherwise read as a confirmed correct page.
  const orderPayUrl = summaryQuery.data?.payment?.pay_url;
  const sameAccount = (accountSlugFromPayUrl(orderPayUrl) || null) === (accountSlug || null);
  const sameRecipient = (recipientSlugFromPayUrl(orderPayUrl) || null) === (slug || null);
  const summary = useMemo(
    () => (summaryQuery.data && sameAccount && sameRecipient
      ? toPaymentOrderSummary(summaryQuery.data, context.reference)
      : null),
    [summaryQuery.data, sameAccount, sameRecipient, context.reference],
  );

  useEffect(() => { if (query.data) document.title = `Pay ${query.data.contributor.display_name} · Teajia`; }, [query.data]);

  // A page carrying somebody's order contents has no business in a search
  // index or a link preview cache. The directive is added only while a summary
  // is on screen, so the plain payment link a tea master sends by hand is
  // unchanged.
  useEffect(() => {
    if (!summary) return;
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex';
    document.head.appendChild(tag);
    return () => { tag.remove(); };
  }, [summary]);

  // The summary is deliberately NOT waited for. Holding the page until it
  // arrives would mean a slow or hanging lookup hides the bank details from
  // somebody trying to pay, to avoid a block appearing above them a moment
  // later. The transfer details are the page; the summary is a courtesy on it,
  // and a courtesy never gets to delay the thing it decorates. The amount and
  // the reference sit above the insertion point and do not move.
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
      <div className="mt-12"><PaymentChooser contributorName={data.contributor.display_name} methods={data.methods} destination={destination} context={context} local={normalizeLocalAmount(data.context?.local)} accountName={data.account?.name} resolution={data.resolution} summary={summary} /></div>
    </main>
  );
}

function PaymentPageLoading() { return <main className="mx-auto w-full max-w-3xl animate-pulse px-4 pt-14 pb-nav-gap-lg md:px-6"><div className="h-5 w-32 rounded-md bg-tea-surface" /><div className="mt-10 h-12 w-72 rounded-md bg-tea-surface" /><div className="mt-12 h-96 rounded-md border border-tea-border bg-tea-surface" /></main>; }
function Unavailable({ onRetry }: { message: string; onRetry: () => void }) { return <main className="mx-auto w-full max-w-3xl px-4 py-20 pb-nav-gap-lg text-center md:px-6"><h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Payment page unavailable</h1><p role="alert" className={`${TYPOGRAPHY_CLASSES.subtitle} mt-3 text-tea-text-sec`}>We could not load the public payment methods. Nothing has been changed.</p><button type="button" onClick={onRetry} className="tap-target mt-5 text-ui-13 text-tea-gold hover:text-tea-gold-lt">Retry</button></main>; }
