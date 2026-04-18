import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '../context/InventoryContext';
import { useAppStore } from '../lib/store';
import { Icons } from '../components/Icons';
import { TeaPlaceholder } from '../components/shop/TeaPlaceholder';
import { HapticSlider } from '../components/shared/HapticSlider';
import { fmtPrice, fmtPricePerGram, fmtNum } from '../utils/formatNumber';
import { CardImage } from '../components/shared/CardImage';
import type { InventoryItem } from '../types';

/**
 * Full product detail page at /shop/product/:id
 * Shows hero image, tea info, description, tasting notes, pricing, and related teas.
 */

/** Converts a string to Title Case */
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function getStockStatus(stockG: number, isOneOfAKind?: boolean, isCurated?: boolean) {
  if (stockG <= 0) return { label: 'Sold Out', color: '#a65d4e', level: 'out' as const };
  if (isCurated) return { label: 'Curated Selection', color: '#c87533', level: 'limited' as const };
  if (isOneOfAKind) return { label: 'Curated Selection', color: '#c87533', level: 'limited' as const };
  if (stockG < 100) return { label: 'Low Stock', color: '#c09a51', level: 'low' as const };
  return { label: 'In Stock', color: '#5A6E5A', level: 'ok' as const };
}

interface ProductPageProps {
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
}

export const ProductPage: React.FC<ProductPageProps> = ({ onAddToCart }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { inventory } = useInventory();
  const { favoriteTeas, toggleFavoriteTea } = useAppStore();

  const item = useMemo(() => inventory.find(i => i.id === id), [inventory, id]);

  const [grams, setGrams] = useState(25);
  const [added, setAdded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

  // Related teas: same type, exclude current, max 4
  const relatedTeas = useMemo(() => {
    if (!item) return [];
    return inventory
      .filter(i => i.id !== item.id && i.type === item.type && i.category === item.category)
      .slice(0, 4);
  }, [inventory, item]);

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-[fadeIn_0.5s_ease-out]">
        <h1 className="text-4xl font-serif text-tea-gold mb-4">Not Found</h1>
        <p className="text-sm text-tea-text-sec mb-8 max-w-md">
          This product could not be found. It may have been removed or the link may be incorrect.
        </p>
        <Link
          to="/shop"
          className="px-8 py-3 bg-tea-gold text-white text-xs uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  const pricePerGram = parseFloat(item.price_per_gram || '0');
  const sliderMax = Math.max(25, Math.floor(item.stock_g || 500));
  const total = pricePerGram * grams;
  const stockStatus = getStockStatus(item.stock_g, item.isOneOfAKind, item.isCurated);
  const isSoldOut = stockStatus.level === 'out';
  const isFavorited = favoriteTeas.includes(item.id);
  const presets = [25, 50, 100, 250].filter(p => p <= sliderMax);

  const mainStory = item.lore || '';
  const introduction = item.description || '';
  const terroir = item.terroir || '';
  const processing = item.processingNotes || '';

  const handleAdd = () => {
    if (isSoldOut) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    if (onAddToCart) {
      onAddToCart(item, grams, Math.round(total * 100) / 100);
    }
  };

  // JSON-LD structured data for SEO (Product + Offer schema)
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.name,
    description: introduction || mainStory || `${item.type} tea from ${item.origin}`,
    image: item.image || undefined,
    brand: { '@type': 'Brand', name: 'Teajia' },
    category: item.category === 'ware' ? 'Teaware' : `${item.type} Tea`,
    ...(item.origin && { countryOfOrigin: { '@type': 'Country', name: item.origin } }),
    offers: {
      '@type': 'Offer',
      price: (pricePerGram * 50).toFixed(2), // Price per 50g serving
      priceCurrency: 'USD',
      availability: isSoldOut
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'Teajia' },
      url: `${window.location.origin}/shop/product/${item.id}`,
    },
  };

  return (
    <div className="max-w-4xl mx-auto animate-[fadeIn_0.5s_ease-out]">
      <Helmet>
        <title>{item.name} — Teajia</title>
        <meta name="description" content={(introduction || mainStory || `${item.type} tea from ${item.origin}`).slice(0, 160)} />
        <meta property="og:title" content={`${item.name} — Teajia`} />
        <meta property="og:description" content={(introduction || mainStory || '').slice(0, 160)} />
        {item.image && <meta property="og:image" content={item.image} />}
        <meta property="og:type" content="product" />
        <meta property="product:price:amount" content={(pricePerGram * 50).toFixed(2)} />
        <meta property="product:price:currency" content="USD" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      {/* Back link */}
      <div className="mb-6">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 text-tea-text-sec hover:text-tea-gold transition-colors text-sm"
        >
          <Icons.Back className="w-4 h-4" />
          <span className="uppercase tracking-[0.12em] text-xs">Back to Shop</span>
        </Link>
      </div>

      {/* Main content: two-column on desktop */}
      <div className="flex flex-col md:flex-row gap-8 md:gap-12">
        {/* Left: Hero image */}
        <div className="md:w-1/2 flex-shrink-0">
          <div className="relative aspect-square rounded-md overflow-hidden bg-tea-surface border border-tea-border">
            {item.image ? (
              <>
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <TeaPlaceholder type={item.type} style={{ width: '60%', height: '60%', opacity: 0.3 }} />
                  </div>
                )}
                <img
                  src={item.image}
                  alt={item.name}
                  className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setImageLoaded(true)}
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <TeaPlaceholder type={item.type} style={{ width: '50%', height: '50%' }} />
              </div>
            )}
          </div>

          {/* Additional images */}
          {item.additionalImages && item.additionalImages.length > 0 && (
            <div className="flex gap-2 mt-3">
              {item.additionalImages.slice(0, 4).map((img, i) => (
                <div key={i} className="w-16 h-16 rounded-sm overflow-hidden bg-tea-surface border border-tea-border flex-shrink-0">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product info */}
        <div className="md:w-1/2 flex flex-col">
          {/* Product name */}
          <h1 className="font-serif text-3xl md:text-4xl text-tea-text leading-snug mb-1">
            {item.variant || item.name}
          </h1>
          {/* Given name — always reserves space */}
          <p className={`font-serif text-lg italic text-tea-text-sec mb-1 min-h-[28px] ${
            item.variant && item.variant !== item.name ? 'visible' : 'invisible'
          }`}>
            {item.variant && item.variant !== item.name ? item.name : '\u00A0'}
          </p>
          {item.chineseName && (
            <p className="text-2xl text-tea-text-sec/30 mb-2" style={{ fontFamily: "'Ma Shan Zheng', cursive" }}>
              {item.chineseName}
            </p>
          )}

          {/* Tea type · origin · year */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] uppercase tracking-[0.15em] text-tea-text-sec bg-tea-accent-sub px-2.5 py-1 rounded-sm border border-tea-border">
              {item.type}
            </span>
            {item.origin && (
              <span className="text-[12px] italic text-tea-text-sec">
                {item.origin}
              </span>
            )}
            {item.year && (
              <>
                <span className="text-tea-text-sec/40">·</span>
                <span className="text-[12px] font-mono text-tea-text-sec">{item.year}</span>
              </>
            )}
          </div>


          {/* Tasting notes */}
          {item.tags && item.tags.length > 0 && (
            <div className="mb-4">
              <span className="text-[11px] uppercase tracking-[0.15em] text-tea-text-sec mb-2 block">
                Tasting Notes
              </span>
              <div className="flex flex-wrap gap-2">
                {item.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-3 py-1.5 rounded-sm bg-tea-accent-sub text-tea-text-sec border border-tea-border"
                  >
                    {toTitleCase(tag)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Mood tags */}
          {item.mood && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-1.5 justify-start">
                {(item.mood.includes(',') ? item.mood.split(',').map(t => t.trim()).filter(Boolean) : [item.mood]).map((tag, i) => (
                  <span
                    key={i}
                    className="font-serif text-xs italic px-2.5 py-1 rounded-sm bg-tea-accent-sub text-tea-text-sec border border-tea-border tracking-wide"
                  >
                    {toTitleCase(tag)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Experience — personal description */}
          {item.experience && (
            <p className="text-sm italic text-tea-text-sec mb-4 leading-relaxed whitespace-pre-line">
              {item.experience}
            </p>
          )}

          {/* Introduction — Adrian's personal curator note */}
          {introduction && (
            <p className="text-sm italic text-tea-text-sec leading-relaxed mb-5 whitespace-pre-line">
              {introduction}
            </p>
          )}

          {/* Lore — historical/cultural story */}
          {mainStory && (
            <p className="text-sm text-tea-text-sec leading-relaxed mb-5 whitespace-pre-line">
              {mainStory}
            </p>
          )}
          {terroir && (
            <div className="mb-5">
              <h3 className="text-[11px] uppercase tracking-[0.12em] text-tea-gold mb-1.5">Terroir</h3>
              <p className="text-sm text-tea-text-sec leading-relaxed whitespace-pre-line">{terroir}</p>
            </div>
          )}
          {processing && (
            <div className="mb-5">
              <h3 className="text-[11px] uppercase tracking-[0.12em] text-tea-gold mb-1.5">Processing</h3>
              <p className="text-sm text-tea-text-sec leading-relaxed whitespace-pre-line">{processing}</p>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-tea-border my-4" />

          {/* Pricing and stock */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: stockStatus.color }}
              />
              <span
                className="text-[11px] uppercase tracking-[0.08em]"
                style={{ color: stockStatus.color }}
              >
                {stockStatus.label}
              </span>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm text-tea-text-sec block">
                {fmtPricePerGram(pricePerGram)}
              </span>
              <span className="font-mono text-[11px] text-tea-text-dim">
                from {fmtPrice(pricePerGram * 25)} / 25g
              </span>
            </div>
          </div>

          {/* Quantity presets */}
          {!isSoldOut && presets.length > 1 && (
            <div className="flex gap-2 mb-3">
              {presets.map(p => (
                <button
                  key={p}
                  onClick={() => setGrams(p)}
                  className={`flex-1 py-1.5 text-xs font-mono rounded-sm border transition-all ${
                    grams === p
                      ? 'bg-tea-gold text-white border-tea-gold'
                      : 'bg-tea-accent-sub text-tea-text-sec border-tea-border hover:border-tea-gold/30'
                  }`}
                >
                  {p}g
                </button>
              ))}
            </div>
          )}

          {/* Slider */}
          {!isSoldOut && (
            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-1 px-0.5">
                <span className="font-mono text-sm text-tea-text">{fmtPrice(total)}</span>
                <span className="font-mono text-xs text-tea-text-sec">
                  {grams}<span className="text-[11px] text-tea-text-sec ml-0.5">g</span>
                </span>
              </div>
              <HapticSlider
                min={25}
                max={sliderMax}
                step={5}
                value={grams}
                onChange={setGrams}
                snapPoints={[25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500]}
                size="sm"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => toggleFavoriteTea(item.id)}
              className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-sm transition-all ${
                isFavorited
                  ? 'border-tea-gold text-tea-gold'
                  : 'border-tea-border text-tea-text-sec hover:border-tea-gold/30 hover:text-tea-text-sec'
              }`}
            >
              <Icons.Heart filled={isFavorited} className="w-4 h-4" />
              <span className="text-[11px] uppercase tracking-[0.08em]">
                {isFavorited ? 'Saved' : 'Save'}
              </span>
            </button>

            <button
              onClick={handleAdd}
              disabled={isSoldOut}
              className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-sm text-xs uppercase tracking-[0.1em] font-medium transition-all active:scale-[0.98] ${
                isSoldOut
                  ? 'bg-tea-accent-sub text-tea-text-sec border border-tea-border cursor-not-allowed opacity-60'
                  : added
                    ? 'bg-tea-green text-white border border-tea-green'
                    : 'bg-tea-gold text-white hover:bg-tea-gold-lt border border-tea-gold'
              }`}
            >
              <span>{isSoldOut ? 'Sold Out' : added ? 'Added!' : 'Add to Cart'}</span>
              {!isSoldOut && !added && (
                <>
                  <span className="w-px h-3 bg-white/20" />
                  <span className="font-mono">{fmtPrice(total)}</span>
                </>
              )}
            </button>
          </div>

          {/* Brewing guide link — tea products only */}
          {item.category === 'tea' && (
            <div className="mt-4 pt-4 border-t border-tea-border">
              <Link
                to="/learn"
                className="inline-flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-gold transition-colors"
              >
                <span className="uppercase tracking-[0.12em]">How to prepare this tea</span>
                <Icons.Back className="w-3 h-3 rotate-180" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Related Teas */}
      {relatedTeas.length > 0 && (
        <div className="mt-16 mb-8">
          <div className="border-t border-tea-border pt-8 mb-6">
            <span className="text-[11px] uppercase tracking-[0.15em] text-tea-text-sec">
              More {item.type} Teas
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {relatedTeas.map(related => (
              <Link
                key={related.id}
                to={`/shop/product/${related.id}`}
                className="group block"
              >
                <div className="bg-tea-surface border border-tea-border rounded-md overflow-hidden transition-all group-hover:border-tea-gold/30">
                  <div className="aspect-square overflow-hidden">
                    {related.image ? (
                      <img
                        src={related.image}
                        alt={related.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-tea-accent-sub">
                        <TeaPlaceholder type={related.type} style={{ width: '40%', height: '40%' }} />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="font-serif text-sm text-tea-text leading-snug group-hover:text-tea-gold transition-colors truncate">
                      {related.name}
                    </h4>
                    <p className="font-mono text-[11px] text-tea-text-sec mt-1">
                      {fmtPricePerGram(parseFloat(related.price_per_gram || '0'))}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {expandedImageUrl && (
        <div
          onClick={() => setExpandedImageUrl(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setExpandedImageUrl(null); }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Product image"
          className="fixed inset-0 z-priority flex items-center justify-center animate-[fadeIn_0.3s_ease-out] outline-none"
          style={{ background: 'var(--tea-bg)' }}
        >
          <img
            src={expandedImageUrl}
            alt={item.name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded cursor-default"
          />
          <button
            onClick={() => setExpandedImageUrl(null)}
            aria-label="Close image"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-tea-accent-sub flex items-center justify-center cursor-pointer hover:bg-tea-surface transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--tea-text-sec)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Sticky mobile add-to-cart bar */}
      {!isSoldOut && (
        <div className="fixed left-0 right-0 md:hidden z-sticky px-4 pb-2 pointer-events-none" style={{ bottom: 'calc(44px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="pointer-events-auto bg-tea-bg/95 backdrop-blur-sm border border-tea-border rounded-lg p-3 flex items-center gap-3 shadow-lg">
            <div className="flex-1 min-w-0">
              <p className="font-serif text-sm text-tea-text truncate">{item.name}</p>
              <p className="font-mono text-xs text-tea-text-sec">{grams}g · {fmtPrice(total)}</p>
            </div>
            <button
              onClick={handleAdd}
              className={`px-5 py-2.5 rounded-sm text-xs uppercase tracking-[0.1em] font-medium transition-all active:scale-[0.98] flex-shrink-0 ${
                added
                  ? 'bg-tea-green text-white'
                  : 'bg-tea-gold text-white hover:bg-tea-gold-lt'
              }`}
            >
              {added ? 'Added!' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;
