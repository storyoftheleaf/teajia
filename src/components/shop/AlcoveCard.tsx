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
import { useSampleCartStore } from '../../samples/sampleCartStore';
import type { InventoryItem, Story } from '../../types';
import { ContentType } from '../../types';

import { AlcoveShell } from './alcove/AlcoveShell';
import { AlcoveGallery } from './alcove/AlcoveGallery';
import { AlcoveIdentityHeader, AlcoveStorySection } from './alcove/AlcoveIdentityHeader';
import { AlcoveSensoryGrid } from './alcove/AlcoveSensoryGrid';
import { AlcoveJournalSection } from './alcove/AlcoveJournalSection';
import { AlcoveCommerceFooter } from './alcove/AlcoveCommerceFooter';
import { SampleModal, CustomAmountModal, ImageOverlayModal } from './alcove/AlcoveModals';
import { ProductImpressions, type ProductImpression } from './ProductImpressions';

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

/** Converts a string to Title Case */
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
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
  const showFade = useScrollFade(scrollRef);

  // Fetch events that featured this product
  const { data: productEvents, isLoading: eventsLoading } = useProductEvents(item.id);
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
  const sliderStep = 5;
  const snapPoints = [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500].filter(p => p <= sliderMax);
  const total = formatPrice ? formatPrice(pricePerGram, grams) : fmtNum(Math.ceil(pricePerGram * grams), 0);
  const perGramDisplay = formatPrice ? formatPrice(pricePerGram, 1) : fmtNum(pricePerGram);
  const sliderPercentage = sliderMax > sliderMin ? ((grams - sliderMin) / (sliderMax - sliderMin)) * 100 : 0;

  const stockStatus = getStockStatus(item.stock_g);
  const isSoldOut = stockStatus.level === 'out';

  const presets = [25, 50, 100, 250].filter(p => p <= sliderMax);

  // Snap to nearest marked point on release
  const snapToNearest = (val: number) => {
    const snapThreshold = 10;
    for (const sp of snapPoints) {
      if (Math.abs(val - sp) <= snapThreshold) return sp;
    }
    return val;
  };

  // Move in 5g increments, with magnetic snap near marked points
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value);
    // Round to nearest 5
    const rounded = Math.round(raw / 5) * 5;
    const clamped = Math.max(sliderMin, Math.min(sliderMax, rounded));
    // Magnetic snap to marked points during drag
    const magnetThreshold = 6;
    for (const sp of snapPoints) {
      if (Math.abs(clamped - sp) <= magnetThreshold) {
        if (sp !== grams) {
          setGrams(sp);
          if (navigator.vibrate) navigator.vibrate(8);
        }
        return;
      }
    }
    if (clamped !== grams) {
      setGrams(clamped);
    }
  };

  const noteOpacities = [1, 0.82, 0.65, 0.5];
  const markerOpacities = [0.7, 0.5, 0.35, 0.2];
  const markerWidths = [18, 16, 14, 12];

  // Alcove uses the main Espresso+Gold palette — see designTokens.ts
  const alcoveColors = {
    bg: 'var(--tea-bg)',
    title: 'var(--tea-text)',
    subtitle: 'var(--tea-text-sec)',
    body: 'var(--tea-text-sec)',
    bodyHighlight: 'var(--tea-text)',
    note: 'var(--tea-text-sec)',
    accent: 'var(--tea-gold)',
    muted: 'var(--tea-text-sec)',
    mutedDark: 'var(--tea-text-sec)',
    success: 'var(--tea-leaf)',
  };
  const accent = alcoveColors.accent;
  const typeColor = getTeaColor(item.type);

  // Derive display values from InventoryItem
  const productName = item.variant || item.name;
  const givenName = item.variant !== item.name ? item.name : '';
  // Strip numbers and latin characters — only show actual CJK characters
  const chineseCharacters = (item.chineseName || '').replace(/[0-9A-Za-z\s]/g, '');
  const teaType = item.type;
  const origin = item.origin;
  const vintage = item.year;
  const mainStory = item.lore || '';
  const introduction = item.description || '';
  const terroir = item.terroir || '';
  const processing = item.processingNotes || '';
  const notes = item.tags || [];
  const feeling = item.mood || '';
  const feelingDescription = item.experience || '';
  const photoUrl = item.image;
  const magazineUrl = item.magazineUrl;

  // Collect all available images (main + additional), max 3
  const allImages = [photoUrl, ...(item.additionalImages || [])].filter(Boolean).slice(0, 3);

  // Parse mood into individual tags (comma-separated or single phrase)
  const moodTags = feeling
    ? feeling.includes(',')
      ? feeling.split(',').map(t => t.trim()).filter(Boolean)
      : [feeling]
    : [];

  // Scroll overflow detection — handled by useScrollFade(scrollRef)

  const handleAdd = () => {
    if (isSoldOut) return;
    if (sampleMode) {
      handleSampleClick();
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    if (onAddToCart) {
      onAddToCart(item, grams, parseFloat(total));
    }
  };

  // Share handler — uses Web Share API with clipboard fallback.
  const handleShare = async () => {
    const shareText = `${item.name} — ${origin} ${teaType} from Teajia`;
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

  // Suppress unused-variable warnings for items kept for completeness
  void sliderStep;
  void sliderPercentage;
  void noteOpacities;
  void markerOpacities;
  void markerWidths;
  void snapToNearest;
  void handleSliderChange;
  void onClose;

  return (
    <AlcoveShell
      alcoveBg={alcoveColors.bg}
      chineseCharacters={chineseCharacters}
      scrollRef={scrollRef}
      showFade={showFade}
      commerceFooter={
        <AlcoveCommerceFooter
          item={item}
          alcoveBg={alcoveColors.bg}
          alcoveColors={alcoveColors}
          accent={accent}
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
      {/* Identity header: title, meta bar, vendor link, story prose, impressions */}
      <AlcoveIdentityHeader
        item={item}
        productName={productName}
        givenName={givenName}
        teaType={teaType}
        origin={origin || ''}
        vintage={vintage}
        alcoveColors={alcoveColors}
        isAdmin={isAdmin}
        onNavigateSource={() => navigate(`/admin/people?tab=sources&search=${encodeURIComponent(item.supplier!)}`)}
      />

      <ProductImpressions impressions={impressions} />

      {/* Gallery: product image anchor before long editorial prose */}
      <AlcoveGallery
        allImages={allImages}
        itemName={item.name}
        onExpandImage={(url) => { setExpandedImageUrl(url); setImageExpanded(true); }}
      />

      <AlcoveStorySection
        item={item}
        allImages={allImages}
        magazineUrl={magazineUrl}
        mainStory={mainStory}
        introduction={introduction}
        feelingDescription={feelingDescription}
        alcoveColors={alcoveColors}
      />

      {/* Sensory grid: tasting notes, mood tags, tasted count */}
      <AlcoveSensoryGrid
        item={item}
        notes={notes}
        moodTags={moodTags}
        typeColor={typeColor}
        isAdmin={isAdmin}
        onEditProductTasting={onEditProductTasting}
        onTermClick={onTermClick}
        tastingCount={tastingCount}
      />

      {/* === TERROIR & PROCESSING — quiet appendix === */}
      {(terroir || processing) && (
        <div style={{
          padding: "0 20px",
          marginTop: "28px",
          marginBottom: "8px",
        }}>
          {terroir && (
            <div>
              <h3 style={{
                fontFamily: "var(--font-display)",
                fontSize: "10px", fontWeight: 400,
                textTransform: "uppercase", letterSpacing: "0.12em",
                color: "var(--tea-text-dim)",
                margin: "0 0 6px 0",
              }}>
                Terroir
              </h3>
              <p style={{
                fontFamily: "var(--font-body)",
                fontSize: "15px", fontWeight: 300, lineHeight: 1.75,
                color: alcoveColors.body, margin: 0,
                whiteSpace: "pre-line",
              }}>
                {terroir}
              </p>
            </div>
          )}
          {processing && (
            <div style={{ marginTop: terroir ? "20px" : 0 }}>
              {terroir && (
                <div style={{
                  height: "1px", marginBottom: "14px",
                  background: "var(--tea-border)",
                }} />
              )}
              <h3 style={{
                fontFamily: "var(--font-display)",
                fontSize: "10px", fontWeight: 400,
                textTransform: "uppercase", letterSpacing: "0.12em",
                color: "var(--tea-text-dim)",
                margin: "0 0 6px 0",
              }}>
                Processing
              </h3>
              <p style={{
                fontFamily: "var(--font-body)",
                fontSize: "15px", fontWeight: 300, lineHeight: 1.75,
                color: alcoveColors.body, margin: 0,
                whiteSpace: "pre-line",
              }}>
                {processing}
              </p>
            </div>
          )}
        </div>
      )}

      {/* === FEATURED IN EVENTS === */}
      {eventsLoading && (
        <div style={{
          marginTop: "28px",
          padding: "0 20px 8px",
        }}>
          <div style={{
            width: "120px", height: "10px",
            background: "var(--tea-accent-sub)",
            borderRadius: "3px",
            marginBottom: "10px",
          }} />
          {[0, 1].map(i => (
            <div key={i} style={{
              height: "40px",
              background: "var(--tea-accent-sub)",
              borderRadius: "6px",
              marginBottom: "8px",
              animation: "pulse 1.8s ease-in-out infinite",
              opacity: i === 1 ? 0.6 : 0.8,
            }} />
          ))}
        </div>
      )}
      {productEvents && productEvents.length > 0 && (
        <div style={{
          marginTop: "28px",
          padding: "0 20px 8px",
        }}>
          <h3 style={{
            fontFamily: "var(--font-display)",
            fontSize: "10px", fontWeight: 400,
            textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--tea-text-dim)",
            margin: "0 0 10px 0",
          }}>
            Featured in {productEvents.length} {productEvents.length === 1 ? 'event' : 'events'}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {productEvents.map(evt => {
              const eventDate = new Date(evt.event_date);
              const formattedDate = eventDate.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              });
              return (
                <button
                  key={evt.id}
                  type="button"
                  className="alcove-event-btn"
                  onClick={() => navigate(`/event/${evt.slug}`)}
                >
                  {evt.flyer_image_url ? (
                    <img
                      src={evt.flyer_image_url}
                      alt=""
                      style={{
                        width: "36px", height: "36px",
                        borderRadius: "4px", objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div style={{
                      width: "36px", height: "36px",
                      borderRadius: "4px",
                      background: "var(--tea-surface)",
                      border: "1px solid var(--tea-border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="var(--tea-text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "13px", fontWeight: 400,
                      color: "var(--tea-text)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {evt.title}
                    </div>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px", fontWeight: 400,
                      color: "var(--tea-text-dim)",
                      marginTop: "2px",
                    }}>
                      {formattedDate}
                      {evt.location_name ? ` · ${evt.location_name}` : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Journal: "From the journal" (card style) + editorial links (both instances) */}
      <AlcoveJournalSection
        relatedArticles={relatedArticles}
        item={item}
      />

    </AlcoveShell>
  );
};
