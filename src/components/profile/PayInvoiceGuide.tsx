import { Button } from '../shared/Button';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Banknote, Bookmark, Check,  Copy, Repeat } from 'lucide-react';
import { TeaCup } from '../TeaCupIcon';
import { useAppStore } from '../../lib/store';
import { authPagePath } from '../../lib/authNavigation';
import { holdKeepTeaser, type KeepTeaser } from '../../lib/keepTeaser';
import { holdReturnPlace } from '../../hooks/useReturnPlace';
import { keepPayInvoice } from '../../lib/payInvoiceKeepApi';
import { PayInvoiceDiscount } from './PayInvoiceDiscount';
import { GuideRow, GuideStep as Step } from '../shop/GuideStep';

const KEEP_PARAM = 'keep';
const TASTE_PARAM = 'choose';

/**
 * Where a signed-out person on an invoice goes to join: sign-up, showing the
 * teas they are keeping, and back to this same address (the open tea
 * included) with the marker that finishes the keep by itself.
 */
export function invoiceJoinPath(teaser: Omit<KeepTeaser, 'path'>, also?: string): string {
  const back = new URLSearchParams(window.location.search);
  back.set(KEEP_PARAM, '1');
  if (also) back.set(also, '1');
  holdKeepTeaser({ ...teaser, path: window.location.pathname });
  holdReturnPlace();
  return authPagePath('signup', `${window.location.pathname}?${back.toString()}`);
}

/**
 * The four pictures under an invoice's head (Adrian, 2026-11-27: the sheet is
 * the way into the site, "visual guide, not reading paragraphs"): Pay, Keep,
 * Taste, Again. They are in the order the days go, the one she is at is lit,
 * and each is a button. Keep puts the invoice in her account and its teas in
 * her saved teas; signed out it goes through joining, which shows the teas she
 * is keeping, and finishes by itself on the way back. Taste asks which tea and
 * opens its tasting on the shop's own page. Again is her teas in the shop.
 * The words are placeholders until Adrian names them.
 *
 * The shop that sent the invoice sees the same pictures and never keeps its
 * own invoice (PayInvoiceAfter gives it the link to copy).
 */
export function PayInvoiceGuide({ slug, token, productIds, teaser, signedIn, kept: keptAtLoad, paid, yoursToSend = false, againPath, onPay, onTaste }: {
  slug: string;
  token: string | null;
  productIds: string[];
  teaser: Omit<KeepTeaser, 'path'>;
  signedIn: boolean;
  kept: boolean;
  paid: boolean;
  yoursToSend?: boolean;
  /** Where Again goes before she has kept anything: the collection the teas came from, or the shop. */
  againPath: string;
  onPay: () => void;
  onTaste: () => void;
}) {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const toggleFavoriteTea = useAppStore(s => s.toggleFavoriteTea);
  const queryClient = useQueryClient();
  const [state, setState] = useState<'idle' | 'saving' | 'kept' | 'error'>(keptAtLoad ? 'kept' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const kept = state === 'kept';

  const save = async (): Promise<boolean> => {
    if (!token || yoursToSend) return false;
    setState('saving');
    setError(null);
    try {
      await keepPayInvoice(slug, token);
      void queryClient.invalidateQueries({ queryKey: ['me', 'bought-teas'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', slug, 'pay-access'] });
      productIds.filter(id => !useAppStore.getState().favoriteTeas.includes(id)).forEach(id => toggleFavoriteTea(id));
      setState('kept');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save. Try again.');
      setState('error');
      return false;
    }
  };

  // Joining, then back here with the marker: finish what she tapped, once.
  const join = (also?: string) => navigate(invoiceJoinPath(teaser, also));
  const finished = useRef(false);
  useEffect(() => {
    if (finished.current || !signedIn || search.get(KEEP_PARAM) !== '1') return;
    finished.current = true;
    const choose = search.get(TASTE_PARAM) === '1';
    const next = new URLSearchParams(search);
    next.delete(KEEP_PARAM);
    next.delete(TASTE_PARAM);
    setSearch(next, { replace: true });
    void (async () => {
      const ok = keptAtLoad || yoursToSend || await save();
      if (ok && choose) onTaste();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, search]);

  // Kept already: the picture opens where her teas now live.
  const keep = () => { if (!signedIn) join(); else if (kept) navigate('/shop?bought=1'); else void save(); };
  const taste = async () => {
    if (!signedIn) { join(TASTE_PARAM); return; }
    if (!kept && !yoursToSend && !(await save())) return;
    onTaste();
  };
  const at = !paid ? 'pay' : !kept && !yoursToSend ? 'keep' : 'taste';

  return (
    <GuideRow testId="pay-guide" error={error}>
        <Step label={paid ? 'Paid' : 'Pay'} done={paid} lit={at === 'pay'} icon={<Banknote size={20} aria-hidden="true" />} onClick={onPay} testId="pay-guide-pay" />
        <Step label={kept ? 'Kept' : state === 'saving' ? 'Keeping' : 'Keep'} done={kept} lit={at === 'keep'} disabled={yoursToSend || state === 'saving'} icon={<Bookmark size={20} aria-hidden="true" />} onClick={keep} testId="pay-guide-keep" />
        <Step label="Taste" lit={at === 'taste'} icon={<TeaCup size={20} aria-hidden="true" />} onClick={() => { void taste(); }} testId="pay-guide-taste" />
        <Step label="Again" icon={<Repeat size={20} aria-hidden="true" />} to={kept ? '/shop?bought=1' : againPath} testId="pay-guide-again" />
    </GuideRow>
  );
}

/**
 * The one line under the invoice's total: where her teas live once kept, the
 * collection they came from, and for the shop that sent it, the link to copy.
 */
export function PayInvoiceAfter({ kept, yoursToSend = false, collection, slug, token, discount, onDiscountChanged }: {
  kept: boolean;
  yoursToSend?: boolean;
  collection?: { title: string; path: string } | null;
  slug: string;
  token: string | null;
  /** On the shop's own view: the discount it offers, and whether it can still change. */
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
  if (!kept && !yoursToSend && !collection) return null;
  const quiet = 'tap-target inline-flex items-center gap-1 font-sans text-ui-12 text-tea-text-sec hover:text-tea-text';
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 md:px-6" data-testid="pay-after">
      {yoursToSend ? (
        <span className="flex flex-wrap items-center gap-3" data-testid="pay-yours-to-send">
          <span className="font-body text-ui-14 text-tea-text">This is your invoice to send.</span>
          <Button variant="plain" type="button" onClick={copy} className="btn-secondary tap-target shrink-0">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Link copied' : 'Copy the link'}
          </Button>
        </span>
      ) : kept ? (
        <Link to="/shop?bought=1" className={quiet} data-testid="pay-your-teas">Your teas <ArrowRight size={12} /></Link>
      ) : <span />}
      {collection && (
        <Link to={collection.path} className={quiet} data-testid="pay-collection-link">See {collection.title} <ArrowRight size={12} /></Link>
      )}
      {yoursToSend && discount?.editable && token && (
        <div className="basis-full">
          <PayInvoiceDiscount slug={slug} token={token} percent={discount.percent} onChanged={onDiscountChanged} />
        </div>
      )}
    </div>
  );
}
