import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AlertCircle, Check, MessageCircle, Minus, Plus, Loader2, ArrowRight, Bell, X, ChevronLeft, ChevronRight, Share2, Link2 } from 'lucide-react';
import { api } from '../lib/api';
import { buildWhatsAppUrl, buildCollectionBasketMessage } from '../lib/whatsapp';
import type { PublicCollectionResponse, PublicCollectionItem } from '../types';
import { authPagePath } from '../lib/authNavigation';
import {
  LinkTeaEntry, LinkTeaPhoto, linkTeaInventoryItem, linkTeaMetaLine, useLinkTeaWriting,
  type LinkTeaDetailFields, type LinkTeaSource,
} from '../components/shop/linkTea';
import { AlcoveModal } from '../components/shop/AlcoveModal';
import type { InventoryItem } from '../types';

// ── Picker mode ──────────────────────────────────────────────────────────────

type PickerMode = 'loose-leaf' | 'cake-brick' | 'teaware' | 'misc';

function getPickerMode(item: PublicCollectionItem): PickerMode {
  const t = (item.product_type || '').toLowerCase();
  if (t === 'teaware') return 'teaware';
  if (t === 'misc') return 'misc';
  // Pu'er and dark tea count by the piece only when the tea is a pressed piece
  // and the suggested amount reads as pieces. A loose tea, or a suggestion
  // of 50, is grams: "50 cakes" was never what a curator meant.
  const form = (item.form || '').toLowerCase();
  if (form === 'loose' || form.includes('loose')) return 'loose-leaf';
  const rec = Number(item.recommended_quantity);
  if (Number.isFinite(rec) && rec > 10) return 'loose-leaf';
  if (t === 'sheng' || t === 'shou' || t === 'dark') return 'cake-brick';
  return 'loose-leaf';
}

// ── Price formatting ─────────────────────────────────────────────────────────
// Collection prices are curator-quoted USD totals (not convertible here without
// rates this public page doesn't load). We render them with an explicit "USD"
// tag so the amount is unambiguous for an international recipient.

const fmtUsd = (n: number) => {
  const cents = Math.round(n * 100);
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
};

// ── Scroll reveal ────────────────────────────────────────────────────────────
// Fades + lifts an element in once when it scrolls into view. Honors
// prefers-reduced-motion (returns visible immediately, no transition).

function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.06 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, shown };
}

// ── Basket state ─────────────────────────────────────────────────────────────

interface BasketEntry {
  quantity: string | number;
  note: string;
  outOfStock: boolean;
  pickerMode: PickerMode;
  productName: string;
  /** Curator's quoted total price for the recommended quantity, if set. */
  recommendedPriceUsd?: number | null;
}

type BasketState = Record<string, BasketEntry>;

// ── Page shell ───────────────────────────────────────────────────────────────

const PublicCollectionPage: React.FC = () => {
  const { slug = '' } = useParams();
  const [data, setData] = useState<PublicCollectionResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'gone' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    api.collections.getPublic(slug)
      .then(res => {
        if (cancelled) return;
        setData(res);
        setStatus('ok');
      })
      .catch((err: any) => {
        if (cancelled) return;
        const msg = err?.message || '';
        if (/410|no longer available/i.test(msg)) setStatus('gone');
        else if (/404|not found/i.test(msg)) setStatus('notfound');
        else setStatus('error');
      });
    return () => { cancelled = true; };
  }, [slug]);

  // View-count: one ping per session per slug.
  useEffect(() => {
    if (status !== 'ok' || !slug) return;
    const key = `tj_c_view_${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* private mode, skip */ }
    api.collections.trackPublicView(slug).catch(() => { /* ignore */ });
  }, [status, slug]);

  // If the visitor is logged in, drop this collection onto their shelf as
  // 'received' the moment they open the link. Best-effort + once per slug;
  // markReceived swallows its own errors (guest / dead link → no-op).
  useEffect(() => {
    if (status !== 'ok' || !slug) return;
    const loggedIn = !!(localStorage.getItem('teajia_token') || sessionStorage.getItem('teajia_token'));
    if (!loggedIn) return;
    const key = `tj_c_recv_${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* private mode, still attempt once */ }
    api.collections.markReceived(slug);
  }, [status, slug]);

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <p className="text-sm text-tea-text-dim">Loading…</p>
      </main>
    );
  }

  if (status === 'notfound' || status === 'gone') {
    return (
      <main className="min-h-screen bg-tea-bg flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <p className="h2 text-tea-text mb-3">
            {status === 'gone' ? 'This collection has been put away.' : 'Not found.'}
          </p>
          <p className="font-body text-ui-15 leading-[1.65] text-tea-text-sec italic">
            {status === 'gone'
              ? 'The link may have been taken down. Ask Teajia directly for a new one.'
              : "The link you followed doesn’t lead anywhere. Check it with whoever shared it."}
          </p>
        </div>
      </main>
    );
  }

  if (status === 'error' || !data) {
    return (
      <main className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <p className="text-sm text-tea-error">Something went wrong loading this page.</p>
      </main>
    );
  }

  return (
    <>
      <Helmet>
        {/* Link-gated: keep out of search indexes. Metadata still helps when the link is shared. */}
        <meta name="robots" content="noindex, nofollow" />
        <title>{data.collection.title}</title>
        {data.collection.note && <meta name="description" content={data.collection.note.slice(0, 160)} />}
      </Helmet>
      <CollectionCatalog data={data} />
    </>
  );
};

export default PublicCollectionPage;

// ── Catalog body ────────────────────────────────────────────────────────────

const CollectionCatalog: React.FC<{ data: PublicCollectionResponse }> = ({ data }) => {
  const { collection, items, account } = data;
  const storeName = account?.name ?? 'Teajia';
  const curatorName = collection.curator_display_name;
  const signedIn = (() => { try { return !!(localStorage.getItem('teajia_token') || sessionStorage.getItem('teajia_token')); } catch { return false; } })();
  // First name (or store) for the inline "X suggests…" recommendation lines.
  const curatorFirstName = (curatorName?.trim().split(/\s+/)[0]) || storeName;

  const visible = useMemo(
    () => items.filter(i => i.product_status === 'Active'),
    [items]
  );

  const slug = data.publication.slug;
  const [basket, setBasket] = useState<BasketState>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [basketNote, setBasketNote] = useState('');
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  // Share, native share sheet where available, clipboard copy as fallback.
  async function handleShare() {
    const url = window.location.href;
    const title = collection.title;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* cancelled, fall through */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2000);
    } catch { /* clipboard blocked, no-op */ }
  }
  const [confirmState, setConfirmState] = useState<'idle' | 'contact' | 'sending' | 'sent'>('idle');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [nameError, setNameError] = useState(false);

  const selectedIds = Object.keys(basket);
  const selectedCount = selectedIds.length;

  // Running total of the curator's quoted prices for the selected items (only the
  // in-stock ones with a price set).
  const quotedTotal = selectedIds.reduce((sum, id) => {
    const e = basket[id];
    return sum + (!e.outOfStock && e.recommendedPriceUsd != null ? Number(e.recommendedPriceUsd) : 0);
  }, 0);

  function handleSendPicks() {
    const basketItems = selectedIds.map(id => {
      const entry = basket[id];
      const unit = entry.pickerMode === 'loose-leaf' ? 'g'
        : entry.pickerMode === 'cake-brick' ? (Number(entry.quantity) === 1 ? ' cake' : ' cakes')
        : (Number(entry.quantity) === 1 ? ' unit' : ' units');
      return {
        name: entry.productName,
        quantity: entry.quantity,
        quantityUnit: entry.pickerMode === 'loose-leaf' ? 'g' : unit,
        note: entry.note || undefined,
        outOfStock: entry.outOfStock,
        priceUsd: entry.recommendedPriceUsd ?? null,
      };
    });

    const message = buildCollectionBasketMessage({
      collectionTitle: collection.title,
      collectionUrl: window.location.href,
      curatorDisplayName: curatorName,
      items: basketItems,
      note: basketNote,
    });

    window.open(buildWhatsAppUrl(account?.whatsapp_number ?? '', message), '_blank');
  }

  function handleConfirmClick() {
    if (confirmState === 'sending' || selectedCount === 0) return;
    // First click: open the reviewable basket (which then flows to contact).
    if (confirmState === 'idle') {
      setReviewOpen(true);
      return;
    }
  }

  async function handleContactSubmit() {
    if (!contactName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setConfirmState('sending');
    try {
      const trimmedBasketNote = basketNote.trim();
      await api.collections.confirmPicks(slug, {
        picks: selectedIds.map((id, i) => {
          // The API has no basket-level note field, so attach the whole-basket
          // note to the first pick (prefixed) so it reaches the curator.
          const perItem = basket[id].note?.trim();
          const note = i === 0 && trimmedBasketNote
            ? [perItem, `Note for the order: ${trimmedBasketNote}`].filter(Boolean).join(' · ')
            : perItem || undefined;
          return {
            item_id: id,
            quantity: Math.max(1, Math.round(Number(basket[id].quantity) || 1)),
            note,
          };
        }),
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim() || undefined,
      });
      setConfirmState('sent');
    } catch {
      // Fall back to WhatsApp so the recipient is never stuck.
      setConfirmState('idle');
      handleSendPicks();
    }
  }

  return (
    <main className="min-h-screen bg-tea-bg text-tea-text pb-nav-gap-lg">
      {/* Masthead, editorial cover. Big title over a faint count watermark so an
          image-less collection still has presence. Contents index doubles as nav. */}
      {/* Masthead in the shop's own register: who it is from, the title, the
          curator's note. A private link, so it says so once, quietly. */}
      <header className="border-b border-tea-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-10 pt-8 pb-8 md:pt-14 md:pb-10">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-6">
            <Link to="/shop" className="tap-target label-caps text-tea-text-sec hover:text-tea-text transition-colors">
              {account?.name || 'Teajia'}
            </Link>
            <button
              onClick={handleShare}
              className="tap-target inline-flex items-center gap-1.5 font-sans text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Share this collection"
            >
              {shareState === 'copied'
                ? (<><Link2 size={13} className="text-tea-gold" /> Link copied</>)
                : (<><Share2 size={13} /> Share</>)}
            </button>
          </div>
          <h1 className="h1 text-tea-text mb-4 max-w-[22ch]">
            {collection.title}
          </h1>
          {collection.note && (
            <p className="body-prose text-tea-text-sec italic max-w-[56ch]">
              {collection.note}
            </p>
          )}
          <p className="mt-4 font-sans text-ui-12 text-tea-text-sec">
            {[
              curatorName ? `Chosen by ${curatorName}` : null,
              `${visible.length} ${visible.length === 1 ? 'tea' : 'teas'}`,
              'A private link, not listed in the shop',
            ].filter(Boolean).join(' · ')}
          </p>

          {collection.hero_image_url && (
            <figure className="mt-8 -mx-4 md:-mx-6 lg:mx-0">
              <img
                src={collection.hero_image_url}
                alt=""
                className="w-full max-h-[46vh] object-cover lg:rounded-md"
                loading="eager"
              />
            </figure>
          )}
        </div>
      </header>

      {/* Catalog body */}
      <section className={`max-w-6xl mx-auto px-4 md:px-6 lg:px-10 py-8 md:py-10 ${selectedCount > 0 ? 'pb-40' : 'pb-16'}`}>
        {visible.length === 0 ? (
          <p className="font-body text-ui-15 leading-[1.65] text-tea-text-sec italic py-10 text-center">
            The teas in this collection are currently unavailable.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(item => (
              <CatalogEntry
                key={item.id}
                item={item}
                basket={basket}
                setBasket={setBasket}
                curatorFirstName={curatorFirstName}
                onOpenDetail={() => setDetailId(item.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* "Curated for you" was the fallback here, and it was a claim the page
          cannot make. Nothing on this route is personalised: the list is a fixed
          set of picks a curator chose and sent, identical for every person who
          opens the link, and the app does not rank, score or recommend anything.
          The shop's equivalent section says so plainly ("The same shelf for
          everyone who walks in"); this says the same thing in a footer's worth
          of words. Where a human curator is named, name them, and where only the
          store is known, name the store. Only the last branch is generic. */}
      <footer className="border-t border-tea-border px-4 py-10 text-center">
        <p className="label-caps text-tea-text-dim">
          {curatorName
            ? `Curated by ${curatorName}`
            : account?.name
              ? `Curated by ${account.name}`
              : 'A curator’s picks. The same list for everyone who opens it.'}
        </p>
        {/* An account is offered, never asked for: the whole page reads and
            orders without one (Adrian, 2026-11-27: "offering them to make an
            account as well, but the reading of the link is not required as an
            account"). Joining brings them back here, and a signed-in visit
            keeps the collection on their shelf (markReceived above). */}
        {!signedIn && slug && (
          <p className="mt-4 text-ui-13 text-tea-text-sec" data-testid="collection-account-offer">
            Want to keep this?{' '}
            <Link to={authPagePath('signup', `/c/${slug}`)} className="tap-target text-tea-text underline decoration-tea-border underline-offset-2 hover:text-tea-gold">Make a free account</Link>
            {' '}and it stays with you. You don’t need one to read or order.
          </p>
        )}
      </footer>

      {/* Sticky basket footer, only visible when ≥1 item selected. This page is a
          focused standalone route (no app bottom nav), so it sits flush at the
          bottom with safe-area padding. */}
      {selectedCount > 0 && confirmState !== 'sent' && (
        <div className="fixed left-0 right-0 bottom-0 bg-tea-surface border-t border-tea-border z-40 px-4 md:px-6 lg:px-10 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Contact step: revealed after first "Confirm" click */}
          {confirmState === 'contact' || confirmState === 'sending' ? (
            <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-col gap-1 min-w-0 flex-1 basis-[140px]">
                  <input
                    type="text"
                    value={contactName}
                    onChange={e => { setContactName(e.target.value); if (nameError) setNameError(false); }}
                    placeholder="Your name"
                    autoFocus
                    className={`input-warm w-full px-3 py-2 text-ui-13 leading-[1.5]${nameError ? ' border-tea-gold/60' : ''}`}
                  />
                  {nameError && (
                    <p className="font-sans text-ui-10 text-tea-gold">Please add your name.</p>
                  )}
                </div>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="input-warm px-3 py-2 text-ui-13 leading-[1.5] min-w-0 flex-1 basis-[120px]"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setConfirmState('idle')}
                    className="tap-target text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleContactSubmit}
                    disabled={confirmState === 'sending'}
                    className="btn-primary"
                  >
                    {confirmState === 'sending' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    {confirmState === 'sending' ? 'Sending…' : 'Send picks'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Default step: item count + action buttons */
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
              <p className="font-sans text-ui-12 text-tea-text-sec min-w-0">
                <span className="text-tea-gold font-medium">{selectedCount}</span>{' '}
                {selectedCount === 1 ? 'item' : 'items'}
                {quotedTotal > 0 && (
                  <span className="text-tea-text-dim"> · {fmtUsd(quotedTotal)}</span>
                )}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSendPicks}
                  className="tap-target inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-ui-12 font-medium tracking-[0.3px] text-tea-text-sec hover:text-tea-text border border-tea-border transition-colors"
                  aria-label="Send my picks over WhatsApp instead"
                >
                  <MessageCircle size={13} />
                  WhatsApp
                </button>
                <button
                  onClick={handleConfirmClick}
                  className="btn-primary"
                >
                  <Check size={13} />
                  Confirm my picks
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sent confirmation, replaces the action bar once the picks are in. */}
      {confirmState === 'sent' && (
        <div className="fixed left-0 right-0 bottom-0 bg-tea-surface border-t border-tea-border z-40 px-4 md:px-6 lg:px-10 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-2.5 text-center">
          <Check size={15} className="text-tea-gold shrink-0" />
          <p className="font-body text-ui-13 leading-[1.5] text-tea-text">
            Your picks are in. {curatorName || account?.name || 'The curator'} will be in touch to finish your order.
          </p>
        </div>
      )}

      {/* The open tea is the shop's own card (AlcoveModal), so it reads exactly
          as the shop does. Its footer is this link's: choosing adds to these
          picks, never to the shop's cart. The tea's Wisdom entry sits under
          About, the one thing this link adds. */}
      {detailId && (() => {
        const focused = visible.find(it => it.id === detailId);
        if (!focused) return null;
        const byProduct = new Map(visible.map(it => [it.product_id, it]));
        const cards = visible.map(collectionTeaItem);
        return (
          <AlcoveModal
            item={cards.find(card => card.id === focused.product_id) ?? null}
            items={cards}
            onClose={() => setDetailId(null)}
            onItemChange={next => { const it = byProduct.get(next.id); if (it) setDetailId(it.id); }}
            linkFooter={card => {
              const it = byProduct.get(card.id);
              return it ? (
                <PickFooter
                  item={it}
                  basket={basket}
                  setBasket={setBasket}
                  selectedCount={selectedCount}
                  onReview={() => { setDetailId(null); setReviewOpen(true); }}
                />
              ) : null;
            }}
            linkAddition={card => {
              const it = byProduct.get(card.id);
              return it ? <PickWriting item={it} curatorFirstName={curatorFirstName} /> : null;
            }}
          />
        );
      })()}

      {/* Reviewable basket, opens from the sticky bar or the card's "Review picks". */}
      {reviewOpen && selectedCount > 0 && confirmState === 'idle' && (
        <BasketReview
          items={visible}
          basket={basket}
          setBasket={setBasket}
          note={basketNote}
          setNote={setBasketNote}
          quotedTotal={quotedTotal}
          onClose={() => setReviewOpen(false)}
          onConfirm={() => { setReviewOpen(false); setConfirmState('contact'); }}
        />
      )}
    </main>
  );
};

// ── One entry ────────────────────────────────────────────────────────────────

const LOOSE_LEAF_GRAM_OPTIONS = [25, 50, 100, 200];

// ── Shared per-item basket controls ──────────────────────────────────────────
// All the derived values + actions for one item's selection/quantity/note state.
// Used by both the inline CatalogEntry row and the slide-over DetailPanel so the
// picker logic has a single source of truth.

function useItemControls(
  item: PublicCollectionItem,
  basket: BasketState,
  setBasket: React.Dispatch<React.SetStateAction<BasketState>>,
) {
  const oos = item.out_of_stock;
  const pickerMode = getPickerMode(item);
  const entry = basket[item.id];
  const isSelected = Boolean(entry);

  const recQty = (() => {
    const n = Number(item.recommended_quantity);
    return item.recommended_quantity != null && Number.isFinite(n) && n > 0 ? n : null;
  })();
  const recPrice = item.recommended_price_usd != null ? Number(item.recommended_price_usd) : null;

  function unitLabel(n: number): string {
    if (pickerMode === 'loose-leaf') return 'g';
    if (pickerMode === 'cake-brick') return n === 1 ? ' cake' : ' cakes';
    return n === 1 ? ' unit' : ' units';
  }

  const description = item.description?.trim() || '';

  // Price scales with the chosen amount. The quoted price is FOR the recommended
  // quantity, so we derive a per-unit rate and multiply by the chosen qty. When
  // recQty is absent we return null rather than show a misleading estimate.
  function priceForQty(q: number): number | null {
    if (recPrice === null || recQty === null) return null;
    return Math.round((recPrice / recQty) * q * 100) / 100;
  }

  const gramOptions = useMemo(() => {
    const opts = new Set(LOOSE_LEAF_GRAM_OPTIONS);
    if (pickerMode === 'loose-leaf' && recQty) opts.add(recQty);
    return Array.from(opts).sort((a, b) => a - b);
  }, [pickerMode, recQty]);

  function defaultQuantity(): string | number {
    if (recQty) return recQty;
    if (pickerMode === 'loose-leaf') return 100;
    return 1;
  }

  function toggle() {
    setBasket(prev => {
      if (prev[item.id]) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      const startQty = defaultQuantity();
      return {
        ...prev,
        [item.id]: {
          quantity: startQty,
          note: '',
          outOfStock: oos,
          pickerMode,
          productName: item.product_name || 'Unknown tea',
          recommendedPriceUsd: priceForQty(Number(startQty)),
        },
      };
    });
  }

  function setQuantity(qty: string | number) {
    setBasket(prev => {
      if (!prev[item.id]) return prev;
      return {
        ...prev,
        [item.id]: { ...prev[item.id], quantity: qty, recommendedPriceUsd: priceForQty(Number(qty)) },
      };
    });
  }

  function setNote(note: string) {
    setBasket(prev => {
      if (!prev[item.id]) return prev;
      return { ...prev, [item.id]: { ...prev[item.id], note } };
    });
  }

  function adjustStepper(delta: number) {
    const current = Number(entry?.quantity ?? 1);
    const max = pickerMode === 'cake-brick' ? 10 : 5;
    setQuantity(Math.min(max, Math.max(1, current + delta)));
  }

  const qty = entry?.quantity ?? defaultQuantity();

  return {
    oos, pickerMode, entry, isSelected, recQty, recPrice, description, qty,
    gramOptions, unitLabel, priceForQty, toggle, setQuantity, setNote, adjustStepper,
  };
}

// ── Amount + cost summary ────────────────────────────────────────────────────
// Sits ABOVE the Add action. Shows the amount the recipient will get and the
// cost at that amount. Before selection it reflects the recommended/default
// amount; once added it tracks the chosen quantity.

const unitWord = (mode: PickerMode, n: number) =>
  mode === 'loose-leaf' ? 'g'
    : mode === 'cake-brick' ? (n === 1 ? 'cake' : 'cakes')
    : (n === 1 ? 'unit' : 'units');

const AmountCost: React.FC<{
  ctl: ReturnType<typeof useItemControls>;
  className?: string;
  /** The card's price line: smaller, no "recommended" word. */
  compact?: boolean;
}> = ({ ctl, className = '', compact }) => {
  const { pickerMode, recQty, isSelected, qty, priceForQty } = ctl;
  // Amount shown: the live chosen qty when selected, else the recommended/default.
  const shownQty = isSelected ? Number(qty) : (recQty ?? (pickerMode === 'loose-leaf' ? 100 : 1));
  const price = priceForQty(shownQty);
  const amountLabel = `${shownQty}${pickerMode === 'loose-leaf' ? 'g' : ' ' + unitWord(pickerMode, shownQty)}`;
  return (
    <div className={`flex items-baseline flex-wrap gap-x-2 gap-y-1 ${className}`}>
      <span className={`font-body ${compact ? 'text-ui-14' : 'text-ui-15'} text-tea-text`}>{amountLabel}</span>
      {price != null && (
        <span className={`font-body ${compact ? 'text-ui-14' : 'text-ui-15'} text-tea-gold`}>
          · {fmtUsd(price)} <span className="text-ui-11 text-tea-text-dim">USD</span>
        </span>
      )}
      {!compact && !isSelected && recQty != null && (
        <span className="label-caps text-tea-text-dim">recommended</span>
      )}
    </div>
  );
};

// ── Quantity picker ──────────────────────────────────────────────────────────

const QuantityPicker: React.FC<{ ctl: ReturnType<typeof useItemControls> }> = ({ ctl }) => {
  const { pickerMode, qty, gramOptions, setQuantity, adjustStepper } = ctl;
  if (pickerMode === 'loose-leaf') {
    return (
      <div className="flex flex-wrap gap-2" role="group" aria-label="Amount">
        {gramOptions.map(g => (
          <button
            key={g}
            onClick={() => setQuantity(g)}
            aria-pressed={qty === g}
            className={`tap-target px-3 py-1.5 rounded text-ui-12 font-medium transition-colors ${
              qty === g
                ? 'bg-tea-gold/[0.15] text-tea-gold'
                : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'
            }`}
          >
            {g}g
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => adjustStepper(-1)}
        disabled={Number(qty) <= 1}
        aria-label="Decrease amount"
        className="tap-target w-8 h-8 flex items-center justify-center rounded border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/[0.4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Minus size={12} />
      </button>
      <span className="font-mono text-ui-14 text-tea-text w-8 text-center tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button
        onClick={() => adjustStepper(1)}
        disabled={Number(qty) >= (pickerMode === 'cake-brick' ? 10 : 5)}
        aria-label="Increase amount"
        className="tap-target w-8 h-8 flex items-center justify-center rounded border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/[0.4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Plus size={12} />
      </button>
      <span className="font-sans text-ui-12 text-tea-text-dim">
        {unitWord(pickerMode, Number(qty))}
      </span>
    </div>
  );
};

// ── Item action controls (amount/cost → picker → Add / decline) ──────────────
// The decision unit. Amount + cost on top, then (once added) the quantity
// control, then the explicit Add / Remove choice.

const ItemControls: React.FC<{
  ctl: ReturnType<typeof useItemControls>;
  /** When set, an extra "Add & next" button appears that adds then advances. */
  onAddAndNext?: () => void;
}> = ({ ctl, onAddAndNext }) => {
  const { oos, isSelected, toggle } = ctl;

  return (
    <div className="flex flex-col gap-4">
      {/* Amount + cost, always shown for in-stock, above the action */}
      {!oos && <AmountCost ctl={ctl} />}

      {/* Once added: let them change how much they actually want */}
      {isSelected && !oos && <QuantityPicker ctl={ctl} />}

      {/* The decision */}
      {oos ? (
        <button
          onClick={toggle}
          aria-pressed={isSelected}
          className={`tap-target inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-ui-12 font-medium tracking-[0.3px] transition-colors self-start ${
            isSelected
              ? 'border border-tea-gold/60 text-tea-gold bg-tea-gold/[0.06]'
              : 'border border-tea-border text-tea-text-sec hover:text-tea-text'
          }`}
        >
          {isSelected ? <Check size={12} /> : <Bell size={12} />}
          {isSelected ? 'On the waitlist' : 'Notify me when it’s back'}
        </button>
      ) : isSelected ? (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-ui-12 font-medium text-tea-gold">
            <Check size={13} /> Added
          </span>
          <button
            onClick={toggle}
            className="tap-target text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggle}
            className="btn-primary tap-target"
          >
            <Plus size={13} /> Add
          </button>
          {onAddAndNext && (
            <button
              onClick={() => { toggle(); onAddAndNext(); }}
              className="tap-target inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-ui-12 font-medium tracking-[0.3px] border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/[0.4] transition-colors"
            >
              Add & next <ChevronRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const CatalogEntry: React.FC<{
  item: PublicCollectionItem;
  basket: BasketState;
  setBasket: React.Dispatch<React.SetStateAction<BasketState>>;
  curatorFirstName: string;
  onOpenDetail: () => void;
}> = ({ item, basket, setBasket, curatorFirstName, onOpenDetail }) => {
  const ctl = useItemControls(item, basket, setBasket);
  const { oos, isSelected, toggle } = ctl;
  const writing = useLinkTeaWriting(teaSourceOf(item));
  const { ref, shown } = useScrollReveal<HTMLLIElement>();
  const meta = linkTeaMetaLine({ ...teaSourceOf(item), year: item.year });
  const name = item.product_name || 'Untitled tea';
  const photo = item.images?.[0] ?? item.image_url ?? null;
  // The card's own words: the curator's note leads where there is one, then
  // the tea's Wisdom writing, then the shop's description.
  const lead = writing.lead || ctl.description || null;

  return (
    <li
      ref={ref}
      id={`entry-${item.id}`}
      data-testid="collection-tea-card"
      className={`scroll-mt-6 min-w-0 transition-[opacity,transform] duration-700 ease-out ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <article className="flex h-full flex-col">
        {/* A tea with no photo shows no picture: the words take the width. */}
        {photo && (
          <button
            type="button"
            onClick={onOpenDetail}
            aria-haspopup="dialog"
            aria-label={`Open ${name}`}
            className="group mb-3 block w-full overflow-hidden rounded-md"
          >
            <LinkTeaPhoto
              src={photo}
              dim={oos}
              className="aspect-square w-full rounded-md transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </button>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="font-display text-ui-20 font-medium leading-tight text-tea-text">
            <button type="button" onClick={onOpenDetail} aria-haspopup="dialog" className="text-left transition-colors hover:text-tea-gold">
              {name}
            </button>
          </h2>
          {item.chinese_name && (
            <p className="mt-0.5 font-body text-ui-13 italic text-tea-text-sec" lang="zh">{item.chinese_name}</p>
          )}
          {meta && (
            <p className="mt-1.5 font-sans text-ui-12 uppercase tracking-[0.04em] text-tea-text-sec">{meta}</p>
          )}
          {oos && (
            <p className="label-caps text-tea-text-sec mt-2 inline-flex items-center gap-1.5">
              <AlertCircle size={10} /> currently unavailable
            </p>
          )}

          {item.item_note?.trim() && (
            <p className="mt-3 font-body text-ui-14 leading-[1.6] italic text-tea-text">
              “{item.item_note.trim()}”
              <span className="not-italic text-tea-text-dim text-ui-12">, {curatorFirstName}</span>
            </p>
          )}

          {lead && (
            <p className="mt-3 font-body text-ui-14 leading-[1.65] text-tea-text-sec line-clamp-3">{lead}</p>
          )}

          <button
            type="button"
            onClick={onOpenDetail}
            aria-haspopup="dialog"
            className="tap-target mt-2 inline-flex items-center gap-1 self-start font-sans text-ui-12 text-tea-text-sec transition-colors hover:text-tea-gold"
          >
            Open the tea <ArrowRight size={11} />
          </button>
        </div>

        {/* The price and the one action, on the card the way the shop's row
            carries its price beside its name. Changing the amount happens in
            the tea's own card. */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-tea-border pt-3">
          {oos ? <span className="font-body text-ui-14 text-tea-text-sec">Not available now</span> : <AmountCost ctl={ctl} compact />}
          {isSelected ? (
            <button type="button" onClick={toggle} className="tap-target inline-flex items-center gap-1.5 text-ui-12 font-medium text-tea-gold" aria-label={`Remove ${name} from your picks`}>
              <Check size={13} /> {oos ? 'On the waitlist' : 'Added'}
            </button>
          ) : oos ? (
            <button type="button" onClick={toggle} className="tap-target inline-flex items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text">
              <Bell size={12} /> Tell me when it’s back
            </button>
          ) : (
            <button type="button" onClick={toggle} className="btn-primary tap-target" aria-label={`Add ${name}`}>
              <Plus size={13} /> Add
            </button>
          )}
        </div>
      </article>
    </li>
  );
};

/** What the shared tea parts read from a collection item. */
function teaSourceOf(item: PublicCollectionItem): LinkTeaSource {
  return {
    productId: item.product_id,
    name: item.product_name,
    type: item.product_type,
    form: item.form,
    originRegion: item.origin_region,
    originCountry: item.origin_country,
  };
}

// ── The open tea: the shop's card plus this link's footer and writing ─────────

type CollectionTea = PublicCollectionItem & LinkTeaDetailFields;

/** The collection tea as the shop's card reads it. The quoted price sets the per-gram price. */
function collectionTeaItem(item: PublicCollectionItem): InventoryItem {
  const tea = item as CollectionTea;
  const qty = Number(item.recommended_quantity);
  const price = item.recommended_price_usd != null ? Number(item.recommended_price_usd) : null;
  return linkTeaInventoryItem({
    ...teaSourceOf(item),
    ...tea,
    chineseName: item.chinese_name,
    year: item.year,
    image: item.image_url,
    images: item.images,
    pricePerGramUsd: price != null && Number.isFinite(qty) && qty > 0 && getPickerMode(item) === 'loose-leaf' ? price / qty : null,
    soldOut: item.out_of_stock,
  });
}

/** Under About on the shop's card: the curator's note, then the tea's Wisdom entry. */
const PickWriting: React.FC<{ item: PublicCollectionItem; curatorFirstName: string }> = ({ item, curatorFirstName }) => {
  const writing = useLinkTeaWriting(teaSourceOf(item));
  const note = item.item_note?.trim();
  if (!note && !writing.entry && writing.passages.passages.length === 0) return null;
  return (
    <div className="alcove-body-section mt-7 flex flex-col gap-5" data-testid="collection-tea-writing">
      {note && (
        <p className="font-body text-ui-15 leading-[1.7] text-tea-text italic">
          “{note}”
          <span className="not-italic text-tea-text-dim text-ui-12">, {curatorFirstName}</span>
        </p>
      )}
      <LinkTeaEntry writing={writing} className="border-t border-tea-border pt-5" />
    </div>
  );
};

/** The card's footer on a link: amount, price, Add to these picks. */
const PickFooter: React.FC<{
  item: PublicCollectionItem;
  basket: BasketState;
  setBasket: React.Dispatch<React.SetStateAction<BasketState>>;
  selectedCount: number;
  onReview: () => void;
}> = ({ item, basket, setBasket, selectedCount, onReview }) => {
  const ctl = useItemControls(item, basket, setBasket);
  return (
    <div className="shrink-0 border-t border-tea-border bg-tea-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]" data-testid="collection-pick-footer">
      <ItemControls ctl={ctl} />
      {selectedCount > 0 && (
        <div className="mt-4 pt-3 border-t border-tea-border flex items-center justify-between gap-3">
          <span className="font-sans text-ui-12 text-tea-text-sec">
            <span className="text-tea-gold font-medium">{selectedCount}</span>{' '}
            {selectedCount === 1 ? 'tea in your picks' : 'teas in your picks'}
          </span>
          <button
            onClick={onReview}
            className="tap-target inline-flex items-center gap-1 font-sans text-ui-12 font-medium text-tea-gold hover:text-tea-gold-lt transition-colors"
          >
            Review picks <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

// ── Basket review ────────────────────────────────────────────────────────────
// A reviewable summary before confirming: each pick (amount, cost, remove), the
// total, and an optional note for the whole order. So the recipient sees exactly
// what they're sending, fewer surprise corrections for the curator.

const BasketReview: React.FC<{
  items: PublicCollectionItem[];
  basket: BasketState;
  setBasket: React.Dispatch<React.SetStateAction<BasketState>>;
  note: string;
  setNote: (v: string) => void;
  quotedTotal: number;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ items, basket, setBasket, note, setNote, quotedTotal, onClose, onConfirm }) => {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const selectedIds = Object.keys(basket);
  const byId = useMemo(() => Object.fromEntries(items.map(it => [it.id, it])), [items]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  function removeOne(id: string) {
    setBasket(prev => { const next = { ...prev }; delete next[id]; return next; });
  }

  return (
    <div className="fixed inset-0 z-panel-modal flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label="Review your picks">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 z-panel-backdrop bg-tea-bg/80 backdrop-blur-[2px] animate-[fadeIn_180ms_ease-out]" />

      <div className="relative z-panel-modal w-full sm:max-w-[460px] max-h-[88vh] bg-tea-surface border-tea-border flex flex-col overflow-hidden rounded-t-xl sm:rounded-xl border-t sm:border animate-[panelInUp_240ms_cubic-bezier(0.22,1,0.36,1)]">
        <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-tea-border">
          <button ref={closeRef} onClick={onClose} className="tap-target text-tea-text-sec hover:text-tea-text transition-colors" aria-label="Close">
            <X size={18} />
          </button>
          <h2 className="font-display text-ui-17 text-tea-text">Your picks</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ul className="flex flex-col divide-y divide-tea-border">
            {selectedIds.map(id => {
              const entry = basket[id];
              const it = byId[id];
              const oos = entry.outOfStock;
              const unit = entry.pickerMode === 'loose-leaf' ? 'g' : ' ' + unitWord(entry.pickerMode as PickerMode, Number(entry.quantity));
              return (
                <li key={id} className="flex items-start gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-ui-15 text-tea-text truncate">{it?.product_name || entry.productName}</p>
                    <p className="font-sans text-ui-12 text-tea-text-sec mt-0.5">
                      {oos ? 'Asking about availability' : (
                        <>
                          {entry.quantity}{unit}
                          {entry.recommendedPriceUsd != null && (
                            <span className="text-tea-gold"> · {fmtUsd(Number(entry.recommendedPriceUsd))}</span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => removeOne(id)}
                    className="tap-target text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors shrink-0"
                    aria-label={`Remove ${it?.product_name || 'item'}`}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>

          {quotedTotal > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-tea-border">
              <span className="label-caps text-tea-text-dim">Total</span>
              <span className="font-body text-ui-17 text-tea-gold">
                {fmtUsd(quotedTotal)} <span className="text-ui-11 text-tea-text-dim">USD</span>
              </span>
            </div>
          )}

          <div className="mt-5">
            <label className="label-caps text-tea-text-dim block mb-2">Anything for the order?</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="A question, a preference, a gift note…"
              rows={2}
              className="input-warm w-full px-3 py-2 text-ui-13 leading-[1.5] resize-none"
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-tea-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
          <button onClick={onClose} className="tap-target text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors">
            Keep browsing
          </button>
          <button
            onClick={onConfirm}
            disabled={selectedIds.length === 0}
            className="btn-primary"
          >
            <Check size={13} /> Confirm picks
          </button>
        </div>
      </div>
    </div>
  );
};
