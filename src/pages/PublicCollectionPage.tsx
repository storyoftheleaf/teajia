import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AlertCircle, Check, MessageCircle, Minus, Plus } from 'lucide-react';
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
          <p className="font-display text-[clamp(24px,3.5vw,32px)] leading-snug text-tea-text mb-3" style={{ fontWeight: 500 }}>
            {status === 'gone' ? 'This collection has been put away.' : 'Not found.'}
          </p>
          <p className="font-body text-ui-15 leading-loose text-tea-text-sec italic">
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
        <p className="text-sm text-red-400">Something went wrong loading this page.</p>
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

  const visible = useMemo(
    () => items.filter(i => i.product_status === 'Active'),
    [items]
  );

  const [basket, setBasket] = useState<BasketState>({});

  const selectedIds = Object.keys(basket);
  const selectedCount = selectedIds.length;

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

  return (
    <main className="min-h-screen bg-tea-bg text-tea-text">
      {/* Masthead — editorial; small label, big title, italic note */}
      <header className="border-b border-tea-border">
        <div className="max-w-[720px] mx-auto px-5 sm:px-8 pt-12 pb-10 md:pt-20 md:pb-14">
          <p className="font-sans text-ui-11 uppercase tracking-[1.5px] text-tea-text-dim mb-5">
            A collection from <span className="text-tea-text-sec">{storeName}</span>
          </p>
          <h1
            className="font-display text-[clamp(32px,6vw,56px)] leading-[1.08] tracking-[-0.005em] text-tea-text mb-6"
            style={{ fontWeight: 400 }}
          >
            {collection.title}
          </h1>
          {collection.note && (
            <p className="font-body text-ui-17 leading-reading text-tea-text-sec italic max-w-[55ch]">
              {collection.note}
            </p>
          )}
          {curatorName && (
            <p className="font-body text-ui-14 leading-loose text-tea-text-sec italic mt-4">
              Curated by {curatorName}.
            </p>
          )}
          {collection.hero_image_url && (
            <figure className="mt-10 -mx-5 sm:mx-0">
              <img
                src={collection.hero_image_url}
                alt=""
                className="w-full max-h-[50vh] object-cover sm:rounded-md"
                loading="eager"
              />
            </figure>
          )}
        </div>
      </header>

      {/* Catalog body */}
      <section className={`max-w-[720px] mx-auto px-5 sm:px-8 py-10 md:py-16 ${selectedCount > 0 ? 'pb-nav-gap-lg' : 'pb-nav-gap'}`}>
        {visible.length === 0 ? (
          <p className="font-body text-ui-15 leading-loose text-tea-text-sec italic py-10 text-center">
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
              />
            ))}
          </ol>
        )}
      </section>

      <footer className="border-t border-tea-border py-10 text-center">
        <p className="font-sans text-ui-10 uppercase tracking-[1.8px] text-tea-text-dim">
          {storeName} · Curated for you
        </p>
      </footer>

      {/* Sticky basket footer — only visible when ≥1 item selected */}
      {selectedCount > 0 && (
        <div className="fixed left-0 right-0 bottom-nav bg-tea-surface border-t border-tea-border z-40 px-5 sm:px-8 py-3 flex items-center justify-between gap-4">
          <p className="font-sans text-ui-12 text-tea-text-sec">
            <span className="text-tea-gold font-medium">{selectedCount}</span>{' '}
            {selectedCount === 1 ? 'item' : 'items'} selected
          </p>
          <button
            onClick={handleSendPicks}
            className="inline-flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg rounded-md text-ui-12 font-medium tracking-[0.3px] hover:bg-tea-gold-lt transition-colors"
          >
            <MessageCircle size={13} />
            Send my picks
          </button>
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
}> = ({ item, index, basket, setBasket }) => {
  const oos = item.out_of_stock;
  const tastingList = Array.isArray(item.tasting_notes) ? item.tasting_notes : [];
  const origin = [item.origin_region, item.origin_country].filter(Boolean).join(', ');

  const pickerMode = getPickerMode(item);
  const entry = basket[item.id];
  const isSelected = Boolean(entry);

  function defaultQuantity(): string | number {
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
      return {
        ...prev,
        [item.id]: {
          quantity: defaultQuantity(),
          note: '',
          outOfStock: oos,
          pickerMode,
          productName: item.product_name || 'Unknown tea',
        },
      };
    });
  }

  function setQuantity(qty: string | number) {
    setBasket(prev => {
      if (!prev[item.id]) return prev;
      return { ...prev, [item.id]: { ...prev[item.id], quantity: qty } };
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
          <h2
            className="font-display text-[clamp(22px,3.2vw,28px)] leading-snug tracking-[-0.005em] text-tea-text"
            style={{ fontWeight: 400 }}
          >
            {item.product_name}
            {item.chinese_name && (
              <span className="block sm:inline font-body italic text-ui-15 sm:ml-3 text-tea-text-sec mt-1 sm:mt-0" style={{ fontWeight: 300 }}>
                {item.chinese_name}
              </span>
            )}
          </h2>
          {(origin || item.year) && (
            <p className="font-sans text-ui-10 uppercase tracking-[1.5px] text-tea-text-dim mt-2">
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
            className="block w-full max-w-[420px] rounded-sm"
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
          <p className="font-sans text-ui-11 uppercase tracking-[1.3px] text-tea-text-sec mb-5">
            {tastingList.slice(0, 6).join(' · ')}
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
                    {LOOSE_LEAF_GRAM_OPTIONS.map(g => (
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
