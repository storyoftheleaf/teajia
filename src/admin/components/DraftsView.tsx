import React, { useState, useMemo, useCallback } from 'react';
import { Loader2, ArrowRight, Compass, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Product } from '../types';
import { InventoryView } from './InventoryView';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

interface DraftsViewProps {
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

// "Ready to approve" gate — single source of truth for what's been triaged.
function isReadyToApprove(p: Product): boolean {
  const hasName = !!p.givenName && p.givenName !== 'Unnamed Tea' && p.givenName.trim().length > 0;
  const hasType = !!p.type && p.type !== 'Misc' && (p.type as string) !== 'MISSING_TYPE';
  const hasCost = (p.costAmount ?? 0) > 0;
  const hasStock = (p.stockGrams ?? 0) > 0 || ((p.quantityUnits ?? 0) > 0);
  return hasName && hasType && hasCost && hasStock;
}

export const DraftsView: React.FC<DraftsViewProps> = ({
  products, isLoading, isError, error, onDraftCreated, onImportClick, onAddClick,
}) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [approving, setApproving] = useState(false);

  const draftProducts = useMemo(() => products.filter(p => p.status === 'Draft'), [products]);
  const toReview = useMemo(() => draftProducts.filter(p => !isReadyToApprove(p)), [draftProducts]);
  const readyToApprove = useMemo(() => draftProducts.filter(p => isReadyToApprove(p)), [draftProducts]);

  const filteredDrafts = useMemo(() => {
    if (filter === 'review') return toReview;
    if (filter === 'ready') return readyToApprove;
    return draftProducts;
  }, [filter, toReview, readyToApprove, draftProducts]);

  const goToCompass = useCallback(() => navigate('/admin/compass'), [navigate]);

  const bulkApprove = async () => {
    if (readyToApprove.length === 0 || approving) return;
    setApproving(true);
    try {
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

  return (
    <div className="h-full flex flex-col relative">
      {/* ── Single shelf: title · segmented filter · Compass link ─────────── */}
      <div className="flex items-center gap-3 px-4 md:px-6 h-12 bg-tea-bg flex-shrink-0 relative z-10">
        <h1 className="font-display text-ui-15 font-light tracking-[0.04em] text-tea-text whitespace-nowrap">
          Inventory
        </h1>

        {draftProducts.length > 0 && (
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

        {/* Compass handoff — quiet text link on the right */}
        <button
          type="button"
          onClick={goToCompass}
          className="ml-auto tap-target inline-flex items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-gold transition-colors"
          title="Capture new items in Compass"
        >
          <Compass size={13} />
          <span>Capture in Compass</span>
        </button>
      </div>

      {/* Soft fade so scrolling rows dissolve into the shelf above */}
      <div
        aria-hidden="true"
        className="h-3 flex-shrink-0 relative z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, var(--tea-bg), transparent)' }}
      />

      {/* ── Spreadsheet body (drafts only) ────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {draftProducts.length === 0 && !isLoading ? (
          <EmptyState onCompass={goToCompass} />
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
    </div>
  );
};

// ─── Subcomponents ─────────────────────────────────────────────────────────

const SegmentChip: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  showZero?: boolean;
}> = ({ active, onClick, label, count, showZero }) => (
  <button
    type="button"
    onClick={onClick}
    className={`tap-target inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-ui-11 uppercase tracking-[0.1em] whitespace-nowrap transition-colors ${
      active ? 'bg-tea-gold/15 text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
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

const EmptyState: React.FC<{ onCompass: () => void }> = ({ onCompass }) => (
  <div className="h-full flex items-center justify-center px-6">
    <div className="text-center max-w-sm">
      <Check size={32} className="mx-auto mb-3 text-tea-text-dim opacity-30" />
      <p className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-1`}>No drafts in the queue</p>
      <p className="text-ui-13 text-tea-text-sec mb-5">
        New items are captured in Compass — photos, samples, and labels become drafts that land here for review.
      </p>
      <button
        type="button"
        onClick={onCompass}
        className="pill text-ui-12 px-3 py-1.5 inline-flex items-center gap-1.5"
      >
        <Compass size={12} /> Open Compass
      </button>
    </div>
  </div>
);

export default DraftsView;
