import React, { useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useScrollFade } from './alcove/hooks/useScrollFade';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { api } from '../../lib/api';
import { useTastingCount } from '../../hooks/useTastingCount';
import { useProductEvents } from '../../hooks/useProductEvents';
import { useStories } from '../../context/StoryContext';
import { useAuth } from '../../hooks/useAuth';
import { getTeaColor } from '../../designTokens';
import { getBrewingProfile } from '../../data/brewing-profiles';
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
import { TeaReference, type TeaReferenceProduct } from '../wisdom/TeaReference';
import { FactGrid } from '../wisdom/FactGrid';
import { getStockStatus } from './stockStatus';
import { useShopPrice } from './shopPrice';
import { BODY, LABEL } from '../shared/typeRoles';

interface AlcoveCardProps {
  item: InventoryItem;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onClose?: () => void;
  /** Admin mode, shows the edit button */
  isAdmin?: boolean;
  /** Called when admin clicks edit */
  onEdit?: (item: InventoryItem) => void;
  /** Called when user clicks a tasting note for cross-reference filtering */
  onTermClick?: (termId: string, categoryId: string) => void;
  /**
   * Price formatter override. The admin panel passes its own so a staff member
   * sees the account's working currency; without it the card uses the same
   * reader-chosen currency the cart and the product page use.
   */
  formatPrice?: (pricePerGram: number, grams: number) => string;
  /** Called when user wants to start a tasting session */
  onTaste?: (item: InventoryItem) => void;
  /** Admin-only: called to open the product tasting editor (writes to the product's own tasting field). */
  onEditProductTasting?: (item: InventoryItem) => void;
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

  /**
   * One price vocabulary, in the currency the reader chose.
   *
   * The card quoted totals through `fmtNum`, which prints a bare number, and
   * then the footer glued a literal `$` in front of it in four places. So the
   * currency selector in the cart moved the cart and nothing on the product,
   * and a reader browsing in Rupiah met dollars on every card that led them to
   * checkout. `useShopPrice` is the same conversion the cart already runs.
   *
   * `totalUsd` is kept as a number alongside the formatted string, because the
   * cart takes a number: the previous code ran `parseFloat` over the formatted
   * total, which silently added the wrong amount the moment a formatter put a
   * currency symbol or a thousands separator in front of the digits.
   */
  const shopPrice = useShopPrice();
  const totalUsd = pricePerGram * grams;
  const total = formatPrice ? formatPrice(pricePerGram, grams) : shopPrice.total(totalUsd);
  const sampleTotal = formatPrice ? formatPrice(pricePerGram, 10) : shopPrice.total(pricePerGram * 10);
  const perGramDisplay = formatPrice ? `${formatPrice(pricePerGram, 1)}/g` : shopPrice.perGram(pricePerGram);

  const stockStatus = getStockStatus(item.stock_g);
  const isSoldOut = stockStatus.level === 'out';

  const presets = [25, 50, 100, 250].filter(p => p <= sliderMax);

  const typeColor = getTeaColor(item.type);

  // Derive display values from InventoryItem
  const productName = item.variant || item.name;
  const givenName = item.variant !== item.name ? item.name : '';
  // Strip numbers and latin characters, only show actual CJK characters
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

  /**
   * What the tea is, not only how it is set.
   *
   * After five rounds the card and the page had the same type roles, the same
   * caption and the same sensory slot, and still disagreed about the substance:
   * the page told a reader which plant the tea is made from, who made it and
   * how to brew it, and the card told them none of the three. A quick view that
   * omits the plant is not a quicker view of the page, it is a different and
   * poorer document about the same tea.
   *
   * Both blocks resolve from the shared wisdom base and render nothing when it
   * knows nothing, which is the common case for a garden tea sold under the
   * shop's own name and is correct.
   */
  const referenceProduct: TeaReferenceProduct = {
    name: item.name,
    variant: item.variant,
    chineseName: item.chineseName,
    origin: item.origin,
    cultivar: item.cultivar,
    type: item.type,
    year: item.year,
  };
  const brewingProfile = item.category === 'tea' ? getBrewingProfile(item.type) : undefined;

  // Collect all available images (main + additional), max 3
  const allImages = [photoUrl, ...(item.additionalImages || [])].filter(Boolean).slice(0, 3);

  // Parse mood into individual tags (comma-separated or single phrase)
  const moodTags = feeling
    ? feeling.includes(',')
      ? feeling.split(',').map(t => t.trim()).filter(Boolean)
      : [feeling]
    : [];

  const handleAdd = () => {
    if (isSoldOut) return;
    if (sampleMode) {
      handleSampleClick();
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    if (onAddToCart) {
      onAddToCart(item, grams, Math.round(totalUsd * 100) / 100);
    }
  };

  // Share handler, uses the Web Share API with a clipboard fallback.
  const handleShare = async () => {
    const shareText = `${item.name}, ${origin} ${teaType} from Teajia`;
    const shareUrl = `${window.location.origin}/shop/product/${item.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: item.name,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // User cancelled or error, silent
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
      chineseCharacters={chineseCharacters}
      scrollRef={scrollRef}
      showFade={showFade}
      commerceFooter={
        <AlcoveCommerceFooter
          item={item}
          accent="var(--tea-gold)"
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
          sampleTotal={sampleTotal}
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
            formatTotal={(usd) => (formatPrice ? formatPrice(usd, 1) : shopPrice.total(usd))}
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
      />

      {/* Sensory grid: tasting notes, tasted count */}
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

      {/* === TERROIR & PROCESSING: quiet appendix === */}
      {(terroir || processing) && (
        <div className="alcove-body-section mb-2 mt-7">
          {terroir && (
            <div>
              <h3 className={`${LABEL} mb-1.5 mt-0 text-tea-text-dim`}>Terroir</h3>
              <p className={`${BODY} m-0 whitespace-pre-line text-tea-text-sec`}>{terroir}</p>
            </div>
          )}
          {processing && (
            <div className={terroir ? 'mt-5' : ''}>
              {terroir && <div className="alcove-hairline" />}
              <h3 className={`${LABEL} mb-1.5 mt-0 text-tea-text-dim`}>Processing</h3>
              <p className={`${BODY} m-0 whitespace-pre-line text-tea-text-sec`}>{processing}</p>
            </div>
          )}
        </div>
      )}

      {/* === THE PLANT, THE MAKER, THE BREW === */}
      <div className="alcove-body-section mt-7">
        <TeaReference product={referenceProduct} />
        {brewingProfile && (
          <div className="mb-6">
            <h3 className={`${LABEL} mb-2 mt-0 text-tea-text-dim`}>Brewing</h3>
            <FactGrid
              facts={[
                { label: 'Water', value: brewingProfile.waterTemp },
                { label: 'Steep', value: brewingProfile.steepTime },
                { label: 'Leaf', value: brewingProfile.leafRatio },
                { label: 'Vessel', value: brewingProfile.vessel },
                { label: 'Infusions', value: brewingProfile.infusions },
              ].filter(fact => Boolean(fact.value))}
            />
          </div>
        )}
      </div>

      {/* === FEATURED IN EVENTS === */}
      {eventsLoading && (
        <div className="alcove-body-section mt-7 pb-2">
          <div className="alcove-skeleton-label" />
          {[0, 1].map(i => (
            <div key={i} className="alcove-skeleton-row" data-second={i === 1} />
          ))}
        </div>
      )}
      {productEvents && productEvents.length > 0 && (
        <div className="alcove-body-section mt-7 pb-2">
          {/* Three words, so it stays a label. The count moved out of it:
              the events are listed directly beneath, and a number a reader can
              see is not a fact the heading has to carry. */}
          <h3 className={`${LABEL} mb-2.5 mt-0 text-tea-text-dim`}>Featured in</h3>
          <div className="flex flex-col gap-2">
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
                    <img src={evt.flyer_image_url} alt="" className="alcove-event-thumb" />
                  ) : (
                    <div className="alcove-event-thumb-empty">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={`${BODY} truncate text-tea-text`}>{evt.title}</div>
                    <div className={`${BODY} mt-0.5 text-tea-text-dim`}>
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
