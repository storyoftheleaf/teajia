import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LaunchpadView } from './LaunchpadView';
import { buildTeaMasterReadiness } from '../readiness/teaMasterReadiness';

const baseProps = {
  user: { name: 'Rayi', email: 'rayi@example.test' },
  avatarDataUrl: null,
  onAvatarClick: () => undefined,
  roleBadgeLabel: 'Tea Master',
  accountName: 'Rayi',
  locationLabel: null,
  membershipsCount: 1,
  pendingInvoiceCount: 0,
  todayEventCount: 0,
  inboundUnreadCount: 0,
  journalLastAt: null,
  journalLastTea: null,
  collectionCount: 0,
  dispositionName: null,
  nextEvent: null,
  onClose: () => undefined,
  onOpenJournal: () => undefined,
  onOpenEvents: () => undefined,
  onOpenCellar: () => undefined,
  onOpenLocationSwitcher: () => undefined,
  onSignOut: () => undefined,
};

const render = (isOwner: boolean, canPublish: boolean, canSell = false) => renderToStaticMarkup(
  <MemoryRouter>
    {React.createElement(LaunchpadView, { ...baseProps, isOwner, canPublish, canSell } as never)}
  </MemoryRouter>,
);

describe('Launchpad operating-program entrances', () => {
  it('shows Tea Master stewardship and Wisdom to an owner', () => {
    const html = render(true, true);
    expect(html).toContain('tea masters');
    expect(html).toContain('profiles &amp; associations');
    expect(html).toContain('knowledge &amp; relationships');
  });

  it('does not expose owner-only Tea Master stewardship to a reader', () => {
    const html = render(false, false);
    expect(html).not.toContain('profiles &amp; associations');
    expect(html).not.toContain('knowledge &amp; relationships');
  });

  it('shows Wisdom to a delegated publisher even when they are not an owner or staff role', () => {
    const html = render(false, true);
    expect(html).toContain('knowledge &amp; relationships');
  });

  it('does not treat a staff role without the Publish bundle as Wisdom access', () => {
    const html = render(false, false);
    expect(html).not.toContain('knowledge &amp; relationships');
    expect(html).toContain('shared with you');
    expect(html).not.toContain('curate &amp; share');
    expect(html).not.toContain('create an article');
  });

  it('gives a delegated publisher the publishing entrances regardless of staff tier', () => {
    const html = render(false, true);
    expect(html).toContain('curate &amp; share');
    expect(html).toContain('create an article');
  });

  it('shows orders to someone with the Sell capability', () => {
    const html = render(false, false, true);
    expect(html).toContain('orders');
    expect(html).toContain('sales &amp; fulfillment');
  });

  it('does not expose orders without the Sell capability', () => {
    const html = render(false, false, false);
    expect(html).not.toContain('sales &amp; fulfillment');
  });
});

// ── What needs you ────────────────────────────────────────────────────────
// The judgement this surface has to get right: only an operator receives the
// queue, it is ordered by how long each thing has waited rather than grouped
// by kind, and nothing waiting is a calm sentence rather than a zero.

const HOUR = 3600000;
const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * HOUR).toISOString();

const waitingFixture = [
  {
    kind: 'claim' as const,
    id: 'c1',
    label: 'Mira reported a transfer',
    meta: null,
    waiting_since: at(5),
    href: '/admin/activity?tab=orders',
  },
  {
    kind: 'request' as const,
    id: 'r1',
    label: 'Yusuf asked about the Dancong',
    meta: null,
    waiting_since: at(80),
    href: '/admin/activity?tab=inquiries',
  },
  {
    kind: 'unsent' as const,
    id: 's1',
    label: 'TJ-1042 for Hana',
    meta: null,
    waiting_since: at(30),
    href: '/admin/activity?tab=orders',
  },
];

const renderWaiting = (
  attentionItems: unknown,
  tier: { isOwner?: boolean; canPublish?: boolean; canSell?: boolean } = {},
) => renderToStaticMarkup(
  <MemoryRouter>
    {React.createElement(LaunchpadView, {
      ...baseProps,
      isOwner: tier.isOwner ?? false,
      canPublish: tier.canPublish ?? false,
      canSell: tier.canSell ?? false,
      attentionItems,
    } as never)}
  </MemoryRouter>,
);

describe('Launchpad: what needs you', () => {
  it('never hands a customer the operator queue', () => {
    // A signed-in customer is passed null, the panel is given nothing to show.
    const html = renderWaiting(null);
    expect(html).not.toContain('What needs you');
    expect(html).not.toContain('Yusuf asked about the Dancong');
    expect(html).not.toContain('nobody has answered');
  });

  it('orders by how long each thing has waited, not by kind', () => {
    const html = renderWaiting(waitingFixture, { isOwner: true, canSell: true });
    const oldestFirst = html.indexOf('Yusuf asked about the Dancong');
    const middle = html.indexOf('TJ-1042 for Hana');
    const newest = html.indexOf('Mira reported a transfer');
    expect(oldestFirst).toBeGreaterThan(-1);
    expect(oldestFirst).toBeLessThan(middle);
    expect(middle).toBeLessThan(newest);
  });

  it('says what kind of waiting each row is, so a row reads without opening it', () => {
    const html = renderWaiting(waitingFixture, { isOwner: true, canSell: true });
    expect(html).toContain('nobody has answered');
    expect(html).toContain('payment reported, unchecked');
    expect(html).toContain('paid, not sent');
  });

  it('speaks the queue in the frontispiece as a sentence, not a count', () => {
    const html = renderWaiting(waitingFixture, { isOwner: true, canSell: true });
    expect(html).toContain('three waiting, the oldest for three days.');
  });

  it('renders the calm state when nothing is waiting, and no zero', () => {
    const html = renderWaiting([], { isOwner: true, canSell: true });
    expect(html).toContain('the table is clear.');
    expect(html).not.toContain('What needs you');
    expect(html).not.toContain('0 waiting');
    expect(html).not.toContain('nothing to do');
  });

  it('keeps the day voice while the queue is still unknown', () => {
    // Loading or a failed read must not be reported as a clear table.
    const html = renderWaiting(null, { isOwner: true, canSell: true });
    expect(html).toContain('a quiet day.');
    expect(html).not.toContain('the table is clear.');
  });

  it('stops the workshop tile counting the same shop twice', () => {
    const withQueue = renderWaiting(waitingFixture, { isOwner: true, canSell: true });
    expect(withQueue).toContain('tools &amp; records');
    // With no queue showing, the tile keeps its own long-standing voice.
    const withoutQueue = renderWaiting([], { isOwner: true, canSell: true });
    expect(withoutQueue).toContain('all settled');
  });
});

// ── Setting up ────────────────────────────────────────────────────────────
// The first surface that knows about the person and the shop at once. What it
// has to get right: it counts both halves, it names the next thing, and it
// leaves when there is nothing left.

const renderSetup = (readiness: unknown) => renderToStaticMarkup(
  <MemoryRouter>
    {React.createElement(LaunchpadView, {
      ...baseProps,
      isOwner: true,
      canPublish: false,
      canSell: false,
      readiness,
    } as never)}
  </MemoryRouter>,
);

const unfinished = buildTeaMasterReadiness({
  person: { hasProfile: true, identityReady: true, isPublished: true, publishedPaymentMethods: 0 },
  shop: null,
});

describe('Launchpad: setting up as a tea master', () => {
  it('counts both halves and names the next thing to do', () => {
    const html = renderSetup(unfinished);
    expect(html).toContain('Setting up');
    expect(html).toContain('2 of 3 steps done');
    expect(html).toContain('A way to pay you');
    expect(html).toContain('Add at least one payment method and make it public.');
  });

  it('leaves once nothing is left, rather than standing as a finished checklist', () => {
    const html = renderSetup(buildTeaMasterReadiness({
      person: { hasProfile: true, identityReady: true, isPublished: true, publishedPaymentMethods: 2 },
      shop: null,
    }));
    expect(html).not.toContain('Setting up');
    expect(html).not.toContain('steps done');
  });

  it('says nothing at all while the answer is still unknown', () => {
    const html = renderSetup(null);
    expect(html).not.toContain('Setting up');
  });

  it('carries the shop steps once a shop is attached', () => {
    const html = renderSetup(buildTeaMasterReadiness({
      person: { hasProfile: true, identityReady: true, isPublished: true, publishedPaymentMethods: 1 },
      shop: {
        name: 'Rayi',
        hasCurrency: true,
        hasContact: true,
        sellableProductCount: 0,
        isPublicEnabled: false,
        orderCount: 0,
      },
    }));
    expect(html).toContain('4 of 7 steps done');
    expect(html).toContain('Tea for sale');
  });
});
