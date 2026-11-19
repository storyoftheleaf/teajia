import { validateUsShippingAddress } from './usShippingAddress';

export type DeliveryChoice = 'bali-delivery' | 'bali-pickup' | 'indonesia' | 'international';
export type ReplyChannel = 'whatsapp' | 'website' | 'whatsapp-chat';

export interface CheckoutDetails {
  name: string;
  contact: string;
  address: string;
  location: string;
  country: string;
  state: string;
  postcode: string;
  notes: string;
  delivery: DeliveryChoice;
}

export function emptyCheckoutDetails(isBaliStore: boolean): CheckoutDetails {
  return { name: '', contact: '', address: '', location: '', country: isBaliStore ? 'United States' : '', state: '', postcode: '', notes: '', delivery: 'international' };
}

/** Old saved forms and corrupt browser storage must not break guest checkout. */
export function readCheckoutDetails(isBaliStore: boolean): CheckoutDetails {
  const result = emptyCheckoutDetails(isBaliStore);
  try {
    const saved = JSON.parse(localStorage.getItem('teajia_cartDetails') || 'null');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return result;
    for (const key of ['name', 'contact', 'location', 'country', 'state', 'postcode', 'notes'] as const) {
      if (typeof saved[key] === 'string') result[key] = saved[key];
    }
    if (['bali-delivery', 'bali-pickup', 'indonesia', 'international'].includes(saved.delivery)) result.delivery = saved.delivery;
    // A legacy free-text destination has no reliable regional meaning.
    if (!saved.delivery && result.location) result.delivery = 'international';
    if (isBaliStore) {
      result.country = 'United States';
      if (result.delivery !== 'bali-pickup') result.delivery = 'international';
    } else result.delivery = 'international';
  } catch { /* Ordering remains available with blocked or corrupt storage. */ }
  return result;
}

export function isUsDelivery(details: CheckoutDetails): boolean {
  return details.delivery === 'international' && /^(us|usa|united states(?: of america)?)$/i.test(details.country.trim());
}

export function checkoutLocation(details: CheckoutDetails): string {
  const area = [details.location.trim(), ...(isUsDelivery(details) && details.state.trim() ? [details.state.trim().toUpperCase()] : [])].join(', ');
  if (details.delivery === 'bali-pickup') return 'Pickup requested in Bali, Indonesia';
  if (details.delivery === 'bali-delivery') return `${area}, Bali, Indonesia`;
  const place = [area, details.postcode.trim()].filter(Boolean).join(' ');
  return `${place}, ${details.delivery === 'indonesia' ? 'Indonesia' : details.country.trim()}`;
}

export function validateCheckoutDetails(details: CheckoutDetails, channel: ReplyChannel, usOnly = false): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!details.name.trim()) errors.name = 'Enter your name.';
  const contact = details.contact.trim();
  if (channel === 'website') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) errors.contact = 'Enter an email address so we can reply.';
  } else if (channel === 'whatsapp' && (!/^\+?[\d\s().-]+$/.test(contact) || contact.replace(/\D/g, '').length < 7)) {
    errors.contact = 'Enter your WhatsApp number, including the country code.';
  }
  if (details.delivery !== 'bali-pickup' && !details.location.trim()) errors.location = 'Enter your town or area.';
  if (details.delivery === 'international' && details.country.trim().length < 2) errors.country = 'Enter the destination country.';
  if (usOnly && details.delivery !== 'bali-pickup') {
    if (!isUsDelivery(details)) errors.country = 'Shipping is currently available to the United States only.';
    Object.assign(errors, validateUsShippingAddress({ street: details.address, city: details.location, state: details.state, postcode: details.postcode }));
  }
  return errors;
}
