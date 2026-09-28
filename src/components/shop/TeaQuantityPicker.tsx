import { useState } from 'react';
import type { InventoryItem } from '../../types';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { teaPurchaseQuote } from '../../lib/shopPurchase';
import { quoteGrams, sellUnitOf, wholePieceOf } from '../../lib/teaPricing';
import { useAppStore } from '../../lib/store';
import { Modal } from '../shared/Modal';
import { CustomAmountModal } from './alcove/AlcoveModals';
import { TeaAmountList } from './alcove/TeaAmountList';
import { useShopPrice } from './shopPrice';

interface TeaQuantityPickerProps {
  item: InventoryItem;
  onAddToCart: (item: InventoryItem, grams: number, total: number) => void;
  onClose: () => void;
}

/** The product page's price list, opened before a catalogue choice is added. */
export function TeaQuantityPicker({ item, onAddToCart, onClose }: TeaQuantityPickerProps) {
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [, setDraftGrams] = useState(0);
  const shopPrice = useShopPrice();
  const cart = useAppStore(state => state.publicCart);
  const available = teaPurchaseQuote(item);
  const pricePerGram = Number.parseFloat(item.price_per_gram ?? '');
  const maxGrams = Math.floor(item.stock_g ?? 0);
  const sellUnit = sellUnitOf(item.form, item.pieceWeightG, item.soldInWholeUnits);
  const wholePiece = sellUnit ?? wholePieceOf(item.form, item.pieceWeightG);
  const inOrderLabel = cart.filter(line => line.id === item.id).map(line => {
    const grams = line.packGrams ?? line.quantityGrams;
    const packs = line.packs ?? 1;
    return packs > 1 ? `${packs} × ${grams}g` : `${grams}g`;
  }).join(' and ');

  const choose = (grams: number) => {
    const quote = teaPurchaseQuote(item, grams);
    if (!quote) return;
    onAddToCart(item, quote.grams, quote.totalUsd);
    onClose();
  };
  const formatPrice = (rate: number, grams: number) => shopPrice.total(
    quoteGrams(rate, grams, { wholePieceGrams: wholePiece?.grams }).totalUsd,
  );

  return (
    <>
      {/* The page ground, not the lifted surface: this opens over the dark shop
          list and reads as part of it rather than a lighter card laid on top. */}
      <Modal isOpen={!customMode} onClose={onClose} title={item.name} initialFocus="container" className="!bg-tea-bg">
        <div className="px-4 pb-nav-gap">
          <p className={`${T.body} py-3 text-tea-text-sec`}>Choose an amount to add to your cart.</p>
          {available ? (
            <TeaAmountList
              item={item}
              pricePerGram={pricePerGram}
              maxGrams={maxGrams}
              formatPrice={formatPrice}
              formatPerGram={shopPrice.perGram}
              formatRate={shopPrice.rate}
              formatPlainTotal={shopPrice.plainTotal}
              inOrderLabel={inOrderLabel || undefined}
              onChoose={choose}
              onCustom={() => setCustomMode(true)}
              variant="picker"
            />
          ) : <p className={`${T.body} text-tea-text-sec`}>This tea is currently unavailable.</p>}
        </div>
      </Modal>
      <CustomAmountModal
        open={customMode}
        onClose={() => setCustomMode(false)}
        sliderMax={maxGrams}
        customInput={customInput}
        setCustomInput={setCustomInput}
        setGrams={setDraftGrams}
        onConfirm={choose}
        confirmLabel="Add to cart"
        pricePerGram={pricePerGram}
        formatTotal={grams => {
          const quote = teaPurchaseQuote(item, grams);
          return quote ? shopPrice.total(quote.totalUsd) : '';
        }}
        wholePiece={wholePiece}
        unitGrams={sellUnit?.grams}
      />
    </>
  );
}
