import React from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Eye, Star, FlaskConical, Share2, Receipt, Layers, Archive, X as XIcon, Loader2 } from 'lucide-react';

/**
 * InventoryActionRail — the ONE surface for acting on selected inventory rows.
 *
 * A bottom action bar that slides up from the bottom edge when one or more rows
 * are selected. Each action is an icon-on-top, short-word-below tile, laid out in
 * a horizontal row. The count sits on the left, Clear on the right. Replaces the
 * old per-row action cluster AND the floating selection-chip drawer.
 *
 * Why the bottom (not the right edge): the right edge collides with the
 * full-screen edit-panel overlay, the framer-motion transform on the page shell,
 * and the rounded content card. A bottom bar sits above all of that and spans the
 * visible width, so it cannot be clipped or hidden behind the panel.
 *
 * Layout (left to right): count, Edit (single-select only), Publish / Star /
 * Sample / Share / Invoice / Collect / Archive, then Clear pinned at the right.
 * All handlers are passed in and reuse the existing InventoryView business logic.
 */
export interface InventoryActionRailProps {
  open: boolean;
  selectedCount: number;
  isSingle: boolean;
  isBusy: boolean;
  /** Kept for API compatibility with the previous right-edge rail. Unused by the
   *  bottom bar (which spans the full width), so callers need not change. */
  rightOffset?: number;
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

/** The bar's resting height in px, exported so callers can reserve bottom space. */
const RAIL_HEIGHT = 72;

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
      className={`tap-target flex flex-1 flex-col items-center justify-center gap-1 min-w-0 min-h-[46px] rounded-[10px] px-0.5 py-1.5 transition-colors hover:bg-tea-surface disabled:opacity-40 disabled:cursor-not-allowed ${tone}`}
    >
      {children}
      <span className="text-ui-9 leading-none text-center" style={{ letterSpacing: '0.02em' }}>{label}</span>
    </button>
  );
};

export const InventoryActionRail: React.FC<InventoryActionRailProps> = ({
  open, selectedCount, isSingle, isBusy,
  onEdit, onPublish, onStar, onSample, onShare, onInvoice, onCollect, onArchive, onClear,
}) => {
  // Portal to document.body so the bar's `position: fixed` resolves against the
  // viewport, NOT against an ancestor. The admin shell wraps pages in a
  // framer-motion PageTransition (a `transform`) and InventoryView's root is
  // `overflow-hidden`; either would otherwise become the containing block and
  // clip a fixed child.
  return createPortal(
    <div
      className={`fixed left-0 right-0 bottom-nav z-modal bg-tea-bg transition-transform duration-200 ease-out ${open ? 'translate-y-0' : 'translate-y-[200%]'}`}
      style={{
        // A pronounced top shadow + the darkest surface so the bar reads as its
        // own raised panel above the table, never a part of it. The `bottom-nav`
        // utility lifts the bar above the mobile bottom tab bar (and drops to the
        // viewport bottom on desktop where there is no tab bar).
        boxShadow: '0 -10px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,166,82,0.14)',
        paddingTop: 10,
        paddingBottom: 10,
      }}
      role="toolbar"
      aria-label="Selection actions"
      aria-hidden={!open}
    >
      {/* Two equal rows of flex tiles. All eight actions visible, no horizontal
          scroll, no item-count label. A small Clear sits in the top-right corner. */}
      <div className="relative px-2">
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          title="Clear selection"
          className="tap-target absolute top-0 right-1 z-10 p-1 rounded-md text-tea-text-dim hover:text-tea-text hover:bg-tea-surface transition-colors"
        >
          <XIcon size={15} aria-hidden="true" />
        </button>

        <div className="flex flex-col gap-1">
          {/* Row 1 — Edit (single only) / Publish / Star / Sample */}
          <div className="flex items-stretch gap-1">
            {isSingle ? (
              <RailButton label="Edit" variant="edit" onClick={onEdit}>
                <Pencil size={19} aria-hidden="true" />
              </RailButton>
            ) : (
              <div className="flex-1" />
            )}
            <RailButton label="Publish" onClick={onPublish} disabled={isBusy}>
              {isBusy ? <Loader2 size={19} className="animate-spin" aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
            </RailButton>
            <RailButton label="Star" onClick={onStar} disabled={isBusy}>
              <Star size={19} aria-hidden="true" />
            </RailButton>
            <RailButton label="Sample" onClick={onSample} disabled={isBusy}>
              <FlaskConical size={19} aria-hidden="true" />
            </RailButton>
          </div>

          {/* Row 2 — Share / Invoice / Collect / Archive */}
          <div className="flex items-stretch gap-1">
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
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const INVENTORY_ACTION_RAIL_HEIGHT = RAIL_HEIGHT;
// Back-compat alias: some callers reserved horizontal space for the old rail.
// The bottom bar reserves vertical space instead; keep the export name so the
// import in InventoryView resolves, mapped to the bar height.
export const INVENTORY_ACTION_RAIL_WIDTH = RAIL_HEIGHT;
