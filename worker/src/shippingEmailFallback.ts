// "Email them instead" (Adrian, 2026-11-25). A customer who chose WhatsApp
// and also gave an email is told by email whenever WhatsApp cannot carry the
// shipping message before anything is sent: the template is not approved, the
// approval could not be checked, or WhatsApp is not set up. Failures after a
// WhatsApp request left the building are never re-sent by email, because the
// customer may already have the message.

const WHATSAPP_UNAVAILABLE = new Set([
  'whatsapp_consent_required',
  'whatsapp_setup_required',
  'customer_matches_sender',
  'whatsapp_template_pending',
  'whatsapp_template_rejected',
  'whatsapp_template_verification_unavailable',
]);

export function whatsappUnavailable(setupCode: string | null): boolean {
  return Boolean(setupCode && WHATSAPP_UNAVAILABLE.has(setupCode));
}

export function validEmail(value?: string | null): string | null {
  return typeof value === 'string' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim()) ? value.trim() : null;
}

/** The email kept beside a WhatsApp choice, or null when the choice is already email. */
export function fallbackEmailFor(channel: 'email' | 'whatsapp' | null, email?: string | null): string | null {
  return channel === 'whatsapp' ? validEmail(email) : null;
}
