import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScrollFade } from './alcove/hooks/useScrollFade';
import { useAppStore } from '../../lib/store';
import { fmtNum } from '../../utils/formatNumber';
import { getTeaColor } from '../../designTokens';
import type { InventoryItem } from '../../types';

import { AlcoveShell } from './alcove/AlcoveShell';
import { AlcoveGallery } from './alcove/AlcoveGallery';
import { AlcoveIdentityHeader } from './alcove/AlcoveIdentityHeader';
import { AlcoveFactsLedger, type LedgerRow } from './alcove/AlcoveFactsLedger';
import { AlcoveSectionHeading } from './alcove/AlcoveSectionHeading';
import { AlcoveCommerceFooter } from './alcove/AlcoveCommerceFooter';
import { ImageOverlayModal } from './alcove/AlcoveModals';
import { TeaPlaceholder } from './TeaPlaceholder';
import { buildPublicProductHref } from '../../lib/publicProductNavigation';

interface TeawareAlcoveCardProps {
  item: InventoryItem;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onClose?: () => void;
  /** Admin mode: shows edit button in the commerce footer */
  isAdmin?: boolean;
  /** Called when admin clicks edit */
  onEdit?: (item: InventoryItem) => void;
}

/**
 * Stock status for unit-counted teaware: stock_g holds whole units here,
 * so the tea gram thresholds don't apply.
 */
function getWareStockStatus(units: number) {
  if (units <= 0) {
    return { label: 'Sold Out', color: '#a65d4e', level: 'out' as const };
  }
  if (units <= 2) {
    return {
      label: units === 1 ? 'Only 1 left' : 'Only 2 left',
      color: '#c09a51',
      level: 'low' as const,
    };
  }
  return { label: 'In Stock', color: 'var(--tea-leaf)', level: 'ok' as const };
}

/**
 * Teaware alcove: the teaware fork of the quiet card. Reuses the shared
 * alcove chapter components (identity header, facts ledger, gallery, section
 * heading, commerce footer) with teaware-appropriate data: unit quantities
 * instead of grams, Material/Capacity ledger rows, and an "About this piece"
 * reading chapter.
 */
export const TeawareAlcoveCard: React.FC<TeawareAlcoveCardProps> = ({
  item,
  onAddToCart,
  onClose,
  isAdmin,
  onEdit,
}) => {
  const navigate = useNavigate();
  const { favoriteTeas, toggleFavoriteTea, activeAccount } = useAppStore();
  const favorited = favoriteTeas.includes(item.id);

  const [quantity, setQuantity] = useState(1);
  // Footer plumbing: teaware has no sample/custom cells, but the shared
  // footer contract expects the state pair.
  const [customMode, setCustomMode] = useState(false);
  const [added, setAdded] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const showFade = useScrollFade(scrollRef as React.RefObject<HTMLElement>);

  // Share handler: canonical product page URL, Web Share API with clipboard fallback
  const handleShare = async () => {
    const shareText = `${item.name}, ${item.type} from Teajia`;
    const shareUrl = `${window.location.origin}${buildPublicProductHref({ id: item.id, slug: item.slug })}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text: shareText, url: shareUrl });
      } catch {
        // User cancelled: silent
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch {
        // Clipboard API unavailable
      }
    }
  };

  const whatsappNumber = activeAccount?.whatsapp_number;
  const handleSampleRequest = () => {
    if (!whatsappNumber) return;
    const msg = `Hi, I'd like to request a sample of ${item.name} (${item.type}). Is that possible?`;
    const phone = whatsappNumber.replace(/\D/g, '').replace(/^0+/, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Gallery: primary image + additional images
  const allImages = [item.image, ...(item.additionalImages || [])].filter(Boolean);

  const maxStock = Math.max(1, Math.floor(item.stock_g || 1));
  const stockStatus = getWareStockStatus(Math.floor(item.stock_g || 0));
  const isSoldOut = stockStatus.level === 'out';

  // price_50g is per-unit price for teaware (legacy field name)
  const unitPrice = parseFloat(item.price_50g || '0');
  // Numeric total (base currency), passed to onAddToCart. Display strings
  // are formatted separately; never parse a formatted string back to a number.
  const numericTotal = Math.ceil(unitPrice * quantity);
  const total = fmtNum(numericTotal, 0);
  const perUnitDisplay = fmtNum(Math.ceil(unitPrice), 0);

  // Per-unit quantity presets in the segmented strip, capped by stock
  const presets = [1, 2, 3, 4].filter(p => p <= maxStock);

  const alcoveBg = 'var(--tea-bg)';
  const typeColor = getTeaColor(item.type);

  // Derive display values
  const productName = item.variant || item.name;
  const givenName = item.variant !== item.name ? item.name : '';
  // Strip numbers and latin characters: only show actual CJK characters
  const chineseCharacters = (item.chineseName || '').replace(/[0-9A-Za-z\s]/g, '');

  // Facts ledger: rows skip when empty; price stays in the commerce footer.
  const ledgerRows: LedgerRow[] = [];
  const origin = item.terroir || item.origin || '';
  if (origin) ledgerRows.push({ key: 'origin', label: 'Origin', value: origin });
  if (item.material) ledgerRows.push({ key: 'material', label: 'Material', value: item.material });
  if (item.capacityMl) {
    ledgerRows.push({ key: 'capacity', label: 'Capacity', value: `${item.capacityMl} ml` });
  }
  if (item.year) ledgerRows.push({ key: 'year', label: 'Year', value: item.year });
  if (item.mood) ledgerRows.push({ key: 'mood', label: 'Mood', value: item.mood });
  if (item.isOneOfAKind) {
    ledgerRows.push({ key: 'edition', label: 'Edition', value: 'One of a kind' });
  }

  // "About this piece": description-led reading chapter; each populated
  // field becomes one paragraph, deduplicated.
  const aboutParagraphs = [
    item.description || '',
    item.lore || '',
    item.processingNotes || '',
    item.experience || '',
  ].filter((text, i, arr) => text && arr.indexOf(text) === i);

  // Same reading-prose grammar as AlcoveAboutSection
  const paragraphClass =
    'm-0 whitespace-pre-line font-body text-ui-14 font-normal leading-[1.75] text-tea-text-sec [&+p]:mt-[9px]';

  const handleAdd = () => {
    if (isSoldOut) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    if (onAddToCart) {
      onAddToCart(item, quantity, numericTotal);
    }
  };

  void onClose;

  return (
    <AlcoveShell
      alcoveBg={alcoveBg}
      chineseCharacters=""
      scrollRef={scrollRef}
      showFade={showFade}
      commerceFooter={
        <AlcoveCommerceFooter
          item={item}
          alcoveBg={alcoveBg}
          stockStatus={stockStatus}
          isSoldOut={isSoldOut}
          grams={quantity}
          setGrams={setQuantity}
          customMode={customMode}
          setCustomMode={setCustomMode}
          sliderMax={maxStock}
          presets={presets}
          pricePerGram={unitPrice}
          perGramDisplay={perUnitDisplay}
          total={total}
          added={added}
          shareCopied={shareCopied}
          favorited={favorited}
          inSampleCart={false}
          isAdmin={isAdmin}
          onEdit={onEdit}
          toggleFavoriteTea={toggleFavoriteTea}
          toggleSampleCart={() => {}}
          handleShare={handleShare}
          handleAdd={handleAdd}
        />
      }
      modals={
        <ImageOverlayModal
          open={imageExpanded}
          expandedImageUrl={expandedImageUrl}
          itemName={item.name}
          onClose={() => { setImageExpanded(false); setExpandedImageUrl(null); }}
        />
      }
    >
      {/* 1. Identity: centered serif header, hanzi as real text */}
      <AlcoveIdentityHeader
        item={item}
        productName={productName}
        givenName={givenName}
        teaType={item.type}
        typeLabel={item.type}
        chineseCharacters={chineseCharacters}
        typeColor={typeColor}
        isAdmin={isAdmin}
        onNavigateSource={() => navigate(`/admin/people?tab=sources&search=${encodeURIComponent(item.supplier!)}`)}
      />

      {/* 2. Facts ledger: Origin / Material / Capacity / … */}
      <AlcoveFactsLedger rows={ledgerRows} />

      {/* 3. Gallery band: TeaPlaceholder stands in when the piece has no photo */}
      {allImages.length > 0 ? (
        <AlcoveGallery
          allImages={allImages}
          itemName={item.name}
          onExpandImage={(url) => { setExpandedImageUrl(url); setImageExpanded(true); }}
        />
      ) : (
        <div aria-hidden="true" className="flex-shrink-0 px-3 pt-3">
          <TeaPlaceholder type={item.type} style={{ height: '160px' }} />
        </div>
      )}

      {/* 4. About this piece: the one reading chapter */}
      {aboutParagraphs.length > 0 && (
        <section aria-label="About this piece">
          <AlcoveSectionHeading label="About this piece" className="mx-6 mb-3 mt-[22px]" />
          <div className="px-6">
            {aboutParagraphs.map((text, i) => (
              <p key={i} className={paragraphClass}>{text}</p>
            ))}
          </div>
        </section>
      )}

      {/* Sample request: the human WhatsApp conversation closes it */}
      {whatsappNumber && (
        <p className="m-0 mt-6 px-6 text-center">
          <button
            type="button"
            onClick={handleSampleRequest}
            className="tap-target cursor-pointer border-0 bg-transparent p-0 font-sans text-ui-10 tracking-[0.04em] text-tea-text-sec underline decoration-tea-border underline-offset-2 transition-colors hover:text-tea-text"
          >
            Request a sample &rarr;
          </button>
        </p>
      )}

      {/* Breathing room above the pinned commerce footer */}
      <div aria-hidden="true" className="h-6" />
    </AlcoveShell>
  );
};
