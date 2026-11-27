import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Plus, ArrowRight, Share2, Link2, Bookmark, MessageCircle, ShoppingBag } from 'lucide-react';
import { TeaCup } from '../components/TeaCupIcon';
import { api } from '../lib/api';
import { buildWhatsAppUrl } from '../lib/whatsapp';
import { useAppStore } from '../lib/store';
import type { PublicCollectionResponse, PublicCollectionItem, InventoryItem } from '../types';
import { authPagePath } from '../lib/authNavigation';
import {
  LinkTeaEntry, linkTeaInventoryItem, useLinkTeaWriting,
  type LinkTeaDetailFields, type LinkTeaSource,
} from '../components/shop/linkTea';
import { LinkTeaPage } from '../components/shop/LinkTeaPage';
import { ChooseTeaLine, GuideRow, GuideStep, ListTasting } from '../components/shop/GuideStep';
import { holdKeepTeaser } from '../lib/keepTeaser';
import { holdReturnPlace, useReturnPlace } from '../hooks/useReturnPlace';
import { useOpenLinkTea } from '../components/shop/useOpenLinkTea';
import { CurrencySelect } from '../components/shop/CurrencySelect';
import { TeaLedger, type TeaLedgerGroup } from '../components/shop/TeaLedger';
import { weighOptions, startingIndex, type WeighOption } from '../components/shop/TeaWeighControl';
import { useShopPrice } from '../components/shop/shopPrice';
import { TEA_PRICING } from '../lib/teaPricing';

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
  link: { storeSlug: string; storeName: string; collectionSlug: string; quoted: boolean },
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
  const collectionTopLine = collection.title;
  const visible = useMemo(() => items.filter(i => i.product_status === 'Active'), [items]);
  const slug = data.publication.slug;
  const { openId: openTea, open: openLinkTea, move: moveLinkTea, close: closeLinkTea } = useOpenLinkTea();
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const shopPrice = useShopPrice();
  const favoriteTeas = useAppStore(s => s.favoriteTeas);
  const toggleFavoriteTea = useAppStore(s => s.toggleFavoriteTea);
  const favoriteIds = useMemo(() => new Set(favoriteTeas), [favoriteTeas]);

  // The shop's rows, grouped by type as the shop groups them, in the order the
  // curator first put each type.
  const byProduct = useMemo(() => new Map(visible.map(it => [it.product_id, it])), [visible]);
  const shelfItems = useMemo(() => visible.map(linkShelfItem), [visible]);
  const groups = useMemo<TeaLedgerGroup[]>(() => {
    const order: string[] = [];
    const byType = new Map<string, InventoryItem[]>();
    for (const tea of shelfItems) {
      const type = tea.type || 'Tea';
      if (!byType.has(type)) { byType.set(type, []); order.push(type); }
      byType.get(type)!.push(tea);
    }
    return order.map(type => ({ type, items: byType.get(type)! }));
  }, [shelfItems]);

  function addFromLink(item: PublicCollectionItem, grams: number, totalUsd: number) {
    if (!onAddToCart) return;
    onAddToCart(linkShelfItem(item), grams, totalUsd, {
      storeSlug: account?.slug || 'teajia-bali', storeName, collectionSlug: slug, quoted: !!item.price_quoted,
    });
  }

  const ctx: LinkContext = {
    slug,
    storeSlug: account?.slug || 'teajia-bali',
    storeName,
    title: collection.title,
    whatsapp: account?.whatsapp_number ?? '',
    onAddToCart,
    onOpenCart,
  };

  // The guide's Keep and Taste. Signed in, the collection is already kept (the
  // page marks it received), so Keep is done; signed out, either goes through
  // joining, which shows these teas, and Taste comes back asking which one.
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const teaList = useRef<HTMLElement | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [tasting, setTasting] = useState<InventoryItem | null>(null);
  const cartCount = useAppStore(state => state.publicCart.length);
  const startChoosing = () => { setChoosing(true); teaList.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const join = (thenChoose = false) => {
    holdKeepTeaser({ path: `/c/${slug}`, from: curatorFirstName, teas: visible.map(it => ({ name: linkShelfItem(it).name })) });
    // Back to exactly here: the same tea open, if one is, and as far down the list.
    holdReturnPlace();
    const back = new URLSearchParams(params);
    if (thenChoose) back.set('choose', '1');
    const query = back.toString();
    navigate(authPagePath('signup', `/c/${slug}${query ? `?${query}` : ''}`));
  };
  const cameBackToChoose = signedIn && params.get('choose') === '1';
  useReturnPlace(!cameBackToChoose);
  useEffect(() => {
    if (!cameBackToChoose) return;
    const next = new URLSearchParams(params);
    next.delete('choose');
    setParams(next, { replace: true });
    startChoosing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameBackToChoose]);

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

      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-10 pt-3 md:pt-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <nav aria-label="Where you are" className="flex flex-wrap items-center gap-x-2 gap-y-1 label-caps text-tea-text-sec">
            <Link to="/shop" className="tap-target hover:text-tea-text transition-colors">{storeName} shop</Link>
            <span aria-hidden="true" className="text-tea-text-dim">/</span>
            <span>Made for you</span>
          </nav>
          <CurrencySelect />
        </div>

        {/* The head is set apart from the shop, a panel of its own saying who
            chose these teas, and kept short so the teas start on the first screen. */}
        <header ref={headRef} className="flex items-start gap-4 rounded-md border border-tea-border bg-tea-elevated px-4 py-4 md:px-6 md:py-5" data-testid="collection-head">
          <div className="min-w-0 flex-1">
            <p className="label-caps text-tea-gold mb-1.5">Chosen for you by {curatorName || storeName}<span className="text-tea-text-sec">{` · ${visible.length} ${visible.length === 1 ? 'tea' : 'teas'}`}</span></p>
            <h1 className="font-display text-ui-26 leading-[1.1] text-tea-text">{collection.title}</h1>
            {collection.note && <p className="mt-1.5 font-body text-ui-14 leading-[1.5] text-tea-text-sec italic max-w-[64ch]">{collection.note}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 font-sans text-ui-12 text-tea-text-sec">
              <button
                type="button"
                onClick={handleShare}
                className="tap-target inline-flex items-center gap-1.5 hover:text-tea-text transition-colors"
                aria-label="Share this collection"
              >
                {shareState === 'copied'
                  ? (<><Link2 size={13} className="text-tea-gold" /> Link copied</>)
                  : (<><Share2 size={13} /> Share</>)}
              </button>
            </div>
          </div>
          {collection.hero_image_url && (
            <img src={collection.hero_image_url} alt="" className="h-20 w-20 shrink-0 rounded-md object-cover md:h-24 md:w-24" loading="eager" />
          )}
        </header>
        {visible.length > 0 && (
          <GuideRow testId="collection-guide">
            <GuideStep label={signedIn ? 'Kept' : 'Keep'} done={signedIn} lit={!signedIn} icon={<Bookmark size={20} aria-hidden="true" />} onClick={() => { if (signedIn) navigate('/account/collections'); else join(); }} testId="collection-guide-keep" />
            <GuideStep label="Taste" lit={signedIn} icon={<TeaCup size={20} aria-hidden="true" />} onClick={() => { if (signedIn) startChoosing(); else join(true); }} testId="collection-guide-taste" />
            <GuideStep label="Order" icon={<ShoppingBag size={20} aria-hidden="true" />} onClick={() => { if (cartCount > 0 && onOpenCart) onOpenCart(); else teaList.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} testId="collection-guide-order" />
          </GuideRow>
        )}
      </div>

      <section ref={teaList} aria-label="The teas" className="max-w-6xl mx-auto scroll-mt-4 px-4 md:px-6 lg:px-10 pt-2 pb-10">
        {choosing && <ChooseTeaLine onCancel={() => setChoosing(false)} />}
        <ListTasting tea={tasting} onClose={() => setTasting(null)} />
        {visible.length === 0 ? (
          <p className="font-body text-ui-15 leading-[1.65] text-tea-text-sec italic py-10 text-center">
            The teas in this collection are currently unavailable.
          </p>
        ) : (
          <TeaLedger
            groups={groups}
            activeType="All"
            specialFilter="None"
            tastingCounts={new Map()}
            priceWeight={50}
            formatPrice={shopPrice.symbolTotal}
            favoriteIds={favoriteIds}
            onToggleFavorite={(id, event) => {
              event.stopPropagation();
              // Signed out, a save first gets them an account, then lands them back on this row with it saved.
              const saving = !favoriteIds.has(id);
              toggleFavoriteTea(id);
              if (saving && !signedIn) join();
            }}
            onOpenProduct={tea => { const it = byProduct.get(tea.id); if (!it) return; if (choosing) { setTasting(tea); setChoosing(false); } else openLinkTea(it.product_id); }}
            onAddToCart={onAddToCart ? (tea, grams, total) => { const it = byProduct.get(tea.id); if (it) addFromLink(it, grams, total); } : undefined}
            weighOptionsFor={tea => { const it = byProduct.get(tea.id); return it ? linkWeighOptions(it) : undefined; }}
          />
        )}
      </section>

      {/* The open tea is the shop's own tea page, everything written for it in
          the store. Its footer is this link's: the amount, the link's price,
          and Add to cart. The sender's note sits above it. */}
      {openTea && (() => {
        // In the order the list shows them, so the arrows walk down the list.
        const order = groups.flatMap(group => group.items);
        const at = order.findIndex(c => c.id === openTea);
        const card = at >= 0 ? order[at] : undefined;
        const focused = card ? byProduct.get(card.id) : undefined;
        if (!focused || !card) return null;
        const before = order[at - 1];
        const after = order[at + 1];
        return (
          <LinkTeaPage
            item={card}
            onClose={closeLinkTea}
            footer={(
              <CardFooter
                item={focused}
                ctx={ctx}
                formatPrice={shopPrice.symbolTotal}
                onAdd={addFromLink}
                onOpenCart={onOpenCart ? () => { closeLinkTea(); onOpenCart(); } : undefined}
              />
            )}
            yoursLine={collectionTopLine}
            yoursNote={{ text: focused.item_note, by: curatorFirstName }}
            yoursNav={{
              index: at + 1,
              count: order.length,
              onPrev: before ? () => moveLinkTea(before.id) : undefined,
              onNext: after ? () => moveLinkTea(after.id) : undefined,
            }}
          />
        );
      })()}
    </div>
  );
};

// ── One tea: its amounts, its prices, and adding it to the cart ──────────────

/**
 * The amounts a tea can be added in from this link, and what each costs.
 *
 * A tea whose price the curator quoted keeps that price, scaled to the amount
 * and with no handling amount on top, exactly as the order prices it
 * (worker/src/collectionCart.ts). A blank quote follows the shop's own rule,
 * so those rows are the shop's rows to the cent. A cake counts in whole cakes
 * and needs its weight. Teaware and an out-of-stock tea are asked about.
 */
function linkWeighOptions(item: PublicCollectionItem): WeighOption[] | undefined {
  if (!item.price_quoted) return undefined;
  const mode = getPickerMode(item);
  const recQty = Number(item.recommended_quantity);
  const recPrice = Number(item.recommended_price_usd);
  if (item.out_of_stock || !Number.isFinite(recQty) || recQty <= 0 || !Number.isFinite(recPrice) || recPrice < 0) return [];
  if (mode === 'loose-leaf') {
    const rate = recPrice / recQty;
    const sizes = Array.from(new Set([...TEA_PRICING.sizesG, recQty])).sort((a, b) => a - b);
    return sizes.map(grams => ({ grams, totalUsd: Math.round(rate * grams * 100) / 100 }));
  }
  const piece = Number(item.piece_weight_g);
  if (mode !== 'cake-brick' || !(piece > 0)) return [];
  const rate = recPrice / (recQty * piece);
  return [1, 2, 3, 5].map(n => ({ grams: n * piece, totalUsd: Math.round(rate * n * piece * 100) / 100 }));
}

/** The tea as the shop's row and card read it: the link's rate where it quoted one. */
function linkShelfItem(item: PublicCollectionItem): InventoryItem {
  const base = collectionTeaItem(item);
  const piece = Number(item.piece_weight_g);
  const options = linkWeighOptions(item);
  const rate = options?.length ? options[0].totalUsd / options[0].grams : null;
  return {
    ...base,
    price_per_gram: rate != null ? String(rate) : base.price_per_gram,
    pieceWeightG: piece > 0 ? piece : undefined,
  } as InventoryItem;
}

const CardFooter: React.FC<{
  item: PublicCollectionItem;
  ctx: LinkContext;
  formatPrice: (usd: number) => string;
  onAdd: (item: PublicCollectionItem, grams: number, totalUsd: number) => void;
  onOpenCart?: () => void;
}> = ({ item, ctx, formatPrice, onAdd, onOpenCart }) => {
  const shelfItem = useMemo(() => linkShelfItem(item), [item]);
  const options = useMemo(() => linkWeighOptions(item) ?? weighOptions(shelfItem), [item, shelfItem]);
  const [index, setIndex] = useState(() => startingIndex(options, Number(item.recommended_quantity) || 50));
  const inCart = useAppStore(s => s.publicCart.some(line => line.id === item.product_id && line.collectionSlug === ctx.slug));
  const current = options[Math.min(index, options.length - 1)];
  const name = item.product_name || 'Untitled tea';
  const askUrl = buildWhatsAppUrl(ctx.whatsapp, `Hello, I'm looking at "${ctx.title}" and would like to ask about ${name}.`);
  return (
    <div className="shrink-0 border-t border-tea-border bg-tea-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-3" data-testid="collection-pick-footer">
      {current ? (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Amount">
            {options.map((option, i) => (
              <button
                key={option.grams}
                type="button"
                onClick={() => setIndex(i)}
                aria-pressed={i === index}
                className={`tap-target px-3 py-1.5 rounded-md text-ui-12 font-medium transition-colors ${i === index ? 'bg-tea-accent-sub text-tea-gold' : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'}`}
              >
                {option.grams}g
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span className="font-body text-ui-14 text-tea-text">
              {current.grams}g <span className="text-tea-gold">· {formatPrice(current.totalUsd)}</span>
            </span>
            <div className="flex items-center gap-3">
              {inCart && onOpenCart && (
                <button type="button" onClick={onOpenCart} className="tap-target inline-flex items-center gap-1 text-ui-12 text-tea-text-sec hover:text-tea-text">
                  <ShoppingBag size={13} /> Open cart
                </button>
              )}
              <button type="button" onClick={() => onAdd(item, current.grams, current.totalUsd)} className="btn-primary tap-target" aria-label={`Add ${current.grams}g of ${name} to cart`}>
                <Plus size={13} /> {inCart ? 'Add more' : 'Add to cart'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-body text-ui-14 text-tea-text-sec">{item.out_of_stock ? 'Not available now' : 'Ask for the price'}</span>
          <a href={askUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary tap-target" aria-label={`Ask about ${name}`}>
            <MessageCircle size={13} /> Ask
          </a>
        </div>
      )}
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

