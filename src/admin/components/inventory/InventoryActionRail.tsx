import React from 'react';
import { Pencil, Eye, Star, FlaskConical, Share2, Receipt, Layers, Archive, X as XIcon, Loader2 } from 'lucide-react';

/**
 * InventoryActionRail — the ONE surface for acting on selected inventory rows.
 *
 * A narrow vertical strip (68px) that slides in from the right edge when one or
 * more rows are selected. Each action is icon-on-top, short-word-below, stacked.
 * Identical narrow width on mobile and desktop. Replaces the old per-row action
 * cluster AND the floating selection-chip drawer.
 *
 * Layout (top to bottom): count header, Edit (single-select only), separator,
 * Publish / Star / Sample, separator, Share / Invoice / Collect / Archive,
 * spacer, Clear pinned at the bottom. All handlers are passed in and reuse the
 * existing InventoryView business logic.
 */
export interface InventoryActionRailProps {
  open: boolean;
  selectedCount: number;
  isSingle: boolean;
  isBusy: boolean;
  /** Distance from the viewport right edge, in px. Lets the rail tuck against
   *  the spreadsheet while the ProductEditPanel occupies the far edge. */
  rightOffset: number;
  onEdit: () => void;
  onPublish: () => void;
  onStar: () => void;
  onSample: () => void;
  onShare: () => void;
  onInvoice: () => void;
  onCollect: () => void;
  onArchive: () => void;
  onClear: () => void;
}

const RAIL_WIDTH = 60;

interface RailButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'edit' | 'danger';
  children: React.ReactNode;
}

const RailButton: React.FC<RailButtonProps> = ({ label, onClick, disabled, variant = 'default', children }) => {
  const tone =
    variant === 'edit'
      ? 'text-tea-gold-lt bg-tea-gold/10'
      : variant === 'danger'
        ? 'text-tea-text-sec hover:text-tea-readgold'
        : 'text-tea-text-sec';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`tap-target flex flex-col items-center justify-center gap-1 w-[52px] min-h-[48px] rounded-[10px] px-0.5 py-1.5 transition-colors hover:bg-tea-surface disabled:opacity-40 disabled:cursor-not-allowed ${tone}`}
    >
      {children}
      <span className="text-ui-9 leading-none text-center" style={{ letterSpacing: '0.02em' }}>{label}</span>
    </button>
  );
};

export const InventoryActionRail: React.FC<InventoryActionRailProps> = ({
  open, selectedCount, isSingle, isBusy, rightOffset,
  onEdit, onPublish, onStar, onSample, onShare, onInvoice, onCollect, onArchive, onClear,
}) => {
  return (
    <div
      className={`fixed top-0 bottom-0 z-drawer flex flex-col items-center bg-tea-bg transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      style={{
        right: rightOffset,
        width: RAIL_WIDTH,
        // A pronounced left shadow + darker-than-the-toolbar surface so the rail
        // reads as its own recessed panel, never a continuation of the bar above.
        boxShadow: '-12px 0 28px rgba(0,0,0,0.5), inset 1px 0 0 rgba(212,166,82,0.14)',
        paddingTop: 12,
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
      }}
      role="toolbar"
      aria-label="Selection actions"
      aria-hidden={!open}
    >
      {/* Count header */}
      <div className="text-ui-11 text-tea-gold-lt font-semibold text-center leading-tight pb-2 mb-1.5 border-b border-tea-border w-11">
        <span className="tabular-nums">{selectedCount}</span>
        <span className="block text-ui-9 text-tea-text-dim font-normal uppercase">{selectedCount === 1 ? 'item' : 'items'}</span>
      </div>

      {/* Edit — the ONLY door to the full ProductEditPanel, single-select only */}
      {isSingle && (
        <RailButton label="Edit" variant="edit" onClick={onEdit}>
          <Pencil size={19} aria-hidden="true" />
        </RailButton>
      )}

      <div className="h-px bg-tea-border my-1.5" style={{ width: 36 }} />

      <RailButton label="Publish" onClick={onPublish} disabled={isBusy}>
        {isBusy ? <Loader2 size={19} className="animate-spin" aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
      </RailButton>
      <RailButton label="Star" onClick={onStar} disabled={isBusy}>
        <Star size={19} aria-hidden="true" />
      </RailButton>
      <RailButton label="Sample" onClick={onSample} disabled={isBusy}>
        <FlaskConical size={19} aria-hidden="true" />
      </RailButton>

      <div className="h-px bg-tea-border my-1.5" style={{ width: 36 }} />

      <RailButton label="Share" onClick={onShare} disabled={isBusy}>
        <Share2 size={19} aria-hidden="true" />
      </RailButton>
      <RailButton label="Invoice" onClick={onInvoice} disabled={isBusy}>
        <Receipt size={19} aria-hidden="true" />
      </RailButton>
      <RailButton label="Collect" onClick={onCollect} disabled={isBusy}>
        <Layers size={19} aria-hidden="true" />
      </RailButton>
      <RailButton label="Archive" variant="danger" onClick={onArchive} disabled={isBusy}>
        <Archive size={19} aria-hidden="true" />
      </RailButton>

      <div className="flex-1" />

      <RailButton label="Clear" onClick={onClear}>
        <XIcon size={19} aria-hidden="true" />
      </RailButton>
    </div>
  );
};

export const INVENTORY_ACTION_RAIL_WIDTH = RAIL_WIDTH;
