import { buildWhatsAppUrl } from './whatsapp';

export const CONTACT_UNAVAILABLE = 'Contact options are not configured for this store yet.';

/**
 * Shown when a store is open but nobody at it can be paid.
 *
 * A store cannot be opened in this state any more, but one opened earlier can
 * lose its payment methods afterwards, and nothing walks back through open
 * shops when that happens. So checkout stops here rather than letting someone
 * finish an order and arrive at a page with no way to send money. It does not
 * blame the customer and it does not explain the shop's internals.
 */
export const STORE_CANNOT_BE_PAID =
  'This store cannot take orders at the moment. Please try again later.';

export function resolveContactChannels(input: {
  whatsappNumber?: string | null;
  email?: string | null;
  subject?: string;
  message: string;
}) {
  const digits = (input.whatsappNumber || '').replace(/\D/g, '');
  const email = (input.email || '').trim();
  return {
    whatsapp: digits.length >= 7 ? { href: buildWhatsAppUrl(input.whatsappNumber || '', input.message) } : null,
    email: email.includes('@') ? {
      href: `mailto:${email}?subject=${encodeURIComponent(input.subject || 'Teajia inquiry')}&body=${encodeURIComponent(input.message)}`,
    } : null,
    unavailable: digits.length < 7 && !email.includes('@'),
  };
}
