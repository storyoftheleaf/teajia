import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Minus,
  Plus,
  Trash2,
  Check,
  ShoppingBag,
  Package,
} from 'lucide-react';
import { useLedgerStore } from '../../lib/ledgerStore';
import type { LedgerTransaction, LedgerLineItem, TransactionDirection } from '../../lib/ledgerStore';
import type { Currency } from '../../admin/types';

// ─── Currency helpers ────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$', NT: 'NT$', Yuan: '¥', IDR: 'Rp', JPY: '¥', MYR: 'RM', HKD: 'HK$', UNK: '',
};

function fmtPrice(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency] || '';
  const decimals = ['NT', 'IDR', 'JPY'].includes(currency) ? 0 : 2;
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function lineTotal(item: LedgerLineItem): number {
  if (item.priceIsPerGram) {
    return item.pricePerUnit * (item.quantityGrams ?? 0);
  }
  return item.pricePerUnit * (item.quantityUnits ?? 1);
}

// ─── Line Item Row ──────────────────────────────────────────────────────────

const LineItemRow: React.FC<{
  item: LedgerLineItem;
  txId: string;
  onRemove: () => void;
}> = ({ item, txId, onRemove }) => {
  const updateLineItem = useLedgerStore((s) => s.updateLineItem);
  const total = lineTotal(item);
  const isUnitBased = !item.priceIsPerGram;

  const handleQtyChange = useCallback(
    (newQty: number) => {
      if (newQty < 1) return;
      if (isUnitBased) {
        updateLineItem(txId, item.id, { quantityUnits: newQty });
      } else {
        updateLineItem(txId, item.id, { quantityGrams: newQty });
      }
    },
    [txId, item.id, isUnitBased, updateLineItem]
  );

  const currentQty = isUnitBased ? (item.quantityUnits ?? 1) : (item.quantityGrams ?? 100);

  return (
    <div className="py-3 border-b border-tea-border/30 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {item.chineseName && (
            <p className="text-tea-text text-lg font-medium tracking-wide leading-tight">
              {item.chineseName}
            </p>
          )}
          <p className="text-tea-text-sec text-sm">
            {item.name || 'Unnamed'}
          </p>
          {(item.type || item.form || item.year) && (
            <p className="text-tea-text-dim text-[11px] mt-0.5">
              {[item.type, item.form, item.year].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Quantity control */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleQtyChange(currentQty - (isUnitBased ? 1 : 25))}
            className="w-7 h-7 rounded-full bg-tea-surface flex items-center justify-center
                       text-tea-text-sec active:bg-tea-border transition-colors"
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            value={currentQty}
            onChange={(e) => handleQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 text-center text-tea-text text-base font-medium bg-transparent
                       border-b border-tea-border/60 focus:border-tea-gold outline-none py-0.5"
          />
          <span className="text-tea-text-dim text-xs w-3">{isUnitBased ? '×' : 'g'}</span>
          <button
            type="button"
            onClick={() => handleQtyChange(currentQty + (isUnitBased ? 1 : 25))}
            className="w-7 h-7 rounded-full bg-tea-surface flex items-center justify-center
                       text-tea-text-sec active:bg-tea-border transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Price + remove */}
      <div className="flex items-center justify-between mt-1.5">
        <button
          type="button"
          onClick={onRemove}
          className="text-tea-text-dim hover:text-red-400 transition-colors text-[11px] flex items-center gap-1"
        >
          <Trash2 size={10} />
          Remove
        </button>
        <span className="text-tea-text text-sm font-medium num">
          {fmtPrice(total, item.currency)}
        </span>
      </div>
    </div>
  );
};

// ─── Transaction Card ───────────────────────────────────────────────────────

const TransactionCard: React.FC<{
  tx: LedgerTransaction;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ tx, isExpanded, onToggle }) => {
  const removeLineItem = useLedgerStore((s) => s.removeLineItem);
  const confirmTransaction = useLedgerStore((s) => s.confirmTransaction);
  const removeTransaction = useLedgerStore((s) => s.removeTransaction);
  const setActiveTransaction = useLedgerStore((s) => s.setActiveTransaction);
  const [justConfirmed, setJustConfirmed] = useState(false);

  const total = useMemo(
    () => tx.items.reduce((sum, item) => sum + lineTotal(item), 0),
    [tx.items]
  );

  const isPurchase = tx.direction === 'purchase';
  const isDraft = tx.status === 'draft';
  const DirectionIcon = isPurchase ? ArrowDownLeft : ArrowUpRight;
  const directionLabel = isPurchase ? 'Purchasing from' : 'Selling to';

  const handleConfirm = useCallback(() => {
    confirmTransaction(tx.id);
    setJustConfirmed(true);
    setTimeout(() => setJustConfirmed(false), 1500);
  }, [tx.id, confirmTransaction]);

  const handleDelete = useCallback(() => {
    if (window.confirm(`Remove this ${isPurchase ? 'purchase' : 'sale'} order?`)) {
      removeTransaction(tx.id);
    }
  }, [tx.id, isPurchase, removeTransaction]);

  return (
    <div className={`bg-tea-surface rounded-lg overflow-hidden transition-colors ${isDraft ? 'border border-tea-border' : 'border border-tea-gold/20'}`}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-tea-elevated/20 transition-colors"
      >
        <DirectionIcon
          size={16}
          className={isPurchase ? 'text-tea-gold shrink-0' : 'text-green-400 shrink-0'}
        />
        <div className="flex-1 min-w-0">
          <p className="text-tea-text text-sm font-medium truncate">
            {tx.counterpartyName || 'Unnamed'}
          </p>
          <p className="text-tea-text-dim text-[11px]">
            {directionLabel} · {tx.items.length} {tx.items.length === 1 ? 'item' : 'items'}
          </p>
        </div>

        {/* Status */}
        <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded ${
          isDraft ? 'bg-tea-gold/10 text-tea-gold' : 'bg-green-500/10 text-green-400'
        }`}>
          {isDraft ? 'Draft' : 'Confirmed'}
        </span>

        {/* Total */}
        <span className="text-tea-text text-sm font-medium num shrink-0">
          {fmtPrice(total, tx.currency)}
        </span>

        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-tea-text-dim shrink-0"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-tea-border/50">
              {/* Line items */}
              {tx.items.length === 0 ? (
                <p className="text-tea-text-dim text-sm py-6 text-center">No items yet</p>
              ) : (
                tx.items.map((item) => (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    txId={tx.id}
                    onRemove={() => removeLineItem(tx.id, item.id)}
                  />
                ))
              )}

              {/* Grand total */}
              {tx.items.length > 0 && (
                <div className="flex items-baseline justify-between pt-3 mt-1">
                  <span className="text-tea-text-sec text-sm">Total</span>
                  <span className="text-tea-text text-xl font-semibold num">
                    {fmtPrice(total, tx.currency)}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4">
                {isDraft && tx.items.length > 0 && (
                  <AnimatePresence mode="wait">
                    {justConfirmed ? (
                      <motion.div
                        key="confirmed"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600/20 text-green-400 text-sm font-medium"
                      >
                        <Check size={16} />
                        Confirmed
                      </motion.div>
                    ) : (
                      <motion.button
                        key="confirm-btn"
                        type="button"
                        onClick={handleConfirm}
                        whileTap={{ scale: 0.98 }}
                        className="flex-1 py-2.5 rounded-lg bg-tea-gold text-tea-bg font-semibold text-sm shadow-lg transition-opacity"
                      >
                        {isPurchase ? 'Confirm Purchase' : 'Confirm Sale'}
                      </motion.button>
                    )}
                  </AnimatePresence>
                )}

                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-2.5 rounded-lg text-tea-text-dim hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  aria-label="Delete transaction"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Filter Tabs ────────────────────────────────────────────────────────────

type LedgerFilter = 'all' | 'purchase' | 'sale' | 'draft' | 'confirmed';

// ─── Main Ledger View ───────────────────────────────────────────────────────

interface LedgerViewProps {
  /** When inside TeaCompass, provide this to add "New Purchase" shortcut */
  embedded?: boolean;
}

export const LedgerView: React.FC<LedgerViewProps> = ({ embedded }) => {
  const transactions = useLedgerStore((s) => s.transactions);
  const createTransaction = useLedgerStore((s) => s.createTransaction);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LedgerFilter>('all');

  const counts = useMemo(() => ({
    all: transactions.length,
    draft: transactions.filter((t) => t.status === 'draft').length,
    confirmed: transactions.filter((t) => t.status === 'confirmed').length,
    purchase: transactions.filter((t) => t.direction === 'purchase').length,
    sale: transactions.filter((t) => t.direction === 'sale').length,
  }), [transactions]);

  const filtered = useMemo(() => {
    let list = [...transactions];
    if (filter === 'draft') list = list.filter((t) => t.status === 'draft');
    if (filter === 'confirmed') list = list.filter((t) => t.status === 'confirmed');
    if (filter === 'purchase') list = list.filter((t) => t.direction === 'purchase');
    if (filter === 'sale') list = list.filter((t) => t.direction === 'sale');
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [transactions, filter]);

  const filterOptions: { value: LedgerFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'draft', label: 'Drafts', count: counts.draft },
    { value: 'purchase', label: 'Purchases', count: counts.purchase },
    { value: 'sale', label: 'Sales', count: counts.sale },
  ];

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-[fadeIn_0.3s_ease-out]">
        <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
          <ShoppingBag className="w-7 h-7 text-tea-gold/40" />
        </div>
        <h3 className="font-serif text-lg text-tea-text mb-2">No transactions yet</h3>
        <p className="text-sm text-tea-text-sec text-center max-w-[260px] leading-relaxed mb-6">
          Mark items as "Buy" in the Compass, or start a new purchase or sale here.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => createTransaction('purchase', '', 'NT')}
            className="px-5 py-2.5 bg-tea-gold text-tea-bg text-xs font-bold uppercase tracking-[0.15em] transition-colors"
          >
            New Purchase
          </button>
          <button
            onClick={() => createTransaction('sale', '', 'USD')}
            className="px-5 py-2.5 bg-tea-surface text-tea-text-sec text-xs font-bold uppercase tracking-[0.15em] border border-tea-border transition-colors hover:text-tea-text"
          >
            New Sale
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
      {/* Filter row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-wider rounded transition-colors ${
                filter === opt.value
                  ? 'bg-tea-gold/15 text-tea-gold'
                  : 'text-tea-text-sec/50 hover:text-tea-text-sec'
              }`}
            >
              {opt.label}{opt.count > 0 ? ` (${opt.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {filtered.map((tx) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <TransactionCard
                tx={tx}
                isExpanded={expandedId === tx.id}
                onToggle={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Quick create buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => {
            const id = createTransaction('purchase', '', 'NT');
            setExpandedId(id);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-tea-surface text-tea-text-sec text-xs font-medium border border-tea-border/50 hover:text-tea-text hover:border-tea-border transition-colors"
        >
          <ArrowDownLeft size={14} />
          New Purchase
        </button>
        <button
          onClick={() => {
            const id = createTransaction('sale', '', 'USD');
            setExpandedId(id);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-tea-surface text-tea-text-sec text-xs font-medium border border-tea-border/50 hover:text-tea-text hover:border-tea-border transition-colors"
        >
          <ArrowUpRight size={14} />
          New Sale
        </button>
      </div>
    </div>
  );
};

export default LedgerView;
