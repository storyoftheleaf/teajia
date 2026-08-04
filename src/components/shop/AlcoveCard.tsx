import React, { useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useScrollFade } from './alcove/hooks/useScrollFade';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { api } from '../../lib/api';
import { useTastingCount } from '../../hooks/useTastingCount';
import { fmtNum } from '../../utils/formatNumber';
import { useProductEvents } from '../../hooks/useProductEvents';
import { useStories } from '../../context/StoryContext';
import { useAuth } from '../../hooks/useAuth';
import { getTeaColor } from '../../designTokens';
import { LIQUOR_COLORS } from '../../data/tastingTaxonomy';
import { useSampleCartStore } from '../../samples/sampleCartStore';
import type { InventoryItem, Story } from '../../types';
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
import type { ProductImpression } from './ProductImpressions';

interface AlcoveCardProps {
  item: InventoryItem;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onClose?: () => void;
  /** Admin mode — shows edit button */
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

/** Converts "#rrggbb" to an "r,g,b" string for rgba() interpolation. */
function hexToRgbString(hex: string): string | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return undefined;
  const int = parseInt(match[1], 16);
  return `${(int >> 16) & 255},${(int >> 8) & 255},${int & 255}`;
}

export const AlcoveCard: React.FC<AlcoveCardProps> = ({ item, onAddToCart, onClose, isAdmin, onEdit, formatPrice, onTermClick, onTaste, onEditProductTasting }) => {
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
  const [sampleMode, setSampleMode] = useState(false);
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

  // Related journal articles (stories with matching teaId, published articles only)
  const { stories } = useStories();
  const relatedArticles = useMemo<Story[]>(() =>
    stories.filter(
      s => s.teaId === item.id && s.status === 'published' && s.type === ContentType.Article
    ),
    [stories, item.id]
  );

  const sliderMin = 5;
  const sliderMax = Math.max(sliderMin, Math.floor(item.stock_g || 0));
  // Numeric total (base currency) — passed to onAddToCart. Display strings
  // are formatted separately; never parse a formatted string back to a number.
  const numericTotal = Math.ceil(pricePerGram * grams);
  const total = formatPrice ? formatPrice(pricePerGram, grams) : fmtNum(numericTotal, 0);
  const perGramDisplay = formatPrice ? formatPrice(pricePerGram, 1) : fmtNum(pricePerGram);

  const stockStatus = getStockStatus(item.stock_g);
  const isSoldOut = stockStatus.level === 'out';

  const presets = [25, 50, 100, 250].filter(p => p <= sliderMax);

  // Alcove uses the main Espresso+Gold palette — see designTokens.ts
  const alcoveBg = 'var(--tea-bg)';
  const typeColor = getTeaColor(item.type);

  // Derive display values from InventoryItem
  const productName = item.variant || item.name;
  const givenName = item.variant !== item.name ? item.name : '';
  // Strip numbers and latin characters — only show actual CJK characters
  const chineseCharacters = (item.chineseName || '').replace(/[0-9A-Za-z\s]/g, '');
  const teaType = item.type;
  const mainStory = item.lore || '';
  const introduction = item.description || '';
  const terroir = item.terroir || '';
  const processing = item.processingNotes || '';
  const notes = item.tags || [];
  const photoUrl = item.image;
  const magazineUrl = item.magazineUrl;

  // Liquor color (first liquor-color term) — ledger row + shell warmth tint
  const liquorTermId = item.tasting?.['liquor-color']?.[0];
  const liquorHex = liquorTermId ? LIQUOR_COLORS[liquorTermId] : undefined;
  const warmthRGB = liquorHex ? hexToRgbString(liquorHex) : undefined;

  // Collect all available images (main + additional), max 3
  const allImages = [photoUrl, ...(item.additionalImages || [])].filter(Boolean).slice(0, 3);

  const handleAdd = () => {
    if (isSoldOut) return;
    if (sampleMode) {
      handleSampleClick();
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    if (onAddToCart) {
      onAddToCart(item, grams, numericTotal);
    }
  };

  // Share handler — uses Web Share API with clipboard fallback.
  const handleShare = async () => {
    const shareText = `${item.name} — ${item.origin || ''} ${teaType} from Teajia`;
    const shareUrl = `${window.location.origin}/shop/product/${item.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: item.name,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error — silent
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

  return (
    <AlcoveShell
      alcoveBg={alcoveBg}
      chineseCharacters=""
      warmthRGB={warmthRGB}
      scrollRef={scrollRef}
      showFade={showFade}
      commerceFooter={
        <AlcoveCommerceFooter
          item={item}
          alcoveBg={alcoveBg}
          stockStatus={stockStatus}
          isSoldOut={isSoldOut}
          grams={grams}
          setGrams={setGrams}
          sampleMode={sampleMode}
          setSampleMode={setSampleMode}
          customMode={customMode}
          setCustomMode={setCustomMode}
          sliderMax={sliderMax}
          presets={presets}
          pricePerGram={pricePerGram}
          perGramDisplay={perGramDisplay}
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
          formatPrice={formatPrice}
        />
      }
      modals={
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
            formatPrice={formatPrice}
          />
          <CustomAmountModal
            open={customMode}
            onClose={() => setCustomMode(false)}
            sliderMax={sliderMax}
            customInput={customInput}
            setCustomInput={setCustomInput}
            setGrams={setGrams}
          />
          <ImageOverlayModal
            open={imageExpanded}
            expandedImageUrl={expandedImageUrl}
            itemName={item.name}
            onClose={() => { setImageExpanded(false); setExpandedImageUrl(null); }}
          />
        </>
      }
    >
      {/* 1. Identity — centered serif header, hanzi as real text */}
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

      {/* 2. Facts ledger — Origin / Harvest / Liquor */}
      <AlcoveFactsLedger
        origin={item.origin}
        harvest={item.year}
        liquorTermId={liquorTermId}
      />

      {/* 3. Gallery band */}
      <AlcoveGallery
        allImages={allImages}
        itemName={item.name}
        onExpandImage={(url) => { setExpandedImageUrl(url); setImageExpanded(true); }}
      />

      {/* 4. Character — taste, feel, and starred notes in one tonal band */}
      <AlcoveCharacterBand
        item={item}
        legacyNotes={notes}
        isAdmin={isAdmin}
        onEditProductTasting={onEditProductTasting}
        onTermClick={onTermClick}
      />

      {/* 5. About this tea — story + terroir + craft as one reading chapter */}
      <AlcoveAboutSection
        item={item}
        magazineUrl={magazineUrl}
        mainStory={mainStory}
        introduction={introduction}
        feelingDescription={item.experience || ''}
        terroir={terroir}
        processing={processing}
      />

      {/* 6. From the table — impression, events, journal, tasting count */}
      <AlcoveTableSection
        impressions={impressions}
        events={productEvents ?? []}
        relatedArticles={relatedArticles}
        tastingCount={tastingCount}
      />

      {/* Breathing room above the pinned commerce footer */}
      <div aria-hidden="true" className="h-6" />
    </AlcoveShell>
  );
};
