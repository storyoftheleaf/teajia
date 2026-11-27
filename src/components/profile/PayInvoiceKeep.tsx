import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Bookmark, Check, Copy } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { authPagePath } from '../../lib/authNavigation';
import { keepPayInvoice, setPayInvoiceDiscount } from '../../lib/payInvoiceKeepApi';
import { Button } from '../shared/Button';

const KEEP_PARAM = 'keep';

/**
 * The invitation under an invoice's teas (Adrian, 2026-11-27): save it to an
 * account so what was bought stays with them, with the photos and tastings
 * they add later. Saving puts the invoice in their orders and keeps its teas
 * in their saved teas. Signed out, it goes through sign-up and finishes by
 * itself on the way back. Adrian asked for the why, brief and actionable,
 * in place of the closed beta paragraph (2026-11-27); the words are a
 * placeholder until he chooses.
 *
 * The shop that sent the invoice never saves it: its owner sees it as theirs
 * to send, with the link to copy (Adrian, 2026-11-27).
 */
export function PayInvoiceKeep({ slug, token, productIds, signedIn, kept: keptAtLoad, yoursToSend = false, discount, onDiscountChanged }: {
  slug: string;
  token: string | null;
  productIds: string[];
  signedIn: boolean;
  kept: boolean;
  yoursToSend?: boolean;
  /** On the shop's own view: the discount it offers, and whether it can still change. */
  discount?: { editable: boolean; percent: number | null };
  onDiscountChanged?: () => void;
}) {
  if (yoursToSend) return <YoursToSend slug={slug} token={token} discount={discount} onDiscountChanged={onDiscountChanged} />;
  return <KeepOffer slug={slug} token={token} productIds={productIds} signedIn={signedIn} kept={keptAtLoad} />;
}

function YoursToSend({ slug, token, discount, onDiscountChanged }: {
  slug: string;
  token: string | null;
  discount?: { editable: boolean; percent: number | null };
  onDiscountChanged?: () => void;
}) {
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
      {discount?.editable && token && (
        <DiscountOffer slug={slug} token={token} percent={discount.percent} onChanged={onDiscountChanged} />
      )}
    </section>
  );
}

/**
 * A percent off, offered from the shop's own view of the sheet (Adrian,
 * 2026-11-27: "I should have a place where I can offer a discount on this
 * sheet"). The buyer sees it as its own line above the total.
 */
function DiscountOffer({ slug, token, percent, onChanged }: {
  slug: string;
  token: string;
  percent: number | null;
  onChanged?: () => void;
}) {
  const [value, setValue] = useState(percent ? String(percent) : '');
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const apply = async (next: number) => {
    setState('saving');
    try {
      await setPayInvoiceDiscount(slug, token, next);
      setState('idle');
      if (next === 0) setValue('');
      onChanged?.();
    } catch {
      setState('error');
    }
  };
  const asked = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(asked) && asked > 0 && asked < 100;
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2 border-t border-tea-border pt-3"
      onSubmit={event => { event.preventDefault(); if (valid) void apply(asked); }}
      data-testid="pay-discount-offer"
    >
      <label htmlFor="pay-discount" className="font-sans text-ui-13 text-tea-text-sec">Offer a discount</label>
      <span className="inline-flex items-center gap-1">
        <input
          id="pay-discount"
          inputMode="decimal"
          value={value}
          onChange={event => setValue(event.target.value.replace(/[^\d.]/g, ''))}
          placeholder="10"
          className="h-10 w-16 rounded-md border border-tea-border bg-tea-surface px-2 text-right font-sans text-ui-14 text-tea-text focus:border-tea-gold focus:outline-none"
        />
        <span className="font-sans text-ui-13 text-tea-text-sec">%</span>
      </span>
      <Button type="submit" variant="secondary" disabled={!valid || state === 'saving'} className="tap-target">
        {state === 'saving' ? 'Saving' : percent ? 'Change' : 'Offer'}
      </Button>
      {percent ? (
        <Button type="button" variant="plain" onClick={() => void apply(0)} disabled={state === 'saving'} className="tap-target font-sans text-ui-12 text-tea-text-sec hover:text-tea-text">
          Take it off
        </Button>
      ) : null}
      {state === 'error' && <p role="alert" className="basis-full font-sans text-ui-12 text-tea-text-sec">That did not save. Try again.</p>}
    </form>
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
  const queryClient = useQueryClient();
  const [state, setState] = useState<'idle' | 'saving' | 'kept' | 'error'>(keptAtLoad ? 'kept' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!token) return;
    setState('saving');
    setError(null);
    try {
      await keepPayInvoice(slug, token);
      void queryClient.invalidateQueries({ queryKey: ['me', 'bought-teas'] });
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
          <span className="flex flex-wrap items-center gap-4">
            <Link to="/shop?bought=1" className="tap-target inline-flex items-center gap-1 font-sans text-ui-12 text-tea-text-sec hover:text-tea-text" data-testid="pay-your-teas">
              Your teas in the shop <ArrowRight size={12} />
            </Link>
            <Link to="/account/orders" className="tap-target inline-flex items-center gap-1 font-sans text-ui-12 text-tea-text-sec hover:text-tea-text">
              Your orders <ArrowRight size={12} />
            </Link>
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-64">
            <p className="font-body text-ui-15 leading-[1.45] text-tea-text">Keep these teas with you.</p>
            <p className="mt-0.5 font-body text-ui-13 leading-[1.5] text-tea-text-sec">
              Order any of them again in a tap, and note how each one tasted.
            </p>
          </div>
          {!signedIn ? (
            <Link to={authPagePath('signup', returnTo)} className="btn-secondary tap-target shrink-0">
              <Bookmark size={13} /> Save my teas
            </Link>
          ) : (
            <button type="button" onClick={save} disabled={state === 'saving' || !token} className="btn-secondary tap-target shrink-0">
              <Bookmark size={13} /> {state === 'saving' ? 'Saving' : 'Save my teas'}
            </button>
          )}
          {error && <p role="alert" className="basis-full font-sans text-ui-12 text-tea-text-sec">{error}</p>}
        </div>
      )}
    </section>
  );
}
