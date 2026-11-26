import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyTeaCredit, ShopTeaCredit } from '../lib/hostCreditApi';

// Launch 5, the tea credit screens: the host's own view, the tile that leads
// to it, and the owner's section in Sales > Waiting. With HOST_CREDIT_OPEN off
// none of them shows anything, even with an answer already in the cache.

const state = vi.hoisted(() => ({ open: true, owner: true, signedIn: true }));
vi.mock('../lib/hostCredit', () => ({ hostCreditOpen: () => state.open }));
vi.mock('../lib/api', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  hasToken: () => state.signedIn,
  currentSignInToken: () => (state.signedIn ? 'session' : null),
}));
// A server render reads a zustand store's first state, so the signed-in
// person is handed to the selectors here.
vi.mock('../lib/store', async importOriginal => {
  const original = await importOriginal<typeof import('../lib/store')>();
  const useAppStore = Object.assign(
    (select: (value: ReturnType<typeof original.useAppStore.getState>) => unknown) =>
      select({ ...original.useAppStore.getState(), activeUserId: state.signedIn ? 'host' : null }),
    original.useAppStore,
  );
  return { ...original, useAppStore, selectIsOwnerTier: () => state.owner };
});
vi.mock('../admin/hooks/usePrivateQueryScope', () => ({ usePrivateQueryScope: () => ({ key: ['shop', 'owner', 0], ready: true }) }));

const { default: TeaCreditPage } = await import('../pages/TeaCreditPage');
const { TeaCreditSection } = await import('../admin/components/TeaCreditSection');
const { LaunchpadView } = await import('./AccountPanel/LaunchpadView');

const mine: MyTeaCredit = {
  balances: [{ account_id: 'shop', shop_name: 'Teajia', currency: 'USD', pending: 2.5, earned: 12, reversed: 0, spent: 0, held: 4, debt: 0, available: 8 }],
  lines: [{
    id: 'l1', account_id: 'shop', shop_name: 'Teajia', event_id: 'e', event_title: 'Evening tea', tea_name: 'Red tea',
    basis_amount: 120, basis_currency: 'USD', credit_amount: 12, credit_currency: 'USD', status: 'earned',
    earned_at: '2026-11-20T10:00:00Z', reversed_at: null, created_at: '2026-11-19T10:00:00Z',
  }],
  spend_requests: [{ id: 'hcs', account_id: 'shop', shop_name: 'Teajia', invoice_id: 'inv', invoice_number: 'TJ-12', amount: 4, currency: 'USD', status: 'held', requested_at: '2026-11-25T10:00:00Z', decided_at: null }],
};

const shop: ShopTeaCredit = {
  terms: { percent: 10, ceilingUsd: 5 },
  hosts: [{ ...mine.balances[0], host_user_id: 'host', host_name: 'Rayi' }],
  lines: [{ ...mine.lines[0], host_user_id: 'host', host_name: 'Rayi', invoice_id: 'sale', invoice_number: 'TJ-9', invoice_status: 'Filled' }],
  spend_requests: [{ id: 'hcs', host_user_id: 'host', host_name: 'Rayi', invoice_id: 'inv', invoice_number: 'TJ-12', amount: 4, currency: 'USD', status: 'held', requested_at: '2026-11-25T10:00:00Z', decided_at: null, over_ceiling: false }],
  second_look: [{ invoice_id: 'big', invoice_number: 'TJ-30', host_user_id: 'host', host_name: 'Rayi', event_title: 'Evening tea', credit_amount: 9, currency: 'USD', ceiling_usd: 5 }],
};

function render(node: React.ReactNode, path = '/') {
  const client = new QueryClient();
  client.setQueryData(['me', 'tea-credit', 'host', null], mine);
  client.setQueryData(['host-credit', 'shop', 'owner', 0], shop);
  return renderToStaticMarkup(
    <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>{node}</MemoryRouter></QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.assign(state, { open: true, owner: true, signedIn: true });
});

describe("the host's own view", () => {
  it('shows ready, earned, waiting and held, and names the tea and the session, never a guest', () => {
    const html = render(<TeaCreditPage />);
    expect(html).toContain('Tea credit');
    for (const word of ['Ready to use', 'Earned', 'Waiting', 'Held', '$8.00', '$12.00', '$2.50', '$4.00']) expect(html).toContain(word);
    expect(html).toContain('Red tea');
    expect(html).toContain('From Evening tea');
    expect(html).toContain('Your order TJ-12');
    expect(html).toContain('Waiting for the shop');
    expect(html).not.toMatch(/guest@|customer/i);
  });

  it('shows nothing with the switch off', () => {
    state.open = false;
    expect(render(<TeaCreditPage />)).toBe('');
  });
});

describe('the tile in Your Table', () => {
  const props = {
    user: { name: 'Rayi', email: 'rayi@example.test' }, avatarDataUrl: null, onAvatarClick: () => undefined,
    roleBadgeLabel: null, accountName: 'Rayi', locationLabel: null, hasManageRoom: false, manageEntryPath: '/admin/dashboard',
    isPlatformOwner: false, membershipsCount: 1, pendingInvoiceCount: 0, todayEventCount: 0, inboundUnreadCount: 0,
    journalLastAt: null, journalLastTea: null, collectionCount: 0, dispositionName: null, nextEvent: null,
    onClose: () => undefined, onOpenJournal: () => undefined, onOpenEvents: () => undefined, onOpenCellar: () => undefined,
    onOpenLocationSwitcher: () => undefined, onSignOut: () => undefined,
  };
  it('appears for a host with credit, and not for anyone else', () => {
    expect(render(<LaunchpadView {...props} teaCredit={{ available: 8, currency: 'USD' }} />)).toContain('$8.00 to use on tea');
    expect(render(<LaunchpadView {...props} teaCredit={null} />)).not.toContain('tea credit');
  });
});

describe("the owner's section in Sales", () => {
  it('lists the uses waiting with Decline and Approve, the second look, and each host', () => {
    const html = render(<TeaCreditSection />, '/admin/activity');
    expect(html).toContain('Asked to use');
    expect(html).toContain('On order TJ-12');
    expect(html).toContain('>Decline<');
    expect(html).toContain('>Approve<');
    expect(html).toContain('Waiting on a second look');
    expect(html).toContain('Order TJ-30');
    expect(html).toContain('Rayi');
  });

  it("opens one host's lines as a step in the address", () => {
    const html = render(<TeaCreditSection />, '/admin/activity?credit=host');
    expect(html).toContain('Where it came from');
    expect(html).toContain('Order TJ-9');
    expect(html).toContain('>Back<');
  });

  it('shows nothing with the switch off, or to anyone but the owner', () => {
    state.open = false;
    expect(render(<TeaCreditSection />)).toBe('');
    state.open = true;
    state.owner = false;
    expect(render(<TeaCreditSection />)).toBe('');
  });
});
