import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { AccountMember } from '../../types';
import type { TeaEvent } from '../../types/events';

/**
 * The live counts behind a store's launch checklist.
 *
 * This used to be a closure inside the store settings screen with unexported
 * types, which meant the only surface that could ask "is this shop ready" was
 * the one screen the shop's owner had to already be standing on. It lives here
 * so the person's side of being a tea master can be joined to the shop's side
 * without a second, differently worded count of the same shop.
 */

export type LaunchProductAudit = {
  total: number;
  publicCount: number;
  priced: number;
  stocked: number;
  withImages: number;
  withType: number;
  readyPublic: number;
};

export type LaunchTeamAudit = {
  total: number;
  owners: number;
  activeMembers: number;
  pendingInvites: number;
  membersWithoutBundles: number;
};

export type LaunchAudit = {
  loading: boolean;
  error: string | null;
  products: LaunchProductAudit;
  team: LaunchTeamAudit;
  events: {
    total: number;
    upcoming: number;
  };
  orders: {
    total: number;
    pending: number;
  };
};

export const EMPTY_LAUNCH_AUDIT: LaunchAudit = {
  loading: true,
  error: null,
  products: {
    total: 0,
    publicCount: 0,
    priced: 0,
    stocked: 0,
    withImages: 0,
    withType: 0,
    readyPublic: 0,
  },
  team: {
    total: 0,
    owners: 0,
    activeMembers: 0,
    pendingInvites: 0,
    membersWithoutBundles: 0,
  },
  events: {
    total: 0,
    upcoming: 0,
  },
  orders: {
    total: 0,
    pending: 0,
  },
};

/**
 * Four reads, none of which is allowed to sink the other three. A shop with no
 * events tool reachable still deserves an honest stock count, so every read is
 * settled independently and a failed one contributes zero rather than an error.
 */
export async function fetchLaunchAudit(accountId: string): Promise<LaunchAudit> {
  const [productsRaw, accessRaw, eventsRaw, invoicesRaw] = await Promise.allSettled([
    api.products.list(),
    api.accounts.getAccess(accountId),
    api.events.listAdmin(),
    api.invoices.list(100),
  ]);

  const products = productsRaw.status === 'fulfilled' && Array.isArray(productsRaw.value)
    ? productsRaw.value as any[]
    : [];
  const members = accessRaw.status === 'fulfilled'
    ? accessRaw.value.members || []
    : [];
  const events = eventsRaw.status === 'fulfilled' && Array.isArray(eventsRaw.value)
    ? eventsRaw.value as TeaEvent[]
    : [];
  const invoices = invoicesRaw.status === 'fulfilled' && Array.isArray(invoicesRaw.value)
    ? invoicesRaw.value as any[]
    : [];

  const activeProducts = products.filter((p) => p.status !== 'Archived');
  const publicProducts = activeProducts.filter((p) => p.is_public !== false);
  const pricedProducts = activeProducts.filter((p) =>
    Number(p.retail_price_per_gram_usd) > 0 || Number(p.fixed_retail_price_usd) > 0
  );
  const stockedProducts = activeProducts.filter((p) =>
    Number(p.stock_grams) > 0 || Number(p.quantity_units) > 0
  );
  const imageProducts = activeProducts.filter((p) => Boolean(p.image_url));
  const typedProducts = activeProducts.filter((p) => Boolean(p.type));
  const readyPublicProducts = publicProducts.filter((p) =>
    (Number(p.stock_grams) > 0 || Number(p.quantity_units) > 0)
    && (Number(p.retail_price_per_gram_usd) > 0 || Number(p.fixed_retail_price_usd) > 0)
    && Boolean(p.product_name)
  );
  const now = Date.now();
  const upcomingEvents = events.filter((event: any) => {
    const date = new Date(event.eventDate || event.event_date || event.date || '').getTime();
    return Number.isFinite(date) && date >= now && event.status !== 'archived';
  });

  return {
    loading: false,
    error: null,
    products: {
      total: activeProducts.length,
      publicCount: publicProducts.length,
      priced: pricedProducts.length,
      stocked: stockedProducts.length,
      withImages: imageProducts.length,
      withType: typedProducts.length,
      readyPublic: readyPublicProducts.length,
    },
    team: {
      total: members.length,
      owners: members.filter((m: AccountMember) => m.role === 'owner').length,
      activeMembers: members.filter((m: AccountMember) => m.status !== 'invited').length,
      pendingInvites: members.filter((m: AccountMember) => m.status === 'invited' || (m.invited_at && !m.joined_at)).length,
      membersWithoutBundles: members.filter((m: AccountMember) => m.role === 'staff' && (m.bundles?.length || 0) === 0).length,
    },
    events: {
      total: events.length,
      upcoming: upcomingEvents.length,
    },
    orders: {
      total: invoices.length,
      pending: invoices.filter((invoice) => invoice.status === 'Pending').length,
    },
  };
}

/**
 * `ready` exists so the caller can hold the reads back until it has whatever it
 * needs first, which on the settings screen is the account itself.
 */
export function useLaunchAudit(accountId: string | null, ready: boolean): {
  audit: LaunchAudit;
  refresh: () => void;
} {
  const [audit, setAudit] = useState<LaunchAudit>(EMPTY_LAUNCH_AUDIT);

  const refresh = useCallback(() => {
    if (!accountId) return;
    setAudit((prev) => ({ ...prev, loading: true, error: null }));
    fetchLaunchAudit(accountId)
      .then(setAudit)
      .catch((err: any) => {
        setAudit((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || 'Could not load launch status.',
        }));
      });
  }, [accountId]);

  useEffect(() => {
    if (!accountId || !ready) return;
    refresh();
  }, [accountId, ready, refresh]);

  return { audit, refresh };
}
