import React, { useState, useMemo, useCallback, useRef } from 'react';
import { mediaUrl } from '../../lib/mediaUrl';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
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
import { NO_VENDOR_YET, releaseTeaFromOrder } from './orderBuy';
import { orderLanded, orderMoney, purchaseSpendInUsd } from './curatePricing';
import { SHOP_ORDERS_KEY, mergeOrders, shopOrderTotals, shopStatusWords, useShopOrders, type ShopOrder } from './shopOrders';
import { arrivalFields, arrivalKey, orderArrivalLines } from './orderArrivals';
import { AGENT_KEYS } from './AgentInbox';
import { useRates, useShopFreightDefault } from '../../admin/hooks/useAdminData';

// ─── Currency helpers ────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$', NT: 'NT$', Yuan: '¥', IDR: 'Rp', JPY: 'JP¥', MYR: 'RM', HKD: 'HK$', AUD: 'A$', UNK: '',
};

function fmtPrice(amount: number, currency: Currency): string {
  // A money this table has no symbol for is named by its code, never printed bare.
  const sym = CURRENCY_SYMBOLS[currency] ?? (currency ? `${currency} ` : '');
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
  // The name is the way into the tea: its hit area is a finger tall, not a line of text tall.
  const nameClass = 'curate-v2-name -my-3 block w-full truncate py-3 text-left transition-colors hover:text-tea-gold';

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
            <p className="mt-1 truncate font-mono text-ui-12 tracking-[0.02em] text-tea-text-sec">
              {item.type && <span className="uppercase">{item.type}</span>}
              {item.type && item.form && item.type !== 'Teaware' && <><span className="px-1.5 text-tea-text-sec">&middot;</span><span>{item.form}</span></>}
              {item.chineseName && <><span className="px-1.5 text-tea-text-sec">&middot;</span><span className="curate-v2-hanzi text-tea-text-sec">{item.chineseName}</span></>}
            </p>
          )}
          {!readOnly && <button type="button" onClick={onRemove} className="tap-target mt-1 text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text">remove</button>}
        </div>
        {/* Amount and price in one frame, − and + beneath it. */}
        <div className="flex shrink-0 flex-col items-stretch gap-1.5">
          <div className="flex h-[38px] items-center justify-between gap-3 rounded-[3px] border border-tea-border px-3">
            <span className="text-ui-13 text-tea-text-sec tabular-nums">{qtyWords}</span>
            {item.unpriced
              ? <span className="text-ui-13 text-tea-text-sec">no price yet</span>
              : <span className="text-ui-14 font-medium text-tea-text tabular-nums">{fmtPrice(total, item.currency)}</span>}
          </div>
          {!readOnly && <div className="flex items-center justify-between">
            <button type="button" aria-label="Less" onClick={() => handleQtyChange(currentQty - (isUnitBased ? 1 : 25))} className="curate-v2-frame h-8 w-9 min-w-0 px-0 text-ui-15">−</button>
            <input
              type="number"
              value={currentQty}
              aria-label="Amount"
              onChange={(e) => handleQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              className="h-11 w-14 border-none bg-transparent text-center font-mono text-ui-12 tracking-[0.14em] text-tea-text-sec outline-none tabular-nums"
            />
            <button type="button" aria-label="More" onClick={() => handleQtyChange(currentQty + (isUnitBased ? 1 : 25))} className="curate-v2-frame h-8 w-9 min-w-0 px-0 text-ui-15">+</button>
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
  /** The order's lines moved into another draft: show that one instead. */
  onSwitchOrder?: (txId: string) => void;
}> = ({ tx, isExpanded, onToggle, onOpenEntry, onOpenOrder, detail, onSwitchOrder }) => {
  const removeLineItem = useLedgerStore((s) => s.removeLineItem);
  const updateCompassEntry = useTeaCompassStore((s) => s.updateEntry);
  const listRow = !detail && !!onOpenOrder;
  const showBody = detail || (!listRow && isExpanded);

  /** A tea taken off a draft order is no longer being ordered. */
  const removeLine = useCallback((item: LedgerLineItem) => {
    removeLineItem(tx.id, item.id);
    if (item.compassEntryId && tx.status === 'draft') releaseTeaFromOrder(item.compassEntryId);
  }, [tx.id, tx.status, removeLineItem]);
  const confirmTransaction = useLedgerStore((s) => s.confirmTransaction);
  const updateTransaction = useLedgerStore((s) => s.updateTransaction);
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

  // The order counted in the money its lines are in: one figure when they share
  // a money, each on its own when they do not, never one money's number under
  // another's symbol. Lines with no price yet are in no total and are said so.
  const money = useMemo(() => orderMoney(tx), [tx]);
  const totalText = money.parts.map((part) => fmtPrice(part.amount, part.currency)).join(' + ');
  const allUnpriced = tx.items.length > 0 && money.unpriced === tx.items.length;
  const { data: rates } = useRates();
  const shopFreight = useShopFreightDefault();
  const landed = useMemo(() => orderLanded(tx, rates, shopFreight.perKgUsd), [tx, rates, shopFreight.perKgUsd]);

  const isPurchase = tx.direction === 'purchase';
  const isDraft = tx.status === 'draft';
  const directionLabel = isPurchase ? 'Purchasing from' : 'Selling to';

  // An order for "No vendor yet" cannot be confirmed: someone has to be named first.
  // ("Unknown Vendor" is the older placeholder, left on drafts made before this one.)
  const needsVendor = isPurchase && !tx.counterpartyId && (!tx.counterpartyName?.trim() || tx.counterpartyName === NO_VENDOR_YET || /^unknown vendor$/i.test(tx.counterpartyName.trim()));
  const [choosingVendor, setChoosingVendor] = useState(false);
  const adoptVendor = useLedgerStore((s) => s.adoptVendor);
  /** The vendor goes onto the order and onto every tea on it. A vendor that
   *  already has a draft takes these lines into it, and that draft opens. */
  const assignVendor = useCallback((id: string | undefined, name: string) => {
    const kept = adoptVendor(tx.id, name, id);
    for (const item of tx.items) {
      if (item.compassEntryId) updateCompassEntry(item.compassEntryId, { vendorName: name, vendorId: id });
    }
    setChoosingVendor(false);
    if (kept !== tx.id) onSwitchOrder?.(kept);
  }, [tx.id, tx.items, adoptVendor, updateCompassEntry, onSwitchOrder]);

  // Putting the confirmed order into the shop's books (a purchase order, or an
  // invoice for a sale). It can fail on a bad connection: then the order stays
  // confirmed here, says plainly that the shop has not recorded it, and offers
  // it again. One attempt at a time, so a second tap cannot record it twice.
  const recording = useRef(false);
  const queryClient = useQueryClient();
  const [recordBusy, setRecordBusy] = useState(false);
  const recordAtShop = useCallback(async () => {
    if (recording.current) return;
    recording.current = true;
    setRecordBusy(true);
    try {
      if (tx.direction === 'purchase') {
        // total_usd is dollars: the order's own money is converted at the shop's
        // rates, and left out when a currency has no rate (never read at 1,
        // which would store ¥2,400 as $2,400).
        // A total is only written when every line has a price: a total with
        // blanks counted as zero would record the order as cheaper than it is.
        const complete = tx.items.length > 0 && tx.items.every((item) => !item.unpriced);
        const totalAmount = complete ? purchaseSpendInUsd([tx], rates).priced[0]?.usd : undefined;
        // Recorded once: a retry after a failed receipt picks the same order up.
        let purchaseOrderId = tx.purchaseOrderId;
        if (!purchaseOrderId) {
          const created = await api.purchaseOrders.create({
            po_number: `PO-${tx.id.slice(0, 8).toUpperCase()}`,
            vendor_name: tx.counterpartyName || 'Unknown',
            vendor_id: tx.counterpartyId || undefined,
            items_json: JSON.stringify(tx.items.map(item => ({
              name: item.name,
              chineseName: item.chineseName,
              type: item.type,
              form: item.form,
              year: item.year,
              quantity: item.priceIsPerGram ? (item.quantityGrams ?? 0) : (item.quantityUnits ?? 1),
              // No price yet is no price, not a price of nothing.
              pricePerUnit: item.unpriced ? null : item.pricePerUnit,
              priceIsPerGram: item.priceIsPerGram,
              currency: item.currency,
              // What the shop reads back when the tea arrives, so it comes in
              // with its cost (see orderArrivals.ts).
              ...arrivalFields(item),
            }))),
            total_usd: totalAmount === undefined ? undefined : Math.round(totalAmount * 100) / 100,
            display_currency: tx.currency,
            status: 'confirmed',
          });
          purchaseOrderId = created?.id;
          // Kept so "Mark as sent" can name the order the shop recorded.
          if (purchaseOrderId) updateTransaction(tx.id, { purchaseOrderId });
          // The shop's list of orders was read before this one existed.
          void queryClient.invalidateQueries({ queryKey: SHOP_ORDERS_KEY });
        }
        // One receipt waiting per tea: accepting it on arrival puts the tea on
        // the shelf's books with what it cost and what came. The same key
        // answers with the same receipt, so trying again adds nothing.
        if (purchaseOrderId) {
          try {
            for (const line of orderArrivalLines(tx)) {
              await api.compass.proposeReceipt(line.entryId, {
                purpose: 'working',
                quantity: line.grams,
                unit: 'g',
                acquisition_kind: 'purchase',
                idempotency_key: arrivalKey(purchaseOrderId, line.entryId),
                product_name: line.name,
                ...(line.type ? { product_type: line.type } : {}),
              });
            }
          } finally {
            // Today's list of receipts was read before these existed. Left as it
            // was, "Arrived" on a tea just ordered would not find its receipt and
            // would shelve the tea with no cost.
            void queryClient.invalidateQueries({ queryKey: AGENT_KEYS.arriving });
          }
        }
        updateTransaction(tx.id, { recordFailed: false });
      } else if (tx.direction === 'sale') {
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
        updateTransaction(tx.id, { recordFailed: false });
      }
    } catch {
      updateTransaction(tx.id, { recordFailed: true });
    } finally {
      recording.current = false;
      setRecordBusy(false);
    }
  }, [tx, updateTransaction, rates, queryClient]);

  const handleConfirm = useCallback(async () => {
    if (recording.current) return;
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
    await recordAtShop();
  }, [tx, confirmTransaction, recordAtShop]);

  const [sendFailed, setSendFailed] = useState(false);
  const markSent = useCallback(async () => {
    setSendFailed(false);
    try {
      // The order the shop recorded, by its own id. (This used to send the first
      // eight letters of the local id, which names no order, so "Marked as sent"
      // changed nothing anywhere.)
      if (!tx.purchaseOrderId) throw new Error('no order');
      await api.purchaseOrders.updateStatus(tx.purchaseOrderId, 'sent');
      updateTransaction(tx.id, { purchaseOrderSent: true });
      void queryClient.invalidateQueries({ queryKey: SHOP_ORDERS_KEY });
    } catch {
      setSendFailed(true);
    }
  }, [tx.id, tx.purchaseOrderId, updateTransaction, queryClient]);

  // Delete asks in place, not in a browser popup: a popup breaks the page's
  // dress, and in-app browsers and webviews often block it, which made Delete
  // do nothing at all.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const handleDelete = useCallback(() => {
    removeTransaction(tx.id);
  }, [tx.id, removeTransaction]);

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
        {!showBody && <span className="text-ui-14 font-medium text-tea-text tabular-nums">{allUnpriced ? 'no price yet' : totalText}</span>}
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
                        <span>Teas</span><span className="text-tea-text">{fmtPrice(landed.subtotal, money.currency)}</span>
                      </div>
                      <div className="flex items-baseline justify-between py-1 text-ui-13 text-tea-text-sec tabular-nums">
                        <span>Freight · {landed.weightKg.toFixed(1)} kg at {fmtPrice(landed.freightPerKg, money.currency)}</span><span className="text-tea-text">{fmtPrice(landed.freight, money.currency)}</span>
                      </div>
                      {landed.perUsd !== 1 && (
                        <div className="flex items-baseline justify-between py-1 text-ui-13 text-tea-text-sec tabular-nums">
                          <span>{fmtPrice(landed.subtotal + landed.freight, money.currency)} at {landed.perUsd.toFixed(2)} today</span><span />
                        </div>
                      )}
                    </>
                  )}
                  <div className="mt-1 flex items-baseline justify-between border-t border-tea-border pt-2.5">
                    <span className="text-ui-13 text-tea-text-sec">{landed && isPurchase ? 'Landed' : 'Total'}</span>
                    <span className="text-ui-20 font-semibold text-tea-gold tabular-nums">
                      {landed && isPurchase && !allUnpriced ? `$${Math.round(landed.landedUsd).toLocaleString()}` : allUnpriced ? 'no price yet' : totalText}
                    </span>
                  </div>
                  {money.unpriced > 0 && !allUnpriced && (
                    <p className="pt-1.5 font-mono text-ui-12 text-tea-text-sec" data-testid="order-unpriced-note">
                      {money.unpriced === 1 ? '1 tea has' : `${money.unpriced} teas have`} no price yet and {money.unpriced === 1 ? 'is' : 'are'} left out of this.
                    </p>
                  )}
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
                        className="flex min-h-11 items-center font-mono text-ui-13 uppercase tracking-[0.16em] text-tea-gold"
                      >
                        Confirmed
                      </motion.div>
                    ) : needsVendor ? (
                      <button
                        key="choose-vendor"
                        type="button"
                        onClick={() => setChoosingVendor((v) => !v)}
                        aria-expanded={choosingVendor}
                        className="curate-v2-frame is-on is-tall uppercase tracking-[0.16em]"
                      >
                        Choose the vendor
                      </button>
                    ) : (
                      <motion.button
                        key="confirm-btn"
                        type="button"
                        onClick={handleConfirm}
                        whileTap={{ scale: 0.98 }}
                        className="curate-v2-frame is-on is-tall uppercase tracking-[0.16em]"
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

                {confirmingDelete ? (
                  <span className="flex min-h-11 items-center gap-3 font-mono text-ui-13" data-testid="order-delete-confirm">
                    <span className="text-tea-text-sec">Remove this {isPurchase ? 'purchase' : 'sale'} order?</span>
                    <button type="button" onClick={handleDelete} className="tap-target text-tea-gold hover:text-tea-text">Remove</button>
                    <button type="button" onClick={() => setConfirmingDelete(false)} className="tap-target text-tea-text-sec hover:text-tea-text">Keep</button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="tap-target flex min-h-11 items-center gap-1 font-mono text-ui-13 text-tea-text-sec hover:text-tea-text"
                    aria-label="Delete transaction"
                  >
                    Delete
                  </button>
                )}

                {/* Sent only means something once the shop has the order to name. */}
                {isPurchase && !isDraft && tx.purchaseOrderId && (
                  <button
                    type="button"
                    onClick={() => void markSent()}
                    disabled={tx.purchaseOrderSent}
                    className="tap-target flex min-h-11 items-center gap-1 font-mono text-ui-13 text-tea-text-sec hover:text-tea-text"
                  >
                    {tx.purchaseOrderSent ? 'Marked as sent' : 'Mark as sent'}
                  </button>
                )}
              </div>
              {!isDraft && tx.recordFailed && (
                <div role="alert" data-testid="order-record-failed" className="flex items-baseline justify-between gap-3 px-4 pt-1">
                  <p className="font-body text-ui-13 text-tea-error">
                    {isPurchase ? 'The order is confirmed here, but the shop has not recorded it yet.' : 'The sale is confirmed here, but the shop has not recorded it yet.'}
                  </p>
                  <button type="button" onClick={() => void recordAtShop()} disabled={recordBusy} className="curate-v2-word tap-target shrink-0 disabled:opacity-60">
                    {recordBusy ? 'Trying…' : 'Try again'}
                  </button>
                </div>
              )}
              {!isDraft && sendFailed && (
                <p role="alert" className="px-4 pt-1 font-body text-ui-13 text-tea-error">Could not mark it as sent. Try again.</p>
              )}
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

// ─── The shop's order, as another device made it ────────────────────────────

const orderDate = (iso: string) => {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/**
 * One line of the shop's record: the tea and what it came to on one row, then
 * its year, type, form and amount in small type under it. Not the local line's
 * framed amount beside the name: the laptop's list is narrow, and there that
 * frame leaves the name two letters.
 */
const ShopLine: React.FC<{ item: LedgerLineItem; onOpenEntry?: (entryId: string) => void }> = ({ item, onOpenEntry }) => {
  const perPiece = !item.priceIsPerGram;
  const qty = perPiece ? (item.quantityUnits ?? 1) : (item.quantityGrams ?? 0);
  const piece = String(item.form || 'piece').toLowerCase();
  const qtyWords = perPiece ? `${qty} ${qty === 1 ? piece : `${piece}s`}` : `${qty.toLocaleString()} g`;
  const kind = [item.year, item.type && item.type !== 'Teaware' ? item.type.toUpperCase() : item.type, item.type !== 'Teaware' ? item.form : undefined].filter((x) => x !== undefined && x !== '');
  const nameClass = 'min-w-0 break-words text-left font-display text-ui-17 leading-tight text-tea-text';
  return (
    <div className="border-b border-tea-border px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        {item.compassEntryId && onOpenEntry
          ? <button type="button" onClick={() => onOpenEntry(item.compassEntryId!)} className={`${nameClass} transition-colors hover:text-tea-gold`}>{item.name || 'Unnamed'}</button>
          : <span className={nameClass}>{item.name || 'Unnamed'}</span>}
        {item.unpriced
          ? <span className="shrink-0 text-ui-13 text-tea-text-sec">no price yet</span>
          : <span className="shrink-0 text-ui-14 font-medium text-tea-text tabular-nums">{fmtPrice(lineTotal(item), item.currency)}</span>}
      </div>
      <p className="mt-1 font-mono text-ui-12 tracking-[0.02em] text-tea-text-sec tabular-nums">
        {kind.length > 0 && <>{kind.join(' · ')} · </>}{qtyWords}
      </p>
    </div>
  );
};

/**
 * An order the shop holds that this device does not: made on another phone or
 * laptop, or before this browser was cleared. It is a record, so it is read-only:
 * what the shop recorded (vendor, lines, status, total), folded under its
 * heading. A total the shop could not record is a dash, never $0.
 */
const ShopOrderCard: React.FC<{
  order: ShopOrder;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenEntry?: (entryId: string) => void;
}> = ({ order, isExpanded, onToggle, onOpenEntry }) => {
  const getEntry = useTeaCompassStore((s) => s.getEntry);
  const totals = useMemo(() => shopOrderTotals(order), [order]);
  const ownText = totals.own ? totals.own.map((part) => fmtPrice(part.amount, part.currency)).join(' + ') : null;
  const usdText = totals.usd !== null ? `$${totals.usd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : null;
  const headline = ownText ?? usdText ?? '—';
  const date = orderDate(order.createdAt);
  // A tea this device has never seen cannot be opened here; the shop's other
  // device's link into a product is not followed either.
  const lines = useMemo(() => order.items.map((item) => ({
    ...item,
    productId: undefined,
    compassEntryId: item.compassEntryId && getEntry(item.compassEntryId) ? item.compassEntryId : undefined,
  })), [order.items, getEntry]);
  return (
    <div className="curate-v2 -mx-4 pb-4" data-testid="curate-shop-order" data-order-id={order.id} data-status={order.status}>
      <div className="flex items-center gap-2 pl-4 pr-2 pt-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={`The shop's order with ${order.vendorName}`}
          className="flex min-h-11 min-w-0 flex-1 items-baseline gap-2 text-left focus-visible:outline-none"
        >
          <span className="min-w-0 truncate font-display text-ui-26 leading-none text-tea-text">{order.vendorName}</span>
          <ChevronDown size={14} className={`shrink-0 self-center text-tea-text-dim transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div className="flex items-baseline justify-between gap-3 px-4 pb-3 text-ui-12 text-tea-text-sec tabular-nums">
        <span>
          purchase · {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
          {' · '}<span>{shopStatusWords(order.status)}</span>
          {date ? ` · ${date}` : ''}
        </span>
        {!isExpanded && <span className="text-ui-14 font-medium text-tea-text tabular-nums" data-testid="shop-order-total">{headline}</span>}
      </div>
      <div className="mx-4 h-px bg-tea-gold/20" aria-hidden="true" />
      {isExpanded && (
        <div className="pb-3">
          {order.items.length === 0 ? (
            <p className="px-4 py-4 text-ui-13 text-tea-text-sec">{order.unreadableLines ? "The shop's record of what was on this order could not be read." : 'The shop recorded no teas on this order.'}</p>
          ) : (
            lines.map((item) => <ShopLine key={item.id} item={item} onOpenEntry={onOpenEntry} />)
          )}
          {order.unreadableLines && order.items.length > 0 && (
            <p className="px-4 pt-2 font-mono text-ui-12 text-tea-text-sec">Some lines the shop recorded could not be read.</p>
          )}
          <div className="px-4 pt-2" aria-label="Grand total">
            <div className="flex items-baseline justify-between py-1 text-ui-13 text-tea-text-sec tabular-nums">
              <span>Total</span><span className="text-tea-text" data-testid="shop-order-total">{ownText ?? '—'}</span>
            </div>
            <div className="flex items-baseline justify-between py-1 text-ui-13 text-tea-text-sec tabular-nums">
              <span>In dollars</span><span className="text-tea-text" data-testid="shop-order-usd">{usdText ?? '—'}</span>
            </div>
            {order.items.some((item) => item.unpriced) && (
              <p className="pt-1 font-mono text-ui-12 text-tea-text-sec">Not every tea has a price on this order, so there is no total to show.</p>
            )}
          </div>
          {order.notes && <p className="px-4 pt-2 text-ui-13 text-tea-text-sec">{order.notes}</p>}
          <p className="px-4 pt-3 font-mono text-ui-12 text-tea-text-sec">Recorded at the shop. This copy is read-only.</p>
        </div>
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
  // The shop's purchase orders, beside this device's own.
  const shop = useShopOrders();
  // All transactions expanded by default; the shop's own orders folded.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [openShopIds, setOpenShopIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<LedgerFilter>('all');

  // One row per order, newest first: an order this device holds that the shop
  // also recorded is the one row, and the shop's copy is not shown again.
  const rows = useMemo(() => mergeOrders(transactions, shop.orders), [transactions, shop.orders]);

  const counts = useMemo(() => ({
    all: rows.length,
    draft: rows.filter((r) => r.kind === 'local' && r.tx.status === 'draft').length,
    purchase: rows.filter((r) => r.kind === 'shop' || r.tx.direction === 'purchase').length,
    sale: rows.filter((r) => r.kind === 'local' && r.tx.direction === 'sale').length,
  }), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === 'draft') list = list.filter((r) => r.kind === 'local' && r.tx.status === 'draft');
    if (filter === 'confirmed') list = list.filter((r) => r.kind === 'shop' || r.tx.status === 'confirmed');
    if (filter === 'purchase') list = list.filter((r) => r.kind === 'shop' || r.tx.direction === 'purchase');
    if (filter === 'sale') list = list.filter((r) => r.kind === 'local' && r.tx.direction === 'sale');
    // Apply text search across counterparty name and line item names
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((r) => {
        const who = r.kind === 'local' ? r.tx.counterpartyName : r.order.vendorName;
        const items = r.kind === 'local' ? r.tx.items : r.order.items;
        return (who || '').toLowerCase().includes(q) || (items || []).some((item) => (item.name || '').toLowerCase().includes(q));
      });
    }
    return list;
  }, [rows, filter, searchQuery]);

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
        <span className="font-mono text-ui-13 text-tea-gold">+ Purchase order</span>
        <span className="flex-1" />
        <span className="font-mono text-ui-12 text-tea-text-sec lg:hidden">several teas from one vendor</span>
      </button>
      <button type="button" onClick={() => createTransaction('purchase', '', useTeaCompassStore.getState().lastCurrency)} className="curate-v2-row w-full text-left">
        <span className="font-mono text-ui-13 text-tea-text-sec">+ Quick purchase note</span>
      </button>
      <button type="button" onClick={() => createTransaction('sale', '', 'USD')} className="curate-v2-row w-full text-left">
        <span className="font-mono text-ui-13 text-tea-text-sec">+ Quick sale</span>
      </button>
    </div>
  );

  // The shop's orders could not be read: what is shown is only this device's, and it says so.
  const shopFailed = shop.failed && (
    <div role="alert" data-testid="shop-orders-failed" className="flex items-baseline justify-between gap-3 py-2">
      <p className="font-body text-ui-13 text-tea-error">
        {transactions.length === 0
          ? "The shop's orders could not be loaded."
          : "The shop's orders could not be loaded, so only the orders on this device are shown."}
      </p>
      <button type="button" onClick={shop.retry} className="curate-v2-word tap-target shrink-0">Try again</button>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div className="pb-8">
        {shop.loading
          ? <p className="pb-3 pt-1 text-ui-14 text-tea-text-sec" data-testid="shop-orders-loading">Loading the shop's orders…</p>
          : shop.failed
            ? shopFailed
            : <p className="pb-3 pt-1 text-ui-14 text-tea-text-sec">No orders yet. Choose Buy on a tea and it starts one with that vendor.</p>}
        {starters}
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Which orders: four equal columns on one line on a phone, never a sideways
          scroll; in the narrow list beside the overview on a laptop, two by two,
          because four would print over each other there. */}
      <div className="curate-v2-tabs -mx-4 mb-1 !grid-cols-4 border-b border-tea-border lg:!grid-cols-2" role="tablist" aria-label="Which orders">
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
      {shopFailed}
      {shop.loading && <p className="py-2 font-mono text-ui-12 text-tea-text-sec" data-testid="shop-orders-loading">Loading the shop's orders…</p>}

      {filtered.map((row) => row.kind === 'local' ? (
        <TransactionCard
          key={row.tx.id}
          tx={row.tx}
          isExpanded={!collapsedIds.has(row.tx.id)}
          onToggle={() => setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(row.tx.id)) next.delete(row.tx.id); else next.add(row.tx.id);
            return next;
          })}
          onOpenEntry={onOpenEntry}
          onOpenOrder={onOpenOrder}
        />
      ) : (
        <ShopOrderCard
          key={`shop-${row.order.id}`}
          order={row.order}
          isExpanded={openShopIds.has(row.order.id)}
          onToggle={() => setOpenShopIds(prev => {
            const next = new Set(prev);
            if (next.has(row.order.id)) next.delete(row.order.id); else next.add(row.order.id);
            return next;
          })}
          onOpenEntry={onOpenEntry}
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
export const OrderScreen: React.FC<{ txId: string; onOpenEntry?: (entryId: string) => void; onSwitchOrder?: (txId: string) => void }> = ({ txId, onOpenEntry, onSwitchOrder }) => {
  const tx = useLedgerStore((s) => s.transactions.find((t) => t.id === txId));
  if (!tx) return null;
  return <TransactionCard tx={tx} isExpanded onToggle={() => {}} onOpenEntry={onOpenEntry} onSwitchOrder={onSwitchOrder} detail />;
};

export default LedgerView;
