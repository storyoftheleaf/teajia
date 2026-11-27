import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../hooks/useAuth';
import { ProductDetailContent } from '../components/shop/AlcoveCard';
import { reviewedLotProse } from '../wisdom/reference/namedTeaLots';
import { normalizeTeaType } from '../wisdom';
import { cultivarPath, resolveLineage } from '../components/wisdom/TeaLineage';
import type { TeaReferenceProduct } from '../components/wisdom/TeaReference';
import { TastingSession, type TastingItem } from '../components/tasting/TastingSession';
import { TastingEditorModal } from '../admin/components/TastingEditorModal';
import { EmblemLoader } from '../components/shared/EmblemLoader';
import type { InventoryItem } from '../types';
import type { Product } from '../admin/types';
import { useAppStore } from '../lib/store';
import { authPagePath, tastingReturnPath } from '../lib/authNavigation';
import { buildPublicProductHref, DEFAULT_PUBLIC_STORE_SLUG, findProductByRouteParam, resolveInventoryStoreSlug } from '../lib/publicProductNavigation';
import { fetchStore, fetchStoreProduct } from '../lib/storefrontApi';
import { resolveContactChannels } from '../lib/contact';
import { teawareOrderSizes, teawareUnitPrice } from '../lib/teawareOrder';
import { quoteGrams, sellUnitOf, wholePieceOf } from '../lib/teaPricing';
import { useProducts } from '../admin/hooks/useAdminData';
import { api } from '../lib/api';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { ProductDetailPageContext } from '../components/shop/ProductDetailLayout';
import { YoursStrip } from '../components/shop/YoursStrip';
import { boughtTeaItem, boughtTopLine, useMyBoughtTeas } from '../lib/myBoughtTeas';


interface ProductPageProps {
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onCartClick?: () => void;
  cartItemCount?: number;
  /**
   * This same page opened over a private link (a /c/ collection, an
   * invoice's pay page; Adrian, 2026-11-27: "have it be the store, just add an
   * extra bit on top of it"). The link names the tea instead of the address,
   * brings the tea as it knows it for a private tea the shop does not list,
   * its own bit on top, its own order footer (null for none), and Back.
   */
  link?: {
    productKey: string;
    fallbackItem: InventoryItem;
    top?: React.ReactNode;
    /** The tea is theirs on this link (an invoice): the line for the strip that is theirs, in place of `top`. */
    yoursLine?: string;
    /** Added to the address they come back to after joining, so the link finishes what it started (an invoice keeps itself). */
    joinMarker?: string;
    /** The link's own order footer; null for none; left out, the shop's own for a tea the shop sells, none for a private one. */
    footer?: React.ReactNode;
    onBack: () => void;
  };
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
export const ProductPage: React.FC<ProductPageProps> = ({ onAddToCart, onCartClick, cartItemCount = 0, link }) => {
  // Named :id for the route, but it now carries the readable address on new
  // links and a legacy UUID on old ones. The resolver accepts either.
  const { id: routeParam } = useParams<{ id: string }>();
  const routeKey = link?.productKey ?? routeParam;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const persistedStoreSlug = useAppStore(state => state.shopStoreSlug);
  const requestedStoreSlug = searchParams.get('store')?.trim();
  const storeSlug = requestedStoreSlug || persistedStoreSlug;
  const shopHref = storeSlug ? `/shop?store=${encodeURIComponent(storeSlug)}` : '/shop';
  const { inventory, isLoading, isError: inventoryError, refetch: refetchInventory } = useInventory();
  const { isAdmin, isAuthenticated } = useAuth();

  const scopedListing = !link && Boolean(requestedStoreSlug && requestedStoreSlug !== DEFAULT_PUBLIC_STORE_SLUG);
  const browseItem = useMemo(() => scopedListing ? null : findProductByRouteParam(inventory, routeKey), [scopedListing, inventory, routeKey]);
  const activeStore = resolveInventoryStoreSlug(searchParams, persistedStoreSlug);
  const linkedProduct = useQuery({
    queryKey: ['storefront', 'product', activeStore, routeKey],
    queryFn: () => fetchStoreProduct(activeStore, routeKey!),
    enabled: !link && !!routeKey && (scopedListing || (!isLoading && !browseItem)),
    refetchOnMount: scopedListing ? 'always' : true,
    retry: false,
  });
  // A seller link must confirm the exact listing with that seller's product reader.
  // In particular an older list snapshot cannot reopen a withdrawn offer.
  const checkingSeller = scopedListing && !linkedProduct.isFetchedAfterMount && !linkedProduct.isError;
  // A tea the person bought says so on top of its page, and a private one the
  // shop does not list still opens from what their order carries.
  const { byId: boughtById } = useMyBoughtTeas();
  const boughtFallback = !link && routeKey ? boughtById.get(routeKey) : undefined;
  const item = link
    ? (browseItem ?? (isLoading ? null : link.fallbackItem))
    : browseItem ?? (checkingSeller ? null : linkedProduct.isError ? (boughtFallback ? boughtTeaItem(boughtFallback) : null) : linkedProduct.data);
  const bought = item ? boughtById.get(item.id) : undefined;
  const yoursLine = link ? link.yoursLine : bought ? boughtTopLine(bought) : undefined;
  const productStore = useQuery({
    queryKey: ['storefront', 'store', activeStore],
    queryFn: () => fetchStore(activeStore),
    enabled: !!item && !item.ordersPaused && (item.stock_g <= 0 || item.exactPackPriceUsd != null),
    retry: false,
  });

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

  // Surface 3 / Lane F: published creators whose public tea selection
  // includes this product. Public read, so it is safe to fire before the
  // reader has signed in, and quiet when nobody has selected the tea --
  // enabled only once an item has resolved, never fired on a 404.
  const selectedByQuery = useQuery({
    queryKey: ['product-selected-by', item?.id],
    queryFn: () => api.products.getSelectedBy(item!.id),
    enabled: Boolean(item?.id),
    staleTime: 1000 * 60 * 5,
  });
  const selectedBy = selectedByQuery.data?.selected_by ?? [];

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

  /*
   * Speaking about a tea is one tap from the tea. The plate offers Note beside
   * Edit, and the intent rides through so the session opens on the notes
   * workspace rather than on the questions with the NOTE word to be hunted for
   * along the taskbar.
   */
  const [tastingOpensOnNotes, setTastingOpensOnNotes] = useState(false);
  const joinMarker = link?.joinMarker;
  const joinSearch = useCallback(() => {
    if (!joinMarker) return window.location.search;
    const params = new URLSearchParams(window.location.search);
    params.set(joinMarker, '1');
    return `?${params.toString()}`;
  }, [joinMarker]);

  const handleTaste = useCallback((tasteItem: InventoryItem, intent?: 'edit' | 'notes') => {
    setTastingOpensOnNotes(intent === 'notes');
    /*
     * A tasting is kept, so it needs somewhere to be kept. Signed out there is
     * no journal to write into: the entry would live in this browser, never
     * reach the shop, and be gone with the next cleared cache. So the door is
     * the account, and they come straight back to this tea afterwards.
     *
     * Only the shop asks this. A guest tasting a sample the shop posted, or
     * sitting at a table at an event, is somewhere else entirely and is not
     * sent to a sign-up form mid-session.
     */
    if (!isAuthenticated) {
      const back = tastingReturnPath(window.location.pathname, joinSearch());
      navigate(`/signup?returnTo=${encodeURIComponent(back)}`);
      return;
    }
    setTastingItem(tasteItem);
  }, [isAuthenticated, navigate, joinSearch]);

  // The strip that is theirs: Photo opens the page's own photo door, Keep is
  // the page's own save. Signed out, either goes through joining and back here.
  const [photoAsk, setPhotoAsk] = useState(0);
  const favoriteTeas = useAppStore(state => state.favoriteTeas);
  const toggleFavoriteTea = useAppStore(state => state.toggleFavoriteTea);
  const joinThen = useCallback((then: () => void) => {
    if (isAuthenticated) { then(); return; }
    navigate(authPagePath('signup', `${window.location.pathname}${joinSearch()}`));
  }, [isAuthenticated, navigate, joinSearch]);

  // Coming back from joining at "Add your tasting": open the tasting they asked for
  // and take the marker out of the address so a reload does not open it again.
  const wantsTasting = searchParams.get('taste') === '1' || window.location.hash === '#private-tasting';
  useEffect(() => {
    if (!wantsTasting || !isAuthenticated || item?.category !== 'tea') return;
    const next = new URLSearchParams(searchParams);
    next.delete('taste');
    setSearchParams(next, { replace: true });
    setTastingOpensOnNotes(true);
    setTastingItem(item);
  }, [wantsTasting, isAuthenticated, item, searchParams, setSearchParams]);

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
  if (!item && (checkingSeller || (!scopedListing && isLoading) || linkedProduct.isLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmblemLoader />
      </div>
    );
  }

  if (!item && (linkedProduct.isError || (!scopedListing && inventoryError))) {
    return (
      <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h1 className="h2 mb-3">Product unavailable</h1>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec mb-6 max-w-md`}>
          We could not load this product right now. Please try again.
        </p>
        <button type="button" onClick={() => { if (!scopedListing) void refetchInventory(); if (routeKey) void linkedProduct.refetch(); }} className="btn-primary btn-primary-lg tap-target">
          Try again
        </button>
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
          className="btn-primary btn-primary-lg"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  const pricePerGram = parseFloat(item.price_per_gram ?? '');
  const isWare = item.category === 'ware';
  const unitPrice = isWare ? teawareUnitPrice(item) : null;
  const priceKnown = isWare ? unitPrice != null : Number.isFinite(pricePerGram) && pricePerGram >= 0;
  const isSoldOut = !item.ordersPaused && (item.stock_g ?? 0) <= 0;
  const introduction = item.description || '';
  const mainStory = reviewedLotProse(item.id, 'lore', item.lore) || '';
  const fallbackDescription = [item.type || item.name, item.origin && `from ${item.origin}`].filter(Boolean).join(' ');
  const description = introduction || mainStory || fallbackDescription;
  const metaDescription = description.slice(0, 160);

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
  const { cultivar: lineageCultivar, region: lineageRegion } = item.category === 'tea'
    ? resolveLineage(referenceProduct) : { cultivar: null, region: null };

  // The plant's public page. One address, so a machine and a reader follow the
  // same door. `#taxon` matches the id CultivarPage publishes for the same
  // plant, so the two documents describe one entity, not two look-alikes.
  const siteOrigin = typeof window === 'undefined' ? '' : window.location.origin;
  const cultivarUrl = lineageCultivar ? `${siteOrigin}${cultivarPath(lineageCultivar.id)}` : null;
  const productHref = buildPublicProductHref({ id: item.id, slug: item.slug }, storeSlug);
  const productUrl = `${siteOrigin}${productHref}`;
  const storeProfile = productStore.data?.slug === activeStore ? productStore.data : undefined;
  const sellerStore = item.exactPackPriceUsd != null ? storeProfile : undefined;
  const contact = isSoldOut && storeProfile ? resolveContactChannels({
    whatsappNumber: storeProfile.whatsapp_number,
    email: storeProfile.contact_email,
    subject: item.category === 'tea' ? `Purchase inquiry for ${item.name}` : `Restock alert for ${item.name}`,
    message: `Hello ${storeProfile.name}, ${item.category === 'tea'
      ? `I’m interested in purchasing more ${item.name}. Could you keep me in mind if you find it again or source something similar?`
      : `please let me know when ${item.name} is back in stock.`}\n${siteOrigin}${buildPublicProductHref(item, activeStore)}`,
  }) : undefined;
  const availabilityContact = contact?.whatsapp
    ? { href: contact.whatsapp.href, opensNewTab: true }
    : contact?.email && { href: contact.email.href, opensNewTab: false };

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
   *
   * A tea sold in sealed units quotes those units instead. Publishing a 25 g
   * offer for a tea that only exists as a 100 g box would put an amount nobody
   * can buy into the structured data, where a crawler repeats it.
   */
  const sliderMax = Math.max(5, Math.floor(item.stock_g || 0));
  const sellUnit = item.category === 'tea'
    ? sellUnitOf(item.form, item.pieceWeightG, item.soldInWholeUnits)
    : undefined;
  const presets = isWare
    ? teawareOrderSizes(Math.max(1, Math.floor(item.stock_g || 0)))
    : sellUnit
      ? [1, 2, 3, 4].map(n => n * sellUnit.grams).filter(p => p <= sliderMax)
      : [25, 50, 100, 250].filter(p => p <= sliderMax);
  // A sealed unit is a whole piece from the curve's own side; a pressed cake,
  // brick or tuo that is not sold in units is the same fact by weight. Either
  // way this is the figure `quoteGrams` needs to know when a preset carries no
  // handling fee.
  const wholePiece = item.category === 'tea'
    ? (sellUnit ?? wholePieceOf(item.form, item.pieceWeightG))
    : undefined;
  const offerCurrency = PUBLISHED_CURRENCY;
  const offerPrice = (usd: number) => usd.toFixed(2);
  // The same curve the ladder, the cart and the order total read. This graph
  // used to state cost times grams with no handling fee, so a crawler quoted
  // a price the page itself does not charge, which is the mismatch schema.org
  // rich results are built to flag.
  const quotedTotal = (quantity: number) => unitPrice != null ? unitPrice * quantity :
    (item.exactPackPriceUsd ?? quoteGrams(pricePerGram, quantity, { wholePieceGrams: wholePiece?.grams }).totalUsd);
  const availability = isSoldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock';
  const quantityOffers = (priceKnown ? presets : []).map(quantity => ({
    '@type': 'Offer',
    '@id': `${productUrl}#offer-${quantity}${isWare ? '-piece' : 'g'}`,
    price: offerPrice(quotedTotal(quantity)),
    priceCurrency: offerCurrency,
    eligibleQuantity: { '@type': 'QuantitativeValue', value: quantity, unitCode: isWare ? 'H87' : 'GRM' },
    availability,
    ...(storeProfile?.name || item.exactPackPriceUsd == null ? {
      seller: { '@type': 'Organization', name: storeProfile?.name ?? 'Teajia' },
    } : {}),
    url: productUrl,
  }));
  // Sold out or stocked under the smallest preset, there is no quantity to
  // quote, so the page states a price for one gram rather than for nothing.
  const smallestOfferPrice = priceKnown ? offerPrice(quotedTotal(presets[0] ?? 1)) : undefined;

  // JSON-LD structured data for SEO. A graph, not a single node: the product,
  // and the plant it is made from, addressed so the plant can be followed.
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${productUrl}#product`,
        name: item.name,
        description,
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
              highPrice: offerPrice(quotedTotal(presets[presets.length - 1])),
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
  const yoursActs = Boolean(yoursLine && browseItem && item.category === 'tea');
  return (
    <div className="paper-ground w-full">
      {yoursLine
        ? (
          <YoursStrip
            line={yoursLine}
            kept={favoriteTeas.includes(item.id)}
            {...(yoursActs ? {
              onTaste: () => handleTaste(item, 'notes'),
              onPhoto: () => joinThen(() => setPhotoAsk(n => n + 1)),
              onKeep: () => joinThen(() => toggleFavoriteTea(item.id)),
            } : {})}
          />
        )
        : link?.top}
      {!link && <Helmet>
        <title>{`${item.name} · Teajia`}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={`${item.name} · Teajia`} />
        <meta property="og:description" content={metaDescription} />
        {item.image && <meta property="og:image" content={item.image} />}
        <meta property="og:type" content="product" />
        {/* The smallest quantity the page will actually sell, in the currency
            the page is priced in. */}
        {smallestOfferPrice !== undefined && <meta property="product:price:amount" content={smallestOfferPrice} />}
        <meta property="product:price:currency" content={offerCurrency} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>}

      <ProductDetailPageContext.Provider value={{
        shopHref: sellerStore ? `/store/${encodeURIComponent(sellerStore.slug)}` : shopHref,
        shopName: sellerStore?.name, crumbType: sellerStore ? null : crumbType, selectedBy, onCartClick, cartItemCount,
        onBack: link?.onBack, photoAsk, yoursActs,
      }}>
        <ProductDetailContent
          key={item.id}
          item={item}
          onAddToCart={onAddToCart}
          onTermClick={handleTermClick}
          onTaste={handleTaste}
          publicHref={productHref}
          availabilityContact={availabilityContact || undefined}
          onOpenOrder={onCartClick}
          isAdmin={isAdmin}
          onEditProductTasting={isAdmin ? (editItem) => setAdminTastingItem(editItem) : undefined}
          {...(link && (link.footer !== undefined || !browseItem) ? { linkFooter: link.footer ?? null } : {})}
        />
      </ProductDetailPageContext.Provider>

      {/* Tasting session (customers) */}
      <AnimatePresence>
        {tastingItem && (
          <TastingSession
            item={{ ...tastingItem, sourceType: 'product' }}
            startOnNotes={tastingOpensOnNotes}
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
          startOnNotes={tastingOpensOnNotes}
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
