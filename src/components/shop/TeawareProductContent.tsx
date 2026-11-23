import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { teawareOrderSizes, teawareRemaining, teawareUnitPrice } from '../../lib/teawareOrder';
import { buildPublicProductHref } from '../../lib/publicProductNavigation';
import { useAppStore } from '../../lib/store';
import type { InventoryItem } from '../../types';
import { QUIET_LINK } from '../../pages/wisdom/frame';
import { useShopPrice } from './shopPrice';
import { ProductDetailLayout } from './ProductDetailLayout';
import { AlcoveCommerceFooter } from './alcove/AlcoveCommerceFooter';

import { productGallery, productIdentity, teawareFacts, teawareReading } from './productDetailFields';

interface TeawareProductContentProps {
  item: InventoryItem;
  publicHref?: string;
  availabilityContact?: { href: string; opensNewTab: boolean };
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
}

const keepPieceMode = () => {};

export function TeawareProductContent({
  item, publicHref, availabilityContact, onAddToCart,
}: TeawareProductContentProps) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { favoriteTeas, toggleFavoriteTea, shopStoreSlug } = useAppStore();
  const shopPrice = useShopPrice();
  const [shareCopied, setShareCopied] = useState(false);

  const [chosenUnits, setChosenUnits] = useState(1);
  const remaining = useAppStore(state => teawareRemaining(item, state.publicCart));
  const count = Math.min(chosenUnits, remaining);
  const store = new URLSearchParams(search).get('store')?.trim() || shopStoreSlug;
  const units = Math.max(0, Math.floor(item.stock_g));
  const unitPrice = teawareUnitPrice(item);
  async function handleShare() {
    const url = new URL(publicHref ?? buildPublicProductHref(item), window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: item.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {
      // A cancelled share leaves the existing page open.
    }
  }

  function handleAdd() {
    if (unitPrice == null || !onAddToCart || count < 1 || count > teawareRemaining(item, useAppStore.getState().publicCart)) return;
    onAddToCart(item, count, count * unitPrice);
  }

  const order = unitPrice != null || availabilityContact && units === 0 ? (
    <section aria-label="Teaware order" className="bg-tea-bg">
      {unitPrice != null && units > 0 && remaining === 0 && (
        <p role="status" className="p-3 text-center text-tea-text-sec">{units === 1 ? 'This piece is in your order.' : 'All available pieces are in your order.'}</p>
      )}
      {unitPrice != null && (remaining > 0 || !units) && <AlcoveCommerceFooter item={item} alcoveBg="var(--tea-bg)"
        stockStatus={{label: units ? 'In Stock' : 'Sold Out', color: 'var(--tea-text-sec)', level: units ? 'ok' : 'out'}}
        isSoldOut={!units} grams={count} setGrams={setChosenUnits} customMode={false}
        setCustomMode={keepPieceMode} sliderMax={remaining} presets={remaining > 1 ? teawareOrderSizes(remaining) : []}
        pricePerGram={unitPrice} total={shopPrice.total(count * unitPrice)}
        formatPrice={(price, count) => shopPrice.total(price * count)} formatTotal={shopPrice.total}
        added={false} shareCopied={shareCopied} favorited={favoriteTeas.includes(item.id)} inSampleCart={false}
        variant="docked" toggleFavoriteTea={toggleFavoriteTea} toggleSampleCart={() => {}}
        handleShare={handleShare} handleAdd={handleAdd} />}
      {!units && availabilityContact && (
        <div className="px-4 pb-3 text-center">
          <a className={QUIET_LINK} href={availabilityContact.href} target={availabilityContact.opensNewTab ? '_blank' : undefined}
            rel={availabilityContact.opensNewTab ? 'noreferrer' : undefined}>Ask about availability</a>
        </div>
      )}
    </section>
  ) : null;

  return (
    <ProductDetailLayout
      identity={{ ...productIdentity(item),
        onNavigateSource: () => navigate(`/admin/people?tab=sources&search=${encodeURIComponent(item.supplier ?? '')}`) }}
      gallery={productGallery(item, 'page')}
      actions={{ productId: item.id, label: 'Your teaware actions' }}
      facts={teawareFacts(item)}
      factsTitle="The Piece"
      order={order}
      reading={teawareReading(item, store)}
      soldOut={!units}
    />
  );
}
