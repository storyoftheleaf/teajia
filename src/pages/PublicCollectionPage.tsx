import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AlertCircle, Check, MessageCircle, Minus, Plus, Loader2, ArrowRight, Bell, X, ChevronLeft, ChevronRight, Share2, Link2, Bookmark } from 'lucide-react';
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
import { TeaLedgerRow } from '../components/shop/TeaLedger';

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
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <p className="text-sm text-tea-text-dim">Loading…</p>
      </div>
    );
  }

  if (status === 'notfound' || status === 'gone') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 text-center">
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
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <p className="text-sm text-tea-error">Something went wrong loading this page.</p>
      </div>
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

/**
 * Three looks for Adrian to choose between (2026-11-27). The one he picks
 * stays and the switch goes.
 *  shelf:  the shop's own tea rows, one under the other.
 *  cards:  even cards, words first, a small photo where there is one.
 *  letter: the curator's letter beside a reading list of the teas.
 */
type CollectionLook = 'shelf' | 'cards' | 'letter';
function useCollectionLook(): CollectionLook {
  const [params] = useSearchParams();
  const look = params.get('look');
  return look === 'cards' || look === 'letter' ? look : 'shelf';
}

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
  const look = useCollectionLook();

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

  const empty = (
    <p className="font-body text-ui-15 leading-[1.65] text-tea-text-sec italic py-10 text-center">
      The teas in this collection are currently unavailable.
    </p>
  );
  const bottomRoom = selectedCount > 0 ? 'pb-40' : 'pb-10';

  return (
    <div className="text-tea-text" data-collection-look={look}>
      {look === 'letter' ? (
        <div className={`max-w-6xl mx-auto px-4 md:px-6 lg:px-10 pt-6 md:pt-10 ${bottomRoom} lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14`}>
          <div className="lg:sticky lg:top-10 lg:self-start">
            <CollectionHead storeName={storeName} title={collection.title} note={collection.note} curatorName={curatorName}
          count={visible.length} slug={slug} signedIn={signedIn} shareState={shareState} onShare={handleShare} heroUrl={collection.hero_image_url} letter />
          </div>
          <section aria-label="The teas" className="mt-8 lg:mt-0">
            {visible.length === 0 ? empty : (
              <ul className="flex flex-col divide-y divide-tea-border border-t border-tea-border lg:border-t-0">
                {visible.map(item => (
                  <LetterEntry key={item.id} item={item}
                basket={basket}
                setBasket={setBasket}
                curatorFirstName={curatorFirstName}
                onOpenDetail={() => setDetailId(item.id)} />
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <>
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-10 pt-6 md:pt-10">
            <CollectionHead storeName={storeName} title={collection.title} note={collection.note} curatorName={curatorName}
          count={visible.length} slug={slug} signedIn={signedIn} shareState={shareState} onShare={handleShare} heroUrl={collection.hero_image_url} />
          </div>
          <section aria-label="The teas" className={`max-w-6xl mx-auto px-4 md:px-6 lg:px-10 pt-6 md:pt-8 ${bottomRoom}`}>
            {visible.length === 0 ? empty : look === 'shelf' ? (
              <ul className="flex flex-col">
                {visible.map(item => (
                  <ShelfEntry key={item.id} item={item}
                basket={basket}
                setBasket={setBasket}
                curatorFirstName={curatorFirstName}
                onOpenDetail={() => setDetailId(item.id)} />
                ))}
              </ul>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map(item => (
                  <CardEntry key={item.id} item={item}
                basket={basket}
                setBasket={setBasket}
                curatorFirstName={curatorFirstName}
                onOpenDetail={() => setDetailId(item.id)} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* The picks bar, only once something is chosen. It floats above the
          shop's bottom bar on a phone and beside the rail on the desk. */}
      {selectedCount > 0 && confirmState !== 'sent' && (
        <div className="fixed left-3 right-3 bottom-nav-gap lg:bottom-6 lg:left-[calc(var(--teajia-sidebar-w)+2.5rem)] lg:right-10 rounded-md bg-tea-surface border border-tea-border shadow-lg z-40 px-4 py-3">
          {/* Contact step: revealed after first "Confirm" click */}
          {confirmState === 'contact' || confirmState === 'sending' ? (
            <div className="w-full flex flex-col gap-2.5">
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
            <div className="w-full flex items-center justify-between gap-3">
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
        <div className="fixed left-3 right-3 bottom-nav-gap lg:bottom-6 lg:left-[calc(var(--teajia-sidebar-w)+2.5rem)] lg:right-10 rounded-md bg-tea-surface border border-tea-border shadow-lg z-40 px-4 py-3.5 flex items-center justify-center gap-2.5 text-center">
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
    </div>
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

// ── The head: where you are in the shop, the title, the curator's note ───────

const CollectionHead: React.FC<{
  storeName: string;
  title: string;
  note?: string | null;
  curatorName?: string | null;
  count: number;
  slug: string;
  signedIn: boolean;
  shareState: 'idle' | 'copied';
  onShare: () => void;
  heroUrl?: string | null;
  /** The letter look: the head is a column of its own beside the teas. */
  letter?: boolean;
}> = ({ storeName, title, note, curatorName, count, slug, signedIn, shareState, onShare, heroUrl, letter }) => (
  <header className={letter ? 'border-b border-tea-border pb-8 lg:border-0 lg:pb-0' : 'border-b border-tea-border pb-8'}>
    <nav aria-label="Where you are" className="flex flex-wrap items-center gap-x-2 gap-y-1 label-caps text-tea-text-sec mb-5">
      <Link to="/shop" className="tap-target hover:text-tea-text transition-colors">{storeName} shop</Link>
      <span aria-hidden="true" className="text-tea-text-dim">/</span>
      <span>A collection</span>
    </nav>
    <h1 className={`${letter ? 'h1' : 'h1 max-w-[22ch]'} text-tea-text mb-4`}>{title}</h1>
    {note && <p className="body-prose text-tea-text-sec italic max-w-[56ch]">{note}</p>}
    <p className="mt-4 font-sans text-ui-12 text-tea-text-sec">
      {[curatorName ? `Chosen by ${curatorName}` : null, `${count} ${count === 1 ? 'tea' : 'teas'}`].filter(Boolean).join(' · ')}
    </p>
    <div className={`mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 ${letter ? 'lg:flex-col lg:items-start' : ''}`}>
      {signedIn ? (
        <span className="inline-flex items-center gap-1.5 font-sans text-ui-12 text-tea-text-sec" data-testid="collection-kept">
          <Check size={13} className="text-tea-gold" /> Kept in your account
        </span>
      ) : slug ? (
        <Link to={authPagePath('signup', `/c/${slug}`)} className="btn-secondary btn-sm" data-testid="collection-account-offer">
          <Bookmark size={13} /> Keep it in a free account
        </Link>
      ) : null}
      <button
        type="button"
        onClick={onShare}
        className="tap-target inline-flex items-center gap-1.5 font-sans text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
        aria-label="Share this collection"
      >
        {shareState === 'copied'
          ? (<><Link2 size={13} className="text-tea-gold" /> Link copied</>)
          : (<><Share2 size={13} /> Share</>)}
      </button>
      <Link to="/shop" className="tap-target inline-flex items-center gap-1 font-sans text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors">
        See the whole shop <ArrowRight size={12} />
      </Link>
    </div>
    {heroUrl && (
      <figure className="mt-8 -mx-4 md:-mx-6 lg:mx-0">
        <img src={heroUrl} alt="" className="w-full max-h-[46vh] object-cover lg:rounded-md" loading="eager" />
      </figure>
    )}
  </header>
);

// ── One tea's price and its one action ───────────────────────────────────────

const EntryAction: React.FC<{
  ctl: ReturnType<typeof useItemControls>;
  name: string;
  /** The shelf row: price over the button, both to the right. */
  stacked?: boolean;
}> = ({ ctl, name, stacked }) => {
  const { oos, isSelected, toggle } = ctl;
  const button = isSelected ? (
    <button type="button" onClick={toggle} className="tap-target inline-flex items-center gap-1.5 text-ui-12 font-medium text-tea-gold" aria-label={`Remove ${name} from your picks`}>
      <Check size={13} /> {oos ? 'On the waitlist' : 'Added'}
    </button>
  ) : oos ? (
    <button type="button" onClick={toggle} className="tap-target inline-flex items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text">
      <Bell size={12} /> Tell me when it’s back
    </button>
  ) : (
    <button type="button" onClick={toggle} className={`btn-primary tap-target${stacked ? ' btn-sm' : ''}`} aria-label={`Add ${name}`}>
      <Plus size={13} /> Add
    </button>
  );
  const price = oos
    ? <span className="font-body text-ui-14 text-tea-text-sec">Not available now</span>
    : <AmountCost ctl={ctl} compact className={stacked ? 'justify-end' : ''} />;
  return stacked ? (
    <div className="flex flex-col items-end gap-1.5 text-right">{price}{button}</div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">{price}{button}</div>
  );
};

interface EntryProps {
  item: PublicCollectionItem;
  basket: BasketState;
  setBasket: React.Dispatch<React.SetStateAction<BasketState>>;
  curatorFirstName: string;
  onOpenDetail: () => void;
}

/** What every look reads from one tea. */
function useEntry({ item, basket, setBasket }: EntryProps) {
  const ctl = useItemControls(item, basket, setBasket);
  const writing = useLinkTeaWriting(teaSourceOf(item));
  return {
    ctl,
    name: item.product_name || 'Untitled tea',
    photo: item.images?.[0] ?? item.image_url ?? null,
    meta: linkTeaMetaLine({ ...teaSourceOf(item), year: item.year }),
    note: item.item_note?.trim() || null,
    lead: writing.lead || ctl.description || null,
  };
}

const CuratorNote: React.FC<{ note: string; who: string; className?: string }> = ({ note, who, className = '' }) => (
  <span className={`block font-body text-ui-14 leading-[1.6] italic text-tea-text ${className}`}>
    “{note}”<span className="not-italic text-tea-text-dim text-ui-12">, {who}</span>
  </span>
);

// ── Look one, shelf: the shop's own tea row ──────────────────────────────────

const ShelfEntry: React.FC<EntryProps> = props => {
  const { item, onOpenDetail } = props;
  const { ctl, name, note, lead } = useEntry(props);
  return (
    <li id={`entry-${item.id}`} data-testid="collection-tea-card" className="min-w-0">
      <TeaLedgerRow
        item={{
          name,
          year: item.year != null ? String(item.year) : '',
          type: item.product_type ?? '',
          origin: [item.origin_region, item.origin_country].filter(Boolean).join(', '),
          description: note ?? lead ?? '',
        }}
        showType
        saved={false}
        onOpen={onOpenDetail}
        openLabel={`Open ${name}`}
        trailing={
          // The row opens the tea; choosing here must not open it too.
          <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            <EntryAction ctl={ctl} name={name} stacked />
          </div>
        }
      />
    </li>
  );
};

// ── Look two, cards: even cards, words first ─────────────────────────────────

const CardEntry: React.FC<EntryProps> = props => {
  const { item, curatorFirstName, onOpenDetail } = props;
  const { ctl, name, photo, meta, note, lead } = useEntry(props);
  return (
    <li id={`entry-${item.id}`} data-testid="collection-tea-card" className="min-w-0">
      <article className="flex h-full flex-col rounded-md border border-tea-border bg-tea-surface p-4 transition-colors hover:border-tea-gold">
        <button type="button" onClick={onOpenDetail} aria-haspopup="dialog" className="group flex flex-1 flex-col text-left">
          <span className="flex items-start gap-3">
            <span className="min-w-0 flex-1">
              <span className="block font-display text-ui-20 font-medium leading-tight text-tea-text group-hover:text-tea-gold transition-colors">{name}</span>
              {item.chinese_name && <span lang="zh" className="mt-0.5 block font-body text-ui-13 italic text-tea-text-sec">{item.chinese_name}</span>}
              {meta && <span className="mt-1.5 block font-sans text-ui-12 uppercase tracking-[0.04em] text-tea-text-sec">{meta}</span>}
            </span>
            {photo && <LinkTeaPhoto src={photo} dim={ctl.oos} className="h-16 w-16 shrink-0 rounded-md" />}
          </span>
          {note && <CuratorNote note={note} who={curatorFirstName} className="mt-3" />}
          {lead && <span className="mt-3 block font-body text-ui-14 leading-[1.65] text-tea-text-sec line-clamp-3">{lead}</span>}
          <span className="mt-auto pt-3 inline-flex items-center gap-1 font-sans text-ui-12 text-tea-text-sec">
            Open the tea <ArrowRight size={11} />
          </span>
        </button>
        <div className="mt-4 border-t border-tea-border pt-3">
          <EntryAction ctl={ctl} name={name} />
        </div>
      </article>
    </li>
  );
};

// ── Look three, letter: a reading list beside the curator's letter ───────────

const LetterEntry: React.FC<EntryProps> = props => {
  const { item, curatorFirstName, onOpenDetail } = props;
  const { ctl, name, photo, meta, note, lead } = useEntry(props);
  return (
    <li id={`entry-${item.id}`} data-testid="collection-tea-card" className="min-w-0 py-6 lg:first:pt-0">
      <article className="flex gap-4 sm:gap-5">
        {photo && (
          <button type="button" onClick={onOpenDetail} aria-haspopup="dialog" aria-label={`Open ${name}`} className="shrink-0 self-start overflow-hidden rounded-md">
            <LinkTeaPhoto src={photo} dim={ctl.oos} className="h-24 w-24 sm:h-28 sm:w-28 rounded-md" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-ui-22 font-medium leading-tight text-tea-text">
            <button type="button" onClick={onOpenDetail} aria-haspopup="dialog" className="text-left transition-colors hover:text-tea-gold">{name}</button>
          </h2>
          {item.chinese_name && <p lang="zh" className="mt-0.5 font-body text-ui-13 italic text-tea-text-sec">{item.chinese_name}</p>}
          {meta && <p className="mt-1.5 font-sans text-ui-12 uppercase tracking-[0.04em] text-tea-text-sec">{meta}</p>}
          {note && <CuratorNote note={note} who={curatorFirstName} className="mt-3" />}
          {lead && <p className="mt-3 font-body text-ui-15 leading-[1.7] text-tea-text-sec line-clamp-4">{lead}</p>}
          <button type="button" onClick={onOpenDetail} aria-haspopup="dialog" className="tap-target mt-2 inline-flex items-center gap-1 font-sans text-ui-12 text-tea-text-sec transition-colors hover:text-tea-gold">
            Open the tea <ArrowRight size={11} />
          </button>
          <div className="mt-3">
            <EntryAction ctl={ctl} name={name} />
          </div>
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
