import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The QR code is the leak the security review cared most about, and a real one
// encodes its payload into path data that no assertion could read back. Standing
// in for it with an element that prints the payload is the only way to say, out
// loud, what the customer's phone camera would be handed.
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <i data-qr-value={value} />,
}));

import { PaymentChooser } from './PaymentChooser';
import { PaymentOrderSummary } from './PaymentOrderSummary';
import { buildPaymentPageUrl, parsePaymentContext, toPaymentOrderSummary } from './profileDomain';
import type { PaymentContext, PaymentMethod } from './types';
import { PayOrderAction } from '../shared/PayOrderAction';
import { rememberPayOrderToken, recallPayOrderToken, sameOriginPayUrl } from '../shared/payOrderHandoff';
import ProfilePaymentPage from '../../pages/ProfilePaymentPage';
import { api } from '../../lib/api';

/**
 * The customer's private key, written so that any accidental appearance of it
 * in rendered markup, a link, or a QR payload is unmistakable rather than a
 * substring somebody has to squint at.
 */
const TOKEN = 'ZqA7_tracking-token-that-must-never-be-printed';

/** The invoice number the pay link carries, which is what the page prints. */
const INVOICE_REF = 'INV-2201';
/** The order's own number, which is a different string and never matches it. */
const ORDER_REF = 'TJ-1042';

const PAY_URL = `https://www.teajia.com/people/adrian/pay?account=teajia-bali&amount=40.00&currency=USD&reference=${INVOICE_REF}`;

const sessionStore = new Map<string, string>();
let storageThrows = false;

beforeAll(() => {
  // The node test environment has no window at all, and every piece of this
  // feature is written to treat that as an absence rather than a crash. Giving
  // it the two surfaces it actually touches, and nothing else, keeps the tests
  // honest about which ones those are.
  (globalThis as unknown as { window: unknown }).window = {
    location: { origin: 'https://teajia.com' },
    dispatchEvent: () => true,
    sessionStorage: {
      getItem: (key: string) => {
        if (storageThrows) throw new Error('storage blocked');
        return sessionStore.has(key) ? sessionStore.get(key)! : null;
      },
      setItem: (key: string, value: string) => {
        if (storageThrows) throw new Error('storage blocked');
        sessionStore.set(key, value);
      },
    },
  };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
    constructor(readonly type: string, readonly init?: unknown) {}
  };
});

beforeEach(() => {
  sessionStore.clear();
  storageThrows = false;
});

const method: PaymentMethod = {
  id: 'pm-1',
  account_id: null,
  method_type: 'bank_transfer',
  label: 'Bank transfer',
  recipient_name: 'Adrian Rasmussen',
  account_identifier: '1234567890',
  instructions: null,
  external_url: null,
  qr_image_url: null,
  position: 0,
  is_published: true,
};

function order(over: Record<string, unknown> = {}) {
  return {
    ref_number: ORDER_REF,
    items_json: JSON.stringify([
      { name: 'Yiwu Gushu 2019', quantityGrams: 100, category: 'tea' },
      { name: 'Jianshui Teapot', quantityGrams: 2, category: 'ware' },
    ]),
    status: 'invoiced',
    total_estimate_usd: 40,
    currency: 'USD',
    created_at: '2026-08-20T09:00:00.000Z',
    payment: {
      recipient_slug: 'adrian',
      recipient_name: 'Adrian Rasmussen',
      pay_url: PAY_URL,
      has_methods: true,
      total_usd: 40,
      paid_usd: 0,
      outstanding_usd: 40,
      claims_pending: 0,
    },
    journey: { stage: 'awaiting_payment' },
    ...over,
  };
}

/**
 * The whole page, rendered the way a customer meets it.
 *
 * The two lookups are seeded into the query cache rather than mocked, so the
 * page walks its real query keys, its real account gate and its real reference
 * check. `handoff` is what the order page would have left behind: absent for
 * every link a tea master sends by hand.
 */
function renderPage(opts: { handoff?: string | null; order?: unknown; search?: string } = {}) {
  if (opts.handoff) sessionStore.set(`teajia:pay-order:${INVOICE_REF}`, opts.handoff);
  const search = opts.search ?? `?account=teajia-bali&amount=40.00&currency=USD&reference=${INVOICE_REF}`;
  const params = new URLSearchParams(search);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(
    ['profile', 'adrian', 'public-payment-methods', params.get('account'), params.get('amount'), params.get('display')],
    {
      contributor: {
        display_name: 'Adrian Rasmussen',
        associations: [{ account_id: 'acc-1', account_slug: 'teajia-bali', account_name: 'Teajia Bali' }],
      },
      methods: [method],
      account: { name: 'Teajia Bali' },
      resolution: 'account',
      context: { local: null },
    },
  );
  // Keyed on the reference, matching the page. The token is deliberately NOT
  // part of this key: the query cache is persisted to local storage, which
  // outlives the tab the session handoff was chosen to die with.
  if (opts.order !== undefined) client.setQueryData(['profile-payment-order', params.get('reference')], opts.order);
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/people/adrian/pay${search}`]}>
        <Routes><Route path="/people/:slug/pay" element={<ProfilePaymentPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Walk a built element tree. Neither component under test uses a hook, so
 *  calling one as a function hands back the whole tree to inspect. */
function collect(node: unknown, hit: (el: React.ReactElement) => boolean, found: React.ReactElement[] = []) {
  if (Array.isArray(node)) { node.forEach(child => collect(child, hit, found)); return found; }
  if (!React.isValidElement(node)) return found;
  if (hit(node)) found.push(node);
  collect((node.props as { children?: unknown }).children, hit, found);
  return found;
}

function context(over: Partial<PaymentContext> = {}): PaymentContext {
  return { amount: '40.00', currency: 'USD', reference: INVOICE_REF, display: null, errors: [], ...over };
}

describe('the payment page names the order the customer came from', () => {
  it('lists the teas and quantities when the customer arrives carrying their own key', () => {
    const html = renderPage({ handoff: TOKEN, order: order() });
    expect(html).toContain('This payment covers');
    expect(html).toContain('Yiwu Gushu 2019');
    expect(html).toContain('100g');
    expect(html).toContain('Jianshui Teapot');
    // The order page's own two forms, so a customer reads the same words twice.
    expect(html).toContain('×2');
  });

  it('leaves the amount, the reference and the transfer details standing above it', () => {
    const html = renderPage({ handoff: TOKEN, order: order() });
    expect(html).toContain('USD 40.00');
    expect(html).toContain(INVOICE_REF);
    expect(html).toContain('Bank transfer');
    expect(html).toContain('1234567890');
  });

  it('answers which order without answering how much a second time', () => {
    const html = renderToStaticMarkup(
      <PaymentOrderSummary summary={{ lines: [{ name: 'Yiwu Gushu 2019', quantity: '100g' }], placedOn: 'Aug 20, 2026' }} />,
    );
    // An order estimate a hairline below the outstanding balance reads as an
    // error in the figure the customer is about to transfer.
    expect(html).not.toContain('$');
    expect(html).not.toContain('40');
    expect(html).not.toContain('USD');
    expect(html).toContain('Placed Aug 20, 2026');
  });

  it('shortens a long order rather than pushing the transfer methods off the screen', () => {
    const line = (n: number) => ({ name: `Tea ${n}`, quantity: '50g' });
    const six = renderToStaticMarkup(<PaymentOrderSummary summary={{ lines: [1, 2, 3, 4, 5, 6].map(line), placedOn: null }} />);
    expect(six).toContain('Tea 6');
    expect(six).not.toContain('more items');

    const seven = renderToStaticMarkup(<PaymentOrderSummary summary={{ lines: [1, 2, 3, 4, 5, 6, 7].map(line), placedOn: null }} />);
    expect(seven).toContain('Tea 5');
    expect(seven).not.toContain('Tea 6');
    expect(seven).toContain('and 2 more items');
  });
});

describe('the link a tea master sends by hand is unchanged', () => {
  it('renders no summary and no trace of one when nothing was handed over', () => {
    const html = renderPage({});
    expect(html).not.toContain('This payment covers');
    expect(html).not.toContain('payment-order-summary');
    expect(html).not.toContain('Yiwu Gushu');
    // Still the whole page it has always been.
    expect(html).toContain('USD 40.00');
    expect(html).toContain('Bank transfer');
    expect(html).toContain('Share this payment page');
  });

  it('renders the identical page when the browser refuses storage altogether', () => {
    const withHandoff = renderPage({ handoff: TOKEN, order: order() });
    const baseline = renderPage({});
    storageThrows = true;
    const blocked = renderPage({});
    expect(blocked).toBe(baseline);
    // And the baseline really is a different page from the one with a summary,
    // so the comparison above is not passing by accident.
    expect(withHandoff).not.toBe(baseline);
  });

  it('does not open the payment-details band on a link that carries nothing', () => {
    // The band's condition was widened to let a summary open it. A bare link
    // must still render no band at all.
    const html = renderToStaticMarkup(
      <PaymentChooser
        contributorName="Adrian Rasmussen"
        methods={[method]}
        destination="https://teajia.com/people/adrian/pay"
        context={context({ amount: null, currency: null, reference: null })}
        local={null}
      />,
    );
    expect(html).not.toContain('Payment details');
  });

  it('opens the payment-details band for a summary alone, since that is why the band widened', () => {
    // Unreachable through the page today, because the handoff is keyed on the
    // reference and a link with no reference recalls no token. It is asserted
    // at the component's own contract so the widened condition is a decision
    // somebody can see rather than a branch that quietly means nothing.
    const html = renderToStaticMarkup(
      <PaymentChooser
        contributorName="Adrian Rasmussen"
        methods={[method]}
        destination="https://teajia.com/people/adrian/pay"
        context={context({ amount: null, currency: null, reference: null })}
        local={null}
        summary={{ lines: [{ name: 'Yiwu Gushu 2019', quantity: '100g' }], placedOn: null }}
      />,
    );
    expect(html).toContain('Payment details');
    expect(html).toContain('Yiwu Gushu 2019');
  });

  it('treats an omitted summary, a null one and an empty one as the same absence', () => {
    const base = {
      contributorName: 'Adrian Rasmussen',
      methods: [method],
      destination: 'https://teajia.com/people/adrian/pay',
      context: context(),
      local: null,
    };
    const omitted = renderToStaticMarkup(<PaymentChooser {...base} />);
    expect(renderToStaticMarkup(<PaymentChooser {...base} summary={null} />)).toBe(omitted);
    expect(renderToStaticMarkup(<PaymentChooser {...base} summary={{ lines: [], placedOn: 'Aug 20, 2026' }} />)).toBe(omitted);
  });
});

describe('a summary that will not load never takes the transfer details down', () => {
  it('shows the whole page while the lookup is still in flight', () => {
    const html = renderPage({ handoff: TOKEN });
    expect(html).toContain('USD 40.00');
    expect(html).toContain('1234567890');
    expect(html).not.toContain('This payment covers');
  });

  it('shows the whole page when the order behind the token is gone', () => {
    const html = renderPage({ handoff: TOKEN, order: null });
    expect(html).toContain('USD 40.00');
    expect(html).toContain('1234567890');
    expect(html).not.toContain('This payment covers');
  });

  it('refuses half an order rather than rendering a partial one', () => {
    expect(toPaymentOrderSummary(null, INVOICE_REF)).toBeNull();
    expect(toPaymentOrderSummary('not an order', INVOICE_REF)).toBeNull();
    expect(toPaymentOrderSummary(order({ items_json: '{ broken' }), INVOICE_REF)).toBeNull();
    expect(toPaymentOrderSummary(order({ items_json: '[]' }), INVOICE_REF)).toBeNull();
    expect(toPaymentOrderSummary(order({ items_json: JSON.stringify([{ quantityGrams: 100 }]) }), INVOICE_REF)).toBeNull();
    expect(toPaymentOrderSummary(order({ items_json: JSON.stringify([{ name: 'Yiwu', quantityGrams: 0 }]) }), INVOICE_REF)).toBeNull();
    // One unreadable line among good ones still ends the attempt, because a
    // silently shortened order is a wrong order.
    expect(toPaymentOrderSummary(
      order({ items_json: JSON.stringify([{ name: 'Yiwu', quantityGrams: 100, category: 'tea' }, { name: '', quantityGrams: 50 }]) }),
      INVOICE_REF,
    )).toBeNull();
    // An unreadable date is not a reason to withhold the order.
    expect(toPaymentOrderSummary(order({ created_at: 'sometime' }), INVOICE_REF)?.placedOn).toBeNull();
  });
});

describe('mitigation: the token never reaches a sharing surface', () => {
  it('prints the token nowhere in the page, even with the summary on screen', () => {
    const html = renderPage({ handoff: TOKEN, order: order() });
    expect(html).toContain('This payment covers');
    expect(html).not.toContain(TOKEN);
    expect(html).not.toContain('tracking-token');
  });

  it('hands the QR code a payload with no token in it', () => {
    const html = renderPage({ handoff: TOKEN, order: order() });
    const payload = /data-qr-value="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(payload).toContain('/people/adrian/pay');
    expect(payload).toContain(`reference=${INVOICE_REF}`);
    expect(payload).not.toContain(TOKEN);
  });

  it('hands the copy-link button the same token-free string the QR code got', () => {
    // The button keeps its payload in a closure, so it is read off the element
    // rather than the markup. The QR and the button are fed one variable, and
    // this is what proves it is still one variable.
    const tree = PaymentChooser({
      contributorName: 'Adrian Rasmussen',
      methods: [method],
      destination: buildPaymentPageUrl('adrian', 'teajia-bali', 'https://teajia.com', context()),
      context: context(),
      local: null,
      summary: { lines: [{ name: 'Yiwu Gushu 2019', quantity: '100g' }], placedOn: null },
    });
    const copies = collect(tree, el => (el.props as { label?: string }).label === 'payment page link');
    expect(copies).toHaveLength(1);
    const value = (copies[0].props as { value: string }).value;
    expect(value).not.toContain(TOKEN);
    const qrs = collect(tree, el => 'value' in (el.props as object) && !('label' in (el.props as object)));
    expect(qrs.length).toBeGreaterThan(0);
    expect((qrs[0].props as { value: string }).value).toBe(value);
  });

  it('keeps the token out of the link builder, so a token in the address is dropped', () => {
    const parsed = parsePaymentContext(new URLSearchParams(`amount=40.00&currency=USD&reference=${INVOICE_REF}&token=${TOKEN}`));
    expect(JSON.stringify(parsed)).not.toContain(TOKEN);
    const url = buildPaymentPageUrl('adrian', 'teajia-bali', 'https://teajia.com', parsed);
    expect(url).not.toContain(TOKEN);
    expect(url).not.toContain('token');
  });

  it('rebuilds the store tabs without carrying the token onto another shop', () => {
    const html = renderPage({ handoff: TOKEN, order: order() });
    for (const href of html.matchAll(/href="([^"]*)"/g)) {
      expect(href[1]).not.toContain(TOKEN);
    }
    expect(html).toContain('Teajia Bali');
  });
});

describe('mitigation: the handoff is session storage, keyed per order', () => {
  it('writes the token to storage on the way out, and to no URL', () => {
    const tree = PayOrderAction({
      payment: { pay_url: PAY_URL, recipient_name: 'Adrian Rasmussen', has_methods: true } as never,
      reference: ORDER_REF,
      trackingToken: TOKEN,
    });
    const links = collect(tree, el => (el.props as { 'data-testid'?: string })['data-testid'] === 'order-pay-link');
    expect(links).toHaveLength(1);
    const link = links[0].props as { href: string; onClick: () => void };
    expect(link.href).not.toContain(TOKEN);
    expect(link.href).not.toContain('#');

    expect(recallPayOrderToken(INVOICE_REF)).toBeNull();
    link.onClick();
    expect(recallPayOrderToken(INVOICE_REF)).toBe(TOKEN);
  });

  it('keys the handoff on the invoice number the payment page will read, not the order number', () => {
    // These are two different sequences. Keying on the order number would hand
    // the token to a page that then decides it belongs to somebody else.
    const tree = PayOrderAction({
      payment: { pay_url: PAY_URL, recipient_name: 'Adrian Rasmussen', has_methods: true } as never,
      reference: ORDER_REF,
      trackingToken: TOKEN,
    });
    const link = collect(tree, el => (el.props as { 'data-testid'?: string })['data-testid'] === 'order-pay-link')[0]
      .props as { onClick: () => void };
    link.onClick();
    expect(recallPayOrderToken(ORDER_REF)).toBeNull();
    expect(recallPayOrderToken(INVOICE_REF)).toBe(TOKEN);
  });

  it('does not let a customer with two open orders cross their keys', () => {
    rememberPayOrderToken('INV-2201', 'first-order-token');
    rememberPayOrderToken('INV-2202', 'second-order-token');
    expect(recallPayOrderToken('INV-2201')).toBe('first-order-token');
    expect(recallPayOrderToken('INV-2202')).toBe('second-order-token');
    expect(recallPayOrderToken('INV-2203')).toBeNull();
  });

  it('carries a page with no order key alongside one that has it, in the same tab', () => {
    // Two open orders, one paid from the order page and one reached from a
    // WhatsApp link. The second must not inherit the first order's summary.
    const withKey = renderPage({ handoff: TOKEN, order: order() });
    const other = renderPage({ search: '?account=teajia-bali&amount=90.00&currency=USD&reference=INV-9999' });
    expect(withKey).toContain('Yiwu Gushu 2019');
    expect(other).not.toContain('Yiwu Gushu 2019');
  });

  it('never throws when the browser refuses to store or read', () => {
    storageThrows = true;
    expect(() => rememberPayOrderToken(INVOICE_REF, TOKEN)).not.toThrow();
    expect(recallPayOrderToken(INVOICE_REF)).toBeNull();
  });
});

describe('mitigation: the pay link stays on the origin the handoff was written on', () => {
  it('reduces the worker-built www link to a path, keeping every parameter', () => {
    const same = sameOriginPayUrl(PAY_URL);
    expect(same).toBe(`/people/adrian/pay?account=teajia-bali&amount=40.00&currency=USD&reference=${INVOICE_REF}`);
    expect(same).not.toContain('www.teajia.com');
  });

  it('renders that path as the href, so session storage is not lost mid-navigation', () => {
    const html = renderToStaticMarkup(
      <PayOrderAction
        payment={{ pay_url: PAY_URL, recipient_name: 'Adrian Rasmussen', has_methods: true } as never}
        reference={ORDER_REF}
        trackingToken={TOKEN}
      />,
    );
    expect(html).toContain('href="/people/adrian/pay?');
    expect(html).not.toContain('www.teajia.com');
  });

  it('still renders nothing at all when the order has not been priced', () => {
    expect(renderToStaticMarkup(<PayOrderAction payment={null} reference={ORDER_REF} trackingToken={TOKEN} />)).toBe('');
  });
});

describe('mitigation: the token lookup files no incident', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; vi.useRealTimers(); vi.restoreAllMocks(); });

  it('reports nothing when the token lookup fails, while a comparable public call still reports', () => {
    const report = vi.spyOn(api.incidents, 'report').mockResolvedValue(undefined as never);
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('version.json')) return new Response('{}', { status: 200 });
      // A plain Error, so fetchWithTimeout takes its single-pass failure path
      // rather than the retry ladder.
      throw new Error('kaboom');
    }) as typeof fetch;

    // Subject first, while the module's own five-second network-error throttle
    // is certainly cold: otherwise a silent absence of a report would prove
    // nothing at all.
    return api.inquiries.getByTrackingToken(TOKEN)
      .then(() => { throw new Error('the lookup was supposed to fail'); }, () => {
        expect(report).not.toHaveBeenCalled();

        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(Date.now() + 60_000);
        return api.profile.getPublicPaymentMethods('adrian', 'teajia-bali').then(
          () => { throw new Error('the control call was supposed to fail'); },
          () => {
            // The control proves the reporter is reachable from this path, so
            // the silence above is the flag and not the harness.
            expect(report).toHaveBeenCalledTimes(1);
            const filed = report.mock.calls[0][0] as { route: string; signature: string };
            expect(filed.route).toContain('/api/public/people/adrian/payment-methods');
            expect(JSON.stringify(report.mock.calls[0][0])).not.toContain(TOKEN);
          },
        );
      });
  });
});

describe('mitigation: one shop never summarises another shop order', () => {
  it('suppresses the summary when the order belongs to a different shop', () => {
    const elsewhere = order({
      payment: {
        ...order().payment,
        pay_url: `https://www.teajia.com/people/adrian/pay?account=teajia-ubud&amount=40.00&reference=${INVOICE_REF}`,
      },
    });
    const html = renderPage({ handoff: TOKEN, order: elsewhere });
    expect(html).not.toContain('This payment covers');
    expect(html).not.toContain('Yiwu Gushu');
    // The wrong-recipient hazard is the whole reason: the transfer details on
    // screen are still this shop's, and must stay legible.
    expect(html).toContain('1234567890');
  });

  it('suppresses the summary when the order disagrees with the reference on the page', () => {
    const otherOrder = order({
      payment: { ...order().payment, pay_url: 'https://www.teajia.com/people/adrian/pay?account=teajia-bali&reference=INV-9999' },
    });
    expect(toPaymentOrderSummary(otherOrder, INVOICE_REF)).toBeNull();
    const html = renderPage({ handoff: TOKEN, order: otherOrder });
    expect(html).not.toContain('This payment covers');
    expect(html).toContain('1234567890');
  });

  it('accepts the order when the shop and the reference both agree', () => {
    const summary = toPaymentOrderSummary(order(), INVOICE_REF);
    expect(summary?.lines.map(l => l.quantity)).toEqual(['100g', '×2']);
  });
});

/**
 * The one line that makes the whole feature work.
 *
 * The customer's order page is the ONLY surface that holds their tracking
 * token, so it is the only place the handoff can start. Deleting the prop from
 * that one call site leaves every other test in this file green while the
 * feature is dead in production: no token is ever stored, so no customer ever
 * sees which order they are paying for. That was proved by deleting it, so it
 * is asserted here rather than trusted.
 *
 * These read the source rather than rendering the page, because rendering it
 * means standing up a route, a query client and four API calls to assert one
 * prop. The source IS the wiring: if the prop is not written there, it does not
 * happen.
 */
describe('the order page hands its token to the pay control', () => {
  const orderStatusSource = readFileSync(
    new URL('../../pages/OrderStatusPage.tsx', import.meta.url),
    'utf8',
  );

  it('passes the tracking token, or the handoff never starts', () => {
    const payAction = orderStatusSource.match(/<PayOrderAction[^>]*\/>/s);
    expect(payAction, 'OrderStatusPage no longer renders PayOrderAction at all').not.toBeNull();
    expect(payAction![0]).toContain('trackingToken=');
  });

  it('is still the only customer surface that passes one', () => {
    // The account surfaces reach an order through a login rather than through a
    // token, so they have none to give. If one of them starts passing something
    // here, it is either a token arriving somewhere it should not be or a name
    // being reused for a different thing, and both deserve a second look.
    const senders = ['../../pages/OrderHistoryPage.tsx', '../../pages/OrderDetailPage.tsx']
      .filter(page => readFileSync(new URL(page, import.meta.url), 'utf8').includes('trackingToken='));
    expect(senders).toEqual([]);
  });

  it('never writes the token into the link it renders', () => {
    // The whole reason for the session-storage handoff. A regression here is a
    // customer's private order key printed as a QR code on a public page.
    const payActionSource = readFileSync(
      new URL('../shared/PayOrderAction.tsx', import.meta.url),
      'utf8',
    );
    const href = payActionSource.match(/href=\{([^}]*)\}/);
    expect(href, 'PayOrderAction no longer renders a link').not.toBeNull();
    expect(href![1]).not.toContain('trackingToken');
    expect(href![1]).not.toContain('token');
  });
});

/**
 * The customer's order body must not outlive their tab.
 *
 * The token is handed over in session storage precisely so it dies with the
 * tab. The order it unlocks would undo that if the query cache wrote it to
 * local storage, which survives a browser restart and is shared across tabs.
 * It was excluded only by luck when this shipped: the persist filter rejects
 * any key containing "me", and "payment" contains "me". This asserts the
 * deliberate exclusion instead, so a rename cannot quietly put it on disk.
 */
describe('the order summary never reaches durable storage', () => {
  const bootSource = readFileSync(new URL('../../index.tsx', import.meta.url), 'utf8');

  it('is excluded by name rather than by a lucky substring', () => {
    const exactList = bootSource.match(/const NEVER_PERSIST_KEYS = \[([\s\S]*?)\];/);
    expect(exactList, 'the exact-match exclusion list has been renamed or removed').not.toBeNull();
    expect(exactList![1]).toContain('profile-payment-order');
  });

  it('keys the lookup on the reference, so the token itself is never cacheable', () => {
    const pageSource = readFileSync(new URL('../../pages/ProfilePaymentPage.tsx', import.meta.url), 'utf8');
    const key = pageSource.match(/queryKey: \['profile-payment-order'[^\]]*\]/);
    expect(key, 'the summary query key has moved').not.toBeNull();
    expect(key![0]).not.toContain('trackingToken');
    expect(key![0]).toContain('context.reference');
  });
});
