import type { PublicShelf, PublicShelfItem } from './api';
import { normalizeShelfWhatsApp } from '../../shared/shelfContact';

export const SHELF_OFFER_ANCHOR = 'offer-';

export function publicShelfPath(slug: string, itemId?: string): string {
  const path = `/u/${encodeURIComponent(slug)}`;
  return itemId ? `${path}#${SHELF_OFFER_ANCHOR}${encodeURIComponent(itemId)}` : path;
}

export function hasShelfAmount(item: PublicShelfItem): boolean {
  return Number.isFinite(item.grams) && item.grams > 0;
}

export function shelfAmount(grams: number): string {
  return `${grams.toLocaleString(undefined, { maximumSignificantDigits: 15 })} g available`;
}

export function shelfWhatsAppHref(shelf: PublicShelf, item: PublicShelfItem): string | null {
  const number = normalizeShelfWhatsApp(shelf.whatsapp);
  if (!number || !hasShelfAmount(item)) return null;
  const seller = shelf.seller_name?.trim();
  const tea = `${item.name}${item.year ? ` (${item.year})` : ''}`;
  const message = `Hi${seller ? ` ${seller}` : ''}, I'd like to ask about ${tea} from your shelf.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
