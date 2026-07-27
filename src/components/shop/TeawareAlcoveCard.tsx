import React, { useState, useRef } from 'react';
import { Heart, Minus, Plus } from 'lucide-react';
import { useScrollFade } from './alcove/hooks/useScrollFade';
import { AlcoveShell } from './alcove/AlcoveShell';
import { AlcoveIdentityHeader } from './alcove/AlcoveIdentityHeader';
import { ImageOverlayModal } from './alcove/AlcoveModals';
import { getStockStatus } from './stockStatus';
import { useShopPrice } from './shopPrice';
import type { InventoryItem } from '../../types';
import { useAppStore } from '../../lib/store';
import { buildOrderMessage, buildWhatsAppUrl } from '../../lib/whatsapp';
import { BODY, HEADING, LABEL, LABEL_NUMERAL } from '../shared/typeRoles';

/**
 * The teaware quick view, on the same system as the tea quick view.
 *
 * Six rounds of work landed on the tea card and none of it landed here, because
 * this file shared a folder with that card and nothing else. It ran its own
 * type scale (28 / 17 / 15 / 13 / 12 / 11 / 10, seven steps against the four
 * roles), its own colour bag of nine CSS-variable strings handed to inline
 * styles where the colour lint cannot read them, one literal `#5A6E5A` and one
 * literal `rgba(200,170,120,…)`, its own three-state stock reading, its own
 * hand-built fullscreen image viewer with no focus trap, two 32px quantity
 * buttons under the 44px floor, and an em-dashed share string, which the
 * project bans in all copy and which this one posted into other people's
 * clipboards.
 *
 * None of that was a decision about teaware. It was six hundred and seventy
 * three lines of the tea card as it stood before round one, kept alive by being
 * out of sight. The differences that are real are kept: a pot is bought by
 * looking at it, so the photograph stays a full square rather than a thumbnail
 * strip; and a pot is counted in pieces, not grams, so the amount control is a
 * stepper and the stock threshold is the piece threshold.
 */
interface TeawareAlcoveCardProps {
  item: InventoryItem;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onClose?: () => void;
}

export const TeawareAlcoveCard: React.FC<TeawareAlcoveCardProps> = ({ item, onAddToCart, onClose }) => {
  const { favoriteTeas, toggleFavoriteTea, activeAccount } = useAppStore();
  const favorited = favoriteTeas.includes(item.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const showFade = useScrollFade(scrollRef as React.RefObject<HTMLElement>);
  const galleryTouchStart = useRef<number | null>(null);

  const allImages = [item.image, ...(item.additionalImages || [])].filter(Boolean) as string[];
  const hasGallery = allImages.length > 1;
  const currentImage = allImages[activeImageIndex] || '';

  // price_50g is the per-piece price for teaware (legacy field name).
  const unitPrice = parseFloat(item.price_50g || '0');
  const stockStatus = getStockStatus(item.stock_g || 0, 'piece');
  const isSoldOut = stockStatus.level === 'out';
  const maxStock = Math.max(1, Math.floor(item.stock_g || 1));

  /**
   * Prices in the currency the reader chose, through the shop's one helper.
   *
   * This card quoted totals through `fmtNum`, a bare number, and glued a
   * literal `$` in front of it in two places, so the currency selector in the
   * cart moved the cart and left every teapot in dollars. `totalUsd` is kept as
   * a number beside the formatted string because the cart takes a number: the
   * previous code ran `parseFloat` over the formatted total, which added the
   * wrong amount the moment a formatter put a symbol or a separator in front of
   * the digits.
   */
  const shopPrice = useShopPrice();
  const totalUsd = unitPrice * quantity;

  const productName = item.variant || item.name;
  const givenName = item.variant !== item.name ? item.name : '';
  const chineseCharacters = item.chineseName || '';
  const material = item.material || '';
  const capacity = item.capacityMl ? `${item.capacityMl}ml` : '';
  const origin = item.terroir || item.origin || '';
  const story = item.lore || item.description || '';
  const technique = item.processingNotes || '';
  const feeling = item.mood || '';
  const feelingDescription = item.experience || '';
  const hasContent = Boolean(story || technique || feeling || feelingDescription);

  // One share string, written the way the tea card writes it: a comma, not the
  // em-dash the project bans, and the product's own address rather than a query
  // parameter pinned to whatever page the reader happened to be on.
  const handleShare = async () => {
    const shareText = `${item.name}, ${item.type} from Teajia`;
    const shareUrl = `${window.location.origin}/shop/product/${item.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text: shareText, url: shareUrl });
      } catch {
        // User cancelled, or the sheet was dismissed. Silent by design.
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch {
        // Clipboard API unavailable.
      }
    }
  };

  // The one checkout handoff, through the same builder the rest of the shop
  // uses, quoting the same figures the card shows and naming the currency it
  // quotes them in.
  const whatsappNumber = activeAccount?.whatsapp_number;
  const handleEnquiry = () => {
    if (!whatsappNumber) return;
    const message = buildOrderMessage({
      type: 'inquiry',
      items: [{
        name: item.name,
        variant: item.type,
        quantity,
        unit: '×',
        price: shopPrice.total(unitPrice),
        total: shopPrice.total(totalUsd),
      }],
      subtotal: shopPrice.total(totalUsd),
      total: shopPrice.total(totalUsd),
      notes: `Prices as shown on the site, in ${shopPrice.code}.`,
    });
    window.open(buildWhatsAppUrl(whatsappNumber, message), '_blank');
  };

  const handleAdd = () => {
    if (isSoldOut) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    onAddToCart?.(item, quantity, Math.round(totalUsd * 100) / 100);
  };

  const handleGalleryTouchStart = (e: React.TouchEvent) => {
    galleryTouchStart.current = e.touches[0].clientX;
  };

  const handleGalleryTouchEnd = (e: React.TouchEvent) => {
    if (galleryTouchStart.current === null) return;
    const diff = galleryTouchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40 && hasGallery) {
      if (diff > 0 && activeImageIndex < allImages.length - 1) setActiveImageIndex(i => i + 1);
      else if (diff < 0 && activeImageIndex > 0) setActiveImageIndex(i => i - 1);
    }
    galleryTouchStart.current = null;
  };

  void onClose;

  const commerceFooter = (
    <div className="alcove-commerce">
      {/* The stock line is a label carrying its own colour, and it is only
          printed when there is something worth saying, exactly as on the tea
          card. There is no dot: a coloured dot a gap away from the words "Low
          Stock", in the colour of those words, says what the words already say. */}
      {stockStatus.level !== 'ok' && (
        <div className="mb-1.5">
          <span className={`${LABEL} ${stockStatus.colorClass}`}>{stockStatus.label}</span>
        </div>
      )}

      {!isSoldOut && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="alcove-stepper">
            <button
              type="button"
              className="alcove-stepper-btn"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="One fewer"
            >
              <Minus size={14} strokeWidth={1.5} />
            </button>
            <span className={`alcove-stepper-value ${LABEL_NUMERAL}`} aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              className="alcove-stepper-btn"
              onClick={() => setQuantity(q => Math.min(maxStock, q + 1))}
              disabled={quantity >= maxStock}
              aria-label="One more"
            >
              <Plus size={14} strokeWidth={1.5} />
            </button>
          </div>

          <span className={`${LABEL_NUMERAL} text-tea-text-sec`}>
            {shopPrice.total(unitPrice)}
            {quantity > 1 && <span className={`${LABEL} ml-1 text-tea-text-dim`}>each</span>}
          </span>
        </div>
      )}

      <div className="flex gap-1.5">
        <div className="alcove-icon-cluster">
          <button
            type="button"
            className="alcove-icon-btn"
            data-active={favorited}
            onClick={() => toggleFavoriteTea(item.id)}
            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={favorited}
          >
            <Heart
              size={14}
              color={favorited ? 'var(--tea-gold)' : 'currentColor'}
              fill={favorited ? 'var(--tea-gold)' : 'none'}
              strokeWidth={1.5}
            />
          </button>
          <div className="alcove-icon-divider" />
          <button type="button" className="alcove-icon-btn" onClick={handleShare} aria-label="Share">
            <span className={`${LABEL} ${shareCopied ? 'text-tea-green' : ''}`}>
              {shareCopied ? 'Copied' : 'Share'}
            </span>
          </button>
        </div>

        <button
          type="button"
          className={`alcove-order-btn ${LABEL}`}
          onClick={handleAdd}
          disabled={isSoldOut}
          data-state={added ? 'added' : isSoldOut ? 'sold-out' : 'default'}
        >
          {isSoldOut ? (
            <span>Sold Out</span>
          ) : added ? (
            <span>Added</span>
          ) : (
            <>
              <span>Order</span>
              <span className={LABEL_NUMERAL}>{shopPrice.total(totalUsd)}</span>
            </>
          )}
        </button>
      </div>

      {/* One handoff, and it is the second one, so it is the quiet one. */}
      {whatsappNumber && !isSoldOut && (
        <button
          type="button"
          onClick={handleEnquiry}
          className={`${LABEL} mt-1.5 flex min-h-[44px] w-full items-center justify-center text-tea-text-sec transition-colors hover:text-tea-text`}
        >
          Ask about this piece
        </button>
      )}
    </div>
  );

  return (
    <AlcoveShell
      chineseCharacters={chineseCharacters}
      scrollRef={scrollRef}
      showFade={showFade}
      commerceFooter={commerceFooter}
      grainOpacity={0.04}
      warmthOpacities={[0.06, 0.03]}
      modals={
        <ImageOverlayModal
          open={Boolean(expandedImageUrl)}
          expandedImageUrl={expandedImageUrl}
          itemName={item.name}
          onClose={() => setExpandedImageUrl(null)}
        />
      }
    >
      {currentImage && (
        <div className="relative shrink-0" onTouchStart={handleGalleryTouchStart} onTouchEnd={handleGalleryTouchEnd}>
          <button
            type="button"
            className="alcove-hero"
            onClick={() => setExpandedImageUrl(currentImage)}
            aria-label={`View ${item.name} larger`}
          >
            <img key={currentImage} src={currentImage} alt={productName} className="alcove-hero-img" />
            <span className="alcove-hero-fade" />
          </button>
          {hasGallery && (
            <div className="alcove-hero-dots" role="group" aria-label="Product gallery">
              {allImages.map((img, i) => (
                <button
                  key={img}
                  type="button"
                  className="alcove-hero-dot"
                  data-active={i === activeImageIndex}
                  aria-label={`Show image ${i + 1} of ${allImages.length}`}
                  aria-pressed={i === activeImageIndex}
                  onClick={(e) => { e.stopPropagation(); setActiveImageIndex(i); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <AlcoveIdentityHeader
        item={item}
        productName={productName}
        givenName={givenName}
        facts={[material, capacity, origin]}
        onNavigateSource={() => {}}
      />

      {/* The craft sections, flat and separated by the one hairline the tea
          card uses. They were a filled, inset-shadowed panel carrying its own
          noise texture, which is a card inside a card: the alcove already has a
          surface, a grain layer and a warmth layer of its own. */}
      {hasContent && (
        <div className="alcove-body-section mt-6">
          {feeling && (
            <p className={`${HEADING} mb-4 mt-0 italic text-tea-text-sec`}>{feeling}</p>
          )}
          {story && (
            <p className={`${BODY} m-0 whitespace-pre-line text-tea-text-sec`}>{story}</p>
          )}
          {technique && (
            <div className="mt-5">
              {story && <div className="alcove-hairline" />}
              <h3 className={`${LABEL} mb-1.5 mt-0 text-tea-text-dim`}>Technique</h3>
              <p className={`${BODY} m-0 whitespace-pre-line text-tea-text-sec`}>{technique}</p>
            </div>
          )}
          {feelingDescription && (
            <div className="mt-5">
              {(story || technique) && <div className="alcove-hairline" />}
              <h3 className={`${LABEL} mb-1.5 mt-0 text-tea-text-dim`}>In use</h3>
              <p className={`${BODY} m-0 whitespace-pre-line text-tea-text-sec`}>{feelingDescription}</p>
            </div>
          )}
        </div>
      )}
    </AlcoveShell>
  );
};
