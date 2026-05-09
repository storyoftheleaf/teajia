import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Camera, Upload, Loader2, Check, X, FileSpreadsheet, PlusCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import type { Product, ProductType, Currency, TeaForm } from '../types';
import { InventoryView } from './InventoryView';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

interface ExtractedProduct {
  givenName?: string;
  chineseName?: string;
  productName?: string;
  type?: ProductType;
  form?: TeaForm;
  year?: number;
  originCountry?: string;
  originRegion?: string;
  vendor?: string;
  costAmount?: number;
  costCurrency?: Currency;
  quantityPurchased?: number;
  description?: string;
  notes?: string;
  imageUrl?: string;
}

type GhostStatus = 'extracting' | 'duplicate' | 'saving' | 'error';

interface GhostItem {
  id: string;
  file: File;
  preview: string;
  status: GhostStatus;
  extracted?: ExtractedProduct;
  duplicateOf?: Product;
  error?: string;
}

interface QuickCaptureProps {
  products: Product[];
  isLoading: boolean;
  isError?: boolean;
  error?: Error | null;
  onDraftCreated: () => void;
  onImportClick: () => void;
  onAddClick: () => void;
  rates?: any;
}

type FilterMode = 'all' | 'review' | 'ready';

const EXTRACT_CONCURRENCY = 3;

// "Ready to approve" gate — pulled out so it's the single source of truth.
function isReadyToApprove(p: Product): boolean {
  const hasName = !!p.givenName && p.givenName !== 'Unnamed Tea' && p.givenName.trim().length > 0;
  const hasType = !!p.type && p.type !== 'Misc' && (p.type as string) !== 'MISSING_TYPE';
  const hasCost = (p.costAmount ?? 0) > 0;
  const hasStock = (p.stockGrams ?? 0) > 0 || ((p.quantityUnits ?? 0) > 0);
  return hasName && hasType && hasCost && hasStock;
}

function dedupeKey(name?: string, vendor?: string): string {
  return `${(name || '').trim().toLowerCase()}|${(vendor || '').trim().toLowerCase()}`;
}

export const QuickCapture: React.FC<QuickCaptureProps> = ({
  products, isLoading, isError, error, onDraftCreated, onImportClick, onAddClick,
}) => {
  const [ghosts, setGhosts] = useState<GhostItem[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [approving, setApproving] = useState(false);
  const [pageDragging, setPageDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const queueRef = useRef<File[]>([]);
  const activeRef = useRef(0);

  // Drafts derived from server state
  const draftProducts = useMemo(() => products.filter(p => p.status === 'Draft'), [products]);
  const toReview = useMemo(() => draftProducts.filter(p => !isReadyToApprove(p)), [draftProducts]);
  const readyToApprove = useMemo(() => draftProducts.filter(p => isReadyToApprove(p)), [draftProducts]);

  // Existing dedupe index over ALL products (not just drafts)
  const dedupeIndex = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) {
      const k = dedupeKey(p.givenName, p.vendor);
      if (k !== '|') m.set(k, p);
    }
    return m;
  }, [products]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const g of ghosts) URL.revokeObjectURL(g.preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredDrafts = useMemo(() => {
    if (filter === 'review') return toReview;
    if (filter === 'ready') return readyToApprove;
    return draftProducts;
  }, [filter, toReview, readyToApprove, draftProducts]);

  // ── Extraction pipeline with concurrency cap ───────────────────────────────
  const saveAsDraft = useCallback(async (id: string, extracted: ExtractedProduct) => {
    setGhosts(prev => prev.map(g => g.id === id ? { ...g, status: 'saving', extracted } : g));
    try {
      await api.products.create({
        type: extracted.type || 'Misc',
        given_name: extracted.givenName || 'Unnamed Tea',
        chinese_name: extracted.chineseName || '',
        product_name: extracted.productName || '',
        year: extracted.year || null,
        origin_country: extracted.originCountry || '',
        origin_region: extracted.originRegion || '',
        vendor: extracted.vendor || '',
        cost_amount: extracted.costAmount || 0,
        cost_currency: extracted.costCurrency || 'UNK',
        quantity_purchased: extracted.quantityPurchased || 0,
        stock_grams: extracted.quantityPurchased || 0,
        description: extracted.description || '',
        image_url: extracted.imageUrl || '',
        status: 'Draft',
        is_personal: false,
        can_reorder: false,
        is_public: false,
        tasting_notes: [],
      });
      // Drop the ghost — the row will appear in the spreadsheet on refetch
      setGhosts(prev => {
        const g = prev.find(x => x.id === id);
        if (g) URL.revokeObjectURL(g.preview);
        return prev.filter(x => x.id !== id);
      });
      onDraftCreated();
    } catch (err: any) {
      setGhosts(prev => prev.map(g => g.id === id ? { ...g, status: 'error', error: err?.message || 'Save failed' } : g));
    }
  }, [onDraftCreated]);

  const pump = useCallback(() => {
    while (activeRef.current < EXTRACT_CONCURRENCY && queueRef.current.length > 0) {
      const file = queueRef.current.shift()!;
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      const ghost: GhostItem = { id, file, preview, status: 'extracting' };
      setGhosts(prev => [ghost, ...prev]);
      activeRef.current += 1;

      api.extractFromImage(file)
        .then((extracted: ExtractedProduct) => {
          const key = dedupeKey(extracted.givenName, extracted.vendor);
          const dup = key !== '|' ? dedupeIndex.get(key) : undefined;
          if (dup) {
            setGhosts(prev => prev.map(g => g.id === id
              ? { ...g, status: 'duplicate', extracted, duplicateOf: dup }
              : g));
          } else {
            void saveAsDraft(id, extracted);
          }
        })
        .catch((err: any) => {
          setGhosts(prev => prev.map(g => g.id === id
            ? { ...g, status: 'error', error: err?.message || 'Extraction failed' }
            : g));
        })
        .finally(() => {
          activeRef.current -= 1;
          pump();
        });
    }
  }, [dedupeIndex, saveAsDraft]);

  const handleFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    queueRef.current.push(...arr);
    pump();
  }, [pump]);

  const removeGhost = useCallback((id: string) => {
    setGhosts(prev => {
      const g = prev.find(x => x.id === id);
      if (g) URL.revokeObjectURL(g.preview);
      return prev.filter(x => x.id !== id);
    });
  }, []);

  const retryGhost = useCallback((id: string) => {
    setGhosts(prev => {
      const g = prev.find(x => x.id === id);
      if (!g) return prev;
      queueRef.current.push(g.file);
      URL.revokeObjectURL(g.preview);
      return prev.filter(x => x.id !== id);
    });
    pump();
  }, [pump]);

  const confirmDuplicate = useCallback((id: string) => {
    const g = ghosts.find(x => x.id === id);
    if (!g || !g.extracted) return;
    void saveAsDraft(id, g.extracted);
  }, [ghosts, saveAsDraft]);

  // ── Page-level drag-and-drop ───────────────────────────────────────────────
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      dragCounter.current += 1;
      setPageDragging(true);
    }
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setPageDragging(false);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setPageDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  // ── Bulk activate ──────────────────────────────────────────────────────────
  const bulkApprove = async () => {
    if (readyToApprove.length === 0 || approving) return;
    setApproving(true);
    try {
      // Fire updates in parallel (server already orders by id)
      await Promise.all(
        readyToApprove.map(p => api.products.update(p.id, { status: 'Active' }))
      );
      onDraftCreated();
    } catch (err) {
      console.error('Bulk approve failed:', err);
    } finally {
      setApproving(false);
    }
  };

  const extractingCount = ghosts.filter(g => g.status === 'extracting').length;
  const savingCount = ghosts.filter(g => g.status === 'saving').length;
  const ghostBlocking = ghosts.filter(g => g.status === 'duplicate' || g.status === 'error');

  return (
    <div
      className="h-full flex flex-col relative"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* ── Single shelf: title · segmented filter · status · intake icons ── */}
      <div className="flex items-center gap-3 px-4 md:px-6 h-12 bg-tea-bg flex-shrink-0 relative z-10">
        <h1 className="font-display text-ui-15 font-light tracking-[0.04em] text-tea-text whitespace-nowrap">
          Capture
        </h1>

        {(draftProducts.length > 0 || ghosts.length > 0) && (
          <div className="inline-flex items-center rounded-md border border-tea-border bg-tea-surface/40 p-0.5">
            <SegmentChip
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              label="All"
              count={draftProducts.length}
              showZero
            />
            <SegmentChip
              active={filter === 'review'}
              onClick={() => setFilter('review')}
              label="Review"
              count={toReview.length}
            />
            <SegmentChip
              active={filter === 'ready'}
              onClick={() => setFilter('ready')}
              label="Ready"
              count={readyToApprove.length}
            />
          </div>
        )}

        {filter === 'ready' && readyToApprove.length > 0 && (
          <button
            type="button"
            onClick={bulkApprove}
            disabled={approving}
            className="pill-active text-ui-11 px-2.5 py-1 inline-flex items-center gap-1.5"
          >
            {approving ? (
              <><Loader2 size={11} className="animate-spin" /> Activating…</>
            ) : (
              <><ArrowRight size={11} /> Activate {readyToApprove.length}</>
            )}
          </button>
        )}

        {/* Inline status counts */}
        <div className="ml-auto flex items-center gap-3 text-ui-11 text-tea-text-sec">
          {extractingCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" />
              {extractingCount}
            </span>
          )}
          {savingCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" />
              {savingCount}
            </span>
          )}
        </div>

        {/* Intake icons (right cluster) */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="tap-target p-1.5 rounded-md text-tea-text-sec hover:text-tea-text hover:bg-tea-surface transition-colors"
            title="Capture photos"
            aria-label="Capture photos"
          >
            <Camera size={15} />
          </button>
          <button
            type="button"
            onClick={onImportClick}
            className="tap-target p-1.5 rounded-md text-tea-text-sec hover:text-tea-text hover:bg-tea-surface transition-colors"
            title="Import CSV"
            aria-label="Import CSV"
          >
            <FileSpreadsheet size={15} />
          </button>
          <button
            type="button"
            onClick={onAddClick}
            className="tap-target p-1.5 rounded-md text-tea-text-sec hover:text-tea-text hover:bg-tea-surface transition-colors"
            title="Add manually"
            aria-label="Add manually"
          >
            <PlusCircle size={15} />
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
          multiple
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
          multiple
        />
      </div>

      {/* Soft fade so scrolling rows dissolve into the shelf above instead of cutting hard against it */}
      <div
        aria-hidden="true"
        className="h-3 flex-shrink-0 relative z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, var(--tea-bg), transparent)' }}
      />
      {/* ── Ghost rows (in-flight extractions) ────────────────────────────── */}
      <AnimatePresence>
        {ghosts.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-b border-tea-border flex-shrink-0"
          >
            <div className="px-4 md:px-6 py-2 space-y-1.5">
              {ghosts.map(g => (
                <GhostRow
                  key={g.id}
                  ghost={g}
                  onRemove={() => removeGhost(g.id)}
                  onRetry={() => retryGhost(g.id)}
                  onConfirmDuplicate={() => confirmDuplicate(g.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Spreadsheet body (drafts only) ────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {draftProducts.length === 0 && ghosts.length === 0 && !isLoading ? (
          <EmptyState onPhoto={() => cameraInputRef.current?.click()} onImport={onImportClick} onAdd={onAddClick} />
        ) : (
          <InventoryView
            products={filteredDrafts}
            isLoading={isLoading}
            isError={isError}
            error={error}
            onImportClick={onImportClick}
            onAddClick={onAddClick}
            onRefresh={onDraftCreated}
          />
        )}
      </div>

      {/* ── Drag-and-drop overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {pageDragging && ghostBlocking.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-tea-bg/85 backdrop-blur-sm pointer-events-none"
          >
            <div className="flex flex-col items-center gap-2 text-tea-gold">
              <Upload size={32} />
              <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-gold`}>Drop to capture</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Subcomponents ─────────────────────────────────────────────────────────

const SegmentChip: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  /** Render the count even when 0 (used for the leading "All" segment to anchor the shelf) */
  showZero?: boolean;
}> = ({ active, onClick, label, count, showZero }) => (
  <button
    type="button"
    onClick={onClick}
    className={`tap-target inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-ui-11 uppercase tracking-[0.1em] whitespace-nowrap transition-colors ${
      active
        ? 'bg-tea-gold/15 text-tea-gold'
        : 'text-tea-text-sec hover:text-tea-text'
    }`}
  >
    {label}
    {(count > 0 || showZero) && (
      <span className={`text-ui-10 font-medium ${active ? 'text-tea-gold' : 'text-tea-text-dim'}`}>
        {count}
      </span>
    )}
  </button>
);

const GhostRow: React.FC<{
  ghost: GhostItem;
  onRemove: () => void;
  onRetry: () => void;
  onConfirmDuplicate: () => void;
}> = ({ ghost, onRemove, onRetry, onConfirmDuplicate }) => {
  const name = ghost.extracted?.givenName || ghost.extracted?.productName;
  const subtitle =
    ghost.status === 'extracting' ? 'Reading label…' :
    ghost.status === 'saving' ? 'Saving draft…' :
    ghost.status === 'duplicate' ? `Possible duplicate of ${ghost.duplicateOf?.givenName || 'existing item'}` :
    ghost.status === 'error' ? (ghost.error || 'Error') :
    '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 rounded-md bg-tea-surface/60 px-2.5 py-2"
    >
      <div className="w-9 h-9 rounded-md overflow-hidden bg-tea-bg flex-shrink-0">
        <img src={ghost.preview} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {ghost.status === 'extracting' && <Loader2 size={11} className="animate-spin text-tea-gold flex-shrink-0" />}
          {ghost.status === 'saving' && <Loader2 size={11} className="animate-spin text-tea-gold flex-shrink-0" />}
          {ghost.status === 'duplicate' && <AlertTriangle size={11} className="text-tea-gold flex-shrink-0" />}
          {ghost.status === 'error' && <X size={11} className="text-tea-text-sec flex-shrink-0" />}
          <span className="text-ui-13 text-tea-text truncate">
            {name || (ghost.status === 'extracting' ? 'Analyzing…' : 'Unknown')}
          </span>
        </div>
        <div className="text-ui-11 text-tea-text-sec truncate">{subtitle}</div>
      </div>

      {ghost.status === 'duplicate' && (
        <button
          type="button"
          onClick={onConfirmDuplicate}
          className="tap-target text-ui-11 px-2.5 py-1 rounded-md text-tea-gold hover:bg-tea-gold/10 transition-colors"
        >
          Save anyway
        </button>
      )}
      {ghost.status === 'error' && (
        <button
          type="button"
          onClick={onRetry}
          className="tap-target text-ui-11 px-2.5 py-1 rounded-md text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated transition-colors"
        >
          Retry
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="tap-target p-1 rounded-md text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated transition-colors"
        aria-label="Remove"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
};

const EmptyState: React.FC<{
  onPhoto: () => void;
  onImport: () => void;
  onAdd: () => void;
}> = ({ onPhoto, onImport, onAdd }) => (
  <div className="h-full flex items-center justify-center px-6">
    <div className="text-center max-w-sm">
      <Check size={32} className="mx-auto mb-3 text-tea-text-dim opacity-30" />
      <p className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-1`}>No drafts yet</p>
      <p className="text-ui-13 text-tea-text-sec mb-5">
        Drop photos anywhere on this page, or use one of the actions above to get started.
      </p>
      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={onPhoto} className="pill text-ui-12 px-3 py-1.5 inline-flex items-center gap-1.5">
          <Camera size={12} /> Photo
        </button>
        <button type="button" onClick={onImport} className="pill text-ui-12 px-3 py-1.5 inline-flex items-center gap-1.5">
          <FileSpreadsheet size={12} /> CSV
        </button>
        <button type="button" onClick={onAdd} className="pill text-ui-12 px-3 py-1.5 inline-flex items-center gap-1.5">
          <PlusCircle size={12} /> Manual
        </button>
      </div>
    </div>
  </div>
);

export default QuickCapture;
