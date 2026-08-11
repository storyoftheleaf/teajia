import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LaunchpadView } from './LaunchpadView';

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
