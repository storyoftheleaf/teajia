import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Minus, Plus } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import type { TeaCompassEntry, TeaForm } from './types';
import { GRAM_PRESETS, DEFAULT_GRAMS, compassEntryToProductDraft } from './types';
import { api, isConfigured, hasToken } from '../../lib/api';
import type { Currency } from '../../admin/types';

interface OrderSummaryProps {
  open: boolean;
  onClose: () => void;
}

// ─── Currency display ────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  NT: 'NT$',
  Yuan: '¥',
  IDR: 'Rp',
  JPY: '¥',
  MYR: 'RM',
  HKD: 'HK$',
  UNK: '',
};

function formatCurrency(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency] || '';
  // No decimals for NT, IDR, JPY
  const decimals = ['NT', 'IDR', 'JPY'].includes(currency) ? 0 : 2;
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const UNIT_FORMS: TeaForm[] = ['Cake', 'Brick', 'Tuo'];

function isUnitBased(form?: TeaForm): boolean {
  return !!form && UNIT_FORMS.includes(form);
}

function getDefaultGrams(form?: TeaForm): number {
  return form ? (DEFAULT_GRAMS[form] ?? 100) : 100;
}

function getLinePrice(entry: TeaCompassEntry, qty: number): number {
  if (entry.category === 'teaware') {
    return (entry.priceAmount ?? 0) * qty;
  }
  if (isUnitBased(entry.form)) {
    // Unit-based: price is per unit (cake/brick/tuo)
    return (entry.priceAmount ?? 0) * qty;
  }
  // Gram-based: pricePerUnitGrams is price per N grams, priceAmount is price for that unit
  // If pricePerUnitGrams is set, unit price = priceAmount / pricePerUnitGrams * qty
  if (entry.pricePerUnitGrams && entry.priceAmount) {
    return (entry.priceAmount / entry.pricePerUnitGrams) * qty;
  }
  // Fallback: priceAmount is total for the amount
  return entry.priceAmount ?? 0;
}

// ─── Line item component ────────────────────────────────────────────────

interface LineItemProps {
  entry: TeaCompassEntry;
  quantity: number;
  onQuantityChange: (qty: number) => void;
}

const TeaLineItem: React.FC<LineItemProps> = ({ entry, quantity, onQuantityChange }) => {
  const unitBased = isUnitBased(entry.form);
  const gramEquiv = unitBased ? getDefaultGrams(entry.form) * quantity : undefined;
  const lineTotal = getLinePrice(entry, quantity);
  const presets = !unitBased && entry.form ? GRAM_PRESETS[entry.form] : null;

  return (
    <div className="py-4 border-b border-tea-border/40 last:border-b-0">
      {/* Chinese name, large */}
      {entry.chineseName && (
        <p className="text-tea-text text-xl font-medium tracking-wide mb-0.5">
          {entry.chineseName}
        </p>
      )}

      {/* English name + quantity row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-tea-text-sec text-base">
            {entry.name || 'Unnamed tea'}
          </p>
          {entry.type && (
            <p className="text-tea-text-dim text-xs mt-0.5">
              {entry.type}{entry.form ? ` · ${entry.form}` : ''}{entry.year ? ` · ${entry.year}` : ''}
            </p>
          )}
        </div>

        {/* Quantity + price calc */}
        <div className="flex items-center gap-2 shrink-0 text-right">
          {unitBased ? (
            /* Unit stepper for cakes/bricks/tuo */
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                className="w-7 h-7 rounded-full bg-tea-surface flex items-center justify-center
                           text-tea-text-sec active:bg-tea-border transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="text-tea-text text-lg font-medium w-6 text-center">{quantity}</span>
              <button
                type="button"
                onClick={() => onQuantityChange(quantity + 1)}
                className="w-7 h-7 rounded-full bg-tea-surface flex items-center justify-center
                           text-tea-text-sec active:bg-tea-border transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            /* Gram input for loose tea */
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={quantity}
                onChange={(e) => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 text-right text-tea-text text-lg font-medium bg-transparent
                           border-b border-tea-border/60 focus:border-tea-gold outline-none
                           px-1 py-0.5"
              />
              <span className="text-tea-text-dim text-sm">g</span>
            </div>
          )}
        </div>
      </div>

      {/* Gram equivalent for unit-based */}
      {unitBased && gramEquiv && (
        <p className="text-tea-text-dim text-xs mt-1">
          {gramEquiv}g total ({getDefaultGrams(entry.form)}g each)
        </p>
      )}

      {/* Gram presets for loose tea */}
      {presets && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {presets.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onQuantityChange(g)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                ${quantity === g
                  ? 'bg-tea-gold/20 text-tea-gold'
                  : 'bg-tea-surface text-tea-text-sec active:bg-tea-border'
                }`}
            >
              {g}g
            </button>
          ))}
        </div>
      )}

      {/* Line total */}
      {entry.priceAmount != null && entry.priceAmount > 0 && (
        <p className="text-tea-text text-right text-base font-medium mt-2">
          {unitBased
            ? `${quantity} × ${formatCurrency(entry.priceAmount, entry.priceCurrency)}`
            : entry.pricePerUnitGrams
              ? `${quantity}g × ${formatCurrency(entry.priceAmount / entry.pricePerUnitGrams, entry.priceCurrency)}/g`
              : ''
          }
          {' = '}
          <span className="text-lg">{formatCurrency(lineTotal, entry.priceCurrency)}</span>
        </p>
      )}
    </div>
  );
};

const TeawareLineItem: React.FC<LineItemProps> = ({ entry, quantity, onQuantityChange }) => {
  const lineTotal = (entry.priceAmount ?? 0) * quantity;

  return (
    <div className="py-4 border-b border-tea-border/40 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {entry.chineseName && (
            <p className="text-tea-text text-xl font-medium tracking-wide mb-0.5">
              {entry.chineseName}
            </p>
          )}
          <p className="text-tea-text-sec text-base">
            {entry.name || 'Unnamed teaware'}
          </p>
          {(entry.teawareCategory || entry.material) && (
            <p className="text-tea-text-dim text-xs mt-0.5">
              {[entry.teawareCategory, entry.material, entry.capacityMl ? `${entry.capacityMl}ml` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>

        {/* Quantity stepper */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            className="w-7 h-7 rounded-full bg-tea-surface flex items-center justify-center
                       text-tea-text-sec active:bg-tea-border transition-colors"
          >
            <Minus size={14} />
          </button>
          <span className="text-tea-text text-lg font-medium w-6 text-center">{quantity}</span>
          <button
            type="button"
            onClick={() => onQuantityChange(quantity + 1)}
            className="w-7 h-7 rounded-full bg-tea-surface flex items-center justify-center
                       text-tea-text-sec active:bg-tea-border transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Line total */}
      {entry.priceAmount != null && entry.priceAmount > 0 && (
        <p className="text-tea-text text-right text-base font-medium mt-2">
          {quantity > 1 && `${quantity} × ${formatCurrency(entry.priceAmount, entry.priceCurrency)} = `}
          <span className="text-lg">{formatCurrency(lineTotal, entry.priceCurrency)}</span>
        </p>
      )}
    </div>
  );
};

// ─── Main OrderSummary ──────────────────────────────────────────────────

export const OrderSummary: React.FC<OrderSummaryProps> = ({ open, onClose }) => {
  const getBuyingEntries = useTeaCompassStore((s) => s.getBuyingEntries);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const buyingEntries = getBuyingEntries();

  // Local quantity state, keyed by entry ID
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const e of buyingEntries) {
      if (e.category === 'teaware') {
        init[e.id] = e.buyQuantityUnits ?? e.quantity ?? 1;
      } else if (isUnitBased(e.form)) {
        init[e.id] = e.buyQuantityUnits ?? 1;
      } else {
        init[e.id] = e.buyQuantityGrams ?? getDefaultGrams(e.form);
      }
    }
    return init;
  });

  const [confirmed, setConfirmed] = useState(false);

  // Re-init quantities when overlay opens
  React.useEffect(() => {
    if (open) {
      const init: Record<string, number> = {};
      const entries = getBuyingEntries();
      for (const e of entries) {
        if (e.category === 'teaware') {
          init[e.id] = e.buyQuantityUnits ?? e.quantity ?? 1;
        } else if (isUnitBased(e.form)) {
          init[e.id] = e.buyQuantityUnits ?? 1;
        } else {
          init[e.id] = e.buyQuantityGrams ?? getDefaultGrams(e.form);
        }
      }
      setQuantities(init);
      setConfirmed(false);
    }
  }, [open, getBuyingEntries]);

  const setQty = useCallback((id: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [id]: qty }));
  }, []);

  // Grand total
  const grandTotal = useMemo(() => {
    return buyingEntries.reduce((sum, e) => {
      const qty = quantities[e.id] ?? 1;
      return sum + getLinePrice(e, qty);
    }, 0);
  }, [buyingEntries, quantities]);

  // Common currency (all items should share one)
  const currency = buyingEntries[0]?.priceCurrency ?? 'NT';

  const handleConfirm = useCallback(async () => {
    // First, update all entries to 'bought' status with quantities
    const updatedEntries: TeaCompassEntry[] = [];
    for (const entry of buyingEntries) {
      const qty = quantities[entry.id] ?? 1;
      const total = getLinePrice(entry, qty);
      const updates: Partial<TeaCompassEntry> = {
        status: 'bought' as const,
        buyTotal: total,
      };
      if (entry.category === 'teaware' || isUnitBased(entry.form)) {
        updates.buyQuantityUnits = qty;
        if (isUnitBased(entry.form)) {
          updates.buyQuantityGrams = getDefaultGrams(entry.form) * qty;
        }
      } else {
        updates.buyQuantityGrams = qty;
      }
      updateEntry(entry.id, updates);
      updatedEntries.push({ ...entry, ...updates });
    }

    setConfirmed(true);

    // Then, attempt to create draft products in the background (non-blocking)
    if (isConfigured && hasToken()) {
      for (const entry of updatedEntries) {
        if (entry.draftProductId) continue; // Already has a draft
        try {
          const payload = compassEntryToProductDraft(entry);
          const created = await api.products.create(payload);
          if (created?.id) {
            updateEntry(entry.id, { draftProductId: created.id });
          }
        } catch (err) {
          // Draft creation failed (offline, auth, etc.) — that's fine.
          // Entry is still 'bought' locally. Draft can be created later.
          console.debug('Draft product creation failed for compass entry:', entry.id, err);
        }
      }
    }

    setTimeout(() => {
      onClose();
    }, 1200);
  }, [buyingEntries, quantities, updateEntry, onClose]);

  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const vendorName = buyingEntries[0]?.vendorName;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col bg-tea-bg"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {/* ── Close button ── */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Close order"
            >
              <X size={22} />
            </button>
          </div>

          {/* ── Header: vendor + date ── */}
          <div className="px-6 pb-4">
            {vendorName && (
              <h1 className="text-tea-text text-2xl font-semibold tracking-tight">
                {vendorName}
              </h1>
            )}
            <p className="text-tea-text-dim text-sm mt-0.5">{today}</p>
          </div>

          {/* ── Line items ── */}
          <div className="flex-1 overflow-y-auto px-6">
            {buyingEntries.length === 0 ? (
              <p className="text-tea-text-dim text-center py-12">No items to buy</p>
            ) : (
              buyingEntries.map((entry) => (
                entry.category === 'teaware' ? (
                  <TeawareLineItem
                    key={entry.id}
                    entry={entry}
                    quantity={quantities[entry.id] ?? 1}
                    onQuantityChange={(q) => setQty(entry.id, q)}
                  />
                ) : (
                  <TeaLineItem
                    key={entry.id}
                    entry={entry}
                    quantity={quantities[entry.id] ?? getDefaultGrams(entry.form)}
                    onQuantityChange={(q) => setQty(entry.id, q)}
                  />
                )
              ))
            )}
          </div>

          {/* ── Grand total + confirm ── */}
          <div className="px-6 pt-4 pb-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] border-t border-tea-border">
            {/* Total */}
            <div className="flex items-baseline justify-between mb-5">
              <span className="text-tea-text-sec text-base">Total</span>
              <span className="text-tea-text text-3xl font-semibold tracking-tight">
                {formatCurrency(grandTotal, currency)}
              </span>
            </div>

            {/* Confirm button */}
            <AnimatePresence mode="wait">
              {confirmed ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-lg bg-green-600/20 text-green-400"
                >
                  <Check size={20} />
                  <span className="font-medium">Purchase confirmed</span>
                </motion.div>
              ) : (
                <motion.button
                  key="confirm"
                  type="button"
                  onClick={handleConfirm}
                  disabled={buyingEntries.length === 0}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 rounded-lg bg-tea-gold text-tea-bg font-semibold text-base
                             shadow-lg transition-opacity disabled:opacity-40"
                >
                  Confirm Purchase
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OrderSummary;
