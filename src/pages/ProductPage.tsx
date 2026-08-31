import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence } from 'framer-motion';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../hooks/useAuth';
import { Icons } from '../components/Icons';
import { AlcoveCard } from '../components/shop/AlcoveCard';
import { normalizeTeaType } from '../wisdom';
import { cultivarPath, resolveLineage } from '../components/wisdom/TeaLineage';
import type { TeaReferenceProduct } from '../components/wisdom/TeaReference';
import { TastingSession, type TastingItem } from '../components/tasting/TastingSession';
import { TastingEditorModal } from '../admin/components/TastingEditorModal';
import { EmblemLoader } from '../components/shared/EmblemLoader';
import type { InventoryItem } from '../types';
import type { Product } from '../admin/types';
import { useAppStore } from '../lib/store';
import { buildPublicProductHref, findProductByRouteParam } from '../lib/publicProductNavigation';
import { LABEL, NUMERAL } from '../components/shared/typeRoles';
import { useProducts } from '../admin/hooks/useAdminData';
import { api } from '../lib/api';


interface ProductPageProps {
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onCartClick?: () => void;
  cartItemCount?: number;
}

interface ProductOrderAccessProps {
  onCartClick?: () => void;
  cartItemCount: number;
}

export function ProductOrderAccess({ onCartClick, cartItemCount }: ProductOrderAccessProps) {
  if (!onCartClick || cartItemCount <= 0) return null;

  const itemLabel = cartItemCount === 1 ? 'item' : 'items';
  return (
    <button
      type="button"
      onClick={onCartClick}
      aria-label={`Open order with ${cartItemCount} ${itemLabel}`}
      className={`${LABEL} tap-target inline-flex shrink-0 items-center gap-2 text-tea-text-sec transition-colors hover:text-tea-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
    >
      <Icons.Bag className="h-4 w-4" aria-hidden="true" />
      <span>View order</span>
      <span className={`normal-case text-tea-gold ${NUMERAL}`}>{cartItemCount}</span>
    </button>
  );
}

/**
 * The one currency this page publishes in, for machines.
 *
 * Reading the currency out of the client store made the markup a per-visitor
 * document: a crawler with no storage always saw one currency, a returning
 * reader saw another, and neither could tell which was the shop's actual quote.
 * Markup that varies per visitor is worse than markup that is honestly fixed.
 *
 * The prices in the record are USD, so USD is what is published, unconverted,
 * to every reader and every crawler. Localising the visible number is the
 * visible page's job, and when it gains that ability the markup does not move.
 */
const PUBLISHED_CURRENCY = 'USD';

/**
 * The real product page at /shop/product/:id: the cold-load container of the
 * one-URL/two-containers pattern. Grid taps inside the shop open the same URL
 * as the AlcoveModal over the still-mounted grid (background-location routing
 * in App.tsx); shared links, reloads, and search results land here.
 *
 * The page is composed from the SAME alcove blocks as the modal card
 * (AlcoveCard with layout="page"), so behaviors (sample request, custom
 * amount, favorite, share, taste, add-to-cart, sold-out states) are shared,
 * never duplicated. On lg+ identity/facts/order form a 340px left rail with the
 * reading content on the right; below lg it is a single column with the
 * commerce bar fixed above the bottom nav.
 */
export const ProductPage: React.FC<ProductPageProps> = ({ onAddToCart, onCartClick, cartItemCount = 0 }) => {
  // Named :id for the route, but it now carries the readable address on new
  // links and a legacy UUID on old ones. The resolver accepts either.
  const { id: routeKey } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const persistedStoreSlug = useAppStore(state => state.shopStoreSlug);
  const storeSlug = searchParams.get('store')?.trim() || persistedStoreSlug;
  const shopHref = storeSlug ? `/shop?store=${encodeURIComponent(storeSlug)}` : '/shop';
  const { inventory, isLoading, refetch: refetchInventory } = useInventory();
  const { isAdmin } = useAuth();

  const item = useMemo(() => findProductByRouteParam(inventory, routeKey), [inventory, routeKey]);

  /*
   * Recently viewed is recorded here because here is where a tea is opened.
   * It used to be recorded by the shop's modal card, and when the shop started
   * opening this page instead the modal stopped appearing, so nothing recorded
   * anything and the shop's recently-viewed ordering quietly went dead. It is
   * the page's job now.
   */
  const addRecentlyViewed = useAppStore(state => state.addRecentlyViewed);
  useEffect(() => {
    if (item?.id) addRecentlyViewed(item.id);
  }, [item?.id, addRecentlyViewed]);

  // Tasting session (customers) / product tasting editor (admins): same
  // behaviors the shop grids attach to the modal card.
  const [tastingItem, setTastingItem] = useState<InventoryItem | null>(null);
  const [adminTastingItem, setAdminTastingItem] = useState<InventoryItem | null>(null);

  // Editing this tea in place. The admin catalogue is fetched only when signed
  // in as an admin, so a reader's cold load never fires an authenticated
  // request it would only get a 401 from.
  const { data: adminProducts = [] } = useProducts({ enabled: isAdmin });
  const adminRecord = useMemo(
    () => (isAdmin && item ? adminProducts.find((p: Product) => p.id === item.id) ?? null : null),
    [isAdmin, item, adminProducts],
  );

  const handleTaste = useCallback((tasteItem: InventoryItem) => {
    if (isAdmin) {
      setAdminTastingItem(tasteItem);
      return;
    }
    setTastingItem(tasteItem);
  }, [isAdmin]);

  // Tasting-term cross-reference: send the reader into the filtered shop.
  const handleTermClick = useCallback((termId: string, categoryId: string) => {
    const param = categoryId === 'feeling' ? 'feel' : 'flavor';
    const next = new URLSearchParams();
    if (storeSlug) next.set('store', storeSlug);
    next.set(param, termId);
    navigate(`/shop?${next.toString()}`);
  }, [navigate, storeSlug]);

  // The tasting overlay now also carries the tea's details form, which needs
  // the whole record. Use the real one when the admin catalogue has loaded and
  // fall back to this minimal shape so the tasting questions still open if it
  // has not.
  const adminTastingProductShim: Product | null = useMemo(() => {
    if (!adminTastingItem) return null;
    if (adminRecord && adminRecord.id === adminTastingItem.id) return adminRecord;
    return {
      id: adminTastingItem.id,
      givenName: adminTastingItem.name,
      productName: adminTastingItem.variant || adminTastingItem.name,
      type: adminTastingItem.type as Product['type'],
      imageUrl: adminTastingItem.image || '',
      tasting: adminTastingItem.tasting,
    } as Product;
  }, [adminTastingItem, adminRecord]);

  // Inventory still loading on a cold load: hold the frame, don't 404 early.
  if (!item && isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmblemLoader />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-[fadeIn_0.5s_ease-out]">
        <h1 className="text-4xl font-serif text-tea-gold mb-4">Not Found</h1>
        <p className="text-sm text-tea-text-sec mb-8 max-w-md">
          This product could not be found. It may have been removed or the link may be incorrect.
        </p>
        <Link
          to={shopHref}
          className="cta-solid px-8 py-3 text-xs uppercase tracking-[0.2em] transition-colors"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  const pricePerGram = parseFloat(item.price_per_gram || '0');
  const isSoldOut = (item.stock_g ?? 0) <= 0;
  const introduction = item.description || '';
  const mainStory = item.lore || '';
  const metaDescription = (introduction || mainStory || `${item.type} tea from ${item.origin}`).slice(0, 160);

  // One shape for everything the wisdom base is asked about this product, built
  // exactly the way AlcoveCard builds it, so the page body and the structured
  // data below resolve from the same fields rather than two similar subsets.
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

  // The plant's public page. One address, so a machine and a reader follow the
  // same door. `#taxon` matches the id CultivarPage publishes for the same
  // plant, so the two documents describe one entity, not two look-alikes.
  const siteOrigin = typeof window === 'undefined' ? '' : window.location.origin;
  const cultivarUrl = lineageCultivar ? `${siteOrigin}${cultivarPath(lineageCultivar.id)}` : null;
  const productHref = buildPublicProductHref({ id: item.id, slug: item.slug }, storeSlug);
  const productUrl = `${siteOrigin}${productHref}`;

  // The crumb between the shop and this tea, resolved through the same
  // vocabulary the rest of the shop reads, so a record saved as "Red" and one
  // saved as "Black" land on one crumb rather than two. Teaware has no crumb:
  // the teaware tab does not read a type from the address, and a crumb that
  // lands nowhere is worse than no crumb.
  const crumbType = item.category === 'ware' ? null : normalizeTeaType(item.type) ?? item.type;
  const typeHref = crumbType ? `${shopHref}${shopHref.includes('?') ? '&' : '?'}type=${encodeURIComponent(crumbType)}` : null;

  /**
   * What this tea actually costs, in the currency this page is priced in.
   *
   * The offer used to state one hardcoded price for a fifty gram serving, but
   * 50g exists only as one of four presets, so the single quoted price was a
   * serving nobody could buy. Now: one offer per quantity the page will
   * actually sell, each carrying the grams it is priced for, wrapped in an
   * aggregate so a crawler that wants a single number gets an honest range
   * instead of an invented midpoint. The presets mirror AlcoveCard's, which is
   * what the reader is given controls for.
   */
  const sliderMax = Math.max(5, Math.floor(item.stock_g || 0));
  const presets = [25, 50, 100, 250].filter(p => p <= sliderMax);
  const offerCurrency = PUBLISHED_CURRENCY;
  const offerPrice = (usd: number) => usd.toFixed(2);
  const availability = isSoldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock';
  const quantityOffers = presets.map(gramsOffered => ({
    '@type': 'Offer',
    '@id': `${productUrl}#offer-${gramsOffered}g`,
    price: offerPrice(pricePerGram * gramsOffered),
    priceCurrency: offerCurrency,
    // GRM is the UN/CEFACT code for a gram, the unit every control on this
    // page is denominated in.
    eligibleQuantity: { '@type': 'QuantitativeValue', value: gramsOffered, unitCode: 'GRM' },
    availability,
    seller: { '@type': 'Organization', name: 'Teajia' },
    url: productUrl,
  }));
  // Sold out or stocked under the smallest preset, there is no quantity to
  // quote, so the page states a price for one gram rather than for nothing.
  const smallestOfferPrice = offerPrice(pricePerGram * (presets[0] ?? 1));

  // JSON-LD structured data for SEO. A graph, not a single node: the product,
  // and the plant it is made from, addressed so the plant can be followed.
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${productUrl}#product`,
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
        offers: quantityOffers.length > 1
          ? {
              '@type': 'AggregateOffer',
              priceCurrency: offerCurrency,
              lowPrice: smallestOfferPrice,
              highPrice: offerPrice(pricePerGram * presets[presets.length - 1]),
              offerCount: quantityOffers.length,
              availability,
              offers: quantityOffers,
            }
          : quantityOffers[0],
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
          { '@type': 'ListItem', position: 1, name: 'Shop', item: `${siteOrigin}${shopHref}` },
          ...(crumbType && typeHref
            ? [{ '@type': 'ListItem', position: 2, name: crumbType, item: `${siteOrigin}${typeHref}` }]
            : []),
          { '@type': 'ListItem', position: crumbType ? 3 : 2, name: item.name, item: productUrl },
        ],
      },
    ],
  };

  // No fade on the page root. Anything whose visibility depends on an
  // animation running to completion is one throttled tab or one interrupted
  // frame away from a page that never fully appears, and this one was found
  // sitting at 11% opacity. The route change already carries its own
  // crossfade, so the page itself simply exists.
  return (
    <div className="paper-ground w-full">
      <Helmet>
        <title>{`${item.name} · Teajia`}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={`${item.name} · Teajia`} />
        <meta property="og:description" content={(introduction || mainStory || '').slice(0, 160)} />
        {item.image && <meta property="og:image" content={item.image} />}
        <meta property="og:type" content="product" />
        {/* The smallest quantity the page will actually sell, in the currency
            the page is priced in. */}
        <meta property="product:price:amount" content={smallestOfferPrice} />
        <meta property="product:price:currency" content={offerCurrency} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      {/* Back: page nav, top-left. Editing lives on the card's own Edit, which
          opens this tea's details inside the tasting overlay. */}
      {/* The page's own bar: where you came from on the left, where you are
          going on the right, one hairline under both. */}
      <div className="mb-1 flex h-[60px] w-full items-center justify-between gap-4 border-b border-tea-border px-2 lg:px-10">
        <Link
          to={shopHref}
          aria-label="Back to shop"
          className="tap-target inline-flex items-center gap-2 font-sans text-ui-12 uppercase tracking-[0.14em] text-tea-text-sec transition-colors hover:text-tea-text"
        >
          <Icons.Back className="h-3.5 w-3.5" />
          <span>Shop</span>
          {crumbType && (
            <>
              <span aria-hidden="true" className="text-tea-text-dim">/</span>
              <span>{crumbType}</span>
            </>
          )}
        </Link>
        {/* The way to the order. As plain caps at the far corner it read as a
            crumb rather than a control and was routinely missed, so it carries
            a tint, the bag, and a filled count that is the only solid shape in
            the bar. */}
        {onCartClick && (
          <button
            type="button"
            onClick={onCartClick}
            aria-label={
              cartItemCount > 0
                ? `Open order with ${cartItemCount} ${cartItemCount === 1 ? 'item' : 'items'}`
                : 'Open order'
            }
            className="tap-target inline-flex shrink-0 items-center gap-[9px] bg-tea-gold/10 py-2 pl-3 pr-2.5 font-sans text-ui-11 font-medium uppercase tracking-[0.14em] text-tea-text transition-colors hover:bg-tea-gold/[0.17]"
          >
            <Icons.Bag className="h-[15px] w-[15px] shrink-0 text-tea-gold-lt" aria-hidden="true" />
            <span>View order</span>
            {cartItemCount > 0 && (
              <span
                className={`cta-solid inline-flex h-[19px] min-w-[19px] items-center justify-center px-1 text-ui-11 font-semibold ${NUMERAL}`}
              >
                {cartItemCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* The quiet page: same blocks and behaviors as the modal card */}
      <AlcoveCard
        item={item}
        layout="page"
        onAddToCart={onAddToCart}
        onTermClick={handleTermClick}
        onTaste={handleTaste}
        publicHref={productHref}
        orderAccess={
          onCartClick && cartItemCount > 0
            ? <ProductOrderAccess onCartClick={onCartClick} cartItemCount={cartItemCount} />
            : undefined
        }
        onOpenOrder={onCartClick}
        isAdmin={isAdmin}
        onEditProductTasting={isAdmin ? (editItem) => setAdminTastingItem(editItem) : undefined}
      />

      {/* Tasting session (customers) */}
      <AnimatePresence>
        {tastingItem && (
          <TastingSession
            item={tastingItem}
            onClose={() => setTastingItem(null)}
            onOrderTea={(ordered: TastingItem) => {
              // Already on this product's page: just close the session.
              setTastingItem(null);
              if (ordered.id !== item.id) {
                // A TastingItem carries only an id, so resolve it back to the
                // catalogue row to get its readable address.
                const orderedItem = findProductByRouteParam(inventory, ordered.id);
                navigate(buildPublicProductHref({ id: ordered.id, slug: orderedItem?.slug }, storeSlug));
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Admin: product tasting editor, same modal used from the admin panel */}
      {adminTastingItem && adminTastingProductShim && (
        <TastingEditorModal
          product={adminTastingProductShim}
          // Edit on the card means "change this tea", so land on its details,
          // but only once the full record is in hand.
          canEditDetails={!!adminRecord}
          startOnDetails
          onDetailsChanged={refetchInventory}
          onClose={() => { setAdminTastingItem(null); refetchInventory(); }}
          onSaved={() => {
            setAdminTastingItem(null);
            refetchInventory();
          }}
        />
      )}

    </div>
  );
};

export default ProductPage;
