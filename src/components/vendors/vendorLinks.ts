import { GENERATED_TEA_REFERENCE_PAGES } from '../../wisdom/reference/generatedPages';
import { findRegion } from '../../wisdom/regions';
import { normalizeTeaType } from '../../wisdom/vocabulary';

/**
 * Where each thing on a vendor's page leads, so the page joins up with the
 * rest of the site instead of listing names (Adrian, 2026-11-27: "the whole
 * role of that page is to interconnect everything").
 */
export const vendorLinks = {
  /** A tea opens in Stock, on its own panel. */
  product: (id: string) => `/admin/stock?panel=${encodeURIComponent(id)}`,
  /** A Curate record (sample, quote line, tea not yet stocked). */
  curateTea: (id: string) => `/admin/compass?entry=${encodeURIComponent(id)}`,
  receipt: (id: string) => `/admin/stock?receipt=${encodeURIComponent(id)}`,
  purchaseOrder: (id: string) => `/admin/purchase-orders?purchaseId=${encodeURIComponent(id)}`,
  /** An invoice opens in Activity's orders list, the one place that already reaches a single order. */
  invoice: (reference: string) => `/admin/activity?tab=orders&search=${encodeURIComponent(reference)}`,
  person: (id: string) => `/admin/people/${encodeURIComponent(id)}`,
};

const WRITTEN_TYPES = new Set<string>(GENERATED_TEA_REFERENCE_PAGES.filter(page => page.kind === 'tea_type').map(page => page.id));

/** The Wisdom Base page for a recorded tea type, only when that page is written. */
export function wisdomTypeLink(type: string | null | undefined): { label: string; href: string } | null {
  const normal = normalizeTeaType(type);
  if (!normal) return null;
  const id = normal.toLowerCase().replace(/\s+/g, '-');
  return WRITTEN_TYPES.has(id) ? { label: type!, href: `/wisdom/type/${encodeURIComponent(id)}` } : null;
}

/** The Wisdom Base place a written origin names, most specific part first; null when the base holds none. */
export function wisdomPlaceLink(...written: Array<string | null | undefined>): { label: string; href: string } | null {
  for (const value of written) {
    const region = findRegion(value);
    if (region) return { label: region.name, href: `/wisdom/region/${encodeURIComponent(region.id)}` };
  }
  return null;
}

/** A tap that reaches the vendor on a contact: a link where the channel has one, else null (copy instead). */
export function contactHref(channel: string, handle: string): string | null {
  const h = handle.trim();
  if (!h) return null;
  const digits = h.replace(/[^\d]/g, '');
  switch (channel) {
    case 'whatsapp': return digits.length >= 7 ? `https://wa.me/${digits}` : null;
    case 'phone': return digits.length >= 5 ? `tel:${h.startsWith('+') ? '+' : ''}${digits}` : null;
    case 'email': return /\S+@\S+\.\S+/.test(h) ? `mailto:${h}` : null;
    case 'website': return /^https?:\/\//i.test(h) ? h : `https://${h}`;
    case 'instagram': return `https://instagram.com/${encodeURIComponent(h.replace(/^@/, ''))}`;
    case 'telegram': return `https://t.me/${encodeURIComponent(h.replace(/^@/, ''))}`;
    default: return null;
  }
}

/** The whole address in one line, adding the city and country when the address doesn't already say them. */
export function fullAddress(v: { address?: string | null; city?: string | null; country?: string | null }): string {
  const address = (v.address ?? '').trim();
  const has = (part?: string | null) => !!part && address.toLocaleLowerCase().includes(part.trim().toLocaleLowerCase());
  return [address, ...[v.city, v.country].filter(p => p && p.trim() && !has(p)).map(p => p!.trim())].filter(Boolean).join(', ');
}

/** Opens the address in Google Maps (a search, so any address Google can read works). */
export function mapsHref(address: string): string | null {
  const text = address.trim();
  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : null;
}

/** "Guangzhou, Guangdong, China" → city "Guangzhou, Guangdong", country "China". One word alone is the city. */
export function splitPlace(text: string): { city: string | null; country: string | null } {
  const value = text.trim();
  const cut = value.lastIndexOf(',');
  if (cut < 0) return { city: value || null, country: null };
  return { city: value.slice(0, cut).trim() || null, country: value.slice(cut + 1).trim() || null };
}
