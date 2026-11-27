import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Check, Minus, Plus, ArrowRight, Share2, Link2, Bookmark, MessageCircle, ShoppingBag } from 'lucide-react';
import { api } from '../lib/api';
import { buildWhatsAppUrl } from '../lib/whatsapp';
import { useAppStore } from '../lib/store';
import type { PublicCollectionResponse, PublicCollectionItem, InventoryItem } from '../types';
import { authPagePath } from '../lib/authNavigation';
import {
  LinkTeaEntry, linkTeaInventoryItem, useLinkTeaWriting,
  type LinkTeaDetailFields, type LinkTeaSource,
} from '../components/shop/linkTea';
import { AlcoveModal } from '../components/shop/AlcoveModal';
import { TeaLedgerRow } from '../components/shop/TeaLedger';

/**
 * A collection link: the shop, filtered down to the teas someone chose for you
 * (Adrian, 2026-11-27: "like an Amazon wish list"). It sits inside the shop,
 * with the shop's rail and bottom bar, and its teas are the shop's own rows.
 * Add puts a tea in the shop's cart at the price this link quoted, and the
 * shop's own checkout turns the order into an invoice. The head says plainly
 * that this was made for you, so nobody feels lost in the shop.
 */

export type AddFromLink = (
  item: InventoryItem,
  grams: number,
  totalUsd: number,
  link: { storeSlug: string; storeName: string; collectionSlug: string },
) => void;

// ── How a suggested amount is counted ────────────────────────────────────────

type PickerMode = 'loose-leaf' | 'cake-brick' | 'teaware' | 'misc';

/** Mirrors worker/src/collectionCart.ts collectionQuantityUnit. */
function getPickerMode(item: PublicCollectionItem): PickerMode {
  const t = (item.product_type || '').toLowerCase();
  if (t === 'teaware') return 'teaware';
  if (t === 'misc') return 'misc';
  // Pu'er and dark tea count by the piece only when the tea is a pressed piece
  // and the suggested amount reads as pieces. A loose tea, or a suggestion
  // of 50, is grams: "50 cakes" was never what a curator meant.
  const form = (item.form || '').toLowerCase();
  if (form.includes('loose')) return 'loose-leaf';
  const rec = Number(item.recommended_quantity);
  if (Number.isFinite(rec) && rec > 10) return 'loose-leaf';
  if (t === 'sheng' || t === 'shou' || t === 'dark') return 'cake-brick';
  return 'loose-leaf';
}

// Collection prices are quoted in USD; the tag keeps the amount unambiguous.
const fmtUsd = (n: number) => {
  const cents = Math.round(n * 100);
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
};

const LOOSE_LEAF_GRAM_OPTIONS = [25, 50, 100, 200];

// ── Page shell ───────────────────────────────────────────────────────────────

interface CartHooks {
  onAddToCart?: AddFromLink;
  onOpenCart?: () => void;
}

const PublicCollectionPage: React.FC<CartHooks> = ({ onAddToCart, onOpenCart }) => {
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

  // A signed-in visitor keeps the collection: it goes onto their shelf as
  // 'received' the moment they open the link. Best-effort, once per slug.
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
      <CollectionShelf data={data} onAddToCart={onAddToCart} onOpenCart={onOpenCart} />
    </>
  );
};

export default PublicCollectionPage;

// ── The shelf ────────────────────────────────────────────────────────────────

interface LinkContext extends CartHooks {
  slug: string;
  storeSlug: string;
  storeName: string;
  title: string;
  whatsapp: string;
}

const CollectionShelf: React.FC<{ data: PublicCollectionResponse } & CartHooks> = ({ data, onAddToCart, onOpenCart }) => {
  const { collection, items, account } = data;
  const storeName = account?.name ?? 'Teajia';
  const curatorName = collection.curator_display_name;
  const signedIn = (() => { try { return !!(localStorage.getItem('teajia_token') || sessionStorage.getItem('teajia_token')); } catch { return false; } })();
  const curatorFirstName = (curatorName?.trim().split(/\s+/)[0]) || storeName;
  const visible = useMemo(() => items.filter(i => i.product_status === 'Active'), [items]);
  const slug = data.publication.slug;
  const [detailId, setDetailId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  const ctx: LinkContext = {
    slug,
    storeSlug: account?.slug || 'teajia-bali',
    storeName,
    title: collection.title,
    whatsapp: account?.whatsapp_number ?? '',
    onAddToCart,
    onOpenCart,
  };

  // The strip that keeps "made for you" in sight once the head scrolls away.
  const headRef = useRef<HTMLElement | null>(null);
  const [headGone, setHeadGone] = useState(false);
  useEffect(() => {
    const el = headRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setHeadGone(!entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: collection.title, url }); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2000);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="text-tea-text">
      {headGone && (
        <div className="sticky top-0 z-30 border-b border-tea-border bg-tea-bg" data-testid="collection-strip">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-10 py-2.5 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate font-sans text-ui-12 text-tea-text-sec">
              <span className="text-tea-gold">Made for you</span>
              <span className="text-tea-text-dim"> · </span>
              <span className="text-tea-text">{collection.title}</span>
            </p>
            <Link to="/shop" className="tap-target shrink-0 inline-flex items-center gap-1 font-sans text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors">
              Whole shop <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-10 pt-6 md:pt-10">
        <nav aria-label="Where you are" className="flex flex-wrap items-center gap-x-2 gap-y-1 label-caps text-tea-text-sec mb-4">
          <Link to="/shop" className="tap-target hover:text-tea-text transition-colors">{storeName} shop</Link>
          <span aria-hidden="true" className="text-tea-text-dim">/</span>
          <span>Made for you</span>
        </nav>

        {/* The head is set apart from the shop: a panel of its own, saying who
            chose these teas. */}
        <header ref={headRef} className="rounded-md border border-tea-border bg-tea-elevated px-5 py-6 md:px-8 md:py-8" data-testid="collection-head">
          <p className="label-caps text-tea-gold mb-3">Chosen for you by {curatorName || storeName}</p>
          <h1 className="h1 text-tea-text mb-3 max-w-[22ch]">{collection.title}</h1>
          {collection.note && <p className="body-prose text-tea-text-sec italic max-w-[56ch]">{collection.note}</p>}
          <p className="mt-3 font-sans text-ui-12 text-tea-text-sec">
            {`${visible.length} ${visible.length === 1 ? 'tea' : 'teas'} from the shop`}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
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
              onClick={handleShare}
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
          {collection.hero_image_url && (
            <img src={collection.hero_image_url} alt="" className="mt-6 w-full max-h-[46vh] object-cover rounded-md" loading="eager" />
          )}
        </header>
      </div>

      <section aria-label="The teas" className="max-w-6xl mx-auto px-4 md:px-6 lg:px-10 pt-4 pb-10">
        {visible.length === 0 ? (
          <p className="font-body text-ui-15 leading-[1.65] text-tea-text-sec italic py-10 text-center">
            The teas in this collection are currently unavailable.
          </p>
        ) : (
          <ul className="flex flex-col">
            {visible.map(item => (
              <ShelfEntry
                key={item.id}
                item={item}
                ctx={ctx}
                amount={amounts[item.id]}
                onOpen={() => setDetailId(item.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* The open tea is the shop's own card. Its footer is this link's: the
          amount, the link's price, and Add to cart. The tea's Wisdom entry
          sits under About, the one thing this link adds. */}
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
                <CardFooter
                  item={it}
                  ctx={ctx}
                  amount={amounts[it.id]}
                  setAmount={n => setAmounts(prev => ({ ...prev, [it.id]: n }))}
                  onOpenCart={onOpenCart ? () => { setDetailId(null); onOpenCart(); } : undefined}
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
    </div>
  );
};

// ── One tea: its amount, its price, and adding it to the cart ────────────────

function useLinkTea(item: PublicCollectionItem, ctx: LinkContext, chosen?: number) {
  const mode = getPickerMode(item);
  const recQty = (() => {
    const n = Number(item.recommended_quantity);
    return item.recommended_quantity != null && Number.isFinite(n) && n > 0 ? n : null;
  })();
  const recPrice = item.recommended_price_usd != null ? Number(item.recommended_price_usd) : null;
  const qty = chosen ?? recQty ?? (mode === 'loose-leaf' ? 50 : 1);
  const price = recPrice != null && recQty != null ? Math.round((recPrice / recQty) * qty * 100) / 100 : null;
  const piece = Number(item.piece_weight_g);
  const grams = mode === 'loose-leaf' ? qty : mode === 'cake-brick' && piece > 0 ? qty * piece : null;
  const amountLabel = mode === 'loose-leaf' ? `${qty}g` : `${qty} ${mode === 'cake-brick' ? (qty === 1 ? 'cake' : 'cakes') : (qty === 1 ? 'piece' : 'pieces')}`;
  const inCart = useAppStore(s => s.publicCart.some(line => line.id === item.product_id && line.collectionSlug === ctx.slug));
  // The cart takes a tea when the link prices it by weight. Anything else (a
  // cake of unknown weight, teaware, a tea out of stock) is asked about instead.
  const canCart = !!ctx.onAddToCart && !item.out_of_stock && item.product_id != null
    && grams != null && price != null && recQty != null && recPrice != null;
  const name = item.product_name || 'Untitled tea';

  function add() {
    if (!canCart || grams == null || price == null || recPrice == null || recQty == null) return;
    const perGram = mode === 'loose-leaf' ? recPrice / recQty : recPrice / (recQty * piece);
    const base = collectionTeaItem(item);
    ctx.onAddToCart!({ ...base, price_per_gram: String(perGram), pieceWeightG: piece > 0 ? piece : undefined } as InventoryItem, grams, price, {
      storeSlug: ctx.storeSlug, storeName: ctx.storeName, collectionSlug: ctx.slug,
    });
  }

  const askUrl = buildWhatsAppUrl(ctx.whatsapp, `Hello, I'm looking at "${ctx.title}" and would like to ask about ${name}.`);
  return { mode, recQty, qty, price, amountLabel, inCart, canCart, add, askUrl, name, oos: item.out_of_stock };
}

type LinkTea = ReturnType<typeof useLinkTea>;

const PriceLine: React.FC<{ tea: LinkTea }> = ({ tea }) => (
  tea.oos ? <span className="font-body text-ui-14 text-tea-text-sec">Not available now</span> : (
    <span className="font-body text-ui-14 text-tea-text">
      {tea.amountLabel}
      {tea.price != null && <span className="text-tea-gold"> · {fmtUsd(tea.price)} <span className="text-ui-11 text-tea-text-dim">USD</span></span>}
    </span>
  )
);

const AddButton: React.FC<{ tea: LinkTea; small?: boolean }> = ({ tea, small }) => {
  if (tea.inCart) {
    return (
      <span className="inline-flex items-center gap-1.5 text-ui-12 font-medium text-tea-gold" data-testid="collection-in-cart">
        <Check size={13} /> In your cart
      </span>
    );
  }
  if (!tea.canCart) {
    return (
      <a href={tea.askUrl} target="_blank" rel="noopener noreferrer" className={`btn-secondary tap-target${small ? ' btn-sm' : ''}`} aria-label={`Ask about ${tea.name}`}>
        <MessageCircle size={13} /> Ask
      </a>
    );
  }
  return (
    <button type="button" onClick={tea.add} className={`btn-primary tap-target${small ? ' btn-sm' : ''}`} aria-label={`Add ${tea.name} to cart`}>
      <Plus size={13} /> Add
    </button>
  );
};

const ShelfEntry: React.FC<{ item: PublicCollectionItem; ctx: LinkContext; amount?: number; onOpen: () => void }> = ({ item, ctx, amount, onOpen }) => {
  const tea = useLinkTea(item, ctx, amount);
  const writing = useLinkTeaWriting(teaSourceOf(item));
  const note = item.item_note?.trim() || null;
  return (
    <li id={`entry-${item.id}`} data-testid="collection-tea-card" className="min-w-0">
      <TeaLedgerRow
        item={{
          name: tea.name,
          year: item.year != null ? String(item.year) : '',
          type: item.product_type ?? '',
          origin: [item.origin_region, item.origin_country].filter(Boolean).join(', '),
          description: note ?? writing.lead ?? item.description ?? '',
        }}
        showType
        saved={false}
        onOpen={onOpen}
        openLabel={`Open ${tea.name}`}
        trailing={
          // The row opens the tea; adding here must not open it too.
          <div className="flex flex-col items-end gap-1.5 text-right" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            <PriceLine tea={tea} />
            <AddButton tea={tea} small />
          </div>
        }
      />
    </li>
  );
};

const CardFooter: React.FC<{
  item: PublicCollectionItem;
  ctx: LinkContext;
  amount?: number;
  setAmount: (n: number) => void;
  onOpenCart?: () => void;
}> = ({ item, ctx, amount, setAmount, onOpenCart }) => {
  const tea = useLinkTea(item, ctx, amount);
  const gramOptions = useMemo(() => {
    const opts = new Set(LOOSE_LEAF_GRAM_OPTIONS);
    if (tea.recQty) opts.add(tea.recQty);
    return Array.from(opts).sort((a, b) => a - b);
  }, [tea.recQty]);
  return (
    <div className="shrink-0 border-t border-tea-border bg-tea-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-3" data-testid="collection-pick-footer">
      {tea.canCart && !tea.inCart && (tea.mode === 'loose-leaf' ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Amount">
          {gramOptions.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setAmount(g)}
              aria-pressed={tea.qty === g}
              className={`tap-target px-3 py-1.5 rounded-md text-ui-12 font-medium transition-colors ${tea.qty === g ? 'bg-tea-accent-sub text-tea-gold' : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'}`}
            >
              {g}g
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setAmount(Math.max(1, tea.qty - 1))} disabled={tea.qty <= 1} aria-label="One fewer"
            className="tap-target w-8 h-8 flex items-center justify-center rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text disabled:opacity-30">
            <Minus size={12} />
          </button>
          <span className="font-mono text-ui-14 text-tea-text w-8 text-center tabular-nums" aria-live="polite">{tea.qty}</span>
          <button type="button" onClick={() => setAmount(Math.min(10, tea.qty + 1))} disabled={tea.qty >= 10} aria-label="One more"
            className="tap-target w-8 h-8 flex items-center justify-center rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text disabled:opacity-30">
            <Plus size={12} />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <PriceLine tea={tea} />
        <div className="flex items-center gap-3">
          {tea.inCart && onOpenCart && (
            <button type="button" onClick={onOpenCart} className="tap-target inline-flex items-center gap-1 text-ui-12 text-tea-text-sec hover:text-tea-text">
              <ShoppingBag size={13} /> Open cart
            </button>
          )}
          <AddButton tea={tea} />
        </div>
      </div>
    </div>
  );
};

// ── The tea as the shop's card reads it ──────────────────────────────────────

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
    <div className="alcove-body-section mx-5 mt-7 flex flex-col gap-5" data-testid="collection-tea-writing">
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
