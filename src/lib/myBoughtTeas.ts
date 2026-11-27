import { useQuery } from '@tanstack/react-query';
import { API_URL, authedFetch } from './api';
import { useAppStore } from './store';
import { linkTeaInventoryItem } from '../components/shop/linkTea';
import type { PayLinkTeaLine } from '../components/profile/types';
import type { InventoryItem } from '../types';

/**
 * The teas a signed-in person has bought, for the shop to say so on each one
 * (Adrian, 2026-11-27: the store itself, "it would just say how much she
 * bought"). Read from GET /api/me/bought-teas (worker/src/myBoughtTeas.ts).
 */
export interface BoughtTea {
  product_id: string;
  account_id: string;
  quantity: number;
  unit: 'g' | 'piece';
  last_bought_at: string | null;
  invoice_numbers: string[];
  tea: Omit<PayLinkTeaLine, 'quantity' | 'unit' | 'line_total_usd'>;
}

export function useMyBoughtTeas() {
  const signedIn = useAppStore(s => Boolean(s.authUser));
  const query = useQuery({
    queryKey: ['me', 'bought-teas'],
    enabled: signedIn,
    staleTime: 60_000,
    queryFn: async (): Promise<BoughtTea[]> => {
      const data = await authedFetch(`${API_URL}/api/me/bought-teas`);
      return Array.isArray(data?.teas) ? data.teas : [];
    },
  });
  const teas = signedIn ? query.data ?? [] : [];
  return { teas, byId: new Map(teas.map(tea => [tea.product_id, tea])) };
}

/** "You bought 150g", the one line a bought tea's row carries. */
export function boughtAmount(tea: Pick<BoughtTea, 'quantity' | 'unit'>): string {
  const amount = tea.unit === 'g' ? `${tea.quantity}g` : `${tea.quantity} ${tea.quantity === 1 ? 'piece' : 'pieces'}`;
  return `You bought ${amount}`;
}

/** The line on top of a bought tea's own page: how much, when, on which invoice. */
export function boughtTopLine(tea: BoughtTea): string {
  const when = tea.last_bought_at ? new Date(tea.last_bought_at.replace(' ', 'T') + (tea.last_bought_at.endsWith('Z') ? '' : 'Z')) : null;
  const date = when && !Number.isNaN(when.getTime())
    ? when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return [boughtAmount(tea), date, tea.invoice_numbers.join(', ') || null].filter(Boolean).join(' · ');
}

/** A tea she bought that the shop does not list, drawn as the shop draws its own. */
export function boughtTeaItem(tea: BoughtTea): InventoryItem {
  const line = tea.tea;
  return linkTeaInventoryItem({
    ...line, productId: line.product_id,
    originRegion: line.origin_region, originCountry: line.origin_country,
    chineseName: line.chinese_name, year: line.year, image: line.image_url, soldOut: true,
  });
}
