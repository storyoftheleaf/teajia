import React, { useState, useMemo, useCallback, useRef } from 'react';
import { mediaUrl } from '../../lib/mediaUrl';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Minus,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useLedgerStore } from '../../lib/ledgerStore';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import type { LedgerTransaction, LedgerLineItem } from '../../lib/ledgerStore';
import type { Currency } from '../../admin/types';
import { useAppStore } from '../../lib/store';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { OrderMessageSheet } from './OrderMessageSheet';
import { VendorPicker } from './VendorPicker';
import { NO_VENDOR_YET } from './orderBuy';
import { orderLanded } from './curatePricing';
import { useRates, useShopFreightDefault } from '../../admin/hooks/useAdminData';

// ─── Currency helpers ────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$', NT: 'NT$', Yuan: '¥', IDR: 'Rp', JPY: 'JP¥', MYR: 'RM', HKD: 'HK$', AUD: 'A$', UNK: '',
};

function fmtPrice(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency] || '';
  // Whole amounts read the way a vendor says them: ¥2,400, not ¥2,400.00.
  const decimals = ['NT', 'IDR', 'JPY'].includes(currency) || Math.abs(amount - Math.round(amount)) < 0.005 ? 0 : 2;
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
  onOpenEntry?: (entryId: string) => void;
  /** A confirmed order is a record: nothing on it can be taken off or changed. */
  readOnly?: boolean;
}> = ({ item, txId, onRemove, onOpenEntry, readOnly }) => {
  const navigate = useNavigate();
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

  // "2 cakes", "1 piece", "500 g": the amount the way it is ordered.
  const piece = String(item.form || (item.type === 'Teaware' ? 'piece' : 'piece')).toLowerCase();
  const qtyWords = isUnitBased ? `${currentQty} ${currentQty === 1 ? piece : `${piece}s`}` : `${currentQty.toLocaleString()} g`;
  const nameClass = 'curate-v2-name block w-full truncate text-left transition-colors hover:text-tea-gold';

  return (
    <div className="border-b border-tea-border px-4 py-3.5">
      <div className="flex items-start gap-3">
        {/* The year in a small frame, as the shop shows it. */}
        <span className="mt-0.5 flex h-[38px] w-[46px] shrink-0 items-center justify-center rounded-[3px] border border-tea-border text-ui-13 text-tea-text-sec tabular-nums">
          {item.year ?? '—'}
        </span>
        <div className="min-w-0 flex-1">
          {item.compassEntryId && onOpenEntry ? (
            <button onClick={() => onOpenEntry(item.compassEntryId!)} className={nameClass}>{item.name || 'Unnamed'}</button>
          ) : item.productId ? (
            <button onClick={() => navigate(`/admin/stock?panel=${encodeURIComponent(item.productId!)}`)} className={nameClass}>{item.name || 'Unnamed'}</button>
          ) : (
            <p className="curate-v2-name truncate">{item.name || 'Unnamed'}</p>
          )}
          {(item.type || item.form || item.chineseName) && (
            <p className="mt-1 truncate font-sans text-ui-12 tracking-[0.02em] text-tea-text-sec">
              {item.type && <span className="uppercase">{item.type}</span>}
              {item.type && item.form && item.type !== 'Teaware' && <><span className="px-1.5 text-tea-text-sec">&middot;</span><span>{item.form}</span></>}
              {item.chineseName && <><span className="px-1.5 text-tea-text-sec">&middot;</span><span className="text-tea-text-sec" style={{ fontFamily: "'Noto Serif SC', serif" }}>{item.chineseName}</span></>}
            </p>
          )}
          {!readOnly && <button type="button" onClick={onRemove} className="tap-target mt-1 text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text">remove</button>}
        </div>
        {/* Amount and price in one frame, − and + beneath it. */}
        <div className="flex shrink-0 flex-col items-stretch gap-1.5">
          <div className="flex h-[38px] items-center justify-between gap-3 rounded-[3px] border border-tea-border px-3">
            <span className="text-ui-13 text-tea-text-sec tabular-nums">{qtyWords}</span>
            <span className="text-ui-14 font-medium text-tea-text tabular-nums">{fmtPrice(total, item.currency)}</span>
          </div>
          {!readOnly && <div className="flex items-center justify-between">
            <button type="button" aria-label="Less" onClick={() => handleQtyChange(currentQty - (isUnitBased ? 1 : 25))} className="curate-v2-frame h-8 w-9 min-w-0 px-0"><Minus size={12} strokeWidth={1.5} /></button>
            <input
              type="number"
              value={currentQty}
              aria-label="Amount"
              onChange={(e) => handleQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              className="w-14 border-none bg-transparent text-center text-ui-11 uppercase tracking-[0.14em] text-tea-text-dim outline-none tabular-nums"
            />
            <button type="button" aria-label="More" onClick={() => handleQtyChange(currentQty + (isUnitBased ? 1 : 25))} className="curate-v2-frame h-8 w-9 min-w-0 px-0"><Plus size={12} strokeWidth={1.5} /></button>
          </div>}
        </div>
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

      <div className="px-4 pt-2">
        {photos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {photos.map((url, i) => (
              <div key={i} className="relative shrink-0">
                <img
                  src={mediaUrl(url)}
                  alt={`Photo ${i + 1}`}
                  className="w-16 h-16 rounded-[3px] object-cover cursor-pointer"
                  onClick={() => setViewerIndex(i)}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(txId, i);
                  }}
                  className="tap-target absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-tea-surface text-tea-text-sec"
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleCapture}
              disabled={uploading}
              className={`w-16 h-16 flex flex-col items-center justify-center shrink-0 rounded-[3px] border border-tea-border ${
                uploading ? 'animate-pulse' : ''
              }`}
            >
              <span className="text-ui-12 text-tea-text-sec">
                {uploading ? '…' : 'Add'}
              </span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCapture}
            disabled={uploading}
            className={`tap-target flex min-h-11 items-center gap-1.5 font-mono text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text ${
              uploading ? 'animate-pulse' : ''
            }`}
          >
            {uploading ? 'Uploading…' : 'Add photo'}
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
            className="fixed inset-0 z-priority bg-tea-bg/95 flex flex-col items-center justify-center"
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
              src={mediaUrl(photos[viewerIndex])}
              alt={`Photo ${viewerIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
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
  onOpenEntry?: (entryId: string) => void;
  /** In a list: tapping the order opens its own screen instead of unfolding it. */
  onOpenOrder?: (txId: string) => void;
  /** The order's own screen: always open, the heading is just a heading. */
  detail?: boolean;
}> = ({ tx, isExpanded, onToggle, onOpenEntry, onOpenOrder, detail }) => {
  const removeLineItem = useLedgerStore((s) => s.removeLineItem);
  const updateCompassEntry = useTeaCompassStore((s) => s.updateEntry);
  const listRow = !detail && !!onOpenOrder;
  const showBody = detail || (!listRow && isExpanded);

  /** A tea taken off a draft order is no longer being ordered. */
  const removeLine = useCallback((item: LedgerLineItem) => {
    removeLineItem(tx.id, item.id);
    if (item.compassEntryId && tx.status === 'draft') {
      const e = useTeaCompassStore.getState().getEntry(item.compassEntryId);
      if (e?.status === 'buying') updateCompassEntry(item.compassEntryId, { status: 'noted' });
    }
  }, [tx.id, tx.status, removeLineItem, updateCompassEntry]);
  const confirmTransaction = useLedgerStore((s) => s.confirmTransaction);
  const removeTransaction = useLedgerStore((s) => s.removeTransaction);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showTagSheet, setShowTagSheet] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  const handleSharePdf = useCallback(async () => {
    setPdfLoading(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { LedgerPdf } = await import('./LedgerPdf');
      const doc = React.createElement(LedgerPdf, { transaction: tx });
      const blob = await pdf(doc as any).toBlob();
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
  const { data: rates } = useRates();
  const shopFreight = useShopFreightDefault();
  const landed = useMemo(() => orderLanded(tx, rates, shopFreight.perKgUsd), [tx, rates, shopFreight.perKgUsd]);

  const isPurchase = tx.direction === 'purchase';
  const isDraft = tx.status === 'draft';
  const directionLabel = isPurchase ? 'Purchasing from' : 'Selling to';

  const [poSaved, setPoSaved] = useState(false);
  // Only the vendor having been messaged counts as sent, not the order being recorded.
  const [markedSent, setMarkedSent] = useState(false);
  // An order for "No vendor yet" cannot be confirmed: someone has to be named first.
  const needsVendor = isPurchase && !tx.counterpartyId && (!tx.counterpartyName?.trim() || tx.counterpartyName === NO_VENDOR_YET);
  const [choosingVendor, setChoosingVendor] = useState(false);
  const updateTransaction = useLedgerStore((s) => s.updateTransaction);
  /** The vendor goes onto the order and onto every tea on it. */
  const assignVendor = useCallback((id: string | undefined, name: string) => {
    updateTransaction(tx.id, { counterpartyName: name, counterpartyId: id });
    for (const item of tx.items) {
      if (item.compassEntryId) updateCompassEntry(item.compassEntryId, { vendorName: name, vendorId: id });
    }
    setChoosingVendor(false);
  }, [tx.id, tx.items, updateTransaction, updateCompassEntry]);

  const handleConfirm = useCallback(async () => {
    confirmTransaction(tx.id);
    setJustConfirmed(true);
    setTimeout(() => setJustConfirmed(false), 1500);
    // Ordered, not arrived: the teas on a confirmed purchase wait under "On the way".
    if (tx.direction === 'purchase') {
      const compass = useTeaCompassStore.getState();
      for (const item of tx.items) {
        const e = item.compassEntryId ? compass.getEntry(item.compassEntryId) : undefined;
        if (e && e.status !== 'in_stock') compass.updateEntry(e.id, { status: 'incoming' });
      }
    }

    // A confirmed purchase order records acquisition intent only. Inventory is
    // created or increased later through a reviewed receipt/Inventory action.
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
        // Non-critical: PO exists locally in ledger store
      }
    }

    // Persist sale as invoice to database (fire-and-forget)
    if (tx.direction === 'sale') {
      try {
        const invoiceNumber = `INV-${new Date().getFullYear()}-${tx.id.slice(0, 8).toUpperCase()}`;
        const lineItems = tx.items
          .filter(item => item.productId) // Only items linked to inventory products
          .map(item => ({
            product_id: item.productId!,
            quantity: item.priceIsPerGram ? (item.quantityGrams ?? 0) : (item.quantityUnits ?? 1),
            price_at_sale: item.pricePerUnit,
          }));

        if (lineItems.length > 0) {
          await api.invoices.create(
            {
              invoice_number: invoiceNumber,
              customer_name: tx.counterpartyName || 'Unknown',
              customer_id: tx.counterpartyId || null,
              display_currency: tx.currency,
              shipping_cost_usd: 0,
              status: 'Pending',
              notes: `Created from ledger transaction ${tx.id}`,
            },
            lineItems
          );
        }
        setPoSaved(true);
      } catch {
        // Non-critical, sale exists locally in ledger store
      }
    }
  }, [tx, confirmTransaction]);

  const handleDelete = useCallback(() => {
    if (window.confirm(`Remove this ${isPurchase ? 'purchase' : 'sale'} order?`)) {
      removeTransaction(tx.id);
    }
  }, [tx.id, isPurchase, removeTransaction]);

  return (
    <div className="curate-v2 -mx-4 pb-4" data-testid="curate-order" data-order-id={tx.id} data-status={tx.status}>
      {/* Curate v2: the vendor as the heading, what the order is in small
          words, the total and Message on the right, as drawn. */}
      <div className="flex items-center gap-2 pl-4 pr-2 pt-3">
        {detail ? (
          <h2 className="flex min-h-11 min-w-0 flex-1 items-center" data-testid="order-vendor">
            <span className="min-w-0 truncate font-display text-ui-26 leading-none text-tea-text">{tx.counterpartyName || (isPurchase ? 'Vendor' : 'Customer')}</span>
          </h2>
        ) : (
          <button
            type="button"
            onClick={listRow ? () => onOpenOrder!(tx.id) : onToggle}
            aria-expanded={listRow ? undefined : isExpanded}
            aria-label={listRow ? `Open the order with ${tx.counterpartyName || (isPurchase ? 'a vendor' : 'a customer')}` : undefined}
            className="flex min-h-11 min-w-0 flex-1 items-baseline gap-2 text-left focus-visible:outline-none"
          >
            <span className="min-w-0 truncate font-display text-ui-26 leading-none text-tea-text">{tx.counterpartyName || (isPurchase ? 'Vendor' : 'Customer')}</span>
            {listRow
              ? <ChevronRight size={14} className="shrink-0 self-center text-tea-text-dim" />
              : <ChevronDown size={14} className={`shrink-0 self-center text-tea-text-dim transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
          </button>
        )}
        {isPurchase && tx.items.length > 0 && (
          <button type="button" onClick={() => setMessageOpen(true)} className="tap-target px-2 font-mono text-ui-13 tracking-[0.04em] text-tea-gold" aria-label="Message the vendor about this order">
            Message
          </button>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-3 px-4 pb-3 text-ui-12 text-tea-text-sec tabular-nums">
        <span>
          {isPurchase ? 'purchase' : 'sale'} · {tx.items.length} {tx.items.length === 1 ? 'item' : 'items'}
          {' · '}<span className={isDraft ? 'text-tea-gold' : ''}>{isDraft ? 'draft' : 'confirmed'}</span>
          {(tx.photos?.length ?? 0) > 0 ? ` · ${tx.photos.length} photo${tx.photos.length === 1 ? '' : 's'}` : ''}
        </span>
        {!showBody && <span className="text-ui-14 font-medium text-tea-text tabular-nums">{fmtPrice(total, tx.currency)}</span>}
      </div>
      <div className="mx-4 h-px bg-tea-gold/20" aria-hidden="true" />

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {showBody && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-3">
              {/* Line items */}
              {tx.items.length === 0 ? (
                <p className="px-4 py-4 text-ui-13 text-tea-text-sec">Nothing on this order yet. Choose Buy on a tea to add it.</p>
              ) : (
                tx.items.map((item) => (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    txId={tx.id}
                    onRemove={() => removeLine(item)}
                    onOpenEntry={onOpenEntry}
                    readOnly={!isDraft}
                  />
                ))
              )}

              {/* Photos */}
              <TransactionPhotos txId={tx.id} photos={tx.photos || []} />

              {/* Totals, as drawn: freight on the tea weight at the shop rate,
                  the rate today, and what it lands at in dollars. */}
              {tx.items.length > 0 && (
                <div className="px-4 pt-2" aria-label="Grand total">
                  {landed && isPurchase && (
                    <>
                      <div className="flex items-baseline justify-between py-1 text-ui-13 text-tea-text-sec tabular-nums">
                        <span>Teas</span><span className="text-tea-text">{fmtPrice(landed.subtotal, tx.currency)}</span>
                      </div>
                      <div className="flex items-baseline justify-between py-1 text-ui-13 text-tea-text-sec tabular-nums">
                        <span>Freight · {landed.weightKg.toFixed(1)} kg at {fmtPrice(landed.freightPerKg, tx.currency)}</span><span className="text-tea-text">{fmtPrice(landed.freight, tx.currency)}</span>
                      </div>
                      {landed.perUsd !== 1 && (
                        <div className="flex items-baseline justify-between py-1 text-ui-13 text-tea-text-sec tabular-nums">
                          <span>{fmtPrice(landed.subtotal + landed.freight, tx.currency)} at {landed.perUsd.toFixed(2)} today</span><span />
                        </div>
                      )}
                    </>
                  )}
                  <div className="mt-1 flex items-baseline justify-between border-t border-tea-border pt-2.5">
                    <span className="text-ui-13 text-tea-text-sec">{landed && isPurchase ? 'Landed' : 'Total'}</span>
                    <span className="text-ui-20 font-semibold text-tea-gold tabular-nums">
                      {landed && isPurchase ? `$${Math.round(landed.landedUsd).toLocaleString()}` : fmtPrice(total, tx.currency)}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-4">
                {isDraft && tx.items.length > 0 && (
                  <AnimatePresence mode="wait">
                    {justConfirmed ? (
                      <motion.div
                        key="confirmed"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-tea-gold/20 text-tea-gold text-xs font-medium"
                      >
                        Confirmed
                      </motion.div>
                    ) : needsVendor ? (
                      <button
                        key="choose-vendor"
                        type="button"
                        onClick={() => setChoosingVendor((v) => !v)}
                        aria-expanded={choosingVendor}
                        className="min-h-11 rounded-md cta-solid px-4 text-ui-13 font-semibold"
                      >
                        Choose the vendor
                      </button>
                    ) : (
                      <motion.button
                        key="confirm-btn"
                        type="button"
                        onClick={handleConfirm}
                        whileTap={{ scale: 0.98 }}
                        className="min-h-11 rounded-md cta-solid px-4 text-ui-13 font-semibold"
                      >
                        {isPurchase ? 'Confirm purchase' : 'Confirm sale'}
                      </motion.button>
                    )}
                  </AnimatePresence>
                )}

                {/* Print Tags, for purchase transactions with compass-linked items */}
                {isPurchase && tx.items.some((i) => i.compassEntryId) && (
                  <button
                    type="button"
                    onClick={() => setShowTagSheet(true)}
                    className="tap-target flex min-h-11 items-center gap-1 font-mono text-ui-13 text-tea-text-sec hover:text-tea-text"
                    aria-label="Print tea tags"
                  >
                    Tags
                  </button>
                )}


                <button
                  type="button"
                  onClick={handleSharePdf}
                  disabled={pdfLoading || tx.items.length === 0}
                  className="tap-target flex min-h-11 items-center gap-1 font-mono text-ui-13 text-tea-text-sec hover:text-tea-text disabled:opacity-30"
                  aria-label="Share as PDF"
                >
                  {pdfLoading ? '…' : 'PDF'}
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  className="tap-target flex min-h-11 items-center gap-1 font-mono text-ui-13 text-tea-text-sec hover:text-tea-text"
                  aria-label="Delete transaction"
                >
                  Delete
                </button>

                {isPurchase && !isDraft && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.purchaseOrders.updateStatus(tx.id.slice(0, 8).toUpperCase(), 'sent');
                        setMarkedSent(true);
                      } catch {
                        // Status update failed silently
                      }
                    }}
                    className="tap-target flex min-h-11 items-center gap-1 font-mono text-ui-13 text-tea-text-sec hover:text-tea-text"
                  >
                    {markedSent ? 'Marked as sent' : 'Mark as sent'}
                  </button>
                )}
              </div>
              {needsVendor && isDraft && choosingVendor && (
                <div className="mt-2 border-t border-tea-border" data-testid="order-vendor-picker">
                  <p className="px-4 pt-3 font-mono text-ui-12 text-tea-text-sec">Whose order is this?</p>
                  <VendorPicker onPick={assignVendor} onCancel={() => setChoosingVendor(false)} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <OrderMessageSheet tx={messageOpen ? tx : null} onOpenChange={(open) => { if (!open) setMessageOpen(false); }} />

      {/* Tag sheet overlay */}
      {showTagSheet && (
        <React.Suspense fallback={null}>
          <LazyTeaTagSheet transaction={tx} onClose={() => setShowTagSheet(false)} />
        </React.Suspense>
      )}
    </div>
  );
};

const LazyTeaTagSheet = React.lazy(() => import('./TeaTagSheet'));

// ─── Filter Tabs ────────────────────────────────────────────────────────────

type LedgerFilter = 'all' | 'purchase' | 'sale' | 'draft' | 'confirmed';

// ─── Main Ledger View ───────────────────────────────────────────────────────

interface LedgerViewProps {
  embedded?: boolean;
  onOpenEntry?: (entryId: string) => void;
  /** External search query from the tab-level search bar */
  searchQuery?: string;
  /** Open one order on its own screen, on top of this tab. */
  onOpenOrder?: (txId: string) => void;
}

export const LedgerView: React.FC<LedgerViewProps> = ({ embedded, onOpenEntry, searchQuery = '', onOpenOrder }) => {
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
    // Apply text search across counterparty name and line item names
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((t) =>
        (t.counterpartyName || '').toLowerCase().includes(q) ||
        (t.items || []).some((item) => (item.name || '').toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [transactions, filter, searchQuery]);

  const filterOptions: { value: LedgerFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'draft', label: 'Drafts', count: counts.draft },
    { value: 'purchase', label: 'Purchases', count: counts.purchase },
    { value: 'sale', label: 'Sales', count: counts.sale },
  ];

  // Starting an order, in words: a purchase from a vendor, a note, or a sale.
  const starters = (
    <div className="curate-v2 -mx-4 border-t border-tea-border">
      <button type="button" onClick={() => openPurchaseOrder()} className="curate-v2-row w-full text-left">
        <span className="font-mono text-ui-13 font-medium text-tea-gold">+ Purchase order</span>
        <span className="flex-1" />
        <span className="font-mono text-ui-12 text-tea-text-sec">several teas from one vendor</span>
      </button>
      <button type="button" onClick={() => createTransaction('purchase', '', useTeaCompassStore.getState().lastCurrency)} className="curate-v2-row w-full text-left">
        <span className="font-mono text-ui-13 text-tea-text-sec">+ Quick purchase note</span>
      </button>
      <button type="button" onClick={() => createTransaction('sale', '', 'USD')} className="curate-v2-row w-full text-left">
        <span className="font-mono text-ui-13 text-tea-text-sec">+ Quick sale</span>
      </button>
    </div>
  );

  if (transactions.length === 0) {
    return (
      <div className="pb-8">
        <p className="pb-3 pt-1 text-ui-14 text-tea-text-sec">No orders yet. Choose Buy on a tea and it starts one with that vendor.</p>
        {starters}
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Which orders: four equal columns on one line, never a sideways scroll. */}
      <div className="curate-v2-tabs -mx-4 mb-1 border-b border-tea-border" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }} role="tablist" aria-label="Which orders">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="tab"
            onClick={() => setFilter(opt.value)}
            aria-label={`Filter: ${opt.label}, ${opt.count} transactions`}
            aria-selected={filter === opt.value}
            className="curate-v2-tab"
          >
            {opt.label}{opt.count > 0 && <span className="ml-1 tabular-nums">{opt.count}</span>}
          </button>
        ))}
      </div>

      {filtered.map((tx) => (
        <TransactionCard
          key={tx.id}
          tx={tx}
          isExpanded={!collapsedIds.has(tx.id)}
          onToggle={() => setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(tx.id)) next.delete(tx.id); else next.add(tx.id);
            return next;
          })}
          onOpenEntry={onOpenEntry}
          onOpenOrder={onOpenOrder}
        />
      ))}

      <div className="pt-6">{starters}</div>
    </div>
  );
};

/**
 * One order on its own screen: the same rendering the Orders tab used to show
 * inline, always open. Opened over the tab you are on (after Buy on a tea, or
 * from a row in Orders); the teas on it open their own tea on top of it.
 */
export const OrderScreen: React.FC<{ txId: string; onOpenEntry?: (entryId: string) => void }> = ({ txId, onOpenEntry }) => {
  const tx = useLedgerStore((s) => s.transactions.find((t) => t.id === txId));
  if (!tx) return null;
  return <TransactionCard tx={tx} isExpanded onToggle={() => {}} onOpenEntry={onOpenEntry} detail />;
};

export default LedgerView;
