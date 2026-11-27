import { Link } from 'react-router-dom';
import { Bookmark, Check } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { authPagePath } from '../../lib/authNavigation';

/**
 * The invitation under an invoice's teas (Adrian, 2026-11-27): save the teas
 * to an account so what was bought stays with them, with the photos and
 * tastings they add later. The words are option 1 of three put to Adrian;
 * swap them here when he chooses.
 */
export function PayInvoiceKeep({ productIds, signedIn }: { productIds: string[]; signedIn: boolean }) {
  const favoriteTeas = useAppStore(s => s.favoriteTeas);
  const toggleFavoriteTea = useAppStore(s => s.toggleFavoriteTea);
  const unsaved = productIds.filter(id => !favoriteTeas.includes(id));
  const here = `${window.location.pathname}${window.location.search}`;
  return (
    <section aria-label="Save to your account" className="mt-6 max-w-2xl rounded-md border border-tea-border bg-tea-elevated px-4 py-4 md:px-5" data-testid="pay-account-offer">
      <p className="font-body text-ui-14 leading-[1.55] text-tea-text-sec">
        Teajia is in a closed beta, shared among close friends. Save these teas to your account and they stay with you.
        Add a photo or a tasting note when you drink them, and it all sits together.
      </p>
      <div className="mt-3 flex justify-end">
        {!signedIn ? (
          <Link to={authPagePath('signup', here)} className="btn-secondary tap-target">
            <Bookmark size={13} /> Save to my account
          </Link>
        ) : unsaved.length > 0 ? (
          <button type="button" onClick={() => unsaved.forEach(id => toggleFavoriteTea(id))} className="btn-secondary tap-target">
            <Bookmark size={13} /> Save to my account
          </button>
        ) : (
          <span className="inline-flex min-h-tap items-center gap-1.5 font-sans text-ui-12 text-tea-text-sec">
            <Check size={13} className="text-tea-gold" /> Saved to your account
          </span>
        )}
      </div>
    </section>
  );
}
