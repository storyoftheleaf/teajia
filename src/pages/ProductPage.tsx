import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Thermometer, Droplets, Clock, RefreshCw, MessageCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useInventory } from '../context/InventoryContext';
import { useAppStore } from '../lib/store';
import { Icons } from '../components/Icons';
import { TeaPlaceholder } from '../components/shop/TeaPlaceholder';
import { HapticSlider } from '../components/shared/HapticSlider';
import { fmtPrice, fmtPricePerGram, fmtNum } from '../utils/formatNumber';
import { CardImage } from '../components/shared/CardImage';
import type { InventoryItem, TastingData } from '../types';
import { getBrewingProfile } from '../data/brewing-profiles';
import { buildWhatsAppUrl, buildOrderMessage } from '../lib/whatsapp';
import { api } from '../lib/api';
import { resolveTermLabel, flattenTastingNotes } from '../data/tastingTaxonomy';

// ── Feature 4: Public tea reviews section ────────────────────────────────────

interface PublicTeaReview {
  id: string;
  tea_key: string;
  author_name?: string;
  author_account_name?: string;
  rating?: number;
  notes?: string;
  voice_notes?: string[];
  tasting?: TastingData;
  verdict?: string;
  session_date?: string;
  created_at: string;
  visibility: string;
}

const PublicReviewsSection: React.FC<{ productId: string; teaKey?: string }> = ({ productId, teaKey }) => {
  const { data: reviews = [], isLoading } = useQuery<PublicTeaReview[]>({
    queryKey: ['public-tea-reviews', productId, teaKey],
    queryFn: () => api.teaReviews.list({
      product_id: productId,
      ...(teaKey ? { tea_key: teaKey } : {}),
      visibility: 'network',
    }),
    staleTime: 60_000,
  });

  const networkReviews = reviews.filter(r => r.visibility === 'network');

  if (isLoading) return null;

  if (networkReviews.length === 0) {
    return (
      <div className="mt-10 pt-6 border-t border-tea-border">
        <h3 className="text-[11px] uppercase tracking-[0.15em] text-tea-text-sec mb-3">Reviews</h3>
        <p className="text-xs text-tea-text-dim italic">No reviews yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-10 pt-6 border-t border-tea-border">
      <h3 className="text-[11px] uppercase tracking-[0.15em] text-tea-text-sec mb-4">
        Reviews <span className="text-tea-text-dim font-sans normal-case tracking-normal">({networkReviews.length})</span>
      </h3>
      <div className="space-y-4">
        {networkReviews.map(r => {
          const flavorTerms = r.tasting ? flattenTastingNotes(r.tasting) : [];
          return (
            <div key={r.id} className="border border-tea-border rounded-md p-4 space-y-2 bg-tea-surface">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-tea-text">
                  {r.author_name ? r.author_name.charAt(0) + '.' : 'Anonymous'}
                </span>
                {r.author_account_name && (
                  <span className="text-[10px] text-tea-text-dim">· {r.author_account_name}</span>
                )}
                {r.rating != null && (
                  <span className="font-mono text-[11px] text-tea-gold">{r.rating}/10</span>
                )}
                {r.verdict && (
                  <span className="text-[10px] text-tea-text-dim capitalize">{r.verdict}</span>
                )}
                <span className="ml-auto text-[10px] text-tea-text-dim">
                  {(r.session_date || r.created_at).slice(0, 10)}
                </span>
              </div>

              {flavorTerms.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {flavorTerms.slice(0, 6).map(termId => (
                    <span
                      key={termId}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-tea-accent-sub text-tea-text-sec"
                    >
                      {resolveTermLabel(termId)}
                    </span>
                  ))}
                </div>
              )}

              {r.notes && (
                <p className="text-xs text-tea-text-sec italic leading-relaxed">{r.notes}</p>
              )}

              {r.voice_notes && r.voice_notes.length > 0 && (
                <div className="space-y-1">
                  {r.voice_notes.map((n, i) => (
                    <p key={i} className="text-xs text-tea-text-sec italic leading-relaxed">"{n}"</p>
                  ))}
                </div>
              )}

              {r.tasting?.brewingTemp && (
                <p className="text-[10px] text-tea-text-dim">
                  Brewed at {r.tasting.brewingTemp}°C
                  {r.tasting.brewingTime ? ` · ${r.tasting.brewingTime}` : ''}
                  {r.tasting.brewingVessel ? ` · ${r.tasting.brewingVessel}` : ''}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── End Feature 4 ────────────────────────────────────────────────────────────

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '';

/**
 * Full product detail page at /shop/product/:id
 * Shows hero image, tea info, description, tasting notes, pricing, and related teas.
 */

/** Converts a string to Title Case */
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function getStockStatus(stockG: number, isOneOfAKind?: boolean, isCurated?: boolean) {
  if (stockG <= 0) return { label: 'Sold Out', colorClass: 'text-tea-text-dim', dotClass: 'bg-tea-text-dim', level: 'out' as const };
  if (isCurated) return { label: 'Curated Selection', colorClass: 'text-tea-gold', dotClass: 'bg-tea-gold', level: 'limited' as const };
  if (isOneOfAKind) return { label: 'Curated Selection', colorClass: 'text-tea-gold', dotClass: 'bg-tea-gold', level: 'limited' as const };
  if (stockG < 100) return { label: 'Low Stock', colorClass: 'text-tea-gold', dotClass: 'bg-tea-gold', level: 'low' as const };
  if (stockG < 300) return { label: 'Available', colorClass: 'text-tea-gold-lt', dotClass: 'bg-tea-gold-lt', level: 'medium' as const };
  return { label: 'In Stock', colorClass: 'text-tea-text-sec', dotClass: 'bg-tea-text-sec', level: 'ok' as const };
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
  const [stickyVisible, setStickyVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setStickyVisible(scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

          {/* Tea type · origin · year — filterable metadata pills */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="font-sans text-[10px] uppercase tracking-widest text-tea-text-sec bg-tea-accent-sub px-2.5 py-1 rounded-sm">
              {item.type}
            </span>
            {item.origin && (
              <span className="font-sans text-[10px] uppercase tracking-widest text-tea-text-sec bg-tea-accent-sub px-2.5 py-1 rounded-sm">
                {item.origin}
              </span>
            )}
            {item.year && (
              <span className="font-sans text-[10px] uppercase tracking-widest text-tea-text-sec bg-tea-accent-sub px-2.5 py-1 rounded-sm">
                {item.year}
              </span>
            )}
          </div>


          {/* Tasting notes — prose, not pills */}
          {item.tags && item.tags.length > 0 && (
            <div className="mb-4">
              <span className="font-sans text-[10px] uppercase tracking-widest text-tea-text-dim mb-1.5 block">
                Tasting Notes
              </span>
              <span className="font-body italic text-tea-text-sec text-sm leading-relaxed">
                {item.tags.map(t => toTitleCase(t)).join(', ')}
              </span>
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
              <div className={`w-2 h-2 rounded-full ${stockStatus.dotClass}`} />
              <span className={`text-[11px] uppercase tracking-[0.08em] ${stockStatus.colorClass}`}>
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
                  aria-pressed={grams === p}
                  className={`flex-1 py-1.5 text-xs font-mono rounded-sm border transition-all duration-150 ${
                    grams === p
                      ? 'bg-tea-accent-sub text-tea-gold border-tea-gold'
                      : 'bg-transparent text-tea-text-sec border-tea-border hover:border-tea-gold/30'
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
              <div className="flex items-end justify-between mb-1 px-0.5">
                <span className="font-mono text-sm text-tea-text">{fmtPrice(total)}</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="font-mono text-2xl text-tea-text leading-none">{grams}</span>
                  <span className="font-sans text-xs text-tea-text-dim">g</span>
                </div>
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

          {/* WhatsApp checkout handoff */}
          {!isSoldOut && (
            <div className="border-t border-tea-border pt-4 mt-4">
              <p className="font-body italic text-tea-text-sec text-sm leading-relaxed mb-4">
                Every order is a personal conversation. Adrian will confirm your selection and arrange delivery within 24 hours.
              </p>
              <button
                onClick={() => {
                  const message = buildOrderMessage({
                    type: 'inquiry',
                    items: [{
                      name: item.variant || item.name,
                      quantity: grams,
                      unit: 'g',
                      price: fmtPricePerGram(pricePerGram),
                      total: fmtPrice(total),
                    }],
                    subtotal: fmtPrice(total),
                    total: fmtPrice(total),
                  });
                  window.open(buildWhatsAppUrl(WHATSAPP_NUMBER, message), '_blank');
                }}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-tea-gold text-tea-bg font-sans font-medium tracking-wide text-sm rounded-sm hover:bg-tea-gold-lt transition-colors duration-150 active:scale-[0.98]"
              >
                <MessageCircle className="w-4 h-4" strokeWidth={2} />
                Order via WhatsApp
              </button>
            </div>
          )}

          {/* Brewing profile — tea products only */}
          {item.category === 'tea' && (() => {
            const profile = getBrewingProfile(item.type);
            if (!profile) return null;
            return (
              <div className="mt-4 pt-4 border-t border-tea-border">
                <h3 className="font-sans text-[11px] uppercase tracking-[0.15em] text-tea-gold mb-3">
                  How to Brew
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="bg-tea-surface rounded-lg p-3 flex flex-col items-center text-center gap-1">
                    <Thermometer className="w-4 h-4 text-tea-text-dim mb-0.5" strokeWidth={1.5} />
                    <span className="font-mono text-sm text-tea-text leading-tight">{profile.waterTemp}</span>
                    <span className="font-sans text-[10px] uppercase tracking-widest text-tea-text-dim">Temp</span>
                  </div>
                  <div className="bg-tea-surface rounded-lg p-3 flex flex-col items-center text-center gap-1">
                    <Droplets className="w-4 h-4 text-tea-text-dim mb-0.5" strokeWidth={1.5} />
                    <span className="font-mono text-sm text-tea-text leading-tight">{profile.leafRatio}</span>
                    <span className="font-sans text-[10px] uppercase tracking-widest text-tea-text-dim">Ratio</span>
                  </div>
                  <div className="bg-tea-surface rounded-lg p-3 flex flex-col items-center text-center gap-1">
                    <Clock className="w-4 h-4 text-tea-text-dim mb-0.5" strokeWidth={1.5} />
                    <span className="font-mono text-sm text-tea-text leading-tight">{profile.steepTime}</span>
                    <span className="font-sans text-[10px] uppercase tracking-widest text-tea-text-dim">Time</span>
                  </div>
                  <div className="bg-tea-surface rounded-lg p-3 flex flex-col items-center text-center gap-1">
                    <RefreshCw className="w-4 h-4 text-tea-text-dim mb-0.5" strokeWidth={1.5} />
                    <span className="font-mono text-sm text-tea-text leading-tight">{profile.infusions}</span>
                    <span className="font-sans text-[10px] uppercase tracking-widest text-tea-text-dim">Steeps</span>
                  </div>
                </div>
                {profile.notes && (
                  <p className="mt-3 text-[11px] text-tea-text-dim leading-relaxed italic border-l border-tea-border pl-3">
                    {profile.notes}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Feature 4: Public tea reviews */}
      {item.category === 'tea' && (
        <PublicReviewsSection productId={item.id} teaKey={(item as InventoryItem & { tea_key?: string }).tea_key} />
      )}

      {/* Related Teas — horizontal scroll strip */}
      {relatedTeas.length > 0 && (
        <div className="mt-16 mb-8">
          <div className="border-t border-tea-border pt-8 mb-4">
            <p className="font-sans text-[10px] uppercase tracking-widest text-tea-text-dim mb-3">
              You might also like
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {relatedTeas.map(related => (
              <Link
                key={related.id}
                to={`/shop/product/${related.id}`}
                className="group block w-36 flex-shrink-0"
              >
                <div className="aspect-square w-full rounded overflow-hidden bg-tea-surface">
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
                <h4 className="font-display text-sm text-tea-text leading-snug line-clamp-2 mt-2 group-hover:text-tea-gold transition-colors duration-150">
                  {related.name}
                </h4>
                <p className="font-mono text-xs text-tea-text-sec mt-0.5">
                  {fmtPricePerGram(parseFloat(related.price_per_gram || '0'))}
                </p>
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
        <div
          className="fixed left-0 right-0 md:hidden z-sticky px-4 pb-2 pointer-events-none transition-transform duration-300 ease-in-out"
          style={{
            bottom: 'calc(44px + env(safe-area-inset-bottom, 0px))',
            transform: stickyVisible ? 'translateY(0)' : 'translateY(calc(100% + 16px))',
          }}
        >
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
