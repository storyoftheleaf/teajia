import { Button } from '../shared/Button';
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { isoCurrencyCode } from '../../lib/currency';
import { mediaUrl } from '../../lib/mediaUrl';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { confirmPurchase, recordPurchase } from '../CurateV2/placeOrder';
import { useLibraryPurchases } from '../../lib/libraryPurchaseState';
import { ensureCompassEncounterSaved } from '../../lib/teaCompassSync';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
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
  MoreHorizontal,
  BookOpen,
  Package,
  X,
  ChevronLeft,
  ChevronRight,
  Tag,
} from 'lucide-react';
import { useLedgerStore } from '../../lib/ledgerStore';
import type { LedgerTransaction, LedgerLineItem } from '../../lib/ledgerStore';
import type { Currency } from '../../admin/types';
import { selectHasBundle, useAppStore } from '../../lib/store';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { useRates } from '../../admin/hooks/useAdminData';
import { usePurchaseLogistics } from '../../admin/hooks/usePurchaseLogistics';
import type { LogisticsShipment } from '../../lib/logisticsTypes';
import { purchaseArrivalTiming } from '../../lib/purchaseArrivalTiming';
import { orderMoney } from './curatePricing';
import { TeaCard, TeaCardMeta, TeaCardMetric, TeaCardTitle } from '../tea/TeaCard';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';

// ─── Currency helpers ────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$', NT: 'NT$', Yuan: 'CN¥', IDR: 'Rp', JPY: 'JP¥', MYR: 'RM', HKD: 'HK$', AUD: 'A$', UNK: '',
};

function fmtPrice(amount: number, currency: Currency, showSymbol = true): string {
  const sym = showSymbol ? CURRENCY_SYMBOLS[currency] || '' : '';
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
  onOpenEntry?: (entryId: string) => void;
  readOnly?: boolean;
  purchase?: boolean;
  shipments?: readonly LogisticsShipment[];
}> = ({ item, txId, onRemove, onOpenEntry, readOnly, purchase, shipments = [] }) => {
  const navigate = useNavigate();
  const updateLineItem = useLedgerStore((s) => s.updateLineItem);
  const total = lineTotal(item);
  const purchases = useLibraryPurchases();
  const facts = purchases.stateFor({ entryId: item.compassEntryId, productId: item.productId });
  const queryClient = useQueryClient();
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState('');
  const receivingRef = useRef(false);
  const tx = useLedgerStore(s => s.transactions.find(transaction => transaction.id === txId));
  const pendingReceipt = readOnly ? purchases.receiptProposals.find(receipt => receipt.status === 'pending'
    && receipt.compass_entry_id === item.compassEntryId
    && (receipt.idempotency_key === `order:${tx?.purchaseOrderId}:${item.compassEntryId}`
      || receipt.idempotency_key === `ledger:${txId}:${item.compassEntryId}`)) : undefined;
  const linkedReceipt = readOnly && tx?.purchaseOrderReceiptId
    ? purchases.receipts.find(receipt => receipt.id === tx.purchaseOrderReceiptId && receipt.state !== 'cancelled')
    : undefined;
  const incomingLine = item.productId ? linkedReceipt?.lines.find(line => item.purchaseReceiptLineId
    ? line.id === item.purchaseReceiptLineId : line.product_id === item.productId) : undefined;
  const incomingQuantity = incomingLine ? Math.max(0, incomingLine.expected_quantity - incomingLine.received_quantity - incomingLine.cancelled_quantity) : 0;
  const quantityToReceive = pendingReceipt?.quantity ?? incomingQuantity;
  const unitToReceive = pendingReceipt?.unit ?? incomingLine?.unit;
  const receive = async () => {
    if (!quantityToReceive || (!pendingReceipt && !incomingLine) || receivingRef.current) return;
    receivingRef.current = true;
    setReceiving(true);
    setReceiveError('');
    const accountId = useAppStore.getState().activeAccountId;
    try {
      let productId: string;
      if (pendingReceipt) {
        productId = (await api.compass.acceptReceiptProposal(pendingReceipt.id)).product_id;
      } else {
        const line = incomingLine!;
        await api.inventoryReceipts.receive(line.id, quantityToReceive, `ledger-arrival:${line.id}:${line.received_quantity}:${quantityToReceive}`);
        productId = line.product_id;
      }
      if (accountId !== useAppStore.getState().activeAccountId) return;
      if (item.compassEntryId) useTeaCompassStore.getState().updateEntry(item.compassEntryId, { status: 'in_stock', draftProductId: productId });
      useLedgerStore.getState().updateLineItem(txId, item.id, { productId });
      void queryClient.invalidateQueries({ queryKey: ['library-purchase-history'] });
      void queryClient.invalidateQueries({ queryKey: ['library-purchase-receipts'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (error) {
      if (accountId === useAppStore.getState().activeAccountId) setReceiveError(error instanceof Error ? error.message : 'Could not record this arrival.');
    } finally {
      receivingRef.current = false;
      setReceiving(false);
    }
  };
  const receiptText = facts.quantities.flatMap(q => q.received === null ? [] : [
    `${q.received.toLocaleString()}${q.unit === 'g' ? 'g' : ' pcs'} received${q.due === null ? '' : ` · ${q.due.toLocaleString()}${q.unit === 'g' ? 'g' : ' pcs'} due`}`,
  ]).join(' · ');
  const isUnitBased = !item.priceIsPerGram;

  const handleQtyChange = useCallback(
    (newQty: number) => {
      if (readOnly || newQty < 1) return;
      if (isUnitBased) {
        updateLineItem(txId, item.id, { quantityUnits: newQty });
      } else {
        updateLineItem(txId, item.id, { quantityGrams: newQty });
      }
    },
    [txId, item.id, isUnitBased, updateLineItem, readOnly]
  );

  const currentQty = isUnitBased ? (item.quantityUnits ?? 1) : (item.quantityGrams ?? 100);

  if (purchase) {
    const name = item.name || 'Unnamed';
    const libraryId = item.compassEntryId;
    const stockHref = item.productId ? `/admin/stock?panel=${encodeURIComponent(item.productId)}` : undefined;
    const openTea = libraryId && onOpenEntry ? () => onOpenEntry(libraryId) : undefined;
    const entryLinks = readOnly && (openTea || stockHref) && <div className="library-quick-actions tea-order-record-links">
      {openTea && <Button variant="plain" type="button" className="tap-target" aria-label={`Open ${name} in Library`} onClick={openTea}><BookOpen size={16} aria-hidden="true" /></Button>}
      {stockHref && <Link className="tap-target" aria-label={`Open ${name} in Stock`} to={stockHref}><Package size={16} aria-hidden="true" /></Link>}
    </div>;
    const purchaseQty = incomingLine?.expected_quantity ?? (isUnitBased ? item.quantityUnits : item.quantityGrams);
    const unitLabel = incomingLine?.unit === 'g' || (!incomingLine && !isUnitBased) ? 'g' : 'pcs';
    const arrivalTiming = readOnly && quantityToReceive > 0 ? purchaseArrivalTiming(shipments, {
      orderId: tx?.purchaseOrderId,
      receiptLineId: incomingLine?.id ?? item.purchaseReceiptLineId,
      remaining: quantityToReceive,
      receiptEta: linkedReceipt?.eta,
    }) : undefined;
    return (
      <TeaCard
        testId={`curate-order-line-${item.id}`}
        className="tea-order-line"
        teaType={item.type}
        title={<TeaCardTitle>
          {!readOnly && openTea ? <button type="button" className="tap-target min-h-11 text-left hover:text-tea-gold" onClick={openTea}>{name}</button>
            : !readOnly && stockHref ? <Link className="tap-target min-h-11 hover:text-tea-gold" to={stockHref}>{name}</Link> : name}
        </TeaCardTitle>}
        meta={(item.form || item.type || item.year) && <TeaCardMeta primary={item.form} type={item.type} trailing={item.year} />}
        metricsLeading={entryLinks}
        metricsLabel={`Order details for ${name}`}
        metrics={<>
          <TeaCardMetric label={readOnly ? 'Ordered' : 'Quantity'}>
            {readOnly
              ? purchaseQty == null ? 'Unknown' : `${purchaseQty.toLocaleString()} ${unitLabel}`
              : <div className="flex min-h-11 min-w-0 items-center justify-center gap-1">
                <Button variant="plain" type="button" aria-label={`Decrease quantity for ${name}`} className="tap-target flex size-7 shrink-0 items-center justify-center text-tea-text-sec" onClick={() => handleQtyChange(currentQty - (isUnitBased ? 1 : 25))}><Minus size={12} /></Button>
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={`Quantity for ${name}`}
                  min={1}
                  value={currentQty}
                  onChange={e => handleQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
                  className="num w-14 min-w-0 rounded-md border border-tea-border bg-tea-bg px-1 py-1 text-center outline-none focus-visible:border-tea-gold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  style={{ MozAppearance: 'textfield' }}
                />
                <span className="text-ui-11 text-tea-text-sec">{unitLabel}</span>
                <Button variant="plain" type="button" aria-label={`Increase quantity for ${name}`} className="tap-target flex size-7 shrink-0 items-center justify-center text-tea-text-sec" onClick={() => handleQtyChange(currentQty + (isUnitBased ? 1 : 25))}><Plus size={12} /></Button>
              </div>}
          </TeaCardMetric>
          {readOnly && incomingLine && <TeaCardMetric label="Received">{`${incomingLine.received_quantity.toLocaleString()} ${unitLabel}`}</TeaCardMetric>}
          <TeaCardMetric label={`Total · ${isoCurrencyCode(item.currency)}`}>{item.unpriced ? '—' : fmtPrice(total, item.currency, false)}</TeaCardMetric>
        </>}
        actions={<>
          <div className="min-w-0 flex-1 py-1.5 text-ui-11 text-tea-text-sec">
            <p>{!readOnly ? 'Draft' : !incomingLine && receiptText ? receiptText : quantityToReceive > 0 ? 'Awaiting arrival' : incomingLine && incomingLine.received_quantity > 0 ? 'Received' : 'Ordered'}</p>
            {arrivalTiming && <p className="mt-0.5 text-tea-text-dim">{arrivalTiming}</p>}
          </div>
          {!readOnly && <button type="button" onClick={onRemove} className="tap-target" aria-label={`Remove ${name}`}>Remove item</button>}
          {readOnly && quantityToReceive > 0 && <button type="button" disabled={receiving} onClick={() => void receive()} className="tap-target text-tea-text font-medium disabled:opacity-50">{receiving ? 'Recording arrival…' : `Receive ${quantityToReceive.toLocaleString()}${unitToReceive === 'g' ? 'g' : ' pieces'}`}</button>}
        </>}
      >
        {receiveError && <p role="alert" className="py-1 text-ui-12 text-tea-text-sec">{receiveError}</p>}
      </TeaCard>
    );
  }

  return (
    <div className="py-2.5 border-b border-tea-border last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        {/* Name + meta */}
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          {item.compassEntryId && onOpenEntry ? (
            <button
              onClick={() => onOpenEntry(item.compassEntryId!)}
              className="text-tea-text hover:text-tea-gold font-serif text-ui-13 text-left transition-colors truncate block w-full"
            >
              {item.name || 'Unnamed'}
            </button>
          ) : item.productId ? (
            <button
              onClick={() => navigate(`/admin/stock?panel=${encodeURIComponent(item.productId!)}`)}
              className="text-tea-text hover:text-tea-gold font-serif text-ui-13 text-left transition-colors truncate block w-full"
            >
              {item.name || 'Unnamed'}
            </button>
          ) : (
            <p className="text-tea-text font-serif text-ui-13 truncate">
              {item.name || 'Unnamed'}
            </p>
          )}
          {readOnly && receiptText && <p className="mt-1 text-ui-11 text-tea-text-sec">{receiptText}</p>}
          {quantityToReceive > 0 && <button type="button" disabled={receiving} onClick={() => void receive()} className="mt-1 min-h-11 text-left text-ui-12 text-tea-gold disabled:opacity-50">{receiving ? 'Recording arrival…' : `Receive ${quantityToReceive.toLocaleString()}${unitToReceive === 'g' ? 'g' : ' pieces'}`}</button>}
          {receiveError && <p role="alert" className="mt-1 text-ui-12 text-tea-text-sec">{receiveError}</p>}
          {(item.type || item.form || item.year) && (
            <p className="text-tea-text-dim text-ui-10 num mt-0.5">
              {[item.type, item.form, item.year].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Quantity control */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={readOnly}
            hidden={readOnly}
            onClick={() => handleQtyChange(currentQty - (isUnitBased ? 1 : 25))}
            className={readOnly ? 'hidden' : 'tap-target w-7 h-7 rounded-full bg-tea-surface flex items-center justify-center text-tea-text-sec active:bg-tea-elevated transition-colors'}
          >
            <Minus size={11} />
          </button>
          <div className="flex items-baseline gap-0.5">
            <input
              type="number"
              readOnly={readOnly}
              value={currentQty}
              onChange={(e) => handleQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              className="w-10 text-center text-tea-text text-xs font-medium bg-transparent num border-none outline-none"
            />
            <span className="text-tea-text-dim text-ui-10 num">{isUnitBased ? '×' : 'g'}</span>
          </div>
          <button
            type="button"
            disabled={readOnly}
            hidden={readOnly}
            onClick={() => handleQtyChange(currentQty + (isUnitBased ? 1 : 25))}
            className={readOnly ? 'hidden' : 'tap-target w-7 h-7 rounded-full bg-tea-surface flex items-center justify-center text-tea-text-sec active:bg-tea-elevated transition-colors'}
          >
            <Plus size={11} />
          </button>
        </div>

        {/* Price + remove */}
        <div className="ml-auto shrink-0 text-right">
          <p className="text-tea-text text-ui-13 font-serif num">{fmtPrice(total, item.currency)}</p>
          {!readOnly && <button
            type="button"
            onClick={onRemove}
            className="tap-target text-tea-text-dim hover:text-tea-text-sec text-ui-10 uppercase tracking-wide transition-colors mt-0.5"
          >
            remove
          </button>}
        </div>
      </div>
    </div>
  );
};

// ─── Photo Gallery (inline within transaction card) ─────────────────────────

const TransactionPhotos: React.FC<{ txId: string; photos: string[]; inOrderActions?: boolean }> = ({ txId, photos, inOrderActions }) => {
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

      <div className={inOrderActions ? undefined : 'pt-2'}>
        {photos.length > 0 ? (
          <div className={inOrderActions ? 'flex flex-wrap gap-2 px-3 py-2' : 'flex gap-2 overflow-x-auto pb-1 scrollbar-hide'}>
            {photos.map((url, i) => (
              <div key={i} className="relative shrink-0">
                <img
                  src={mediaUrl(url)}
                  alt={`Photo ${i + 1}`}
                  className="w-16 h-16 rounded-xl object-cover cursor-pointer"
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
              className={`w-16 h-16 flex flex-col items-center justify-center shrink-0 rounded-xl bg-tea-surface ${
                uploading ? 'animate-pulse' : ''
              }`}
            >
              <Plus size={16} className="text-tea-text-dim" />
              <span className="text-ui-9 text-tea-text-dim mt-0.5">
                {uploading ? '...' : 'Add'}
              </span>
            </button>
          </div>
        ) : inOrderActions ? (
          <SheetOption label={uploading ? 'Uploading…' : 'Add photo'} leading={<Camera size={17} aria-hidden="true" />} onSelect={handleCapture} />
        ) : (
          <button type="button" onClick={handleCapture} disabled={uploading}
            className="tap-target gap-1.5 rounded-xl bg-tea-surface px-3 text-ui-11 text-tea-text-sec"
          >
            <Camera size={14} aria-hidden="true" />
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
  shipments?: readonly LogisticsShipment[];
}> = ({ tx, isExpanded, onToggle, onOpenEntry, shipments }) => {
  const removeLineItem = useLedgerStore((s) => s.removeLineItem);
  const confirmTransaction = useLedgerStore((s) => s.confirmTransaction);
  const updateTransaction = useLedgerStore((s) => s.updateTransaction);
  const { data: rates } = useRates();
  const removeTransaction = useLedgerStore((s) => s.removeTransaction);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showTagSheet, setShowTagSheet] = useState(false);
  const [showPurchaseActions, setShowPurchaseActions] = useState(false);

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

  // The order counted in the money its lines are in: one figure when they
  // share a money, each on its own when they do not, never one money's number
  // under another's symbol.
  const money = useMemo(() => orderMoney(tx), [tx]);
  const totalText = money.parts.map((part) => fmtPrice(part.amount, part.currency)).join(' + ');

  const isPurchase = tx.direction === 'purchase';
  const isDraft = tx.status === 'draft';
  const purchaseAction = 'tap-target inline-flex min-h-11 items-center gap-1 px-2 text-ui-12 text-tea-text-sec hover:text-tea-text';

  // Only the vendor having been told counts as sent, not the order being recorded.
  const [markedSent, setMarkedSent] = useState(false);
  const purchaseSent = markedSent || tx.purchaseOrderSent;

  const queryClient = useQueryClient();
  const recording = useRef(false);
  const [recordBusy, setRecordBusy] = useState(false);
  const handleConfirm = useCallback(async () => {
    if (recording.current) return;
    recording.current = true; setRecordBusy(true);
    const accountId = useLedgerStore.getState().accountScopeId;
    updateTransaction(tx.id, { confirmationPending: true, confirmationError: undefined });
    try {
      if (tx.direction === 'purchase') {
        for (const item of tx.items) {
          if (item.compassEntryId && useTeaCompassStore.getState().getEntry(item.compassEntryId)) await ensureCompassEncounterSaved(item.compassEntryId);
        }
        await recordPurchase(tx, rates, queryClient);
        if (useLedgerStore.getState().accountScopeId !== accountId) return;
        confirmPurchase(useLedgerStore.getState().getTransaction(tx.id) || tx);
        updateTransaction(tx.id, { confirmationPending: false, confirmationError: undefined, recordFailed: false });
        void queryClient.invalidateQueries({ queryKey: ['library-purchase-history'] });
      } else {
        const lineItems = tx.items.filter(item => item.productId).map(item => ({ product_id: item.productId!,
          quantity: item.priceIsPerGram ? item.quantityGrams ?? 0 : item.quantityUnits ?? 1, price_at_sale: item.pricePerUnit }));
        if (!lineItems.length) throw new Error('Link these sale items to Stock before confirming.');
        await api.invoices.create({ invoice_number: `INV-${new Date().getFullYear()}-${tx.id.slice(0, 8).toUpperCase()}`,
          customer_name: tx.counterpartyName || 'Unknown', customer_id: tx.counterpartyId || null,
          display_currency: tx.currency, shipping_cost_usd: 0, status: 'Pending', notes: `Created from ledger transaction ${tx.id}` }, lineItems);
        if (useLedgerStore.getState().accountScopeId !== accountId) return;
        confirmTransaction(tx.id);
        updateTransaction(tx.id, { confirmationPending: false, confirmationError: undefined });
      }
      setJustConfirmed(true); setTimeout(() => setJustConfirmed(false), 1500);
    } catch (error) {
      if (useLedgerStore.getState().accountScopeId === accountId) updateTransaction(tx.id, {
        confirmationPending: true, recordFailed: true,
        confirmationError: error instanceof Error ? error.message : 'Could not record this order. Your draft is kept for retry.',
      });
    } finally { recording.current = false; setRecordBusy(false); }
  }, [tx, confirmTransaction, updateTransaction, rates, queryClient]);

  const retryConfirmationRef = useRef(handleConfirm);
  retryConfirmationRef.current = handleConfirm;
  useEffect(() => {
    const retry = () => {
      const current = useLedgerStore.getState().getTransaction(tx.id);
      if (current?.confirmationPending) void retryConfirmationRef.current();
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [tx.id]);

  const handleDelete = useCallback(() => {
    const prompt = isPurchase && !isDraft && tx.purchaseOrderId
      ? 'Remove this order from this device? The recorded purchase stays in Purchase Tracking.'
      : `Remove this ${isPurchase ? 'purchase' : 'sale'} order?`;
    if (window.confirm(prompt)) {
      removeTransaction(tx.id);
    }
  }, [tx.id, tx.purchaseOrderId, isPurchase, isDraft, removeTransaction]);

  return (
    <div className={isPurchase ? 'library-supplier-group tea-order-group' : 'bg-tea-surface rounded-xl overflow-hidden transition-colors'}>
      {isPurchase ? <header className="tea-order-header">
        <div className="min-w-0 flex flex-wrap items-center justify-between gap-x-2">
          <h2 className="library-supplier-name min-w-0 break-words">{tx.counterpartyName || 'Unnamed supplier'}</h2>
          {!isDraft && tx.purchaseOrderId
            ? <Link className="tap-target shrink-0 min-h-11 gap-1 text-ui-12 text-tea-text-sec hover:text-tea-text" to={`/admin/purchase-orders?purchaseId=${encodeURIComponent(tx.purchaseOrderId)}`}>View purchase <ArrowUpRight size={12} aria-hidden="true" /></Link>
            : <span className="text-ui-12 text-tea-text-sec">{isDraft ? 'Draft' : 'Confirmed'}</span>}
        </div>
        <div className="tea-order-summary text-ui-12 text-tea-text-sec">
          <span>{!isDraft && tx.purchaseOrderId ? (purchaseSent ? 'Sent' : 'Confirmed') + ' · ' : ''}{tx.items.length} {tx.items.length === 1 ? 'item' : 'items'}</span>
          {tx.items.length > 0 && <span className="text-tea-text font-medium tabular-nums" aria-label="Grand total">{totalText}</span>}
        </div>
      </header> : <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-tea-elevated active:bg-tea-surface transition-colors focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none ${isExpanded ? 'bg-tea-elevated/30' : ''}`}
      >
        <ArrowUpRight size={16} className="text-tea-gold-lt shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-tea-text text-sm font-serif truncate">
            {tx.counterpartyName || 'Unnamed'}
          </p>
          <p className="text-tea-text-sec text-ui-11 uppercase tracking-[0.08em]">
            Selling to · {tx.items.length} {tx.items.length === 1 ? 'item' : 'items'}
            {(tx.photos?.length ?? 0) > 0 && ` · ${tx.photos.length} photo${tx.photos.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {/* Status */}
        <span className={`badge-status ${isDraft ? 'badge-status-gold' : 'badge-status-default'}`}>
          {isDraft ? 'Draft' : 'Confirmed'}
        </span>

        {/* Total */}
        <span className="text-tea-text text-sm font-serif num shrink-0">
          {totalText}
        </span>

        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-tea-text-sec shrink-0"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>}

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {(isPurchase || isExpanded) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className={isPurchase ? 'space-y-2 min-w-0' : 'px-3 pb-3 border-t border-tea-border'}>
              {/* Line items */}
              {tx.items.length === 0 ? (
                <p className="text-tea-text-sec text-sm font-serif italic py-6 text-center">Nothing here yet.</p>
              ) : (
                tx.items.map((item) => (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    txId={tx.id}
                    readOnly={!isDraft}
                    purchase={isPurchase}
                    shipments={shipments}
                    onRemove={() => removeLineItem(tx.id, item.id)}
                    onOpenEntry={onOpenEntry}
                  />
                ))
              )}

              {/* Photos */}
              {!isPurchase && <TransactionPhotos txId={tx.id} photos={tx.photos || []} />}

              {/* Grand total */}
              {!isPurchase && tx.items.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 pt-3 border-t border-tea-border" aria-label="Grand total">
                  <span className="text-tea-text-sec text-ui-11 uppercase tracking-[0.15em]">Total</span>
                  <span className="ml-auto text-tea-text text-sm font-serif num">
                    {totalText}
                  </span>
                </div>
              )}

              {(tx.confirmationPending || tx.confirmationError) && <p role="status" className="mt-3 text-ui-12 text-tea-text-sec">{tx.confirmationError || 'Recording this order. The draft is kept on this device.'}</p>}
              {/* Actions */}
              <div className={isPurchase ? 'tea-order-tools' : 'flex flex-wrap items-center gap-2 mt-3'}>
                {isPurchase && <Button variant="plain" type="button" onClick={() => setShowPurchaseActions(true)} className={purchaseAction} aria-haspopup="dialog" aria-label="More order actions">
                  <MoreHorizontal size={17} aria-hidden="true" /> More
                </Button>}
                {isDraft && tx.items.length > 0 && (
                  <AnimatePresence mode="wait">
                    {justConfirmed ? (
                      <motion.div
                        key="confirmed"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-tea-gold/20 text-tea-gold text-xs font-medium"
                      >
                        <Check size={12} />
                        Confirmed
                      </motion.div>
                    ) : (
                      <motion.button
                        key="confirm-btn"
                        type="button"
                        onClick={handleConfirm}
                        disabled={recordBusy}
                        whileTap={{ scale: 0.98 }}
                        className="py-1.5 px-3 rounded-md cta-solid font-semibold text-xs uppercase tracking-[0.08em] transition-all"
                      >
                        {recordBusy ? 'Recording…' : tx.confirmationPending ? 'Retry confirmation' : isPurchase ? 'Purchase' : 'Sale'}
                      </motion.button>
                    )}
                  </AnimatePresence>
                )}

                {isPurchase && tx.recordFailed && !isDraft && <button type="button" disabled={recordBusy} onClick={handleConfirm} className="min-h-11 px-3 text-ui-12 text-tea-gold">{recordBusy ? 'Recording…' : 'Retry recording purchase'}</button>}
                {!isPurchase && <>
                  <button type="button" onClick={handleSharePdf} disabled={pdfLoading || tx.items.length === 0}
                    className="pill flex items-center gap-1 disabled:opacity-30" aria-label="Share as PDF">
                    <Share2 size={12} aria-hidden="true" className={pdfLoading ? 'animate-pulse' : ''} /> PDF
                  </button>
                  <button type="button" onClick={handleDelete} className="pill flex items-center gap-1" aria-label="Delete transaction">
                    <Trash2 size={12} aria-hidden="true" /> Delete
                  </button>
                </>}

                {/* Only an order the shop recorded can be marked: the PUT names it
                    by the id the shop gave it. (This used to send the first
                    eight letters of the local id, which names no order, so
                    "Sent" changed nothing anywhere.) */}
                {isPurchase && !isDraft && tx.purchaseOrderId && !purchaseSent && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.purchaseOrders.updateStatus(tx.purchaseOrderId!, 'sent');
                        setMarkedSent(true);
                        updateTransaction(tx.id, { purchaseOrderSent: true, confirmationError: undefined });
                      } catch (error) {
                        updateTransaction(tx.id, { confirmationError: error instanceof Error ? error.message : 'Could not mark the order as sent.' });
                      }
                    }}
                    className={`${purchaseAction} ml-auto font-medium text-tea-text`}
                  >
                    <Check size={14} aria-hidden="true" /> Mark as Sent
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomSheet open={showPurchaseActions} onOpenChange={setShowPurchaseActions} title="Order actions">
        {showPurchaseActions && <>
          <TransactionPhotos txId={tx.id} photos={tx.photos || []} inOrderActions />
          {tx.items.some(item => item.compassEntryId) && <SheetOption label="Print tea tags" leading={<Tag size={17} aria-hidden="true" />} onSelect={() => {
            setShowPurchaseActions(false);
            setShowTagSheet(true);
          }} />}
          {tx.items.length > 0 && <SheetOption label="Share as PDF" leading={<Share2 size={17} aria-hidden="true" />} onSelect={() => {
            setShowPurchaseActions(false);
            if (!pdfLoading) void handleSharePdf();
          }} />}
          <SheetOption label={isDraft ? 'Delete draft' : 'Remove local order'} leading={<Trash2 size={17} aria-hidden="true" />} onSelect={() => {
            setShowPurchaseActions(false);
            handleDelete();
          }} />
        </>}
      </BottomSheet>

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
}

export const LedgerView: React.FC<LedgerViewProps> = ({ embedded, onOpenEntry, searchQuery = '' }) => {
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

  const canReadStock = useAppStore(state => selectHasBundle(state, 'stock'));
  const { data: logistics } = usePurchaseLogistics(canReadStock && filtered.some(
    transaction => transaction.direction === 'purchase' && transaction.status === 'confirmed' && !!transaction.purchaseOrderId,
  ));

  const filterOptions: { value: LedgerFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'draft', label: 'Drafts', count: counts.draft },
    { value: 'purchase', label: 'Purchases', count: counts.purchase },
    { value: 'sale', label: 'Sales', count: counts.sale },
  ];

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 animate-[fadeIn_0.4s_ease-out]">
        <div className="w-20 h-20 rounded-full bg-tea-gold/8 flex items-center justify-center mb-5 shadow-[0_0_30px_var(--tea-accent-sub)]">
          <ShoppingBag className="w-8 h-8 text-tea-gold/40" />
        </div>
        <h3 className="font-serif text-lg text-tea-text mb-1.5 tracking-wide">No transactions yet</h3>
        <p className="text-ui-13 text-tea-text-sec font-serif text-center max-w-[240px] leading-relaxed mb-8">
          Mark items as "Buy" in the Compass, or start a new purchase or sale here.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            onClick={() => openPurchaseOrder()}
            className="w-full px-5 py-3 cta-solid text-ui-10 font-semibold uppercase tracking-[0.08em] transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingBag size={14} />
            Purchase Order Builder
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => createTransaction('purchase', '', 'NT')}
              className="flex-1 px-4 py-2.5 bg-tea-surface text-tea-text-sec text-ui-10 font-semibold uppercase tracking-[0.08em] transition-colors active:text-tea-text"
            >
              Quick Note
            </button>
            <button
              onClick={() => createTransaction('sale', '', 'USD')}
              className="flex-1 px-4 py-2.5 bg-tea-surface text-tea-text-sec text-ui-10 font-semibold uppercase tracking-[0.08em] transition-colors active:text-tea-text"
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
        <div className="flex flex-wrap gap-1.5 pb-1">
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
                onOpenEntry={onOpenEntry}
                shipments={logistics?.shipments}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Quick create buttons */}
      <div className="flex flex-col gap-2 pt-4 border-t border-tea-border lg:hidden">
        <div className="flex gap-2">
          <button
            onClick={() => {
              createTransaction('purchase', '', 'NT');
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-tea-gold/5 text-tea-text-sec text-ui-11 font-semibold uppercase tracking-[0.08em] active:text-tea-text transition-colors"
          >
            <ArrowDownLeft size={14} />
            Quick Note
          </button>
          <button
            onClick={() => {
              createTransaction('sale', '', 'USD');
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-tea-surface text-tea-text-sec text-ui-11 font-semibold uppercase tracking-[0.08em] active:text-tea-text transition-colors"
          >
            <ArrowUpRight size={14} />
            Quick Sale
          </button>
        </div>
        <button
          onClick={() => openPurchaseOrder()}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl cta-solid text-ui-11 font-semibold uppercase tracking-[0.08em] transition-colors"
        >
          <ShoppingBag size={14} />
          Full Purchase Order Builder
        </button>
      </div>
    </div>
  );
};

export default LedgerView;
