import type { PublicShelf, PublicShelfItem } from './api';
import { normalizeShelfWhatsApp } from '../../shared/shelfContact';
import { formatPersonalTeaMoney, readPersonalTeaMoney } from './personalTeaMoney';

export const SHELF_OFFER_ANCHOR = 'offer-';

export function publicShelfPath(slug: string, itemId?: string): string {
  const path = `/u/${encodeURIComponent(slug)}`;
  return itemId ? `${path}#${SHELF_OFFER_ANCHOR}${encodeURIComponent(itemId)}` : path;
}

export function hasShelfAmount(item: PublicShelfItem): boolean {
  return Number.isFinite(item.grams) && item.grams > 0;
}

function shelfWeight(grams: number): string {
  return `${grams.toLocaleString(undefined, { maximumSignificantDigits: 15 })} g`;
}

export function shelfAmount(grams: number): string {
  return `${shelfWeight(grams)} available`;
}

export function shelfPrice(item: PublicShelfItem): string | null {
  const price = readPersonalTeaMoney(item.price_amount, item.price_currency);
  return price && price.amount > 0 ? formatPersonalTeaMoney(price.amount, price.currency) : null;
}

export function shelfWhatsAppHref(shelf: PublicShelf, item: PublicShelfItem): string | null {
  const number = normalizeShelfWhatsApp(shelf.whatsapp);
  const price = shelfPrice(item);
  if (!number || !price || !hasShelfAmount(item)) return null;
  const seller = shelf.seller_name?.trim();
  const tea = `${item.name}${item.year ? ` (${item.year})` : ''}`;
  const message = `Hi${seller ? ` ${seller}` : ''}, I'd like to order ${tea}, ${shelfWeight(item.grams)} for ${price}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
