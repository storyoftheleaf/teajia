import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Bookmark, Check, Copy } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { authPagePath } from '../../lib/authNavigation';
import { keepPayInvoice } from '../../lib/payInvoiceKeepApi';

const KEEP_PARAM = 'keep';

/**
 * The invitation under an invoice's teas (Adrian, 2026-11-27): save it to an
 * account so what was bought stays with them, with the photos and tastings
 * they add later. Saving puts the invoice in their orders and keeps its teas
 * in their saved teas. Signed out, it goes through sign-up and finishes by
 * itself on the way back. The words are option 1 of three put to Adrian;
 * swap them here when he chooses.
 *
 * The shop that sent the invoice never saves it: its owner sees it as theirs
 * to send, with the link to copy (Adrian, 2026-11-27).
 */
export function PayInvoiceKeep({ slug, token, productIds, signedIn, kept: keptAtLoad, yoursToSend = false }: {
  slug: string;
  token: string | null;
  productIds: string[];
  signedIn: boolean;
  kept: boolean;
  yoursToSend?: boolean;
}) {
  if (yoursToSend) return <YoursToSend />;
  return <KeepOffer slug={slug} token={token} productIds={productIds} signedIn={signedIn} kept={keptAtLoad} />;
}

function YoursToSend() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch { /* the address bar still has it */ }
  };
  return (
    <section aria-label="Your invoice to send" className="mt-4 max-w-2xl rounded-md border border-tea-border bg-tea-elevated px-4 py-3 md:px-5" data-testid="pay-yours-to-send">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-body text-ui-14 text-tea-text">This is your invoice to send.</span>
        <button type="button" onClick={copy} className="btn-secondary tap-target shrink-0">
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Link copied' : 'Copy the link'}
        </button>
      </div>
    </section>
  );
}

function KeepOffer({ slug, token, productIds, signedIn, kept: keptAtLoad }: {
  slug: string;
  token: string | null;
  productIds: string[];
  signedIn: boolean;
  kept: boolean;
}) {
  const [search, setSearch] = useSearchParams();
  const favoriteTeas = useAppStore(s => s.favoriteTeas);
  const toggleFavoriteTea = useAppStore(s => s.toggleFavoriteTea);
  const [state, setState] = useState<'idle' | 'saving' | 'kept' | 'error'>(keptAtLoad ? 'kept' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!token) return;
    setState('saving');
    setError(null);
    try {
      await keepPayInvoice(slug, token);
      productIds.filter(id => !useAppStore.getState().favoriteTeas.includes(id)).forEach(id => toggleFavoriteTea(id));
      setState('kept');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save. Try again.');
      setState('error');
    }
  };

  // Back from sign-up with ?keep=1: finish the save they started, once.
  const finished = useRef(false);
  useEffect(() => {
    if (finished.current || !signedIn || search.get(KEEP_PARAM) !== '1') return;
    finished.current = true;
    const next = new URLSearchParams(search);
    next.delete(KEEP_PARAM);
    setSearch(next, { replace: true });
    if (!keptAtLoad) void save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, search]);

  const back = new URLSearchParams(search);
  back.set(KEEP_PARAM, '1');
  const returnTo = `${window.location.pathname}?${back.toString()}`;
  const allSaved = productIds.every(id => favoriteTeas.includes(id));

  return (
    <section aria-label="Save to your account" className="mt-4 max-w-2xl rounded-md border border-tea-border bg-tea-elevated px-4 py-3 md:px-5" data-testid="pay-account-offer">
      {state === 'kept' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 font-body text-ui-14 text-tea-text">
            <Check size={14} className="text-tea-gold" /> Saved to your account{allSaved ? ', with its teas' : ''}.
          </span>
          <Link to="/account/orders" className="tap-target inline-flex items-center gap-1 font-sans text-ui-12 text-tea-text-sec hover:text-tea-text">
            Your orders <ArrowRight size={12} />
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="min-w-0 flex-1 basis-64 font-body text-ui-14 leading-[1.5] text-tea-text-sec">
            Teajia is in a closed beta, shared among close friends. Save these teas to your account and they stay with you.
            Add a photo or a tasting note when you drink them, and it all sits together.
          </p>
          {!signedIn ? (
            <Link to={authPagePath('signup', returnTo)} className="btn-secondary tap-target shrink-0">
              <Bookmark size={13} /> Save to my account
            </Link>
          ) : (
            <button type="button" onClick={save} disabled={state === 'saving' || !token} className="btn-secondary tap-target shrink-0">
              <Bookmark size={13} /> {state === 'saving' ? 'Saving' : 'Save to my account'}
            </button>
          )}
          {error && <p role="alert" className="basis-full font-sans text-ui-12 text-tea-text-sec">{error}</p>}
        </div>
      )}
    </section>
  );
}
