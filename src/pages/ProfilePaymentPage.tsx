import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PaymentChooser } from '../components/profile/PaymentChooser';
import { PayInvoiceTeas } from '../components/profile/PayInvoiceTeas';
import { PayInvoiceAfter, PayInvoiceGuide } from '../components/profile/PayInvoiceGuide';
import type { PayLinkTeaLine } from '../components/profile/types';
import type { InventoryItem } from '../types';
import { CurrencySelect } from '../components/shop/CurrencySelect';
import { authPagePath } from '../lib/authNavigation';
import { buildPaymentPageUrl, isTrackingTokenShaped, normalizeLocalAmount, parsePaymentContext, toPaymentOrderSummary } from '../components/profile/profileDomain';
import { firstName } from '../components/people/profileFormat';
import { GOLD_LINE_STYLE, GOLD_TEXT_ROW, GOLD_TEXT_STYLE } from '../components/people/immersive';
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

export default function ProfilePaymentPage({ onAddToCart }: {
  /** The shop's own Add to cart, so a tea on the invoice can be bought again. */
  onAddToCart?: (item: InventoryItem, grams: number, totalUsd: number) => void;
} = {}) {
  // The guide's Pay and Taste point at these two parts of the sheet.
  const paySection = useRef<HTMLElement>(null);
  const teaList = useRef<HTMLDivElement>(null);
  const [choosingTea, setChoosingTea] = useState(false);
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
  // Never served stale: an approval can land a minute after the ask, and the
  // page must show the sheet on the next open. So this query is always fresh,
  // always refetched on mount, and (by 'pay-access' in the persister's
  // exclusion list) never written to disk. Found on the sandbox 2026-09-20.
  const accessQuery = useQuery({
    queryKey: ['profile', slug, 'pay-access', shareToken, viewerKey],
    queryFn: () => api.people.getPayAccess(slug, shareToken),
    enabled: Boolean(slug) && auth.isSessionReady,
    staleTime: 0,
    refetchOnMount: 'always',
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
      <Sheet portrait={access.contributor.portrait_url} closeHref={profileHref} testId="pay-gate">
        <h1 className="mt-2 font-display text-ui-26 leading-[1.1] text-tea-text">I share my payment details <span className="italic text-tea-readgold">privately</span></h1>
        <p className="mt-2.5 max-w-[36ch] font-body text-ui-14 italic leading-[1.45] text-tea-text-sec">
          They go only to people I have sold tea to. Ask me once; from then on you can open them from my page.
        </p>
        {requested ? (
          <p className="mt-[22px] flex min-h-[52px] items-center border-b font-display text-ui-22 leading-none text-tea-text-dim" style={GOLD_LINE_STYLE} role="status" data-testid="pay-gate-asked">
            Asked. It opens here once I approve.
          </p>
        ) : (
          <button
            type="button"
            onClick={onAsk}
            disabled={ask.isPending}
            className={`${GOLD_TEXT_ROW} mt-[22px]`}
            style={GOLD_TEXT_STYLE}
            data-testid="pay-gate-ask"
          >
            {ask.isPending ? 'Asking' : `Ask ${first}`}
          </button>
        )}
        {ask.isError && (
          <p role="alert" className="mt-3 font-sans text-ui-12 text-tea-text-sec">{ask.error instanceof Error ? ask.error.message : 'The request could not be sent.'}</p>
        )}
        <p className="mt-3 font-sans text-ui-11 leading-[1.5] text-tea-text-dim">
          {signedIn
            ? 'Once I approve, it stays approved.'
            : 'You need an account so I know who is asking. Sign in or continue with Google first.'}
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
  const waysLine = visibleCount === 1
    ? 'One way. It comes straight to me.'
    : visibleCount === 2
      ? 'Two ways. Both come straight to me.'
      : `${visibleCount} ways. All come straight to me.`;
  const heading = access.contributor.business_name
    ? <>For tea bought <span className="italic text-tea-readgold">at {access.contributor.business_name}</span></>
    : <>Pay <span className="italic text-tea-readgold">{access.contributor.display_name}</span></>;
  const accountLinks = associationRows.length > 0 && (
    <nav aria-label="Payment account" className="mt-4 flex flex-wrap gap-2">
      <a href={(() => { const url = new URL(buildPaymentPageUrl(slug, null, 'https://teajia.com', context)); return `${url.pathname}${withToken(url.search, shareToken)}`; })()} className={`tap-target rounded-md border px-3 py-2 text-ui-12 ${!accountSlug ? 'border-tea-gold bg-tea-accent-sub text-tea-text' : 'border-tea-border text-tea-text-sec hover:text-tea-text'}`}>Personal default</a>
      {associationRows.map(association => {
        const url = new URL(buildPaymentPageUrl(slug, association.account_slug, 'https://teajia.com', context));
        return <a key={association.account_id} href={`${url.pathname}${withToken(url.search, shareToken)}`} className={`tap-target rounded-md border px-3 py-2 text-ui-12 ${accountSlug === association.account_slug ? 'border-tea-gold bg-tea-accent-sub text-tea-text' : 'border-tea-border text-tea-text-sec hover:text-tea-text'}`}>{association.account_name}</a>;
      })}
    </nav>
  );
  const chooser = (
    <PaymentChooser contributorName={data.contributor.display_name} methods={data.methods} destination={destination} context={context} local={normalizeLocalAmount(data.context?.local)} accountName={data.account?.name} resolution={data.resolution} summary={summary} />
  );
  // The same quiet offer the collection link makes: an account is never
  // needed to read or pay, and joining brings them back to this page.
  const accountOffer = !access.viewer.signed_in && (
    <p className="mt-4 border-t border-tea-border pt-4 text-ui-13 text-tea-text-sec" data-testid="pay-account-offer">
      Want to keep this?{' '}
      <Link to={authPagePath('signup', `${window.location.pathname}${window.location.search}`)} className="relative text-tea-text underline before:absolute before:-inset-y-3 before:inset-x-0 before:content-['']  decoration-tea-border underline-offset-2 hover:text-tea-gold">Make a free account</Link>
      {' '}and your teas stay with you. You don’t need one to pay.
    </p>
  );

  // An invoice with its teas reads like a collection link (Adrian, 2026-11-27):
  // a short head, the shop's own tea rows from the first screen (full width,
  // so each keeps its line of description), and paying under them.
  const invoiceLines = access.invoice?.lines ?? [];
  if (invoiceLines.length > 0) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 pb-nav-gap-lg pt-3 text-tea-text md:px-6 md:pt-6 lg:px-10" data-testid="pay-sheet">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <nav aria-label="Where you are" className="flex flex-wrap items-center gap-x-2 gap-y-1 label-caps text-tea-text-sec">
            <a href={profileHref} className="tap-target hover:text-tea-text transition-colors">{access.contributor.display_name}</a>
            <span aria-hidden="true" className="text-tea-text-dim">/</span>
            <span>Your invoice</span>
          </nav>
          <CurrencySelect />
        </div>
        <header className="rounded-md border border-tea-border bg-tea-elevated px-4 py-4 md:px-6 md:py-5">
          {access.invoice?.invoice_number && (
            <p className="label-caps text-tea-gold mb-1.5" data-testid="pay-sheet-invoice">Invoice {access.invoice.invoice_number}</p>
          )}
          <h1 className="font-display text-ui-26 leading-[1.1] text-tea-text">{heading}</h1>
          {visibleCount > 0 && <p className="mt-1.5 font-body text-ui-14 italic leading-[1.5] text-tea-text-sec">{waysLine}</p>}
        </header>
        <PayInvoiceGuide
          slug={slug}
          token={shareToken}
          productIds={Array.from(new Set(invoiceLines.map(line => line.product_id).filter((id): id is string => Boolean(id))))}
          teaser={{ from: access.contributor.display_name, teas: keepTeaserTeas(invoiceLines) }}
          signedIn={access.viewer.signed_in}
          kept={access.invoice?.kept === true}
          paid={(access.invoice?.outstanding_usd ?? 1) <= 0}
          yoursToSend={access.invoice?.yours_to_send === true}
          againPath={access.invoice?.collection?.path ?? '/shop'}
          onPay={() => paySection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          onTaste={() => { setChoosingTea(true); teaList.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
        />
        <div className="mt-2 scroll-mt-4" ref={teaList}>
          <PayInvoiceTeas lines={invoiceLines} invoiceNumber={access.invoice?.invoice_number ?? null} onAddToCart={onAddToCart} choosing={choosingTea} onChosen={() => setChoosingTea(false)} />
          <PayInvoiceAfter kept={access.invoice?.kept === true} yoursToSend={access.invoice?.yours_to_send === true} collection={access.invoice?.collection ?? null} />
          <section aria-label="Pay" className="mt-4 max-w-2xl scroll-mt-4" ref={paySection}>
            {accountLinks}
            <div className={associationRows.length > 0 ? 'mt-4' : ''}>{chooser}</div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <Sheet portrait={access.contributor.portrait_url} closeHref={profileHref} testId="pay-sheet">
      <h1 className="mt-2 font-display text-ui-26 leading-[1.1] text-tea-text">{heading}</h1>
      {visibleCount > 0 && <p className="mt-2 font-body text-ui-13 italic leading-[1.45] text-tea-text-sec">{waysLine}</p>}
      {access.invoice?.invoice_number && (
        <p className="mt-1 font-body text-ui-13 italic leading-[1.45] text-tea-text-sec" data-testid="pay-sheet-invoice">Invoice {access.invoice.invoice_number}.</p>
      )}
      {accountLinks}
      <div className="mt-6">{chooser}</div>
      {accountOffer}
    </Sheet>
  );
}

// The teas as the sign-up page shows them: one row a tea, two packs of one tea added up.
function keepTeaserTeas(lines: readonly PayLinkTeaLine[]) {
  const rows = new Map<string, { name: string; quantity: number; unit: 'g' | 'piece' }>();
  for (const line of lines) {
    const key = `${line.product_id ?? line.name}|${line.unit}`;
    const row = rows.get(key);
    if (row) row.quantity += line.quantity;
    else rows.set(key, { name: line.name, quantity: line.quantity, unit: line.unit });
  }
  return [...rows.values()].map(row => ({
    name: row.name,
    amount: row.unit === 'g' ? `${row.quantity}g` : `${row.quantity} ${row.quantity === 1 ? 'piece' : 'pieces'}`,
  }));
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
// the screen with the page ground behind it, and the close mark alone in the
// head (canvas version 25: no caps line across the top).
function Sheet({ portrait, closeHref, children, testId }: { portrait: string | null; closeHref: string; children: ReactNode; testId?: string }) {
  return (
    <main className="relative mx-auto min-h-screen w-full max-w-2xl pb-nav-gap-lg" data-testid={testId}>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[320px] overflow-hidden bg-tea-bg">
        {portrait && <img src={portrait} alt="" className="h-full w-full object-cover opacity-35" />}
      </div>
      <section className="relative mt-[220px] border-t bg-tea-surface px-6 pb-8 pt-3" style={GOLD_LINE_STYLE}>
        <div className="flex min-h-tap items-center">
          <a href={closeHref} aria-label="Close" className="tap-target inline-flex h-11 w-11 items-center justify-start font-sans text-ui-22 text-tea-text-sec hover:text-tea-text">×</a>
        </div>
        {children}
      </section>
    </main>
  );
}

function PaymentPageLoading() { return <main className="mx-auto w-full max-w-2xl animate-pulse pb-nav-gap-lg"><div className="h-[220px] w-full bg-tea-surface" /><div className="mt-2 h-96 rounded-t-[12px] bg-tea-surface" /></main>; }
function Unavailable({ onRetry }: { message: string; onRetry: () => void }) { return <main className="mx-auto w-full max-w-2xl px-4 py-20 pb-nav-gap-lg text-center md:px-6"><h1 className="font-display text-ui-26 text-tea-text">Payment page unavailable</h1><p role="alert" className="subtitle mt-3 text-tea-text-sec">We could not load the payment page. Nothing has been changed.</p><button type="button" onClick={onRetry} className="tap-target mt-5 text-ui-13 text-tea-gold hover:text-tea-gold-lt">Retry</button></main>; }
