import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Minus, Plus } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useLedgerStore } from '../../lib/ledgerStore';
import type { TeaCompassEntry, TeaForm } from './types';
import { GRAM_PRESETS, DEFAULT_GRAMS } from './types';
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
  AUD: 'A$',
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
    <div className="py-5 border-b border-tea-border last:border-b-0">
      {/* Hero: Chinese name or English name promoted */}
      {entry.chineseName ? (
        <>
          <p className="text-2xl font-chinese font-medium text-tea-text tracking-wide mb-0.5">
            {entry.chineseName}
          </p>
          <p className="text-sm text-tea-text-sec">
            {entry.name || 'Unnamed tea'}
          </p>
        </>
      ) : (
        <p className="text-xl font-display text-tea-text">
          {entry.name || 'Unnamed tea'}
        </p>
      )}

      {entry.type && (
        <p className="text-tea-text-dim text-xs mt-0.5">
          {entry.type}{entry.form ? ` · ${entry.form}` : ''}{entry.year ? ` · ${entry.year}` : ''}
        </p>
      )}

      {/* Quantity controls */}
      <div className="flex items-center justify-between gap-3 mt-3">
        <div className="flex items-center gap-2 shrink-0">
          {unitBased ? (
            /* Unit stepper for cakes/bricks/tuo */
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-full bg-tea-surface flex items-center justify-center
                           text-tea-text-sec active:bg-tea-border transition-colors"
              >
                <Minus size={15} />
              </button>
              <span className="text-xl tabular-nums text-tea-text font-medium w-8 text-center">{quantity}</span>
              <button
                type="button"
                onClick={() => onQuantityChange(quantity + 1)}
                className="w-8 h-8 rounded-full bg-tea-surface flex items-center justify-center
                           text-tea-text-sec active:bg-tea-border transition-colors"
              >
                <Plus size={15} />
              </button>
            </div>
          ) : (
            /* Gram input for loose tea */
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={quantity}
                onChange={(e) => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-xl tabular-nums text-center text-tea-text font-medium bg-transparent
                           border-b border-tea-border focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg
                           px-1 py-0.5"
              />
              <span className="text-tea-text-dim text-sm">g</span>
            </div>
          )}
        </div>

        {/* Line total */}
        {entry.priceAmount != null && entry.priceAmount > 0 && (
          <div className="text-right tabular-nums">
            <p className="text-sm text-tea-text-sec">
              {unitBased
                ? <>{quantity} <span className="text-tea-text-dim">×</span> {formatCurrency(entry.priceAmount, entry.priceCurrency)}</>
                : entry.pricePerUnitGrams
                  ? <>{quantity}g <span className="text-tea-text-dim">×</span> {formatCurrency(entry.priceAmount / entry.pricePerUnitGrams, entry.priceCurrency)}/g</>
                  : null
              }
            </p>
            <p className="text-lg font-medium text-tea-text">
              {formatCurrency(lineTotal, entry.priceCurrency)}
            </p>
          </div>
        )}
      </div>

      {/* Gram equivalent for unit-based */}
      {unitBased && gramEquiv && (
        <p className="text-tea-text-dim text-xs mt-1.5">
          {gramEquiv}g total ({getDefaultGrams(entry.form)}g each)
        </p>
      )}

      {/* Gram presets for loose tea */}
      {presets && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {presets.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onQuantityChange(g)}
              className={`pill ${quantity === g ? 'pill-active' : ''}`}
            >
              {g}g
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const TeawareLineItem: React.FC<LineItemProps> = ({ entry, quantity, onQuantityChange }) => {
  const lineTotal = (entry.priceAmount ?? 0) * quantity;

  return (
    <div className="py-5 border-b border-tea-border last:border-b-0">
      {/* Hero: Chinese name or English name promoted */}
      {entry.chineseName ? (
        <>
          <p className="text-2xl font-chinese font-medium text-tea-text tracking-wide mb-0.5">
            {entry.chineseName}
          </p>
          <p className="text-sm text-tea-text-sec">
            {entry.name || 'Unnamed teaware'}
          </p>
        </>
      ) : (
        <p className="text-xl font-display text-tea-text">
          {entry.name || 'Unnamed teaware'}
        </p>
      )}

      {(entry.teawareCategory || entry.material) && (
        <p className="text-tea-text-dim text-xs mt-0.5">
          {[entry.teawareCategory, entry.material, entry.capacityMl ? `${entry.capacityMl}ml` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      {/* Quantity + line total */}
      <div className="flex items-center justify-between gap-3 mt-3">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            className="w-8 h-8 rounded-full bg-tea-surface flex items-center justify-center
                       text-tea-text-sec active:bg-tea-border transition-colors"
          >
            <Minus size={15} />
          </button>
          <span className="text-xl tabular-nums text-tea-text font-medium w-8 text-center">{quantity}</span>
          <button
            type="button"
            onClick={() => onQuantityChange(quantity + 1)}
            className="w-8 h-8 rounded-full bg-tea-surface flex items-center justify-center
                       text-tea-text-sec active:bg-tea-border transition-colors"
          >
            <Plus size={15} />
          </button>
        </div>

        {/* Line total */}
        {entry.priceAmount != null && entry.priceAmount > 0 && (
          <div className="text-right tabular-nums">
            {quantity > 1 && (
              <p className="text-sm text-tea-text-sec">
                {quantity} <span className="text-tea-text-dim">×</span> {formatCurrency(entry.priceAmount, entry.priceCurrency)}
              </p>
            )}
            <p className="text-lg font-medium text-tea-text">
              {formatCurrency(lineTotal, entry.priceCurrency)}
            </p>
          </div>
        )}
      </div>
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

  const getOrCreatePurchaseTransaction = useLedgerStore((s) => s.getOrCreatePurchaseTransaction);
  const addLineItem = useLedgerStore((s) => s.addLineItem);

  const handleConfirm = useCallback(async () => {
    // First, update all entries to 'in_stock' status with quantities
    const updatedEntries: TeaCompassEntry[] = [];
    for (const entry of buyingEntries) {
      const qty = quantities[entry.id] ?? 1;
      const total = getLinePrice(entry, qty);
      const updates: Partial<TeaCompassEntry> = {
        status: 'in_stock' as const,
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

    // Also create ledger entries so purchases are tracked in the ledger
    const vendorName = buyingEntries[0]?.vendorName || 'Unknown Vendor';
    const vendorId = buyingEntries[0]?.vendorId;
    const txId = getOrCreatePurchaseTransaction(vendorName, currency, vendorId);
    for (const entry of updatedEntries) {
      const qty = quantities[entry.id] ?? 1;
      const unitBased = entry.category === 'teaware' || isUnitBased(entry.form);
      addLineItem(txId, {
        name: entry.name,
        chineseName: entry.chineseName,
        type: entry.category === 'teaware' ? 'Teaware' : (entry.type || undefined),
        form: entry.form,
        year: entry.year,
        quantityGrams: unitBased ? undefined : qty,
        quantityUnits: unitBased ? qty : undefined,
        unitWeightGrams: unitBased && entry.form ? getDefaultGrams(entry.form) : undefined,
        pricePerUnit: entry.priceAmount ?? 0,
        priceIsPerGram: !unitBased && !!entry.pricePerUnitGrams,
        currency,
        compassEntryId: entry.id,
      });
    }

    setConfirmed(true);

    setTimeout(() => {
      onClose();
    }, 1200);
  }, [buyingEntries, quantities, updateEntry, onClose, currency, getOrCreatePurchaseTransaction, addLineItem]);

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
          className="fixed inset-0 sidebar-inset z-50 flex flex-col bg-tea-bg"
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
              className="tap-target p-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Close order"
            >
              <X size={22} />
            </button>
          </div>

          {/* ── Header: vendor + date ── */}
          <div className="px-6 pb-4">
            {vendorName && (
              <h1 className="text-2xl font-display text-tea-text tracking-tight">
                {vendorName}
              </h1>
            )}
            <p className="text-sm text-tea-text-dim mt-0.5">{today}</p>
          </div>

          {/* ── Line items ── */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-6">
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
          <div className="px-6 pb-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
            {/* Total */}
            <div className="flex items-baseline justify-between mt-6 pt-6 border-t border-tea-border mb-5">
              <span className="text-lg text-tea-text-sec">Total</span>
              <span className="text-3xl font-medium text-tea-gold tabular-nums tracking-tight">
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
                  className="flex items-center justify-center gap-2 py-4 rounded-lg bg-tea-gold/15 text-tea-gold"
                >
                  <Check size={20} />
                  <span className="text-base font-medium uppercase tracking-wider">Purchase confirmed</span>
                </motion.div>
              ) : (
                <motion.button
                  key="confirm"
                  type="button"
                  onClick={handleConfirm}
                  disabled={buyingEntries.length === 0}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 rounded-lg bg-tea-gold text-tea-bg text-base font-medium
                             uppercase tracking-wider shadow-lg transition-opacity disabled:opacity-40"
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
