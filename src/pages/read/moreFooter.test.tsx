/**
 * Renders the "More from The Art of Tea" rail itself, rather than the filter
 * behind it.
 *
 * publishGate.test.ts already pins `visibleMoreLinks`, and that test would keep
 * passing if MoreFooter stopped calling it: the leak this file guards is in the
 * component's wiring, not in the predicate. So this one renders the real
 * component through the real hook and reads the markup, which is what a visitor
 * actually receives.
 *
 * Storage is stubbed rather than mocked out. `useIsReadOwner` reads the stored
 * JWT's claims, and stubbing the two Storage globals with a plain map is the
 * smallest thing that lets the real hook run unchanged: a mock of the hook
 * would test the mock. `vi.hoisted` puts the stubs in place before the module
 * graph loads, since an ES import runs before any statement in this file.
 *
 * JOBC-2, prime-time audit 2026-09.
 */
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { MoreFooter, type MoreLink } from './immersive';

const store = vi.hoisted(() => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
  (globalThis as Record<string, unknown>).localStorage = storage;
  (globalThis as Record<string, unknown>).sessionStorage = storage;
  return map;
});

/** A token shaped like the ones the worker signs, with the claims that matter. */
function tokenFor(claims: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `header.${body}.signature`;
}

function signIn(claims: Record<string, unknown> | null) {
  if (claims === null) store.delete('teajia_token');
  else store.set('teajia_token', tokenFor(claims));
}

const RAIL: MoreLink[] = [
  { to: '/read/ritual', kicker: 'The Ritual', title: 'Seven Steeps', blurb: 'The same leaves, brewed seven ways.' },
  { to: '/read/history', kicker: 'History', title: 'Ten Thousand Mornings', blurb: 'Five thousand years of tea.' },
  { to: '/read/rock-remembers', kicker: 'Conversation', title: 'The Rock Remembers', blurb: 'A Wuyi roaster on fire.' },
];

function render(links: MoreLink[]): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <MoreFooter links={links} />
    </MemoryRouter>,
  );
}

describe('MoreFooter', () => {
  it('names no draft to a visitor, and links to none', () => {
    signIn(null);
    const html = render(RAIL);
    expect(html).toContain('/read/ritual');
    expect(html).toContain('Seven Steeps');
    // Both the href and the title: a card that leaked either one told a visitor
    // an unpublished piece exists.
    expect(html).not.toContain('/read/history');
    expect(html).not.toContain('Ten Thousand Mornings');
    expect(html).not.toContain('/read/rock-remembers');
    expect(html).not.toContain('The Rock Remembers');
  });

  it('renders nothing at all when every companion is a draft', () => {
    signIn(null);
    // /read/porcelain-and-tea's own three cards, the one live page whose rail
    // empties completely. No heading over an empty grid.
    expect(render(RAIL.slice(1))).toBe('');
  });

  it('shows the Teajia owner every card, marked Draft', () => {
    signIn({
      sub: 'u1',
      memberships: [{ account_id: 'acc_teajia_bali', role: 'owner', account_kind: 'platform', is_platform_account: true }],
    });
    const html = render(RAIL);
    expect(html).toContain('Ten Thousand Mornings');
    expect(html).toContain('The Rock Remembers');
    expect(html).toContain('Draft');
  });

  it('treats a curator who owns their own shop as a visitor', () => {
    // The over-grant round two shipped: the predicate asked only whether any
    // membership carried role owner, which is true of every curator on the
    // network, so a curator read every Teajia draft.
    signIn({
      sub: 'u2',
      role: 'owner',
      memberships: [{ account_id: 'acc_other_shop', role: 'owner', account_kind: 'master' }],
    });
    const html = render(RAIL);
    expect(html).not.toContain('Ten Thousand Mornings');
    expect(html).not.toContain('The Rock Remembers');
    expect(html).not.toContain('Draft');
  });
});
