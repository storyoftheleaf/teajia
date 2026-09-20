import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PaymentChooser } from '../components/profile/PaymentChooser';
import { buildPaymentPageUrl, isTrackingTokenShaped, normalizeLocalAmount, parsePaymentContext, toPaymentOrderSummary } from '../components/profile/profileDomain';
import { firstName } from '../components/people/profileFormat';
import { accountSlugFromPayUrl, recipientSlugFromPayUrl } from '../components/shared/paymentClaimDomain';
import { recallPayOrderToken } from '../components/shared/payOrderHandoff';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

// /people/:slug/pay. Pay is private, and approval is permanent.
//
// The page asks the worker one question before it asks for a single transfer
// method: may this viewer open the sheet. Three answers open it, the
// contributor themselves, an account they approved, and whoever holds a share
// link (the `t` on the URL). Everyone else meets the gate: one action, ask the
// contributor, which needs an account so the request carries a name. Nothing
// with a bank number ever reaches a viewer the worker has not said yes to.
//
// Built to boards 1 and 3 of the Creator Profiles canvas: the sheet sits over
// the dimmed portrait, close on the left, the person's name across the top.

const SHARE_TOKEN_PARAM = 't';

export default function ProfilePaymentPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const accountSlug = search.get('account') || search.get('store');
  const shareToken = search.get(SHARE_TOKEN_PARAM);
  const askOnArrival = search.get('ask') === '1';
  const context = parsePaymentContext(search);

  // Keyed on the viewer too: signing in changes the answer, and the page has
  // to notice without a reload.
  const viewerKey = auth.isAuthenticated ? auth.user?.email ?? 'signed-in' : 'signed-out';
  const accessQuery = useQuery({
    queryKey: ['profile', slug, 'pay-access', shareToken, viewerKey],
    queryFn: () => api.people.getPayAccess(slug, shareToken),
    enabled: Boolean(slug) && auth.isSessionReady,
  });
  const access = accessQuery.data;
  const open = access?.access === 'open';

  // The amount and the customer's currency travel with the request, because the
  // conversion is the worker's to make: it holds the live rate table and the
  // hour it was refreshed, and a rate worked out on this side would be a second
  // opinion about money.
  const query = useQuery({
    queryKey: ['profile', slug, 'public-payment-methods', accountSlug, context.amount, context.display, shareToken, viewerKey],
    queryFn: () => api.profile.getPublicPaymentMethods(slug, accountSlug, { amount: context.amount, display: context.display, token: shareToken }),
    enabled: Boolean(slug) && open,
  });
  const destination = buildPaymentPageUrl(slug, accountSlug, undefined, context);

  const ask = useMutation({
    mutationFn: () => api.people.requestPayAccess(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', slug, 'pay-access'] });
      if (askOnArrival) {
        const next = new URLSearchParams(search);
        next.delete('ask');
        setSearch(next, { replace: true });
      }
    },
  });

  // Back from sign-in with ?ask=1: the person pressed Ask before they had an
  // account, so the request fires now, once, without another press.
  const askedOnArrival = useRef(false);
  useEffect(() => {
    if (!askOnArrival || askedOnArrival.current) return;
    if (!access || access.access !== 'gate' || !access.viewer.signed_in || access.viewer.request_status) return;
    askedOnArrival.current = true;
    ask.mutate();
  }, [askOnArrival, access, ask]);

  // The customer's own key, handed over in session storage by the order page
  // they came from and deliberately kept out of `context`. Every field in
  // `context` is rebuilt by buildPaymentPageUrl into the QR code and the "Copy
  // payment page link" button at the foot of this page, so a token living
  // there would be handed to whoever the customer shares the page with.
  const trackingToken = useMemo(() => recallPayOrderToken(context.reference), [context.reference]);
  const summaryQuery = useQuery({
    // Keyed on the reference, NEVER on the token: the query cache persists to
    // local storage. The reference identifies exactly one order.
    queryKey: ['profile-payment-order', context.reference],
    queryFn: () => api.inquiries.getByTrackingToken(trackingToken as string),
    enabled: open && isTrackingTokenShaped(trackingToken),
    retry: false,
    staleTime: 60_000,
  });
  const orderPayUrl = summaryQuery.data?.payment?.pay_url;
  const sameAccount = (accountSlugFromPayUrl(orderPayUrl) || null) === (accountSlug || null);
  const sameRecipient = (recipientSlugFromPayUrl(orderPayUrl) || null) === (slug || null);
  const summary = useMemo(
    () => (summaryQuery.data && sameAccount && sameRecipient
      ? toPaymentOrderSummary(summaryQuery.data, context.reference)
      : null),
    [summaryQuery.data, sameAccount, sameRecipient, context.reference],
  );

  const displayName = access?.contributor.display_name ?? query.data?.contributor.display_name ?? null;
  useEffect(() => { if (displayName) document.title = `Pay ${displayName} · Teajia`; }, [displayName]);

  // A page carrying somebody's order contents has no business in a search
  // index or a link preview cache; nor has one that reached a bank detail.
  useEffect(() => {
    if (!open) return;
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex';
    document.head.appendChild(tag);
    return () => { tag.remove(); };
  }, [open]);

  const profileHref = `/people/${encodeURIComponent(slug)}`;

  if (!auth.isSessionReady || accessQuery.isLoading) return <PaymentPageLoading />;
  if (accessQuery.isError || !access) {
    return <Unavailable onRetry={() => accessQuery.refetch()} message={accessQuery.error instanceof Error ? accessQuery.error.message : 'The payment page could not be loaded.'} />;
  }

  const first = firstName(access.contributor.display_name);

  // ── The gate ────────────────────────────────────────────────────────────
  if (!open) {
    const requested = access.viewer.request_status === 'pending';
    const signedIn = access.viewer.signed_in;
    const returnTo = `${window.location.pathname}${search.toString() ? `?${search.toString()}${search.has('ask') ? '' : '&ask=1'}` : '?ask=1'}`;
    const onAsk = () => {
      if (!signedIn) {
        navigate(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      ask.mutate();
    };
    return (
      <Sheet portrait={access.contributor.portrait_url} closeHref={profileHref} title={`Pay ${access.contributor.display_name}`} testId="pay-gate">
        <h1 className="mt-2 font-display text-ui-26 leading-[1.15] text-tea-text">{first} shares payment details privately</h1>
        <p className="body-light mt-2 max-w-[40ch] text-ui-15 text-tea-text-sec">
          Bank and transfer details go only to people {first} has sold tea to. Ask once; approved accounts see them from {first}’s page from then on.
        </p>
        {requested ? (
          <p className="mt-6 flex min-h-[48px] items-center rounded-md bg-tea-accent-sub px-5 font-sans text-ui-13 text-tea-text" role="status" data-testid="pay-gate-asked">
            Asked. This will open here once {first} approves.
          </p>
        ) : (
          <button
            type="button"
            onClick={onAsk}
            disabled={ask.isPending}
            className="cta-solid tap-target mt-6 flex min-h-[48px] w-full items-center justify-center rounded-md px-5 font-sans text-ui-13 font-medium tracking-[0.04em] disabled:opacity-60"
            data-testid="pay-gate-ask"
          >
            {ask.isPending ? 'Asking' : `Ask ${first} to share them`}
          </button>
        )}
        {ask.isError && (
          <p role="alert" className="mt-3 font-sans text-ui-12 text-tea-text-sec">{ask.error instanceof Error ? ask.error.message : 'The request could not be sent.'}</p>
        )}
        <p className="mt-2.5 font-sans text-ui-12 leading-[1.5] text-tea-text-sec">
          {signedIn
            ? `Once ${first} approves, it stays approved.`
            : `You need an account so ${first} knows who is asking. Sign in or continue with Google first. Once ${first} approves, it stays approved.`}
        </p>
      </Sheet>
    );
  }

  // ── The sheet ───────────────────────────────────────────────────────────
  if (query.isLoading) return <PaymentPageLoading />;
  if (query.isError || !query.data) return <Unavailable message={query.error instanceof Error ? query.error.message : 'The payment methods could not be loaded.'} onRetry={() => query.refetch()} />;
  const data = query.data;
  const associationRows = data.contributor.associations ?? [];
  const visibleCount = data.methods.filter(method => method.is_published).length;
  const forLine = access.contributor.business_name
    ? `For tea bought at ${access.contributor.business_name}`
    : `Pay ${access.contributor.display_name}`;
  const waysLine = visibleCount === 1
    ? `One way. It goes straight to ${first}.`
    : visibleCount === 2
      ? `Two ways. Both go straight to ${first}.`
      : `${visibleCount} ways. All go straight to ${first}.`;
  return (
    <Sheet portrait={access.contributor.portrait_url} closeHref={profileHref} title={`Pay ${access.contributor.display_name}`} testId="pay-sheet">
      <h1 className="mt-2 font-display text-ui-26 leading-[1.15] text-tea-text">{forLine}</h1>
      {visibleCount > 0 && <p className="body-light mt-1.5 text-ui-15 text-tea-text-sec">{waysLine}</p>}
      {access.invoice?.invoice_number && (
        <p className="mt-2 font-sans text-ui-12 text-tea-text-sec" data-testid="pay-sheet-invoice">Invoice {access.invoice.invoice_number}</p>
      )}
      {associationRows.length > 0 && (
        <nav aria-label="Payment account" className="mt-5 flex flex-wrap gap-2">
          <a href={(() => { const url = new URL(buildPaymentPageUrl(slug, null, 'https://teajia.com', context)); return `${url.pathname}${withToken(url.search, shareToken)}`; })()} className={`tap-target rounded-md border px-3 py-2 text-ui-12 ${!accountSlug ? 'border-tea-gold bg-tea-accent-sub text-tea-text' : 'border-tea-border text-tea-text-sec hover:text-tea-text'}`}>Personal default</a>
          {associationRows.map(association => {
            const url = new URL(buildPaymentPageUrl(slug, association.account_slug, 'https://teajia.com', context));
            return <a key={association.account_id} href={`${url.pathname}${withToken(url.search, shareToken)}`} className={`tap-target rounded-md border px-3 py-2 text-ui-12 ${accountSlug === association.account_slug ? 'border-tea-gold bg-tea-accent-sub text-tea-text' : 'border-tea-border text-tea-text-sec hover:text-tea-text'}`}>{association.account_name}</a>;
          })}
        </nav>
      )}
      <div className="mt-6">
        <PaymentChooser contributorName={data.contributor.display_name} methods={data.methods} destination={destination} context={context} local={normalizeLocalAmount(data.context?.local)} accountName={data.account?.name} resolution={data.resolution} summary={summary} />
      </div>
      <p className="mt-4 font-sans text-ui-12 leading-[1.5] text-tea-text-sec">
        {first} keeps these up to date.{access.via === 'link' ? ' You opened this from a link.' : access.via === 'approved' ? ' Your account is approved to see them.' : ''}
      </p>
    </Sheet>
  );
}

// Keep the share token on the account-switch links, or switching stores would
// drop a link holder back at the gate.
function withToken(searchString: string, token: string | null): string {
  if (!token) return searchString;
  const params = new URLSearchParams(searchString);
  params.set(SHARE_TOKEN_PARAM, token);
  return `?${params.toString()}`;
}

// The sheet: the portrait dimmed behind, the panel rising from the bottom of
// the screen with the page ground behind it, close on the left, the person's
// name across the top in caps.
function Sheet({ portrait, closeHref, title, children, testId }: { portrait: string | null; closeHref: string; title: string; children: ReactNode; testId?: string }) {
  return (
    <main className="relative mx-auto min-h-screen w-full max-w-2xl pb-nav-gap-lg" data-testid={testId}>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[320px] overflow-hidden bg-tea-bg">
        {portrait && <img src={portrait} alt="" className="h-full w-full object-cover opacity-35" />}
      </div>
      <section className="relative mt-[220px] rounded-t-[12px] bg-tea-surface px-4 pb-8 pt-3 md:px-6">
        <div className="flex min-h-[44px] items-center justify-between">
          <a href={closeHref} aria-label="Close" className="tap-target inline-flex h-11 w-11 items-center justify-start font-sans text-[22px] text-tea-text-sec hover:text-tea-text">×</a>
          <span className="font-sans text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec">{title}</span>
          <span className="w-11" />
        </div>
        {children}
      </section>
    </main>
  );
}

function PaymentPageLoading() { return <main className="mx-auto w-full max-w-2xl animate-pulse pb-nav-gap-lg"><div className="h-[220px] w-full bg-tea-surface" /><div className="mt-2 h-96 rounded-t-[12px] bg-tea-surface" /></main>; }
function Unavailable({ onRetry }: { message: string; onRetry: () => void }) { return <main className="mx-auto w-full max-w-2xl px-4 py-20 pb-nav-gap-lg text-center md:px-6"><h1 className="font-display text-ui-26 text-tea-text">Payment page unavailable</h1><p role="alert" className="subtitle mt-3 text-tea-text-sec">We could not load the payment page. Nothing has been changed.</p><button type="button" onClick={onRetry} className="tap-target mt-5 text-ui-13 text-tea-gold hover:text-tea-gold-lt">Retry</button></main>; }
