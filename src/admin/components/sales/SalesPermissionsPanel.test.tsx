import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AccountMember } from '../../../types';
import type { SalesGrant } from '../../../lib/api';
import { SalesPermissionsPanelView, grantsOverlap, sellCapableMembers } from './SalesPermissionsPanel';

const grant: SalesGrant = {
  id: 'grant-1', account_id: 'account-1', product_id: 'product-1', seller_user_id: 'seller-1',
  seller_name: 'Mei Lin', granted_by_user_id: 'owner-1', granted_by_name: 'Adrian', price_floor: 0.3,
  owner_share_type: 'percent', owner_share_value: 70, quantity_limit: 100,
  starts_at: null, expires_at: null, revoked_at: null, created_at: '2026-08-10T00:00:00Z', updated_at: '2026-08-10T00:00:00Z',
};

describe('SalesPermissionsPanel', () => {
  it('filters the roster to active Sell-capable members without exposing contacts', () => {
    const members: AccountMember[] = [
      { user_id: 'owner', name: 'Owner', email: 'owner@example.com', role: 'owner', status: 'active', bundles: [] },
      { user_id: 'seller', name: 'Seller', email: 'seller@example.com', role: 'staff', status: 'active', bundles: ['sell'] },
      { user_id: 'viewer', name: 'Viewer', email: 'viewer@example.com', role: 'staff', status: 'active', bundles: ['catalog'] },
      { user_id: 'old', name: 'Old', email: 'old@example.com', role: 'owner', status: 'removed', bundles: ['sell'] },
    ];
    expect(sellCapableMembers(members).map(member => member.user_id)).toEqual(['owner', 'seller']);
  });

  it('detects overlapping effective windows for the same seller', () => {
    expect(grantsOverlap(grant, { seller_user_id: 'seller-1', starts_at: null, expires_at: null })).toBe(true);
    expect(grantsOverlap(grant, { seller_user_id: 'other', starts_at: null, expires_at: null })).toBe(false);
    expect(grantsOverlap(grant, { seller_user_id: 'seller-1', starts_at: '2026-08-01', expires_at: '2026-08-09' })).toBe(false);
  });

  it('shows grant terms and explains that stock remains with this fulfillment account', () => {
    const html = renderToStaticMarkup(<SalesPermissionsPanelView
      grants={[grant]}
      members={[]}
      mode="list"
      busy={false}
      error={null}
      onRetry={() => {}}
      onBeginCreate={() => {}}
      onBeginEdit={() => {}}
      onRevoke={() => {}}
      onCancel={() => {}}
      onSubmit={async () => {}}
    />);
    expect(html).toContain('Mei Lin');
    expect(html).toContain('$0.30');
    expect(html).toContain('70%');
    expect(html).toContain('100');
    expect(html).toContain('does not transfer stock');
    expect(html).not.toContain('example.com');
  });

  it('renders loading, empty, and retryable error states', () => {
    const base = { members: [], busy: false, onRetry: () => {}, onBeginCreate: () => {}, onBeginEdit: () => {}, onRevoke: () => {}, onCancel: () => {}, onSubmit: async () => {} };
    expect(renderToStaticMarkup(<SalesPermissionsPanelView {...base} grants={[]} mode="loading" error={null} />)).toContain('Loading sales permissions');
    expect(renderToStaticMarkup(<SalesPermissionsPanelView {...base} grants={[]} mode="list" error={null} />)).toContain('No active sales permissions');
    expect(renderToStaticMarkup(<SalesPermissionsPanelView {...base} grants={[]} mode="error" error="Unavailable" />)).toContain('Retry');
  });
});
