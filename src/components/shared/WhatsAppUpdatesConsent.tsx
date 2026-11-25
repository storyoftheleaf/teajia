import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';

// WhatsApp order updates are agreed by default (Adrian, 2026-11-25: "make it
// default to a consent and if someone unclicks it then you can email them").
// Unticked, the customer can leave an email and the updates go there instead.

/** Ticked when the form opens, and again whenever the reply choice resets. */
export const WHATSAPP_UPDATES_DEFAULT = true;

export function updateEmailError(consent: boolean, email: string): string | null {
  const value = email.trim();
  if (consent || !value) return null;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) ? null : 'Enter an email address, or leave this empty.';
}

/** The email the order updates go to when WhatsApp updates are unticked. */
export function updateEmailForRequest(consent: boolean, email: string): string | undefined {
  const value = email.trim();
  return !consent && value && !updateEmailError(consent, value) ? value : undefined;
}

export function WhatsAppUpdatesConsent({ storeName, consent, onConsent, email, onEmail, error }: {
  storeName: string;
  consent: boolean;
  onConsent: (value: boolean) => void;
  email: string;
  onEmail: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1" data-testid="whatsapp-updates-consent">
      <label className="checkout-channel font-body text-ui-13 text-tea-text">
        <input type="checkbox" checked={consent} onChange={event => onConsent(event.target.checked)} style={{ accentColor: 'rgb(var(--tea-gold-rgb))' }} />
        Send me order and shipping payment updates from {storeName} on WhatsApp
      </label>
      <p className={`${T.bodyLight} text-tea-text-sec`}>I agree to receive confirmation, shipping payment links and replies about this order at this number. Automatic messages depend on availability; your order is saved even if a message does not arrive.</p>
      {!consent && (
        <div className="space-y-1 pt-2">
          <label className="block font-body text-ui-13 text-tea-text-sec" htmlFor="checkout-update-email">Email for order updates (optional)</label>
          <input id="checkout-update-email" name="update-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
            value={email} onChange={event => onEmail(event.target.value)} aria-invalid={Boolean(error)}
            aria-describedby={error ? 'checkout-update-email-error' : undefined} className="checkout-input" />
          {error && <p id="checkout-update-email-error" role="alert" className={`${T.bodyLight} text-tea-text`}>{error}</p>}
        </div>
      )}
    </div>
  );
}
