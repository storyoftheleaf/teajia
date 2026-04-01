import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Check, BookOpen } from 'lucide-react';
import { useLedgerStore } from '../../lib/ledgerStore';
import type { CompassStatus, TeaCompassEntry, TeaForm } from './types';
import { DEFAULT_GRAMS } from './types';
import type { Currency } from '../../admin/types';

interface StatusActionsProps {
  status: CompassStatus;
  onStatusChange: (status: CompassStatus) => void;
  /** The full entry — needed to build the ledger line item */
  entry?: TeaCompassEntry;
  /** Called after item is added to ledger, to switch to ledger tab */
  onAddedToLedger?: () => void;
}

const UNIT_FORMS: TeaForm[] = ['Cake', 'Brick', 'Tuo'];

function isUnitBased(form?: TeaForm): boolean {
  return !!form && UNIT_FORMS.includes(form);
}

export const StatusActions: React.FC<StatusActionsProps> = ({
  status,
  onStatusChange,
  entry,
  onAddedToLedger,
}) => {
  const [showQtyPicker, setShowQtyPicker] = useState(false);
  const [quantity, setQuantity] = useState<number>(() => {
    if (!entry) return 100;
    if (entry.category === 'teaware') return 1;
    if (isUnitBased(entry.form)) return 1;
    return entry.form ? (DEFAULT_GRAMS[entry.form] ?? 100) : 100;
  });
  const [justAdded, setJustAdded] = useState(false);

  const getOrCreatePurchaseTransaction = useLedgerStore((s) => s.getOrCreatePurchaseTransaction);
  const addLineItem = useLedgerStore((s) => s.addLineItem);
  const transactions = useLedgerStore((s) => s.transactions);

  // Check if this entry is already in a ledger transaction
  const isInLedger = entry && transactions.some(
    (tx) => tx.status === 'draft' && tx.items.some((item) => item.compassEntryId === entry.id)
  );

  const handleWant = () => {
    onStatusChange(status === 'want' ? 'logged' : 'want');
  };

  const handleBuyClick = () => {
    if (!entry) {
      onStatusChange(status === 'buying' ? 'logged' : 'buying');
      return;
    }

    if (isInLedger) {
      onAddedToLedger?.();
      return;
    }

    setShowQtyPicker(true);
    if (entry.category === 'teaware') {
      setQuantity(1);
    } else if (isUnitBased(entry.form)) {
      setQuantity(1);
    } else {
      setQuantity(entry.form ? (DEFAULT_GRAMS[entry.form] ?? 100) : 100);
    }
  };

  const handleConfirmAdd = useCallback(() => {
    if (!entry) return;

    const vendorName = entry.vendorName || 'Unknown Vendor';
    const currency = entry.priceCurrency || 'NT';

    const txId = getOrCreatePurchaseTransaction(vendorName, currency, entry.vendorId);
    const unitBased = entry.category === 'teaware' || isUnitBased(entry.form);

    addLineItem(txId, {
      name: entry.name || 'Unnamed',
      chineseName: entry.chineseName,
      type: entry.type,
      form: entry.form,
      year: entry.year,
      quantityGrams: unitBased ? undefined : quantity,
      quantityUnits: unitBased ? quantity : undefined,
      unitWeightGrams: isUnitBased(entry.form) ? (DEFAULT_GRAMS[entry.form!] ?? 100) : undefined,
      pricePerUnit: entry.priceAmount ?? 0,
      priceIsPerGram: !unitBased && !!entry.pricePerUnitGrams,
      currency,
      compassEntryId: entry.id,
    });

    onStatusChange('buying');

    setShowQtyPicker(false);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      onAddedToLedger?.();
    }, 800);
  }, [entry, quantity, getOrCreatePurchaseTransaction, addLineItem, onStatusChange, onAddedToLedger]);

  const unitBased = entry?.category === 'teaware' || isUnitBased(entry?.form);
  const step = unitBased ? 1 : 25;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleWant}
          className={`flex-1 text-sm font-semibold rounded-lg text-center py-3.5 transition-all border ${
            status === 'want'
              ? 'bg-amber-500/20 text-amber-400 border-amber-400/25 shadow-[0_2px_8px_rgba(245,158,11,0.15)]'
              : 'bg-tea-surface/80 text-tea-text-sec border-tea-border/40 active:bg-tea-elevated hover:bg-tea-surface hover:border-tea-border/60'
          }`}
        >
          Want
        </button>
        <button
          type="button"
          onClick={handleBuyClick}
          className={`flex-1 text-sm font-semibold rounded-lg text-center py-3.5 flex items-center justify-center gap-1.5 transition-all border ${
            isInLedger
              ? 'bg-tea-gold/20 text-tea-gold border-tea-gold/25 shadow-[0_2px_8px_rgba(184,146,78,0.15)]'
              : status === 'buying'
                ? 'bg-tea-gold text-tea-bg border-tea-gold/40 shadow-[0_2px_8px_rgba(184,146,78,0.3)]'
                : 'bg-tea-gold/8 text-tea-text-sec border-tea-border/40 active:bg-tea-gold/15 hover:bg-tea-gold/12 hover:border-tea-gold/30'
          }`}
        >
          {isInLedger ? (
            <>
              <BookOpen size={14} />
              In Ledger
            </>
          ) : (
            'Buy'
          )}
        </button>
      </div>

      {/* Quantity picker — slides in when Buy is tapped */}
      <AnimatePresence>
        {showQtyPicker && !justAdded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="inset-panel px-4 py-3 space-y-3">
              <p className="text-xs text-tea-text-sec uppercase tracking-wider">
                How much?
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(step, quantity - step))}
                  className="w-11 h-11 rounded-full bg-tea-surface flex items-center justify-center
                             text-tea-text-sec active:bg-tea-elevated transition-colors"
                >
                  <Minus size={16} />
                </button>
                <div className="flex items-baseline gap-1">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 text-center text-tea-text text-2xl font-semibold bg-transparent num
                               border-none outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                  />
                  <span className="text-tea-text-sec text-xs">
                    {unitBased ? (quantity === 1 ? 'unit' : 'units') : 'g'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + step)}
                  className="w-11 h-11 rounded-full bg-tea-surface flex items-center justify-center
                             text-tea-text-sec active:bg-tea-elevated transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Preset buttons for gram-based */}
              {!unitBased && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {[50, 100, 150, 250, 357, 500].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setQuantity(g)}
                      className={quantity === g ? 'pill-active' : 'pill'}
                    >
                      {g}g
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowQtyPicker(false)}
                  className="flex-1 py-2.5 rounded-lg bg-tea-surface text-xs font-semibold uppercase tracking-[0.08em] text-tea-text-sec active:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdd}
                  className="flex-1 py-2 rounded-lg bg-tea-gold text-tea-bg font-semibold text-xs uppercase tracking-[0.08em] transition-opacity active:opacity-80"
                >
                  Add to Ledger
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {justAdded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-tea-gold/15 text-tea-gold text-sm font-medium"
          >
            <Check size={16} />
            Added to Ledger
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StatusActions;
