import { useQuery } from '@tanstack/react-query';
import { api, getTokenClaims } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { ExchangeRate, Customer } from '../types';
import { shopFreightDefaultFrom, type ShopFreightDefault } from '../../lib/shippingRate';
import { rateToUsd } from '../../lib/currency';
import { loadLastKnownRates, saveLastKnownRates } from '../lastKnownRates';
import { mapAdminProduct } from '../productAdapter';
export { normalizeAdminProductTastingSource } from '../productAdapter';

const useAccountQueryScope = () => {
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  return {
    accountScope: activeAccountId ?? 'no-account',
    userScope: getTokenClaims()?.sub ?? 'anonymous',
  };
};

// Fetch Products
export const useProducts = (options?: { enabled?: boolean }) => {
  const { accountScope, userScope } = useAccountQueryScope();
  return useQuery({
    queryKey: ['products', accountScope, userScope],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
    queryFn: async () => (await api.products.list() || []).map(mapAdminProduct),
  });
};

/**
 * The shop's exchange rates. One table, one refresh, one number.
 *
 * `/api/rates` serves the `exchange_rates` rows in D1, which the worker
 * refreshes daily from a single feed and which every price it computes goes
 * through: the cost basis, the freight rate, the x3. The browser converts an
 * already-computed USD figure for display, so it has to read the same rate the
 * shelf was priced at. That is the one read; there is no second feed in front
 * of it and no invented table behind it.
 *
 * What is behind it is the last successful read of this same table, kept in the
 * browser. Adrian's rule: if the rates cannot be read today, yesterday's rate is
 * better than the whole system going down. So a failed request changes nothing
 * on screen, and a cold boot renders immediately from what the shop last said
 * rather than waiting on the network.
 *
 * The difference from what this used to do matters. It used to fall back to
 * hardcoded 2024 figures, which is not yesterday's rate, it is a guess wearing
 * the same clothes: IDR sat at 16210 against a market of 17.5k and nothing
 * distinguished it from a live number. A cached rate is a real rate that was
 * true recently and carries the date it was read. Only a browser that has never
 * once reached the API has nothing, and then the shop quotes its own USD.
 *
 * The key and the staleTime are a contract with the twelve components that read
 * this through `useShopPrice`. See the note in src/components/shop/shopPrice.ts
 * before changing either.
 */
export const useRates = () => {
  const { accountScope, userScope } = useAccountQueryScope();
  return useQuery({
    queryKey: ['rates', accountScope, userScope],
    queryFn: async () => {
      try {
        const data = await api.rates.list();
        const live = (data || []).map((r: any) => ({
          currency: r.currency,
          rateToUSD: Number(r.rate_to_usd),
          // Carried so a surface can say how old the number is. The shop
          // converts its freight rate through this on every request.
          lastUpdated: r.last_updated ?? null,
        })).filter((r: ExchangeRate) => Number.isFinite(r.rateToUSD) && r.rateToUSD > 0) as ExchangeRate[];
        if (live.length > 0) {
          saveLastKnownRates(live);
          return live;
        }
        // An empty table is not an answer worth adopting over a real one.
        return loadLastKnownRates();
      } catch {
        return loadLastKnownRates();
      }
    },
    // Matched to the worker's daily refresh. There is nothing to gain by asking
    // more often than the table changes, and a session open across the daily
    // boundary should still pick the new rate up, so: one hour of cache on a
    // number that moves once a day.
    staleTime: 1000 * 60 * 60,
    initialData: () => {
      const remembered = loadLastKnownRates();
      // An empty initial value is considered fresh for staleTime too, which
      // prevents a first-time shopper from fetching any exchange rates.
      return remembered.length > 0 ? remembered : undefined;
    },
    // The remembered rates are for the first paint, not for the hour. Without
    // this React Query dates them "now", and the hour above covers them: a
    // browser that has never read the table holds an EMPTY list as fresh data
    // and does not ask. Measured on 2026-09-21 against the live site with a
    // brand-new browser: zero requests to the rates endpoint on the home page
    // and on the shop, nothing cached, so a first-time visitor had no currency
    // to choose from until something else evicted the query. Dating the memory
    // at zero asks straight away and only paints from it meanwhile. It is
    // also why the anchored-navigation test in inventory-scroll.spec.ts was
    // "known failing": a cold Playwright browser is that first-time visitor.
    initialDataUpdatedAt: 0,
  });
};

/**
 * The shop's freight rate, resolved to USD against live rates.
 *
 * Every admin surface that shows or edits a per-tea shipping rate needs this,
 * because a tea with nothing entered is charged the shop rate and must display
 * it rather than a blank. It is one row and it changes rarely, so it is cached
 * for the session and refetched on the same terms as the rates it converts
 * through.
 *
 * `initialData` is the fallback rather than undefined, so no surface ever
 * renders a dash where a live charge belongs. That reads as free freight, which
 * is the exact misreading this whole area exists to prevent.
 */
export const useShopFreightDefault = (): ShopFreightDefault => {
  const { accountScope, userScope } = useAccountQueryScope();
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const { data: rates } = useRates();
  // Canonicalised, so a shop quoting its freight in 'CNY' resolves to the
  // 'Yuan' rate directly instead of falling through to the fallback currency's.
  const lookup = (currency: string) => rateToUsd(rates, currency);

  const { data: account } = useQuery({
    queryKey: ['shop-freight-default', accountScope, userScope],
    enabled: Boolean(activeAccountId),
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!activeAccountId) return null;
      try {
        return await api.accounts.get(activeAccountId);
      } catch {
        // A shop that cannot read its own settings still charges freight.
        return null;
      }
    },
  });

  return shopFreightDefaultFrom(account, lookup);
};

// Fetch Customers
export const useCustomers = () => {
  const { accountScope, userScope } = useAccountQueryScope();
  return useQuery({
    queryKey: ['customers', accountScope, userScope],
    staleTime: 1000 * 60 * 5,   // 5 min, same as products
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const data = await api.customers.list();
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        company: c.company || undefined,
        email: c.email || undefined,
        phone: c.phone || undefined,
        whatsapp: c.whatsapp || undefined,
        address: c.address || undefined,
        city: c.city || undefined,
        country: c.country || undefined,
        preferredCurrency: c.preferred_currency || 'USD',
        tags: typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : (c.tags || []),
        contacts: typeof c.contacts === 'string' ? JSON.parse(c.contacts || '[]') : (c.contacts || []),
        contact_tags: Array.isArray(c.contact_tags) ? c.contact_tags : [],
        notes: c.notes || undefined,
        source: c.source || undefined,
        type: c.type || 'customer',
        userId: c.user_id || undefined,
        userLinkedAt: c.user_linked_at || undefined,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        orderCount: Number(c.order_count) || 0,
        totalSpentUSD: Number(c.total_spent_usd) || 0,
        lastOrderDate: c.last_order_date || undefined,
        eventCount: Number(c.event_count) || 0,
        relationshipKinds: Array.isArray(c.relationship_kinds) ? c.relationship_kinds : [],
      })) as Customer[];
    }
  });
};

// Fetch Activity Logs (with pagination & filtering)
export const useActivityLogs = (params?: { limit?: number; offset?: number; action?: string; search?: string; entity_id?: string }) => {
  const { accountScope, userScope } = useAccountQueryScope();
  return useQuery({
    queryKey: ['activity_logs', accountScope, userScope, params],
    queryFn: async () => {
      try {
        return await api.activityLogs.list(params);
      } catch {
        return { logs: [], total: 0 };
      }
    }
  });
};

// Fetch Stock Ledger, global or per-product
export const useStockLedger = (productId: string | null | undefined, limit = 50, offset = 0) => {
  const { accountScope, userScope } = useAccountQueryScope();
  return useQuery({
    queryKey: ['stock_ledger', accountScope, userScope, productId ?? 'all', limit, offset],
    queryFn: async () => {
      return await api.stockLedger.list(productId || undefined, limit, offset);
    }
  });
};
