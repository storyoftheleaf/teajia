import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AlertCircle, Check, MessageCircle, Minus, Plus, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { buildWhatsAppUrl, buildCollectionBasketMessage } from '../lib/whatsapp';
import type { PublicCollectionResponse, PublicCollectionItem } from '../types';

const ROMAN = [
  '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX',
];

function toRoman(n: number): string {
  if (n <= 30) return ROMAN[n] || String(n);
  return String(n);
}

// ── Picker mode ──────────────────────────────────────────────────────────────

type PickerMode = 'loose-leaf' | 'cake-brick' | 'teaware' | 'misc';

function getPickerMode(item: PublicCollectionItem): PickerMode {
  const t = (item.product_type || '').toLowerCase();
  if (t === 'teaware') return 'teaware';
  if (t === 'misc') return 'misc';
  if (t === 'sheng' || t === 'shou' || t === 'dark') return 'cake-brick';
  return 'loose-leaf';
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
    } catch { /* private mode — skip */ }
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
    } catch { /* private mode — still attempt once */ }
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
              ? 'The link may have been taken down. Ask Adrian directly for a new one.'
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
  // First name (or store) for the inline "X suggests…" recommendation lines.
  const curatorFirstName = (curatorName?.trim().split(/\s+/)[0]) || storeName;

  const visible = useMemo(
    () => items.filter(i => i.product_status === 'Active'),
    [items]
  );

  const slug = data.publication.slug;
  const [basket, setBasket] = useState<BasketState>({});
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
    });

    window.open(buildWhatsAppUrl(account?.whatsapp_number ?? '', message), '_blank');
  }

  function handleConfirmClick() {
    if (confirmState === 'sending' || selectedCount === 0) return;
    // First click: reveal the contact step.
    if (confirmState === 'idle') {
      setConfirmState('contact');
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
      await api.collections.confirmPicks(slug, {
        picks: selectedIds.map(id => ({
          item_id: id,
          quantity: Math.max(1, Math.round(Number(basket[id].quantity) || 1)),
          note: basket[id].note || undefined,
        })),
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
      {/* Masthead — editorial; small label, big title, italic note */}
      <header className="border-b border-tea-border">
        <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-10 pt-12 pb-10 md:pt-20 md:pb-14">
          <p className="label-caps text-tea-text-dim mb-5">
            A collection from <span className="text-tea-text-sec">{storeName}</span>
          </p>
          <h1 className="h1 text-tea-text mb-6">
            {collection.title}
          </h1>
          {collection.note && (
            <p className="body-prose text-tea-text-sec italic max-w-[55ch]">
              {collection.note}
            </p>
          )}
          {curatorName && (
            <p className="subtitle text-tea-text-sec mt-4">
              Curated by {curatorName}.
            </p>
          )}
          {collection.hero_image_url && (
            <figure className="mt-10 -mx-4 md:-mx-6 lg:mx-0">
              <img
                src={collection.hero_image_url}
                alt=""
                className="w-full max-h-[50vh] object-cover lg:rounded-md"
                loading="eager"
              />
            </figure>
          )}
        </div>
      </header>

      {/* Catalog body */}
      <section className={`max-w-3xl mx-auto px-4 md:px-6 lg:px-10 py-10 md:py-16 ${selectedCount > 0 ? 'pb-40' : 'pb-16'}`}>
        {visible.length === 0 ? (
          <p className="font-body text-ui-15 leading-[1.65] text-tea-text-sec italic py-10 text-center">
            The teas in this collection are currently unavailable.
          </p>
        ) : (
          <ol className="flex flex-col gap-14 md:gap-20">
            {visible.map((item, i) => (
              <CatalogEntry
                key={item.id}
                item={item}
                index={i + 1}
                basket={basket}
                setBasket={setBasket}
                curatorFirstName={curatorFirstName}
              />
            ))}
          </ol>
        )}
      </section>

      <footer className="border-t border-tea-border py-10 text-center">
        <p className="label-caps text-tea-text-dim">
          {storeName} · Curated for you
        </p>
      </footer>

      {/* Sticky basket footer — only visible when ≥1 item selected. This page is a
          focused standalone route (no app bottom nav), so it sits flush at the
          bottom with safe-area padding. */}
      {selectedCount > 0 && confirmState !== 'sent' && (
        <div className="fixed left-0 right-0 bottom-0 bg-tea-surface border-t border-tea-border z-40 px-4 md:px-6 lg:px-10 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Contact step: revealed after first "Confirm" click */}
          {confirmState === 'contact' || confirmState === 'sending' ? (
            <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
              <p className="font-sans text-ui-11 text-tea-text-dim">
                Your name lets {storeName} know who to reach out to.
              </p>
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
                    className="inline-flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg rounded-md text-ui-12 font-medium tracking-[0.3px] hover:bg-tea-gold-lt disabled:opacity-60 transition-colors"
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
                  <span className="text-tea-text-dim"> · ${Math.round(quotedTotal * 100) / 100}</span>
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg rounded-md text-ui-12 font-medium tracking-[0.3px] hover:bg-tea-gold-lt transition-colors"
                >
                  <Check size={13} />
                  Confirm my picks
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sent confirmation — replaces the action bar once the picks are in. */}
      {confirmState === 'sent' && (
        <div className="fixed left-0 right-0 bottom-0 bg-tea-surface border-t border-tea-border z-40 px-4 md:px-6 lg:px-10 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-2.5 text-center">
          <Check size={15} className="text-tea-gold shrink-0" />
          <p className="font-body text-ui-13 leading-[1.5] text-tea-text">
            Your picks are with {storeName}. They’ll be in touch to finish your order.
          </p>
        </div>
      )}
    </main>
  );
};

// ── One entry ────────────────────────────────────────────────────────────────

const LOOSE_LEAF_GRAM_OPTIONS = [25, 50, 100, 200];

const CatalogEntry: React.FC<{
  item: PublicCollectionItem;
  index: number;
  basket: BasketState;
  setBasket: React.Dispatch<React.SetStateAction<BasketState>>;
  curatorFirstName: string;
}> = ({ item, index, basket, setBasket, curatorFirstName }) => {
  const oos = item.out_of_stock;
  const tastingList = Array.isArray(item.tasting_notes) ? item.tasting_notes : [];
  const origin = [item.origin_region, item.origin_country].filter(Boolean).join(', ');

  const pickerMode = getPickerMode(item);
  const entry = basket[item.id];
  const isSelected = Boolean(entry);

  // Curator's recommendation, if any.
  const recQty = (() => {
    const n = Number(item.recommended_quantity);
    return item.recommended_quantity != null && Number.isFinite(n) && n > 0 ? n : null;
  })();
  const recPrice = item.recommended_price_usd != null ? Number(item.recommended_price_usd) : null;

  // Price scales with the chosen amount. The quoted price is FOR the recommended
  // quantity, so we derive a per-unit rate and multiply by the chosen qty.
  // When recQty is absent we cannot compute a valid scaled total, so we return
  // null rather than show a misleading per-unit estimate.
  function priceForQty(q: number): number | null {
    if (recPrice === null || recQty === null) return null;
    return Math.round((recPrice / recQty) * q * 100) / 100;
  }

  // Gram buttons for loose-leaf: standard options plus the curator's recommended
  // amount injected (and sorted) so the recipient sees it as a selectable choice.
  const gramOptions = useMemo(() => {
    const opts = new Set(LOOSE_LEAF_GRAM_OPTIONS);
    if (pickerMode === 'loose-leaf' && recQty) opts.add(recQty);
    return Array.from(opts).sort((a, b) => a - b);
  }, [pickerMode, recQty]);

  function defaultQuantity(): string | number {
    if (recQty) return recQty;
    if (pickerMode === 'loose-leaf') return 50;
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
        [item.id]: {
          ...prev[item.id],
          quantity: qty,
          recommendedPriceUsd: priceForQty(Number(qty)),
        },
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
    const next = Math.min(max, Math.max(1, current + delta));
    setQuantity(next);
  }

  const qty = entry?.quantity ?? defaultQuantity();

  return (
    <li className="flex flex-col gap-5">
      <div className="flex items-baseline gap-4">
        <span className="font-display text-ui-17 tabular-nums tracking-[0.05em] text-tea-gold" style={{ fontWeight: 500 }}>
          {toRoman(index)}.
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="h2 text-tea-text">
            {item.product_name}
            {item.chinese_name && (
              <span className="block sm:inline font-body italic text-ui-15 sm:ml-3 text-tea-text-sec mt-1 sm:mt-0" style={{ fontWeight: 300 }}>
                {item.chinese_name}
              </span>
            )}
          </h2>
          {(origin || item.year) && (
            <p className="label-caps text-tea-text-dim mt-2">
              {[origin, item.year].filter(Boolean).join(' · ')}
              {oos && (
                <span className="ml-3 inline-flex items-center gap-1 text-tea-text-sec">
                  <AlertCircle size={10} /> currently unavailable
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {item.image_url && (
        <figure className="pl-[42px]">
          <img
            src={item.image_url}
            alt=""
            className="block w-full max-w-[420px] rounded-md"
            loading="lazy"
          />
        </figure>
      )}

      <div className="pl-[42px] max-w-[60ch]">
        {item.description && (
          <p className="font-body text-ui-15 leading-[1.75] text-tea-text mb-4">
            {item.description}
          </p>
        )}

        {tastingList.length > 0 && (
          <p className="label-caps text-tea-text-sec mb-5">
            {tastingList.slice(0, 6).join(' · ')}
          </p>
        )}

        <Link
          to={`/shop/product/${item.product_id}`}
          className="inline-flex items-center gap-1 font-sans text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors mb-5"
        >
          About this tea <ArrowRight size={11} />
        </Link>

        {/* Curator's recommendation — shown only when recQty is present so the
            amount + price context is always complete. A bare price with no qty
            would be ambiguous, so we omit the line when recQty is absent. */}
        {recQty != null && (
          <p className="font-body text-ui-14 leading-[1.6] text-tea-gold italic mb-5">
            {curatorFirstName} suggests{' '}
            {recQty}{pickerMode === 'loose-leaf' ? 'g' : (recQty === 1 ? (pickerMode === 'cake-brick' ? ' cake' : ' unit') : (pickerMode === 'cake-brick' ? ' cakes' : ' units'))}
            {recPrice != null && (
              <span className="text-tea-text-sec not-italic"> · ${Math.round(recPrice * 100) / 100}</span>
            )}
          </p>
        )}

        {/* Want this toggle */}
        <button
          onClick={toggle}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-ui-12 font-medium tracking-[0.3px] transition-colors ${
            isSelected
              ? 'border border-tea-gold text-tea-gold bg-tea-gold/[0.06]'
              : 'border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/[0.4]'
          }`}
        >
          {isSelected && <Check size={12} />}
          {isSelected ? 'Selected' : 'Want this'}
        </button>

        {/* Quantity + note — only when selected */}
        {isSelected && (
          <div className="mt-4 flex flex-col gap-3">
            {/* OOS note */}
            {oos && (
              <p className="font-sans text-ui-11 text-tea-text-dim italic">
                Currently out of stock. Requesting availability.
              </p>
            )}

            {/* Quantity picker — skip for OOS */}
            {!oos && (
              <>
                {pickerMode === 'loose-leaf' && (
                  <div className="flex flex-wrap gap-2">
                    {gramOptions.map(g => (
                      <button
                        key={g}
                        onClick={() => setQuantity(g)}
                        className={`px-3 py-1.5 rounded text-ui-11 font-medium transition-colors ${
                          qty === g
                            ? 'bg-tea-gold/[0.15] text-tea-gold'
                            : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
                        }`}
                      >
                        {g}g
                      </button>
                    ))}
                  </div>
                )}

                {(pickerMode === 'cake-brick' || pickerMode === 'teaware' || pickerMode === 'misc') && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => adjustStepper(-1)}
                      disabled={Number(qty) <= 1}
                      className="w-7 h-7 flex items-center justify-center rounded border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/[0.4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="font-mono text-ui-13 text-tea-text w-8 text-center tabular-nums">
                      {qty}
                    </span>
                    <button
                      onClick={() => adjustStepper(1)}
                      disabled={Number(qty) >= (pickerMode === 'cake-brick' ? 10 : 5)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/[0.4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={11} />
                    </button>
                    <span className="font-sans text-ui-11 text-tea-text-dim">
                      {pickerMode === 'cake-brick'
                        ? (Number(qty) === 1 ? 'cake' : 'cakes')
                        : (Number(qty) === 1 ? 'unit' : 'units')}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Live price for the chosen amount — updates as the picker changes. */}
            {!oos && priceForQty(Number(qty)) != null && (
              <p className="font-body text-ui-14 text-tea-text">
                {qty}{pickerMode === 'loose-leaf' ? 'g' : (Number(qty) === 1 ? (pickerMode === 'cake-brick' ? ' cake' : ' unit') : (pickerMode === 'cake-brick' ? ' cakes' : ' units'))}
                <span className="text-tea-gold"> · ${priceForQty(Number(qty))}</span>
              </p>
            )}

            {/* Per-item note */}
            <input
              type="text"
              value={entry?.note ?? ''}
              onChange={e => setNote(e.target.value)}
              placeholder="Anything to add?"
              className="input-warm w-full max-w-[300px] px-3 py-2 text-ui-13 leading-[1.5]"
            />
          </div>
        )}
      </div>
    </li>
  );
};
