import { buildWhatsAppUrl } from './whatsapp';

export const CONTACT_UNAVAILABLE = 'Contact options are not configured for this store yet.';

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
