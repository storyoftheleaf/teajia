import React, { useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useScrollFade } from './alcove/hooks/useScrollFade';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { api } from '../../lib/api';
import { useTastingCount, useTastingEntry } from '../../hooks/useTastingCount';
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
import { AlcoveOriginLine } from './alcove/AlcoveOriginLine';
import { AlcoveSectionHeading } from './alcove/AlcoveSectionHeading';
import { AlcoveTastingPlate } from './alcove/AlcoveTastingPlate';
import { AlcoveCharacterBand } from './alcove/AlcoveCharacterBand';
import { AlcoveAboutSection } from './alcove/AlcoveAboutSection';
import { AlcoveTableSection } from './alcove/AlcoveTableSection';
import { AlcoveCommerceFooter, wholePieceOf } from './alcove/AlcoveCommerceFooter';
import { SampleModal, CustomAmountModal, ImageOverlayModal } from './alcove/AlcoveModals';
import { TeaReference, type TeaReferenceProduct } from '../wisdom/TeaReference';
import type { ProductImpression } from './ProductImpressions';
import { resolveProductResearch } from '../../wisdom/productResearch';
import { buildPublicProductHref } from '../../lib/publicProductNavigation';
import { minimumOrderGrams, quoteGrams, sellUnitOf, snapToUnit } from '../../lib/teaPricing';
import { resolveTermLabel } from '../../data/tastingTaxonomy';
import { resolveLineage } from '../wisdom/TeaLineage';
import { regionElevationPresentation } from '../../wisdom/regions';

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
  onTaste?: (item: InventoryItem, intent?: 'edit' | 'notes') => void;
  /** Admin-only: called to open the product tasting editor (writes to the product's own tasting field). */
  onEditProductTasting?: (item: InventoryItem) => void;
  /** Canonical public route, including store context on standalone pages. */
  publicHref?: string;
  /** Product-page-only control kept beside ordering reassurance. */
  orderAccess?: React.ReactNode;
  /** Opens the order. The page bar's tan block is the only caller. */
  onOpenOrder?: () => void;
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

export const AlcoveCard: React.FC<AlcoveCardProps> = ({ item, onAddToCart, onClose, isAdmin, onEdit, formatPrice, onTermClick, onTaste, onEditProductTasting, publicHref, orderAccess, onOpenOrder, layout = 'card' }) => {
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
  const tastingEntry = useTastingEntry(item.id);
  const [chosenGrams, setGrams] = useState(50);
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

  // A tea sold in sealed units has no amount below one unit, so that is where
  // its slider starts. Everything else starts at the shop's ordinary floor.
  const sellUnit = item.category === 'tea'
    ? sellUnitOf(item.form, item.pieceWeightG, item.soldInWholeUnits)
    : undefined;
  const unitGrams = sellUnit?.grams;
  const sliderMin = minimumOrderGrams(unitGrams);
  const sliderMax = Math.max(sliderMin, Math.floor(item.stock_g || 0));
  // One whole pressed piece ships as it is, so it is the one amount that
  // carries no handling. A sealed unit is the same fact, so it reads the same
  // way. Everything priced below reads this.
  const wholePiece = item.category === 'tea'
    ? (sellUnit ?? wholePieceOf(item.form, item.pieceWeightG))
    : undefined;
  const wholePieceGrams = wholePiece?.grams;
  // The amount actually on offer. A sealed tea rounds whatever was chosen up
  // to the next whole unit here, once, so every price, label and button below
  // reads an amount the shop can send rather than each guarding for itself.
  const grams = unitGrams ? snapToUnit(chosenGrams, unitGrams, sliderMax) : chosenGrams;
  // Numeric total (base currency), passed to onAddToCart. Display strings
  // are formatted separately; never parse a formatted string back to a number.
  const numericTotal = Math.ceil(quoteGrams(pricePerGram, grams, { wholePieceGrams }).totalUsd);

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
  // The shop's own formatter is where the pricing curve is applied, because
  // every surface reads its total through here. An admin override formats
  // against its own rate table and keeps that job untouched.
  const resolvedFormatPrice = formatPrice
    ?? ((usdPerGram: number, g: number) =>
      shopPrice.total(quoteGrams(usdPerGram, g, { wholePieceGrams }).totalUsd));
  const total = resolvedFormatPrice(pricePerGram, grams);
  // A rate is a complete display value. Public prices use the rate formatter;
  // admin overrides add their unit here, at the card boundary, exactly once.
  // The public rate is the EFFECTIVE one for the amount currently chosen, not
  // the shelf rate: handling is folded into the curve, so 50 g of a $0.15/g
  // tea costs $0.19 a gram, and quoting $0.15 beside a $10 total would have
  // the same button disagreeing with itself. The ladder quotes effective
  // rates too, so both read off the same curve.
  const rateLabel = formatPrice
    ? `${formatPrice(pricePerGram, 1)}/g`
    : shopPrice.perGram(quoteGrams(pricePerGram, grams, { wholePieceGrams }).perGramUsd);

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

  /**
   * Choosing an amount on the page bar puts it straight in the order.
   * It takes the grams explicitly rather than reading state, because the
   * state set a line earlier has not landed by the time this runs.
   */
  /* Choosing an amount CHOOSES it. It used to add to the order as well, on the
     argument that picking is the same act as adding, and the result was that
     changing your mind from 50 g to 100 g left both in the order: every
     adjustment bought another bag. Selection and purchase are two acts now,
     and the bar carries one control for each. */
  const handleChooseAmount = (g: number) => {
    if (isSoldOut) return;
    setGrams(g);
    setCustomMode(false);
  };

  /* Adds exactly what the bar was showing: the bar passes both the weight and
     the total it displayed, so the order can never store a different figure
     from the one the reader agreed to. */
  const handleAddAmount = (g: number, totalUsd: number) => {
    if (isSoldOut) return;
    if (onAddToCart) onAddToCart(item, g, Math.ceil(totalUsd));
  };

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
    const shareUrl = new URL(publicHref || buildPublicProductHref({ id: item.id, slug: item.slug }), window.location.origin).toString();

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

  const commerceFooter = (variant: 'pinned' | 'rail' | 'docked') => (
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
      formatPerGram={shopPrice.perGram}
      formatRate={shopPrice.rate}
      formatTotal={shopPrice.total}
      /* Only on the public path. An admin override formats against its own
         rate table and keeps naming its currency on every figure; the price
         list strips the name only when it is the one naming it, once, in the
         picker beside its heading. */
      formatPlainTotal={formatPrice ? undefined : shopPrice.plainTotal}
      onChooseAmount={variant === 'docked' ? handleChooseAmount : undefined}
      onAdd={variant === 'docked' ? handleAddAmount : undefined}
      onOpenOrder={variant === 'docked' ? onOpenOrder : undefined}
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
        wholePiece={wholePiece}
        unitGrams={unitGrams}
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
    <div className="relative lg:h-full">
      {/* The one door for an admin standing on a tea: it opens the tasting
          overlay on that tea's own details, with the tasting questions one
          step across. There is deliberately no second Edit elsewhere. */}
      {/* On the page the header is the label plate, which carries a keyline
          inset 12px in the hand and 24px on the desk, so the mark has to sit
          INSIDE that line rather than across it. At right-3 top-3 it did not:
          it landed 22 to 46px in from the plate's edge and the desk keyline
          runs at 24, so the line crossed the word.

          Two things make the offsets below look arbitrary and both are real.
          `tap-target` centres the label in a 44px box, so the visible text sits
          9px in horizontally and 16px down from that box. And the button is
          positioned against the wrapper, which the plate is inset 18px inside
          at the sides below lg. Each number is the inset the plate wants, less
          those. Measured, not derived: the text clears the keyline by 10px in
          the hand and 14px on the desk. The card layout has no plate and keeps
          the corner it always had. */}
      {isAdmin && onEditProductTasting && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEditProductTasting(item); }}
          className={`tap-target absolute z-10 font-sans text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim transition-colors hover:text-tea-gold ${
            layout === 'page'
              ? 'right-[32px] top-[6px] lg:right-7 lg:top-[22px]'
              : 'right-3 top-3'
          }`}
          aria-label="Edit this tea"
        >
          Edit
        </button>
      )}
      <AlcoveIdentityHeader
        item={item}
        variant={layout === 'page' ? 'plate' : 'plain'}
        footNote={
          layout === 'page' && wholePieceGrams
            ? `One whole ${(wholePiece?.label ?? '').toLowerCase()} · ${wholePieceGrams}g`
            : undefined
        }
        standfirst={layout === 'page' ? introduction : undefined}
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

  // 2. Facts ledger: what the shop and the wisdom base together know.
  //
  // One row read as an accident rather than as restraint: a tea with no
  // recorded year and no liquor colour showed Origin alone under a heading.
  // The wisdom base already holds the elevation of the place this tea comes
  // from, written once and improving on every tea the day it is corrected, so
  // the ledger asks it rather than leaving the space empty. Its own label
  // comes through with it, because a county elevation and a tea-growing
  // elevation are not the same claim and the base is careful about which it
  // is offering.
  const ledgerRegion = item.category === 'tea'
    ? resolveLineage({
        name: item.name,
        chineseName: item.chineseName,
        origin: item.origin,
        cultivar: item.cultivar,
      }).region
    : null;
  const ledgerElevationRaw = regionElevationPresentation(ledgerRegion);
  // The base's long label exists to stop a county's geographic range being read
  // as a tea-growing claim. Where the figure IS scoped to tea growing there is
  // nothing to guard against, so the ledger can say Elevation and stay honest.
  // Anything else keeps the qualifier it came with.
  const ledgerElevation = ledgerElevationRaw
    ? {
        ...ledgerElevationRaw,
        label: ledgerRegion?.elevation?.scope === 'tea_growing' ? 'Elevation' : ledgerElevationRaw.label,
      }
    : null;

  /*
   * The page states where the tea is from as one floating block under the
   * label; the card still states it as a ledger, because a glance wants rows
   * and a page wants a place. Same facts, same source, two registers.
   */
  const originLine = (
    <AlcoveOriginLine
      origin={item.origin}
      harvest={item.year}
      elevation={ledgerElevation}
      forestCover={ledgerRegion?.forestCover}
      treeCharacter={ledgerRegion?.treeCharacter}
    />
  );

  const factsLedger = (
    <AlcoveFactsLedger
      origin={item.origin}
      harvest={item.year}
      liquorTermId={liquorTermId}
      elevation={ledgerElevation}
      forestCover={ledgerRegion?.forestCover}
      treeCharacter={ledgerRegion?.treeCharacter}
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
      onTaste={layout === 'page' ? undefined : onTaste}
      tastingEntry={tastingEntry}
      open={layout === 'page'}
    />
  );

  /*
   * Your own tasting, on the page. It used to live inside the character band,
   * which put your words inside the shop's claim about the tea. It stands on
   * its own now, directly above the reading, so the record says what the tea
   * is and this says what you did with it.
   */
  const tastingRow = onTaste ? (
    <div className="mx-5 mt-6">
      <AlcoveTastingPlate
        variant="standalone"
        entry={tastingEntry}
        onTaste={intent => onTaste(item, intent)}
      />
    </div>
  ) : null;

  // 5. About this tea: story + terroir + craft as one reading chapter
  const aboutSection = (
    <AlcoveAboutSection
      variant={layout === 'page' ? 'page' : 'card'}
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

  /**
   * Follow the thread.
   *
   * The page used to stop dead at the end of the last chapter. These are the
   * threads this tea is actually on, each one a real filter on the shop rather
   * than a decorative tag: where it comes from, what it is, and the one taste
   * word the reader is most likely to be chasing. Nothing here is invented, so
   * a tea with no recorded taste simply shows fewer threads.
   */
  const shopStoreSlug = useAppStore.getState().shopStoreSlug;
  const threadBase = shopStoreSlug ? `/shop?store=${encodeURIComponent(shopStoreSlug)}&` : '/shop?';
  const threadOriginName = (item.origin ?? '').split(',')[0]?.trim();
  const firstFlavor = item.tasting?.flavor?.[0];
  const threads = [
    ...(threadOriginName ? [{ key: 'origin', label: `More from ${threadOriginName}`, href: `${threadBase}origin=${encodeURIComponent(threadOriginName)}` }] : []),
    ...(teaType ? [{ key: 'type', label: `Other ${teaType.toLowerCase()}`, href: `${threadBase}type=${encodeURIComponent(teaType)}` }] : []),
    ...(firstFlavor ? [{ key: 'flavor', label: resolveTermLabel(firstFlavor), href: `${threadBase}flavor=${encodeURIComponent(firstFlavor)}` }] : []),
  ];

  const threadSection = threads.length > 0 ? (
    <div className="alcove-body-section mt-10 lg:mt-12">
      <AlcoveSectionHeading label="Follow the thread" size="lg" className="mb-[18px] lg:mb-5" />
      <div className="flex flex-wrap justify-center gap-2">
        {threads.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigate(t.href)}
            className="tap-target inline-flex min-h-[38px] items-center bg-tea-gold/8 px-3.5 font-body text-ui-14 text-tea-text transition-colors hover:bg-tea-gold/6"
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  ) : null;

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
  /* The order bar's right-hand block IS the way to the order, and it carries
     the total. A second row under it repeating "View order" was 45px of the
     screen spent saying the same thing twice, and it only appeared once there
     was an order, which is exactly when the block above it was already
     shouting. The crumb bar at the top of the page carries the same link for
     anyone who has scrolled away from the bar. */
  const commerceReassurance = null; 

  // ── Page layout: the "quiet page" at /shop/product/:id on cold loads ─────
  if (layout === 'page') {
    return (
      <article className="mx-auto w-full max-w-[1280px]">
        {/* Two columns on lg: the label standing full height, and the reading
            taking everything else. There was a third, a narrow order rail, and
            it was the page's weakest idea: it gave one tea two places to buy
            it and took 320px off the reading to do so. Ordering is the bar at
            the foot now, the same object the phone gets. The label is a panel
            rather than a header here, which is what lets this page hold up on
            a tea with no photograph at all. */}
        {/* The label takes a SHARE of the page, not a fixed 520px. 520 is what
            the design file draws at 1440, where it is 36% and reads as an
            accent beside the reading; pinned, the same number is 57% of a
            900px window and the tea's own words end up in a gutter. As a
            percentage it stays 520 at 1440 and gets out of the way below it,
            capped so it never grows past what the file draws. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,min(36%,520px))_minmax(0,1fr)] lg:items-stretch lg:gap-0">
          <div className="lg:h-full lg:border-r lg:border-tea-border">
            {identityHeader}
          </div>

          {/* The reading, with what the shop knows at the top of it */}
          <div className="lg:min-w-0 lg:px-7 lg:pt-2">
            {originLine}
            {gallery}
            {characterBand}
            {tastingRow}
            <div className="mt-10 lg:mt-12">{aboutSection}</div>
            {referenceSection}
            {tableSection}
            {threadSection}
          </div>

        </div>

        {/* One order bar at every width. Below lg it docks onto the top edge of
            the bottom navigation so the two read as one object; on lg it rests
            at the foot of the reading instead, since there is no navigation
            there to join. commerce-dock owns both geometries, and squares the
            nav's top corners while it is sitting on it. */}
        <div className="commerce-dock paper-surface z-nav">
          {commerceFooter('docked')}
          {commerceReassurance}
        </div>
        {/* Clearance for the fixed bar's own height, at both widths: on the
            phone the app shell's pb-nav-gap-lg covers the navigation and this
            covers the bar above it, and on the desk there is no navigation but
            the bar is still fixed, so the reading needs to end above it. */}
        <div aria-hidden="true" className="h-40 lg:h-28" />

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
