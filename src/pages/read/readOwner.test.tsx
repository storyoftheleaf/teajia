/** Browser-written claims never authorize drafts. Server grants and token
 * changes are exercised in readEditorState.test.ts; real permissions are
 * exercised through worker.fetch in read-delivery-boundary.test.ts. */
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

  it('does not trust browser-written platform roles before verification', () => {
    expect(whoAmI({ sub: 'u', platform_role: 'platform_owner', memberships: [] })).toBe('visitor');
    expect(whoAmI({ sub: 'u', platform_role: 'platform_admin', memberships: [] })).toBe('visitor');
  });

  it("waits for server verification of a Teajia owner claim", () => {
    expect(whoAmI({ sub: 'u', memberships: [{ ...TEAJIA, role: 'owner' }] })).toBe('visitor');
  });

  it('does not trust browser-written bundles', () => {
    expect(whoAmI({ sub: 'u', memberships: [{ ...TEAJIA, role: 'staff', bundles: ['publish', 'catalog'] }] })).toBe('visitor');
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

  it('does not trust either browser-written platform account marker', () => {
    expect(whoAmI({ sub: 'u', memberships: [{ account_id: 'a', role: 'owner', account_kind: 'platform' }] })).toBe('visitor');
    expect(whoAmI({ sub: 'u', memberships: [{ account_id: 'a', role: 'owner', is_platform_account: true }] })).toBe('visitor');
  });

  it('does not accept a mixed membership claim without verification', () => {
    expect(
      whoAmI({
        sub: 'u',
        memberships: [
          { ...OTHER_SHOP, role: 'owner' },
          { ...TEAJIA, role: 'staff', bundles: ['publish'] },
        ],
      }),
    ).toBe('visitor');
  });
});
