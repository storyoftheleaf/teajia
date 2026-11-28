import { Button } from '../shared/Button';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { authPagePath } from '../../lib/authNavigation';
import { holdKeepTeaser, type KeepTeaser } from '../../lib/keepTeaser';
import { holdReturnPlace } from '../../hooks/useReturnPlace';
import { keepPayInvoice } from '../../lib/payInvoiceKeepApi';
import { invoiceShortPath, shortLinkOrigin } from '../../../shared/invoiceShortLink';

const KEEP_PARAM = 'keep';

/**
 * Where a signed-out person on an invoice goes to join: sign-up, showing the
 * teas they are keeping, and back to this same address (the open tea
 * included) with the marker that finishes the keep by itself.
 */
export function invoiceJoinPath(teaser: Omit<KeepTeaser, 'path'>, mode: 'signup' | 'signin' = 'signup'): string {
  const back = new URLSearchParams(window.location.search);
  back.set(KEEP_PARAM, '1');
  holdKeepTeaser({ ...teaser, path: window.location.pathname });
  holdReturnPlace();
  return authPagePath(mode, `${window.location.pathname}?${back.toString()}`);
}

/**
 * Keeping an invoice: it goes into the person's account, so its teas show as
 * theirs in the shop. There is no button for it (Adrian, 2026-11-27, "it is
 * simply the shop"): saving any of its teas keeps the invoice too. Signed
 * out, that save goes through joining, which shows the teas, and the keep
 * finishes by itself on the way back. The shop that sent the invoice never
 * keeps its own.
 */
export function useInvoiceKeep({ slug, token, signedIn, kept, yoursToSend = false }: {
  slug: string;
  token: string | null;
  signedIn: boolean;
  kept: boolean;
  yoursToSend?: boolean;
}): () => void {
  const [search, setSearch] = useSearchParams();
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const keep = () => {
    if (!token || !signedIn || kept || yoursToSend || busy.current) return;
    busy.current = true;
    void keepPayInvoice(slug, token)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['me', 'bought-teas'] });
        void queryClient.invalidateQueries({ queryKey: ['profile', slug, 'pay-access'] });
      })
      // Nothing to show: the save itself held, and the next save tries again.
      .catch(() => undefined)
      .finally(() => { busy.current = false; });
  };
  // Back from joining with the marker: finish the keep, once.
  const finished = useRef(false);
  useEffect(() => {
    if (finished.current || !signedIn || search.get(KEEP_PARAM) !== '1') return;
    finished.current = true;
    const next = new URLSearchParams(search);
    next.delete(KEEP_PARAM);
    setSearch(next, { replace: true });
    keep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, search]);
  return keep;
}

/**
 * The one line under the invoice's total: where her teas live once kept and
 * the collection they came from.
 */
export function PayInvoiceAfter({ kept, collection }: {
  kept: boolean;
  collection?: { title: string; path: string } | null;
}) {
  if (!kept && !collection) return null;
  const quiet = 'tap-target inline-flex items-center gap-1 font-sans text-ui-12 text-tea-text-sec hover:text-tea-text';
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 md:px-6" data-testid="pay-after">
      {kept ? (
        <Link to="/shop?bought=1" className={quiet} data-testid="pay-your-teas">Your teas <ArrowRight size={12} /></Link>
      ) : <span />}
      {collection && (
        <Link to={collection.path} className={quiet} data-testid="pay-collection-link">See {collection.title} <ArrowRight size={12} /></Link>
      )}
    </div>
  );
}

/** The short form of this invoice's address when it has one, else the address itself. */
export function invoiceLinkToSend(location: Pick<Location, 'href' | 'origin' | 'search'>): string {
  const search = new URLSearchParams(location.search);
  const path = invoiceShortPath(search.get('reference'), search.get('t'));
  return path ? `${shortLinkOrigin(location.origin)}${path}` : location.href;
}

/**
 * For the shop that sent it: the link to copy, sitting with the amount and
 * the reference it asks for (Adrian, 2026-11-27).
 */
export function PayInvoiceSend() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invoiceLinkToSend(window.location));
      setCopied(true);
    } catch { /* the address bar still has it */ }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-tea-border pt-2" data-testid="pay-yours-to-send">
      <span className="font-body text-ui-14 text-tea-text">This is your invoice to send.</span>
      <Button variant="plain" type="button" onClick={copy} className="btn-secondary tap-target shrink-0">
        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Link copied' : 'Copy the link'}
      </Button>
    </div>
  );
}
