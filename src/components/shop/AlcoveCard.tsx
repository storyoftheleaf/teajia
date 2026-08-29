import React, { useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useScrollFade } from './alcove/hooks/useScrollFade';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { api } from '../../lib/api';
import { useTastingCount } from '../../hooks/useTastingCount';
import { useShopPrice } from './shopPrice';
import { useProductEvents } from '../../hooks/useProductEvents';
import { useStories } from '../../context/StoryContext';
import { useAuth } from '../../hooks/useAuth';
import { getTeaColor } from '../../designTokens';
import { LIQUOR_COLORS } from '../../data/tastingTaxonomy';
import { useSampleCartStore } from '../../samples/sampleCartStore';
import type { InventoryItem } from '../../types';
import { ContentType } from '../../types';

import { AlcoveShell } from './alcove/AlcoveShell';
import { AlcoveGallery } from './alcove/AlcoveGallery';
import { AlcoveIdentityHeader } from './alcove/AlcoveIdentityHeader';
import { AlcoveFactsLedger } from './alcove/AlcoveFactsLedger';
import { AlcoveCharacterBand } from './alcove/AlcoveCharacterBand';
import { AlcoveAboutSection } from './alcove/AlcoveAboutSection';
import { AlcoveTableSection } from './alcove/AlcoveTableSection';
import { AlcoveCommerceFooter } from './alcove/AlcoveCommerceFooter';
import { SampleModal, CustomAmountModal, ImageOverlayModal } from './alcove/AlcoveModals';
import { TeaReference, type TeaReferenceProduct } from '../wisdom/TeaReference';
import type { ProductImpression } from './ProductImpressions';
import { resolveProductResearch } from '../../wisdom/productResearch';

interface AlcoveCardProps {
  item: InventoryItem;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onClose?: () => void;
  /** Admin mode: shows edit button */
  isAdmin?: boolean;
  /** Called when admin clicks edit */
  onEdit?: (item: InventoryItem) => void;
  /** Called when user clicks a tasting note for cross-reference filtering */
  onTermClick?: (termId: string, categoryId: string) => void;
  /** Custom price formatter (admin uses formatCurrency with rates) */
  formatPrice?: (pricePerGram: number, grams: number) => string;
  /** Called when user wants to start a tasting session */
  onTaste?: (item: InventoryItem) => void;
  /** Admin-only: called to open the product tasting editor (writes to the product's own tasting field). */
  onEditProductTasting?: (item: InventoryItem) => void;
  /** Canonical public route, including store context on standalone pages. */
  publicHref?: string;
  /** Product-page-only control kept beside ordering reassurance. */
  orderAccess?: React.ReactNode;
  /**
   * 'card' (default) is the modal quiet card inside AlcoveShell (internal
   * scroll, pinned commerce bar). 'page' is the standalone product-page
   * composition: identity + facts + order module as a 340px left rail on lg+,
   * reading content right, single column with a fixed commerce bar below lg.
   * Both layouts share the exact same state, handlers, and section blocks.
   */
  layout?: 'card' | 'page';
}

/** Returns stock status info for display */
function getStockStatus(stockG: number, status?: string) {
  if (status === 'Sold Out' || stockG <= 0) {
    return { label: 'Sold Out', color: '#a65d4e', level: 'out' as const };
  }
  if (stockG < 100) {
    return { label: 'Low Stock', color: '#c09a51', level: 'low' as const };
  }
  return { label: 'In Stock', color: 'var(--tea-leaf)', level: 'ok' as const };
}

/**
 * Converts "#rrggbb" to an "r g b" string for CSS custom properties.
 *
 * Space-separated to match `--tea-gold-rgb`, because the value lands inside
 * `rgb(<channels> / <alpha>)` in card-utilities.css. A comma form parses as a
 * legacy three-argument rgb() and silently kills the whole declaration.
 */
function hexToRgbString(hex: string): string | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return undefined;
  const int = parseInt(match[1], 16);
  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`;
}

export const AlcoveCard: React.FC<AlcoveCardProps> = ({ item, onAddToCart, onClose, isAdmin, onEdit, formatPrice, onTermClick, onTaste, onEditProductTasting, publicHref, orderAccess, layout = 'card' }) => {
  const navigate = useNavigate();
  const { favoriteTeas, toggleFavoriteTea, activeAccountId } = useAppStore();

  // Local sample cart (flask / sample list)
  const inSampleCart = useSampleCartStore(s => s.items.some(i => i.id === item.id));
  const addToSampleCart = useSampleCartStore(s => s.addItem);
  const removeFromSampleCart = useSampleCartStore(s => s.removeItem);
  const toggleSampleCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inSampleCart) {
      removeFromSampleCart(item.id);
    } else {
      addToSampleCart({
        id: item.id,
        name: item.name,
        chineseName: item.chineseName,
        type: item.type,
        vendorName: item.supplier || undefined,
        productId: item.id,
      });
    }
  };

  // Sample request modal state
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [sampleGrams, setSampleGrams] = useState<5 | 10 | 15>(5);
  const [sampleNote, setSampleNote] = useState('');
  const [sampleSubmitting, setSampleSubmitting] = useState(false);
  const [sampleDone, setSampleDone] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);

  const { isAuthenticated: isLoggedIn } = useAuth();

  const handleSampleClick = () => {
    setSampleModalOpen(true);
    setSampleGrams(10);
    setSampleDone(false);
    setSampleError(null);
    setSampleNote('');
  };

  const handleSampleSubmit = async () => {
    setSampleSubmitting(true);
    setSampleError(null);
    try {
      await api.samples.request({
        product_id: item.id,
        quantity_grams: sampleGrams,
        note: sampleNote || undefined,
        account_id: activeAccountId ?? undefined,
      });
      setSampleDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit request.';
      setSampleError(msg);
    } finally {
      setSampleSubmitting(false);
    }
  };

  const pricePerGram = parseFloat(item.price_per_gram || '0');

  const favorited = favoriteTeas.includes(item.id);
  const tastingCount = useTastingCount(item.id);
  const [grams, setGrams] = useState(50);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [added, setAdded] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const showFade = useScrollFade(scrollRef as React.RefObject<HTMLElement>);

  // Fetch events that featured this product
  const { data: productEvents } = useProductEvents(item.id);
  const { data: impressions = [] } = useQuery<ProductImpression[]>({
    queryKey: ['product-impressions', item.id],
    queryFn: () => api.productImpressions.list(item.id),
    staleTime: 60_000,
  });
  const { data: xrefArticleResponse } = useQuery({
    queryKey: ['public-xref', 'product-articles', item.id],
    queryFn: () => api.publicXref.productArticles(item.id),
    staleTime: 5 * 60 * 1000,
  });

  // Related journal articles (stories with matching teaId, published articles only)
  const { stories } = useStories();
  const relatedArticles = useMemo(() => {
    if (xrefArticleResponse) return xrefArticleResponse.articles;
    return stories
      .filter(s => s.teaId === item.id && s.status === 'published' && s.type === ContentType.Article)
      .map(story => ({ id: story.id, slug: story.slug || story.id, title: story.title }));
  }, [xrefArticleResponse, stories, item.id]);

  const sliderMin = 5;
  const sliderMax = Math.max(sliderMin, Math.floor(item.stock_g || 0));
  // Numeric total (base currency), passed to onAddToCart. Display strings
  // are formatted separately; never parse a formatted string back to a number.
  const numericTotal = Math.ceil(pricePerGram * grams);

  /**
   * Every figure on this card, in the currency the reader chose.
   *
   * The card quoted dollars unconditionally while the cart had honoured the
   * currency selector for a long time, so a reader set to Rupiah met dollars on
   * the card and Rupiah the moment they added the tea. `formatPrice` stays the
   * override the admin surfaces pass (they format against their own rate
   * table); when nobody overrides it, the shared shop hook fills the gap
   * instead of a bare `$`. Downstream blocks read `resolvedFormatPrice` and so
   * no longer carry a dollar-only fallback branch of their own.
   */
  const shopPrice = useShopPrice();
  const resolvedFormatPrice = formatPrice ?? ((usdPerGram: number, g: number) => shopPrice.total(usdPerGram * g));
  const total = resolvedFormatPrice(pricePerGram, grams);
  // A rate is a complete display value. Public prices use the rate formatter;
  // admin overrides add their unit here, at the card boundary, exactly once.
  const rateLabel = formatPrice
    ? `${formatPrice(pricePerGram, 1)}/g`
    : shopPrice.perGram(pricePerGram);

  const stockStatus = getStockStatus(item.stock_g);
  const isSoldOut = stockStatus.level === 'out';

  const presets = [25, 50, 100, 250].filter(p => p <= sliderMax);

  // Alcove uses the main Espresso+Gold palette (see designTokens.ts)
  const alcoveBg = 'var(--tea-bg)';
  const typeColor = getTeaColor(item.type);

  // Derive display values from InventoryItem
  const productName = item.variant || item.name;
  const givenName = item.variant !== item.name ? item.name : '';
  // Strip numbers and latin characters: only show actual CJK characters
  const chineseCharacters = (item.chineseName || '').replace(/[0-9A-Za-z\s]/g, '');
  const teaType = item.type;
  const mainStory = item.lore || '';
  const introduction = item.description || '';
  const terroir = item.terroir || '';
  const processing = item.processingNotes || '';
  const notes = item.tags || [];
  const photoUrl = item.image;
  const magazineUrl = item.magazineUrl;

  // Liquor color (first liquor-color term): ledger row + shell warmth tint
  const liquorTermId = item.tasting?.['liquor-color']?.[0];
  const liquorHex = liquorTermId ? LIQUOR_COLORS[liquorTermId] : undefined;
  const warmthRGB = liquorHex ? hexToRgbString(liquorHex) : undefined;

  // Collect all available images (main + additional), max 3
  const allImages = [photoUrl, ...(item.additionalImages || [])].filter(Boolean).slice(0, 3);

  const handleAdd = () => {
    if (isSoldOut) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    if (onAddToCart) {
      onAddToCart(item, grams, numericTotal);
    }
  };

  // Share handler: uses Web Share API with clipboard fallback.
  const handleShare = async () => {
    const shareText = `${item.name}, ${item.origin || ''} ${teaType} from Teajia`;
    const shareUrl = new URL(publicHref || `/shop/product/${encodeURIComponent(item.id)}`, window.location.origin).toString();

    if (navigator.share) {
      try {
        await navigator.share({
          title: item.name,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error: silent
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch {
        // Clipboard API unavailable
      }
    }
  };

  void onClose;

  // ── Shared blocks: one composition, two layouts ──────────────────────────

  const commerceFooter = (variant: 'pinned' | 'rail') => (
    <AlcoveCommerceFooter
      item={item}
      alcoveBg={alcoveBg}
      stockStatus={stockStatus}
      isSoldOut={isSoldOut}
      grams={grams}
      setGrams={setGrams}
      customMode={customMode}
      setCustomMode={setCustomMode}
      sliderMax={sliderMax}
      presets={presets}
      pricePerGram={pricePerGram}
      rateLabel={rateLabel}
      total={total}
      added={added}
      shareCopied={shareCopied}
      favorited={favorited}
      inSampleCart={inSampleCart}
      isAdmin={isAdmin}
      onEdit={onEdit}
      onTaste={onTaste}
      toggleFavoriteTea={toggleFavoriteTea}
      toggleSampleCart={toggleSampleCart}
      handleShare={handleShare}
      handleAdd={handleAdd}
      formatPrice={resolvedFormatPrice}
      variant={variant}
    />
  );

  const modals = (
    <>
      <SampleModal
        item={item}
        open={sampleModalOpen}
        onClose={() => { if (!sampleSubmitting) setSampleModalOpen(false); }}
        sampleGrams={sampleGrams}
        setSampleGrams={setSampleGrams}
        sampleNote={sampleNote}
        setSampleNote={setSampleNote}
        sampleSubmitting={sampleSubmitting}
        sampleDone={sampleDone}
        sampleError={sampleError}
        onSubmit={handleSampleSubmit}
        isLoggedIn={isLoggedIn}
        pricePerGram={pricePerGram}
        formatTotal={(usd) => resolvedFormatPrice(usd, 1)}
      />
      <CustomAmountModal
        open={customMode}
        onClose={() => setCustomMode(false)}
        sliderMax={sliderMax}
        customInput={customInput}
        setCustomInput={setCustomInput}
        setGrams={setGrams}
        pricePerGram={pricePerGram}
        formatTotal={(g) => resolvedFormatPrice(pricePerGram, g)}
        onRequestSample={handleSampleClick}
      />
      <ImageOverlayModal
        open={imageExpanded}
        expandedImageUrl={expandedImageUrl}
        itemName={item.name}
        onClose={() => { setImageExpanded(false); setExpandedImageUrl(null); }}
      />
    </>
  );

  // 1. Identity: centered serif header, hanzi as real text
  const identityHeader = (
    <div className="relative">
      {isAdmin && onEditProductTasting && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEditProductTasting(item); }}
          className="tap-target absolute right-3 top-3 z-10 font-sans text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim transition-colors hover:text-tea-gold"
          aria-label="Edit product"
        >
          Edit
        </button>
      )}
      <AlcoveIdentityHeader
        item={item}
        productName={productName}
        givenName={givenName}
        teaType={teaType}
        chineseCharacters={chineseCharacters}
        typeColor={typeColor}
        isAdmin={isAdmin}
        onNavigateSource={() => navigate(`/admin/people?tab=sources&search=${encodeURIComponent(item.supplier!)}`)}
      />
    </div>
  );

  // 2. Facts ledger: Origin / Harvest / Liquor
  const factsLedger = (
    <AlcoveFactsLedger
      origin={item.origin}
      harvest={item.year}
      liquorTermId={liquorTermId}
    />
  );

  // 3. Gallery band
  const gallery = (
    <AlcoveGallery
      allImages={allImages}
      itemName={item.name}
      onExpandImage={(url) => { setExpandedImageUrl(url); setImageExpanded(true); }}
    />
  );

  // What the wisdom base can resolve from this product's own fields.
  const referenceProduct: TeaReferenceProduct = {
    name: item.name,
    variant: item.variant,
    chineseName: item.chineseName,
    origin: item.origin,
    cultivar: item.cultivar,
    type: item.type,
    year: item.year,
  };
  const potentialResearch = item.category === 'tea'
    ? resolveProductResearch(referenceProduct)
    : null;

  // 4. Character: exact product tasting and cited shared potential remain separate.
  const characterBand = (
    <AlcoveCharacterBand
      item={item}
      legacyNotes={notes}
      onTermClick={onTermClick}
      potentialResearch={potentialResearch}
    />
  );

  // 5. About this tea: story + terroir + craft as one reading chapter
  const aboutSection = (
    <AlcoveAboutSection
      item={item}
      magazineUrl={magazineUrl}
      mainStory={mainStory}
      introduction={introduction}
      feelingDescription={item.experience || ''}
      terroir={terroir}
      processing={processing}
      mood={item.mood || ''}
    />
  );

  /**
   * 6. The plant and the maker: what the wisdom base knows.
   *
   * Not the shop's voice. Every fact here is written once in the wisdom base
   * and improves on every product the day it is corrected, which is why it sits
   * apart from Adrian's own words in the About chapter above.
   *
   * The card and the page render the same block, because a quick view that
   * omits the plant is not a quicker view of the page, it is a poorer document
   * about the same tea. Both render nothing when the base knows nothing, which
   * is the common case for a garden tea sold under the shop's own name and is
   * correct.
   *
   * No brewing table: the old one came from a per-tea-TYPE lookup, so every
   * oolong in the shop claimed the same water, steep, leaf, vessel and
   * infusion count regardless of what the leaf actually wanted. A number that
   * is not about this tea does not belong on this tea's page.
   */
  const referenceSection = (
    <div className="alcove-body-section mt-7">
      <TeaReference product={referenceProduct} />
    </div>
  );

  // 7. From the table: impression, events, journal, tasting count
  const tableSection = (
    <AlcoveTableSection
      impressions={impressions}
      events={productEvents ?? []}
      relatedArticles={relatedArticles}
      tastingCount={tastingCount}
    />
  );

  /**
   * The order-access strip on the page layout. It used to carry a promise
   * about WhatsApp turnaround; nothing in the system guarantees that, so the
   * claim is gone and the strip renders only when there is a control to hold.
   */
  const commerceReassurance = orderAccess ? (
    <div className="flex min-h-[44px] items-center gap-3 border-t border-tea-border bg-tea-bg px-3.5">
      {orderAccess}
    </div>
  ) : null;

  // ── Page layout: the "quiet page" at /shop/product/:id on cold loads ─────
  if (layout === 'page') {
    return (
      <article className="mx-auto w-full max-w-[1080px]">
        <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Left rail: identity, facts, and the order module */}
          <div className="lg:border-r lg:border-tea-border lg:pb-8">
            {identityHeader}
            {factsLedger}
            {/* Desktop order rail: hairline box; the commerce module stacks
                vertically inside it (order button full width). */}
            <div className="mx-6 mt-6 hidden border border-tea-border lg:block">
              {commerceFooter('rail')}
              {commerceReassurance}
            </div>
          </div>

          {/* Right column: the reading content */}
          <div className="lg:pt-3">
            {gallery}
            {characterBand}
            {aboutSection}
            {referenceSection}
            {tableSection}
          </div>
        </div>

        {/* Below lg the commerce module is a fixed bar sitting just above the
            mobile bottom nav (bottom-nav utility, never inline calc). */}
        <div className="fixed inset-x-0 bottom-nav z-sticky border-b border-tea-border lg:hidden">
          {commerceFooter('pinned')}
          {commerceReassurance}
        </div>
        {/* Clearance for the fixed bar's own height; the bottom nav clearance
            itself comes from the app shell's pb-nav-gap-lg on <main>. */}
        <div aria-hidden="true" className="h-40 lg:hidden" />

        {modals}
      </article>
    );
  }

  // ── Card layout: the modal quiet card ────────────────────────────────────
  return (
    <AlcoveShell
      alcoveBg={alcoveBg}
      chineseCharacters=""
      warmthRGB={warmthRGB}
      scrollRef={scrollRef}
      showFade={showFade}
      commerceFooter={commerceFooter('pinned')}
      modals={modals}
    >
      {identityHeader}
      {factsLedger}
      {gallery}
      {characterBand}
      {aboutSection}
      {referenceSection}
      {tableSection}

      {/* Breathing room above the pinned commerce footer */}
      <div aria-hidden="true" className="h-6" />
    </AlcoveShell>
  );
};
