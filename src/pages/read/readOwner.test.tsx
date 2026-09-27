/**
 * Who counts as an owner of the Read drafts.
 *
 * Round two answered `memberships.some((m) => m.role === 'owner')`, which is
 * true of every curator on the network: a curator who owns their OWN shop signs
 * in through the same JWT, so that predicate handed them every unpublished
 * Teajia piece. The gate was tightened to the Teajia account (the one the
 * worker marks `is_platform_account` and gives `kind = 'platform'`) plus the
 * platform roles, and these are the cases that pin it.
 *
 * The hook is exercised through a component rather than called directly, since
 * a React hook needs a render, and `renderToStaticMarkup` is the same
 * server-render approach the wisdom relations tests use. Storage is stubbed
 * with a plain map so the real hook reads a real token, rather than mocked out,
 * which would test the mock.
 *
 * JOBC-2, prime-time audit 2026-09.
 */
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useIsReadOwner } from './publishGate';

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

const Probe: React.FC = () => <span>{useIsReadOwner() ? 'owner' : 'visitor'}</span>;

function whoAmI(claims: Record<string, unknown> | null): 'owner' | 'visitor' {
  if (claims === null) store.delete('teajia_token');
  else {
    const body = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
    store.set('teajia_token', `header.${body}.signature`);
  }
  return renderToStaticMarkup(<Probe />).includes('>owner<') ? 'owner' : 'visitor';
}

const TEAJIA = { account_id: 'acc_teajia_bali', account_kind: 'platform', is_platform_account: true } as const;
const OTHER_SHOP = { account_id: 'acc_some_curator', account_kind: 'master' } as const;

describe('useIsReadOwner', () => {
  it('treats nobody signed in as a visitor', () => {
    expect(whoAmI(null)).toBe('visitor');
  });

  it('lets the platform owner and platform admin in', () => {
    expect(whoAmI({ sub: 'u', platform_role: 'platform_owner', memberships: [] })).toBe('owner');
    expect(whoAmI({ sub: 'u', platform_role: 'platform_admin', memberships: [] })).toBe('owner');
  });

  it("lets the Teajia account's owner in", () => {
    expect(whoAmI({ sub: 'u', memberships: [{ ...TEAJIA, role: 'owner' }] })).toBe('owner');
  });

  it('lets Teajia staff in only with the publish bundle', () => {
    expect(whoAmI({ sub: 'u', memberships: [{ ...TEAJIA, role: 'staff', bundles: ['publish', 'catalog'] }] })).toBe('owner');
    // Hired to count stock, not to read the unpublished writing.
    expect(whoAmI({ sub: 'u', memberships: [{ ...TEAJIA, role: 'staff', bundles: ['stock'] }] })).toBe('visitor');
  });

  it('keeps a Teajia viewer out', () => {
    expect(whoAmI({ sub: 'u', memberships: [{ ...TEAJIA, role: 'viewer' }] })).toBe('visitor');
  });

  it('keeps out a curator who owns their own account', () => {
    // The reproduced over-grant. Owner of their shop, nobody at Teajia.
    expect(whoAmI({ sub: 'u', memberships: [{ ...OTHER_SHOP, role: 'owner' }] })).toBe('visitor');
  });

  it('ignores a top-level role claim on its own', () => {
    // users.role is the users table's own column: every self-registered account
    // gets 'user' there and the rows carrying 'owner' are legacy seeds, so it
    // says nothing about which shop a person belongs to.
    expect(whoAmI({ sub: 'u', role: 'owner', memberships: [] })).toBe('visitor');
    expect(whoAmI({ sub: 'u', role: 'admin', memberships: [] })).toBe('visitor');
    expect(whoAmI({ sub: 'u', role: 'owner', memberships: [{ ...OTHER_SHOP, role: 'owner' }] })).toBe('visitor');
  });

  it('reads either marker of the Teajia account, since older tokens carry one', () => {
    expect(whoAmI({ sub: 'u', memberships: [{ account_id: 'a', role: 'owner', account_kind: 'platform' }] })).toBe('owner');
    expect(whoAmI({ sub: 'u', memberships: [{ account_id: 'a', role: 'owner', is_platform_account: true }] })).toBe('owner');
  });

  it('lets a curator in when they are also Teajia staff, which is a real person', () => {
    expect(
      whoAmI({
        sub: 'u',
        memberships: [
          { ...OTHER_SHOP, role: 'owner' },
          { ...TEAJIA, role: 'staff', bundles: ['publish'] },
        ],
      }),
    ).toBe('owner');
  });
});
