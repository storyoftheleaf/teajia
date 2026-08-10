import { useState } from 'react';
import { ArrowSquareOut, Check, CopySimple } from '@phosphor-icons/react';
import { buildPaymentPageUrl } from './profileDomain';

export function CopyPublicLinkButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" onClick={copy} className="tap-target inline-flex items-center gap-2 text-ui-12 text-tea-text-sec hover:text-tea-text" aria-label={`Copy ${label}`}>
      {copied ? <Check size={16} aria-hidden="true" /> : <CopySimple size={16} aria-hidden="true" />}
      {copied ? 'Copied' : `Copy ${label}`}
    </button>
  );
}

export function ProfileShareLinks({ slug, accountSlug, origin, showPayment = true }: { slug: string; accountSlug?: string | null; origin?: string; showPayment?: boolean }) {
  const base = origin ?? (typeof window === 'undefined' ? 'https://teajia.com' : window.location.origin);
  const profilePath = `/people/${encodeURIComponent(slug)}`;
  const profileUrl = new URL(profilePath, base).toString();
  const favoritesUrl = new URL(`${profilePath}/favorites`, base).toString();
  const paymentUrl = buildPaymentPageUrl(slug, accountSlug, base);
  return (
    <div className="grid gap-3 rounded-md border border-tea-border bg-tea-surface p-4 sm:grid-cols-2">
      <a href={profilePath} className="tap-target inline-flex items-center gap-2 text-ui-13 text-tea-gold hover:text-tea-gold-lt">View profile <ArrowSquareOut size={16} aria-hidden="true" /></a>
      <CopyPublicLinkButton value={profileUrl} label="profile link" />
      <CopyPublicLinkButton value={favoritesUrl} label="public favorites link" />
      {showPayment && <CopyPublicLinkButton value={paymentUrl} label="payment link" />}
    </div>
  );
}
