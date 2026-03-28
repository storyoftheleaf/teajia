import React, { useState, useMemo, useCallback, useRef } from 'react';
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
  Share2,
  Camera,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useLedgerStore } from '../../lib/ledgerStore';
import type { LedgerTransaction, LedgerLineItem } from '../../lib/ledgerStore';
import type { Currency } from '../../admin/types';
import { useAppStore } from '../../lib/store';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';

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
    <div className="py-3 border-b border-tea-border/15 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {item.chineseName && (
            <p className="text-tea-text text-lg font-serif tracking-wide leading-[1.3]">
              {item.chineseName}
            </p>
          )}
          <p className="text-tea-text font-serif text-[13px]">
            {item.name || 'Unnamed'}
          </p>
          {(item.type || item.form || item.year) && (
            <p className="text-tea-text-sec text-[11px] mt-0.5 num">
              {[item.type, item.form, item.year].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Quantity control */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleQtyChange(currentQty - (isUnitBased ? 1 : 25))}
            aria-label="Decrease quantity"
            className="w-10 h-10 rounded-full bg-tea-surface flex items-center justify-center
                       text-tea-text-sec active:bg-tea-elevated transition-colors"
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            value={currentQty}
            aria-label={isUnitBased ? 'Number of units' : 'Quantity in grams'}
            onChange={(e) => handleQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
            onWheel={(e) => (e.target as HTMLElement).blur()}
            className="w-14 text-center text-tea-text text-sm font-medium bg-transparent num
                       border-none outline-none py-0.5"
          />
          <span className="text-tea-text-sec text-[10px] num w-3">{isUnitBased ? '×' : 'g'}</span>
          <button
            type="button"
            onClick={() => handleQtyChange(currentQty + (isUnitBased ? 1 : 25))}
            aria-label="Increase quantity"
            className="w-10 h-10 rounded-full bg-tea-surface flex items-center justify-center
                       text-tea-text-sec active:bg-tea-elevated transition-colors"
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
          className="pill flex items-center gap-1"
        >
          <Trash2 size={10} />
          Remove
        </button>
        <span className="text-tea-text text-sm font-serif num">
          {fmtPrice(total, item.currency)}
        </span>
      </div>
    </div>
  );
};

// ─── Photo Gallery (inline within transaction card) ─────────────────────────

const TransactionPhotos: React.FC<{ txId: string; photos: string[] }> = ({ txId, photos }) => {
  const addPhoto = useLedgerStore((s) => s.addPhoto);
  const removePhoto = useLedgerStore((s) => s.removePhoto);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const handleCapture = () => {
    if (uploading) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const compressedFile = new File([compressed], 'photo.jpg', { type: 'image/jpeg' });
      const url = await api.uploadImage(compressedFile);
      if (url) addPhoto(txId, url);
    } catch (err) {
      console.error('Ledger photo upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        key={photos.length === 0 ? 'camera' : 'gallery'}
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        {...(photos.length === 0 ? { capture: 'environment' } : {})}
      />

      <div className="pt-2">
        {photos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {photos.map((url, i) => (
              <div key={i} className="relative shrink-0">
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-16 h-16 rounded-lg object-cover cursor-pointer"
                  onClick={() => setViewerIndex(i)}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(txId, i);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-tea-surface text-tea-text-dim"
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleCapture}
              disabled={uploading}
              className={`w-16 h-16 flex flex-col items-center justify-center shrink-0 rounded-lg bg-tea-surface ${
                uploading ? 'animate-pulse' : ''
              }`}
            >
              <Plus size={16} className="text-tea-text-dim" />
              <span className="text-[9px] text-tea-text-dim mt-0.5">
                {uploading ? '...' : 'Add'}
              </span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCapture}
            disabled={uploading}
            className={`flex items-center gap-1.5 py-2 px-3 rounded-lg bg-tea-surface text-tea-text-dim text-[11px] transition-colors active:text-tea-text-sec ${
              uploading ? 'animate-pulse' : ''
            }`}
          >
            <Camera size={14} />
            {uploading ? 'Uploading...' : 'Add photo'}
          </button>
        )}
      </div>

      {/* Fullscreen photo viewer */}
      <AnimatePresence>
        {viewerIndex !== null && photos[viewerIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] bg-tea-bg/95 flex flex-col items-center justify-center"
            onClick={() => setViewerIndex(null)}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setViewerIndex(null)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-tea-surface/80 text-tea-text z-10"
            >
              <X size={20} />
            </button>

            {/* Counter */}
            <p className="absolute top-5 left-1/2 -translate-x-1/2 text-tea-text-sec text-xs num z-10">
              {viewerIndex + 1} / {photos.length}
            </p>

            {/* Image */}
            <img
              src={photos[viewerIndex]}
              alt={`Photo ${viewerIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Nav arrows */}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewerIndex((viewerIndex - 1 + photos.length) % photos.length);
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-tea-surface/60 text-tea-text"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewerIndex((viewerIndex + 1) % photos.length);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-tea-surface/60 text-tea-text"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleSharePdf = useCallback(async () => {
    setPdfLoading(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { LedgerPdf } = await import('./LedgerPdf');
      const doc = React.createElement(LedgerPdf, { transaction: tx });
      const blob = await pdf(doc).toBlob();
      const fileName = `teajia-${tx.direction}-${tx.counterpartyName || 'order'}-${tx.id.slice(0, 6)}.pdf`.replace(/\s+/g, '-');

      // Use Web Share API if available (mobile), otherwise download
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        await navigator.share({ files: [file], title: `Teajia ${tx.direction === 'purchase' ? 'Purchase' : 'Sale'} Order` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.debug('PDF generation failed:', err);
    } finally {
      setPdfLoading(false);
    }
  }, [tx]);

  const total = useMemo(
    () => tx.items.reduce((sum, item) => sum + lineTotal(item), 0),
    [tx.items]
  );

  const isPurchase = tx.direction === 'purchase';
  const isDraft = tx.status === 'draft';
  const DirectionIcon = isPurchase ? ArrowDownLeft : ArrowUpRight;
  const directionLabel = isPurchase ? 'Purchasing from' : 'Selling to';

  const [poSaved, setPoSaved] = useState(false);

  const handleConfirm = useCallback(async () => {
    confirmTransaction(tx.id);
    setJustConfirmed(true);
    setTimeout(() => setJustConfirmed(false), 1500);

    // Persist purchase order to database (fire-and-forget)
    if (tx.direction === 'purchase') {
      try {
        const totalAmount = tx.items.reduce((sum, item) => sum + lineTotal(item), 0);
        await api.purchaseOrders.create({
          po_number: `PO-${tx.id.slice(0, 8).toUpperCase()}`,
          vendor_name: tx.counterpartyName || 'Unknown',
          items_json: JSON.stringify(tx.items.map(item => ({
            name: item.name,
            chineseName: item.chineseName,
            type: item.type,
            form: item.form,
            year: item.year,
            quantity: item.priceIsPerGram ? (item.quantityGrams ?? 0) : (item.quantityUnits ?? 1),
            pricePerUnit: item.pricePerUnit,
            priceIsPerGram: item.priceIsPerGram,
          }))),
          total_usd: totalAmount,
          display_currency: tx.currency,
          status: 'confirmed',
        });
        setPoSaved(true);
      } catch {
        // Non-critical — PO exists locally in ledger store
      }
    }
  }, [tx, confirmTransaction]);

  const handleDelete = useCallback(() => {
    if (window.confirm(`Remove this ${isPurchase ? 'purchase' : 'sale'} order?`)) {
      removeTransaction(tx.id);
    }
  }, [tx.id, isPurchase, removeTransaction]);

  return (
    <div className="inset-panel overflow-hidden transition-colors">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-tea-elevated active:bg-tea-surface transition-colors focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none ${isExpanded ? 'bg-tea-elevated/30' : ''}`}
      >
        <DirectionIcon
          size={16}
          className={isPurchase ? 'text-tea-gold shrink-0' : 'text-tea-gold-lt shrink-0'}
        />
        <div className="flex-1 min-w-0">
          <p className="text-tea-text text-sm font-serif truncate">
            {tx.counterpartyName || 'Unnamed'}
          </p>
          <p className="text-tea-text-sec text-[11px] uppercase tracking-[0.08em]">
            {directionLabel} · {tx.items.length} {tx.items.length === 1 ? 'item' : 'items'}
            {(tx.photos?.length ?? 0) > 0 && ` · ${tx.photos.length} photo${tx.photos.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {/* Status */}
        <span className={`badge-status ${isDraft ? 'badge-status-gold' : 'badge-status-default'}`}>
          {isDraft ? 'Draft' : 'Confirmed'}
        </span>

        {/* Total */}
        <span className="text-tea-text text-sm font-serif num shrink-0">
          {fmtPrice(total, tx.currency)}
        </span>

        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-tea-text-sec shrink-0"
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
            <div className="px-3 pb-3 border-t border-tea-border/20">
              {/* Line items */}
              {tx.items.length === 0 ? (
                <p className="text-tea-text-sec text-sm font-serif italic py-6 text-center">No items yet</p>
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

              {/* Photos */}
              <TransactionPhotos txId={tx.id} photos={tx.photos || []} />

              {/* Grand total */}
              {tx.items.length > 0 && (
                <div className="flex items-baseline justify-between pt-3 border-t border-tea-border/15" aria-label="Grand total">
                  <span className="text-tea-text-sec text-[11px] uppercase tracking-[0.15em]">Total</span>
                  <span className="text-tea-text text-lg font-serif font-semibold num">
                    {fmtPrice(total, tx.currency)}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                {isDraft && tx.items.length > 0 && (
                  <AnimatePresence mode="wait">
                    {justConfirmed ? (
                      <motion.div
                        key="confirmed"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-tea-gold/20 text-tea-gold text-sm font-medium"
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
                        className="flex-1 py-2.5 rounded-lg bg-tea-gold text-tea-bg font-semibold text-xs uppercase tracking-[0.08em] shadow-[0_2px_8px_rgba(184,146,78,0.3)] active:shadow-[0_1px_4px_rgba(184,146,78,0.2)] transition-all"
                      >
                        {isPurchase ? 'Confirm Purchase' : 'Confirm Sale'}
                      </motion.button>
                    )}
                  </AnimatePresence>
                )}

                <button
                  type="button"
                  onClick={handleSharePdf}
                  disabled={pdfLoading || tx.items.length === 0}
                  className="pill flex items-center gap-1 disabled:opacity-30"
                  aria-label="Share as PDF"
                >
                  <Share2 size={12} className={pdfLoading ? 'animate-pulse' : ''} />
                  PDF
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  className="pill flex items-center gap-1"
                  aria-label="Delete transaction"
                >
                  <Trash2 size={12} />
                  Delete
                </button>

                {isPurchase && !isDraft && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.purchaseOrders.updateStatus(tx.id.slice(0, 8).toUpperCase(), 'sent');
                        setPoSaved(true);
                      } catch {
                        // Status update failed silently
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-tea-surface text-tea-text text-[11px] font-medium uppercase tracking-[0.08em] active:bg-tea-elevated transition-colors"
                  >
                    <Check size={14} /> {poSaved ? 'Sent' : 'Mark as Sent'}
                  </button>
                )}
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
  embedded?: boolean;
}

export const LedgerView: React.FC<LedgerViewProps> = ({ embedded }) => {
  const transactions = useLedgerStore((s) => s.transactions);
  const createTransaction = useLedgerStore((s) => s.createTransaction);
  const openPurchaseOrder = useAppStore((s) => s.openPurchaseOrder);
  // All transactions expanded by default
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
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
      <div className="flex flex-col items-center justify-center py-10 animate-[fadeIn_0.3s_ease-out]">
        <div className="w-16 h-16 rounded-full bg-tea-gold/15 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(184,146,78,0.1)]">
          <ShoppingBag className="w-7 h-7 text-tea-gold/60" />
        </div>
        <h3 className="font-serif text-lg text-tea-text mb-3">No transactions yet</h3>
        <p className="text-sm text-tea-text-sec font-serif text-center max-w-[260px] leading-relaxed mb-6">
          Mark items as "Buy" in the Compass, or start a new purchase or sale here.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            onClick={() => openPurchaseOrder()}
            className="w-full px-5 py-3 bg-tea-gold text-tea-bg text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingBag size={14} />
            Purchase Order Builder
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => createTransaction('purchase', '', 'NT')}
              className="flex-1 px-4 py-2.5 bg-tea-surface text-tea-text-sec text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors active:text-tea-text"
            >
              Quick Note
            </button>
            <button
              onClick={() => createTransaction('sale', '', 'USD')}
              className="flex-1 px-4 py-2.5 bg-tea-surface text-tea-text-sec text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors active:text-tea-text"
            >
              Quick Sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8 animate-[fadeIn_0.3s_ease-out]">
      {/* Filter row */}
      <div className="flex items-center">
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              aria-label={`Filter: ${opt.label}, ${opt.count} transactions`}
              aria-pressed={filter === opt.value}
              className={filter === opt.value ? 'pill-active' : 'pill'}
            >
              <>{opt.label}{opt.count > 0 && <span className="num ml-1 opacity-70">{opt.count}</span>}</>
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
                isExpanded={!collapsedIds.has(tx.id)}
                onToggle={() => setCollapsedIds(prev => {
                  const next = new Set(prev);
                  if (next.has(tx.id)) next.delete(tx.id); else next.add(tx.id);
                  return next;
                })}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Quick create buttons */}
      <div className="flex flex-col gap-2 pt-4 border-t border-tea-border/15">
        <div className="flex gap-2">
          <button
            onClick={() => {
              createTransaction('purchase', '', 'NT');
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-tea-gold/5 text-tea-text-sec text-[11px] font-semibold uppercase tracking-[0.08em] active:text-tea-text transition-colors"
          >
            <ArrowDownLeft size={14} />
            Quick Note
          </button>
          <button
            onClick={() => {
              createTransaction('sale', '', 'USD');
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-tea-surface text-tea-text-sec text-[11px] font-semibold uppercase tracking-[0.08em] active:text-tea-text transition-colors"
          >
            <ArrowUpRight size={14} />
            Quick Sale
          </button>
        </div>
        <button
          onClick={() => openPurchaseOrder()}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-tea-gold text-tea-bg text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors"
        >
          <ShoppingBag size={14} />
          Full Purchase Order Builder
        </button>
      </div>
    </div>
  );
};

export default LedgerView;
