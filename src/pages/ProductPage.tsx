import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MessageCircle, Pencil } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useInventory } from '../context/InventoryContext';
import { useAppStore } from '../lib/store';
import { Icons } from '../components/Icons';
import { TeaPlaceholder } from '../components/shop/TeaPlaceholder';
import { HapticSlider } from '../components/shared/HapticSlider';
import { fmtPricePerGram, fmtShopPrice, fmtShopPricePerGram } from '../utils/formatNumber';
import type { InventoryItem, TastingData } from '../types';
import { buildWhatsAppUrl, buildOrderMessage } from '../lib/whatsapp';
import { api } from '../lib/api';
import { resolveTermLabel, flattenTastingNotes } from '../data/tastingTaxonomy';
import { getBrewingProfile } from '../data/brewing-profiles';
import { getTeaColor } from '../designTokens';
import { normalizeTeaType } from '../wisdom';
import { ProductTastingEditorial } from '../components/tasting/ProductTastingEditorial';
import { useProductTasting } from '../hooks/useProductTasting';
import { useAuth } from '../hooks/useAuth';
import { TastingEditorModal } from '../admin/components/TastingEditorModal';
import type { Product } from '../admin/types';
import { ProductImpressions, type ProductImpression } from '../components/shop/ProductImpressions';
import { cultivarPath, resolveLineage } from '../components/wisdom/TeaLineage';
import { TeaReference, type TeaReferenceProduct } from '../components/wisdom/TeaReference';
import { FactGrid } from '../components/wisdom/FactGrid';
import { BODY, HEADING, LABEL, LABEL_GAP, SECTION, TITLE } from '../components/wisdom/typeRoles';

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
  const { data: impressions = [] } = useQuery<ProductImpression[]>({
    queryKey: ['product-impressions', productId],
    queryFn: () => api.productImpressions.list(productId),
    staleTime: 60_000,
  });

  if (isLoading) return null;

  if (networkReviews.length === 0 && impressions.length === 0) {
    return (
      <div className="mt-6 pt-6 border-t border-tea-border">
        <h2 className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>Reviews</h2>
        <p className={`${BODY} text-tea-text-dim italic`}>No reviews yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-tea-border">
      <ProductImpressions impressions={impressions} />
      {networkReviews.length > 0 && <>
        <h2 className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>
          Reviews <span className="normal-case tracking-normal">({networkReviews.length})</span>
        </h2>
        {/* Flat entries, separated by the same hairline every other section on
            this page is separated by. This was the last bordered, filled card
            left standing after the brewing card dissolved into a fact grid, and
            one surviving card among flat sections reads as a leftover widget
            rather than as part of the page. Hierarchy inside an entry is colour
            only: the note is secondary, everything about the note is dim. */}
        <div className="space-y-5">
        {networkReviews.map(r => {
          const flavorTerms = r.tasting ? flattenTastingNotes(r.tasting) : [];
          const brewedAt = r.tasting?.brewingTemp
            ? [`Brewed at ${r.tasting.brewingTemp}°C`, r.tasting.brewingTime, r.tasting.brewingVessel]
                .filter(Boolean)
                .join(' · ')
            : '';
          return (
            <article key={r.id} className="space-y-1 border-t border-tea-border pt-5 first:border-t-0 first:pt-0">
              <div className={`${BODY} flex flex-wrap items-baseline gap-x-2 text-tea-text-dim`}>
                <span className="text-tea-text">
                  {r.author_name ? r.author_name.charAt(0) + '.' : 'Anonymous'}
                </span>
                {r.author_account_name && <span>· {r.author_account_name}</span>}
                {r.rating != null && <span className="font-mono text-tea-text-sec">{r.rating}/10</span>}
                {r.verdict && <span className="capitalize">{r.verdict}</span>}
                <span className="ml-auto tabular-nums">
                  {(r.session_date || r.created_at).slice(0, 10)}
                </span>
              </div>

              {/* Terms a reader cannot tap are a caption, not a row of pills.
                  The metadata under the title stopped pretending to be links in
                  round two; these were the same promise, still unkept. */}
              {flavorTerms.length > 0 && (
                <p className={`${BODY} text-tea-text-dim`}>
                  {flavorTerms.slice(0, 6).map(termId => resolveTermLabel(termId)).join(' · ')}
                </p>
              )}

              {r.notes && (
                <p className={`${BODY} italic text-tea-text-sec`}>{r.notes}</p>
              )}

              {r.voice_notes && r.voice_notes.length > 0 && (
                <div className="space-y-1">
                  {r.voice_notes.map((n, i) => (
                    <p key={i} className={`${BODY} italic text-tea-text-sec`}>&ldquo;{n}&rdquo;</p>
                  ))}
                </div>
              )}

              {brewedAt && <p className={`${BODY} text-tea-text-dim`}>{brewedAt}</p>}
            </article>
          );
        })}
        </div>
      </>}
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

/**
 * Three states, because there are three things worth saying.
 *
 * There were four. "Available" (100g to 300g) and "In Stock" (300g up) both
 * lost their colour when bronze was pulled back to the one state that asks the
 * reader to act, and two labels rendered in the same tone at the same size are
 * one label written twice. The 300g boundary was invented by the page, not by
 * the shop: nothing behind it changes at 300g, no reader knows where the line
 * is, and giving it a second colour would have spent a signal on a distinction
 * that means nothing. So the boundary is gone rather than decorated.
 */
function getStockStatus(stockG: number) {
  if (stockG <= 0) return { label: 'Sold Out', colorClass: 'text-tea-text-dim', dotClass: 'bg-tea-text-dim', level: 'out' as const };
  // Bronze is reserved for the one stock state that asks the reader to act.
  if (stockG < 100) return { label: 'Low Stock', colorClass: 'text-tea-gold', dotClass: 'bg-tea-gold', level: 'low' as const };
  return { label: 'In Stock', colorClass: 'text-tea-text-sec', dotClass: 'bg-tea-text-sec', level: 'ok' as const };
}

interface ProductPageProps {
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
}

/** Why another tea is on this page. Ordered strongest first. */
type Relation = 'plant' | 'place' | 'type';
interface RelatedTea {
  item: InventoryItem;
  relation: Relation;
}
const RELATION_RANK: Record<Relation, number> = { plant: 0, place: 1, type: 2 };
const RELATION_LABEL: Record<Relation, string> = {
  plant: 'Same plant',
  place: 'Same place',
  type: 'Same type',
};

export const ProductPage: React.FC<ProductPageProps> = ({ onAddToCart }) => {
  const { id } = useParams<{ id: string }>();
  const { inventory, refetch: refetchInventory } = useInventory();
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

  // Escape closes the enlarged image. Listened for on the window rather than on
  // the overlay: the overlay only ever received the key when it happened to
  // hold focus, which after a tap on a thumbnail it does not.
  useEffect(() => {
    if (!expandedImageUrl) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedImageUrl(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expandedImageUrl]);

  // Related teas: stated facts, in strength order, never a recommendation.
  //
  // A shared plant is the strongest thing two teas can have in common, a shared
  // growing region is next, and a shared type is the weakest, because half the
  // shop is oolong. Each tea carries the relation it was picked for, so the
  // strip reads as "these share a plant" rather than "you might also like".
  //
  // Nothing here is scored, weighted, personalised or learned. Every candidate
  // is resolved through the same wisdom base the lineage block reads, the tiers
  // are fixed, and the sort is stable, so the same product always produces the
  // same four teas for every reader.
  const relatedTeas = useMemo(() => {
    if (!item) return [];
    const lineageOf = (candidate: InventoryItem) => resolveLineage({
      name: candidate.name,
      chineseName: candidate.chineseName,
      origin: candidate.origin,
      cultivar: candidate.cultivar,
    });
    const { cultivar, region } = lineageOf(item);
    const itemType = normalizeTeaType(item.type) ?? item.type;

    const related = inventory
      .filter(other => other.id !== item.id && other.category === item.category)
      .map(other => {
        const theirs = lineageOf(other);
        if (cultivar && theirs.cultivar?.id === cultivar.id) return { item: other, relation: 'plant' as const };
        if (region && theirs.region?.id === region.id) return { item: other, relation: 'place' as const };
        // Type compared via normalizeTeaType so records saved under a historical
        // dialect (one item stored as 'Black', another as 'Red') still match.
        if ((normalizeTeaType(other.type) ?? other.type) === itemType) return { item: other, relation: 'type' as const };
        return null;
      })
      .filter((entry): entry is RelatedTea => entry !== null);

    return related.sort((left, right) => RELATION_RANK[left.relation] - RELATION_RANK[right.relation]).slice(0, 4);
  }, [inventory, item]);

  // Grouped so a relation is stated once above its teas rather than repeated on
  // every card. Order is preserved, so the strongest group leads.
  const relatedGroups = useMemo(() => {
    const groups: Array<{ relation: Relation; teas: InventoryItem[] }> = [];
    for (const entry of relatedTeas) {
      const last = groups[groups.length - 1];
      if (last?.relation === entry.relation) last.teas.push(entry.item);
      else groups.push({ relation: entry.relation, teas: [entry.item] });
    }
    return groups;
  }, [relatedTeas]);

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-[fadeIn_0.5s_ease-out]">
        <h1 className={`${TITLE} ${SECTION} text-tea-text`}>Not found</h1>
        <p className={`${BODY} ${SECTION} max-w-md text-tea-text-sec`}>
          This product could not be found. It may have been removed or the link may be incorrect.
        </p>
        <Link
          to="/shop"
          className={`${LABEL} rounded-md bg-tea-gold px-8 py-3 text-tea-bg transition-colors hover:bg-tea-gold-lt`}
        >
          Back to shop
        </Link>
      </div>
    );
  }

  const typeColor = getTeaColor(item.type);
  const pricePerGram = parseFloat(item.price_per_gram || '0');
  const sliderMax = Math.max(25, Math.floor(item.stock_g || 500));
  const total = pricePerGram * grams;
  const stockStatus = getStockStatus(item.stock_g);
  const isSoldOut = stockStatus.level === 'out';
  const isFavorited = favoriteTeas.includes(item.id);
  const presets = [25, 50, 100, 250].filter(p => p <= sliderMax);

  // One shape for everything the wisdom base is asked about this product, so
  // the structured data below and the reference band on the page resolve from
  // the same fields rather than from two slightly different subsets.
  const referenceProduct: TeaReferenceProduct = {
    name: item.name,
    variant: item.variant,
    chineseName: item.chineseName,
    origin: item.origin,
    cultivar: item.cultivar,
    type: item.type,
    year: item.year,
  };
  const { cultivar: lineageCultivar, region: lineageRegion } = resolveLineage(referenceProduct);

  const mainStory = item.lore || '';
  const introduction = item.description || '';
  const terroir = item.terroir || '';
  const processing = item.processingNotes || '';
  const brewingProfile = item.category === 'tea' ? getBrewingProfile(item.type) : undefined;
  const resolvedTasting = useProductTasting(item);
  const { isAdmin } = useAuth();
  const [tastingEditorOpen, setTastingEditorOpen] = useState(false);

  // Minimal Product shape TastingEditorModal needs; mapped from the public InventoryItem.
  const adminProductShim: Product | null = useMemo(() => {
    if (!item) return null;
    return {
      id: item.id,
      givenName: item.name,
      productName: item.variant || item.name,
      type: item.type as Product['type'],
      imageUrl: item.image || '',
      tasting: item.tasting,
    } as Product;
  }, [item]);

  const handleAdd = () => {
    if (isSoldOut) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    if (onAddToCart) {
      onAddToCart(item, grams, Math.round(total * 100) / 100);
    }
  };

  // The plant's public page. One address, used by the link in the lineage block
  // and by the structured data below, so a machine and a reader follow the same
  // door. `#taxon` matches the id CultivarPage publishes for the same plant, so
  // the two documents describe one entity rather than two look-alikes.
  const siteOrigin = typeof window === 'undefined' ? '' : window.location.origin;
  const cultivarUrl = lineageCultivar ? `${siteOrigin}${cultivarPath(lineageCultivar.id)}` : null;
  const productUrl = `${siteOrigin}/shop/product/${item.id}`;

  // The crumb between the shop and this tea. Its own type, resolved through the
  // same vocabulary the rest of the page reads, so a record saved as "Red" and
  // one saved as "Black" land on one crumb rather than two.
  const crumbType = item.category === 'ware' ? 'Teaware' : normalizeTeaType(item.type) ?? item.type;

  // JSON-LD structured data for SEO. A graph, not a single node: the product,
  // and the plant it is made from, addressed so the plant can be followed.
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${siteOrigin}/shop/product/${item.id}#product`,
        name: item.name,
        description: introduction || mainStory || `${item.type} tea from ${item.origin}`,
        image: item.image || undefined,
        brand: { '@type': 'Brand', name: 'Teajia' },
        category: item.category === 'ware' ? 'Teaware' : `${item.type} Tea`,
        ...(item.origin && { countryOfOrigin: { '@type': 'Country', name: item.origin } }),
        ...((lineageCultivar || lineageRegion) && {
          additionalProperty: [
            ...(lineageCultivar
              ? [{
                  '@type': 'PropertyValue',
                  name: 'Cultivar',
                  value: lineageCultivar.name,
                  ...(cultivarUrl ? { url: cultivarUrl } : {}),
                }]
              : []),
            ...(lineageCultivar?.chineseName
              ? [{ '@type': 'PropertyValue', name: 'Cultivar (Chinese)', value: lineageCultivar.chineseName }]
              : []),
            ...(lineageCultivar?.originRegion || lineageCultivar?.originCountry
              ? [{
                  '@type': 'PropertyValue',
                  name: 'Cultivar Origin',
                  value: [lineageCultivar?.originRegion, lineageCultivar?.originCountry].filter(Boolean).join(', '),
                }]
              : []),
            ...(lineageRegion?.altitude ? [{ '@type': 'PropertyValue', name: 'Growing Altitude', value: lineageRegion.altitude }] : []),
            ...(lineageRegion?.climate ? [{ '@type': 'PropertyValue', name: 'Growing Climate', value: lineageRegion.climate }] : []),
          ],
        }),
        // `material` takes a URL in schema.org, and a tea is quite literally
        // made of this plant. It is the one property on Product whose range
        // accepts the plant's address without bending the vocabulary.
        ...(cultivarUrl && { material: cultivarUrl }),
        offers: {
          '@type': 'Offer',
          price: (pricePerGram * 50).toFixed(2), // Price per 50g serving
          priceCurrency: 'USD',
          availability: isSoldOut
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
          seller: { '@type': 'Organization', name: 'Teajia' },
          url: productUrl,
        },
      },
      ...(lineageCultivar && cultivarUrl
        ? [{
            '@type': 'Taxon',
            '@id': `${cultivarUrl}#taxon`,
            name: lineageCultivar.name,
            taxonRank: 'cultivar',
            url: cultivarUrl,
            alternateName: [lineageCultivar.chineseName, ...lineageCultivar.altNames].filter(Boolean),
          }]
        : []),
      // The page itself, so the crumbs have something to hang off. Same three
      // nodes the cultivar page publishes (the thing, the page, the trail),
      // which is what lets a crawler read the shop and the reference as one
      // graph instead of two documents that happen to share a name.
      {
        '@type': 'WebPage',
        '@id': productUrl,
        url: productUrl,
        name: `${item.name} · Teajia`,
        inLanguage: 'en',
        about: { '@id': `${productUrl}#product` },
        breadcrumb: { '@id': `${productUrl}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${productUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Shop', item: `${siteOrigin}/shop` },
          ...(crumbType
            ? [{
                '@type': 'ListItem',
                position: 2,
                name: crumbType,
                item: `${siteOrigin}/shop?type=${encodeURIComponent(crumbType)}`,
              }]
            : []),
          { '@type': 'ListItem', position: crumbType ? 3 : 2, name: item.name, item: productUrl },
        ],
      },
    ],
  };

  return (
    <div className="max-w-4xl mx-auto animate-[fadeIn_0.5s_ease-out]">
      <Helmet>
        <title>{item.name} · Teajia</title>
        <meta name="description" content={(introduction || mainStory || `${item.type} tea from ${item.origin}`).slice(0, 160)} />
        <meta property="og:title" content={`${item.name} · Teajia`} />
        <meta property="og:description" content={(introduction || mainStory || '').slice(0, 160)} />
        {item.image && <meta property="og:image" content={item.image} />}
        <meta property="og:type" content="product" />
        <meta property="product:price:amount" content={(pricePerGram * 50).toFixed(2)} />
        <meta property="product:price:currency" content="USD" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      {/* Back link */}
      <div className={SECTION}>
        <Link
          to="/shop"
          className="inline-flex min-h-[44px] items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors"
        >
          <Icons.Back className="w-4 h-4" />
          <span className={LABEL}>Back to shop</span>
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
              <div
                className="w-full h-full flex flex-col items-center justify-center gap-3"
                style={{
                  background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${typeColor}18 0%, transparent 70%)`,
                }}
              >
                {item.chineseName ? (
                  <p
                    className="select-none pointer-events-none text-center leading-none"
                    style={{ fontFamily: "'Ma Shan Zheng', cursive", fontSize: '5rem', color: typeColor, opacity: 0.35 }}
                  >
                    {item.chineseName}
                  </p>
                ) : (
                  <TeaPlaceholder type={item.type} style={{ width: '32%', height: '32%', opacity: 0.2 }} />
                )}
                <span
                  className={LABEL}
                  style={{ color: typeColor, opacity: 0.4 }}
                >
                  {item.origin || item.type}
                </span>
              </div>
            )}
          </div>

          {/* Additional images. Wired to the lightbox rather than deleted with
              it: a 64px square of leaf is not a photograph anyone can read, so
              the enlargement is the whole reason a second image is on the page.
              64px is already past the 44px floor, so no tap-target is needed. */}
          {item.additionalImages && item.additionalImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {item.additionalImages.slice(0, 4).map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setExpandedImageUrl(img)}
                  aria-label={`Enlarge image ${i + 2} of ${item.name}`}
                  className="w-16 h-16 rounded-md overflow-hidden bg-tea-surface border border-tea-border flex-shrink-0 transition-colors hover:border-tea-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
                >
                  <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product info */}
        <div className="md:w-1/2 flex flex-col">
          {/* Product name */}
          <h1 className={`${TITLE} mb-1 text-tea-text`}>
            {item.variant || item.name}
          </h1>
          {/* Given name. Always reserves space. */}
          <p className={`${HEADING} mb-1 min-h-[26px] italic text-tea-text-sec ${
            item.variant && item.variant !== item.name ? 'visible' : 'invisible'
          }`}>
            {item.variant && item.variant !== item.name ? item.name : '\u00A0'}
          </p>
          {item.chineseName && (
            // The calligraphic name is not a step on the Latin scale: it is a
            // different face, set at 26px so it sits optically level with a
            // 32px title. The one optical exception on the page.
            <p className="mb-2 text-ui-26 leading-none text-tea-text-sec" style={{ fontFamily: "'Ma Shan Zheng', cursive" }}>
              {item.chineseName}
            </p>
          )}

          {/* Type, origin, year. Read as a caption, not as pills: the shop has
              no filter to send these to, and a chip that cannot be tapped is a
              promise the page does not keep. */}
          <p className={`${LABEL} ${SECTION} text-tea-text-dim`}>
            {[item.type, item.origin, item.year].filter(Boolean).join(' · ')}
          </p>

          {/* Tasting notes: the sensory line, in the tea's own colour */}
          {item.tags && item.tags.length > 0 && (
            <p className={`${HEADING} ${SECTION} italic`} style={{ color: typeColor }}>
              {item.tags.map(t => toTitleCase(t)).join(' · ')}
            </p>
          )}

          {/* Tasting description: flavour and energy, linked through to the shop filters. */}
          {resolvedTasting ? (
            <ProductTastingEditorial
              tasting={resolvedTasting.tasting}
              source={resolvedTasting.source}
              onEdit={isAdmin ? () => setTastingEditorOpen(true) : undefined}
            />
          ) : isAdmin ? (
            <button
              type="button"
              onClick={() => setTastingEditorOpen(true)}
              className={`${LABEL} ${SECTION} flex min-h-[44px] items-center gap-1.5 text-tea-text-dim transition-colors hover:text-tea-text`}
            >
              <Pencil size={12} strokeWidth={1.5} />
              <span>Add tasting profile</span>
            </button>
          ) : item.mood ? (
            <p className={`${BODY} ${SECTION} italic text-tea-text-sec`}>
              {(item.mood.includes(',') ? item.mood.split(',').map(t => t.trim()).filter(Boolean) : [item.mood])
                .map(tag => toTitleCase(tag))
                .join(' · ')}
            </p>
          ) : null}

          {/* About: character and description. */}
          {(item.experience || introduction) && (
            <div className={SECTION}>
              <h2 className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>About</h2>
              {item.experience && (
                <p className={`${BODY} mb-2 whitespace-pre-line text-tea-text-sec`}>
                  {item.experience}
                </p>
              )}
              {introduction && (
                <p className={`${BODY} whitespace-pre-line text-tea-text-sec`}>
                  {introduction}
                </p>
              )}
            </div>
          )}

          {/* Story: historical and cultural context. */}
          {mainStory && (
            <div className={SECTION}>
              <h2 className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>History</h2>
              <p className={`${BODY} whitespace-pre-line text-tea-text-sec`}>
                {mainStory}
              </p>
            </div>
          )}
          {terroir && (
            <div className={SECTION}>
              <h2 className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>Terroir</h2>
              <p className={`${BODY} whitespace-pre-line text-tea-text-sec`}>{terroir}</p>
            </div>
          )}
          {processing && (
            <div className={SECTION}>
              <h2 className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>Processing</h2>
              <p className={`${BODY} whitespace-pre-line text-tea-text-sec`}>{processing}</p>
            </div>
          )}

          {/* Tea wisdom lineage: shared background beneath Adrian's own words above,
              marked as reference rather than voice. Renders nothing when the plant
              can't be resolved (see TeaLineage.tsx). */}
          <TeaReference product={referenceProduct} />

          {/* Brewing: the same fact grid the lineage block uses, so the two
              sets of facts on this page read as one kind of thing. No card, no
              surface, no icon: a fact does not need chrome to be legible. */}
          {brewingProfile && (
            <div className={SECTION}>
              <h2 className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>Brewing</h2>
              <FactGrid
                facts={[
                  { label: 'Water', value: brewingProfile.waterTemp },
                  { label: 'Steep', value: brewingProfile.steepTime },
                  { label: 'Leaf', value: brewingProfile.leafRatio },
                  { label: 'Vessel', value: brewingProfile.vessel },
                  { label: 'Infusions', value: brewingProfile.infusions },
                ].filter(fact => Boolean(fact.value))}
              />
              {brewingProfile.notes && (
                <p className={`${BODY} mt-3 italic text-tea-text-sec`}>
                  {brewingProfile.notes}
                </p>
              )}
            </div>
          )}

          {/* Zone break: story to action. A hairline, on the same token every
              other rule on this page uses. The gold gradient it replaces was
              both a hardcoded rgba and a fourth bronze element in one column. */}
          <div className={`${SECTION} border-t border-tea-border`} />

          {/* Pricing and stock */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${stockStatus.dotClass}`} />
              <span className={`${LABEL} ${stockStatus.colorClass}`}>
                {stockStatus.label}
              </span>
            </div>
            <div className="text-right">
              <span className="font-mono text-ui-15 text-tea-text-sec block">
                {fmtShopPricePerGram(pricePerGram)}
              </span>
              <span className="font-mono text-ui-11 text-tea-text-dim">
                from {fmtShopPrice(pricePerGram * 25)} / 25g
              </span>
            </div>
          </div>

          {/* Quantity presets. Four across at 390px is 83px a button, so the
              width was never the problem: at py-1.5 on 11px type they stood
              26px tall, well under the 44px floor. Height is set explicitly
              here because the type roles are small by design and every control
              on this page has to clear the floor on its own. */}
          {!isSoldOut && presets.length > 1 && (
            <div className="flex gap-2 mb-3">
              {presets.map(p => (
                <button
                  key={p}
                  onClick={() => setGrams(p)}
                  aria-pressed={grams === p}
                  className={`flex-1 min-h-[44px] font-mono text-ui-11 rounded-md border transition-all duration-150 ${
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
                <span className="font-mono text-ui-15 text-tea-text">{fmtShopPrice(total)}</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="font-mono text-ui-20 text-tea-text leading-none">{grams}</span>
                  <span className="font-sans text-ui-11 text-tea-text-dim">g</span>
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
              className={`flex min-h-[44px] items-center justify-center gap-2 px-4 py-3 border rounded-md transition-all ${
                isFavorited
                  ? 'border-tea-gold text-tea-gold'
                  : 'border-tea-border text-tea-text-sec hover:border-tea-gold/30 hover:text-tea-text-sec'
              }`}
            >
              <Icons.Heart filled={isFavorited} className="w-4 h-4" />
              <span className={LABEL}>
                {isFavorited ? 'Saved' : 'Save'}
              </span>
            </button>

            <button
              onClick={handleAdd}
              disabled={isSoldOut}
              className={`${LABEL} flex-1 flex min-h-[44px] items-center justify-center gap-3 py-3 rounded-md font-medium transition-all active:scale-[0.98] ${
                isSoldOut
                  ? 'bg-tea-accent-sub text-tea-text-sec border border-tea-border cursor-not-allowed opacity-60'
                  : added
                    ? 'bg-tea-green text-tea-bg border border-tea-green'
                    : 'bg-tea-gold text-tea-bg hover:bg-tea-gold-lt border border-tea-gold'
              }`}
            >
              <span>{isSoldOut ? 'Sold Out' : added ? 'Added!' : 'Add to Cart'}</span>
              {!isSoldOut && !added && (
                <>
                  <span className="w-px h-3 bg-tea-bg/20" />
                  <span className="font-mono">{fmtShopPrice(total)}</span>
                </>
              )}
            </button>
          </div>

          {/* WhatsApp checkout handoff */}
          {!isSoldOut && (
            <div className="pt-4 mt-2">
              <button
                onClick={() => {
                  const message = buildOrderMessage({
                    type: 'inquiry',
                    items: [{
                      name: item.variant || item.name,
                      quantity: grams,
                      unit: 'g',
                      price: fmtPricePerGram(pricePerGram),
                      total: fmtShopPrice(total),
                    }],
                    subtotal: fmtShopPrice(total),
                    total: fmtShopPrice(total),
                  });
                  window.open(buildWhatsAppUrl(WHATSAPP_NUMBER, message), '_blank');
                }}
                className={`${LABEL} w-full flex min-h-[44px] items-center justify-center gap-2.5 py-3 px-4 border border-tea-border bg-transparent text-tea-text-sec rounded-md hover:border-tea-gold/40 hover:text-tea-text transition-colors duration-150 active:scale-[0.98]`}
              >
                <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
                Order via WhatsApp
              </button>
              <p className={`${BODY} mt-2 text-center text-tea-text-dim`}>
                Personal conversation · Adrian confirms within 24 hours
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Feature 4: Public tea reviews */}
      {item.category === 'tea' && (
        <PublicReviewsSection productId={item.id} teaKey={(item as InventoryItem & { tea_key?: string }).tea_key} />
      )}

      {/* Related teas. Each group is headed by the fact its teas share, not by
          a suggestion, and the grid wraps rather than scrolling sideways. */}
      {relatedGroups.length > 0 && (
        <div className="mt-6 pt-6 border-t border-tea-border">
          {relatedGroups.map(group => (
            <section key={group.relation} className={SECTION}>
              <h2 className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>
                {RELATION_LABEL[group.relation]}
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {group.teas.map(related => (
                  <Link
                    key={related.id}
                    to={`/shop/product/${related.id}`}
                    className="group block min-w-0"
                  >
                    <div className="aspect-square w-full rounded-md overflow-hidden bg-tea-surface">
                      {related.image ? (
                        <img
                          src={related.image}
                          alt={related.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-tea-accent-sub">
                          <TeaPlaceholder type={related.type} style={{ width: '40%', height: '40%' }} />
                        </div>
                      )}
                    </div>
                    <h3 className={`${HEADING} mt-2 line-clamp-2 text-tea-text transition-colors duration-150 group-hover:text-tea-gold`}>
                      {related.name}
                    </h3>
                    <p className="font-mono text-ui-11 text-tea-text-sec mt-0.5">
                      {fmtShopPricePerGram(parseFloat(related.price_per_gram || '0'))}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Image lightbox */}
      {expandedImageUrl && (
        <div
          onClick={() => setExpandedImageUrl(null)}
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
            className="tap-target absolute top-4 right-4 w-9 h-9 rounded-full bg-tea-accent-sub flex items-center justify-center cursor-pointer hover:bg-tea-surface transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--tea-text-sec)" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Sticky mobile add-to-cart bar */}
      {!isSoldOut && (
        <div
          className="fixed left-0 right-0 bottom-nav md:hidden z-sticky px-4 pb-2 pointer-events-none transition-transform duration-300 ease-in-out"
          style={{
            transform: stickyVisible ? 'translateY(0)' : 'translateY(calc(100% + 16px))',
          }}
        >
          <div className="pointer-events-auto bg-tea-bg/95 backdrop-blur-sm border border-tea-border rounded-xl p-3 flex items-center gap-3 shadow-lg">
            <div className="flex-1 min-w-0">
              <p className={`${HEADING} truncate text-tea-text`}>{item.name}</p>
              <p className="font-mono text-ui-11 text-tea-text-sec">{grams}g · {fmtShopPrice(total)}</p>
            </div>
            <button
              onClick={handleAdd}
              className={`${LABEL} inline-flex min-h-[44px] items-center px-5 rounded-md font-medium transition-all active:scale-[0.98] flex-shrink-0 ${
                added
                  ? 'bg-tea-green text-tea-bg'
                  : 'bg-tea-gold text-tea-bg hover:bg-tea-gold-lt'
              }`}
            >
              {added ? 'Added!' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Admin inline tasting editor: the same modal the admin panel uses. */}
      {tastingEditorOpen && adminProductShim && (
        <TastingEditorModal
          product={adminProductShim}
          onClose={() => setTastingEditorOpen(false)}
          onSaved={() => {
            setTastingEditorOpen(false);
            refetchInventory();
          }}
        />
      )}
    </div>
  );
};

export default ProductPage;
