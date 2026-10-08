import React from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Eye, Star, FlaskConical, Share2, Receipt, Layers, Archive, X as XIcon, Loader2, NotebookPen, BookOpen, FilePenLine, Link2, MoreHorizontal } from 'lucide-react';

/**
 * InventoryActionRail, the ONE surface for acting on selected inventory rows.
 *
 * A narrow vertical strip (68px) that slides in from the right edge when one or
 * more rows are selected. Each action is icon-on-top, short-word-below, stacked.
 * Identical narrow width on mobile and desktop. Replaces the old per-row action
 * cluster AND the floating selection-chip drawer.
 *
 * Layout (top to bottom): count header, then the four actions used most,
 * Edit (single-select only), Publish, Invoice, Archive; then More, which opens
 * the other eight in place (the tasting pair, Profile, Writing, Star, Sample,
 * Share, Collect); spacer, Clear pinned at the bottom. Thirteen at once was the
 * densest control in Manage (2026-09-29, todo/plans/archive/manage-regroup.md). All handlers are passed in and reuse the
 * existing InventoryView business logic.
 */
export interface InventoryActionRailProps {
  open: boolean;
  selectedCount: number;
  isSingle: boolean;
  isBusy: boolean;
  canPublish: boolean;
  /** Distance from the viewport right edge, in px. Lets the rail tuck against
   *  the spreadsheet while the ProductEditPanel occupies the far edge. */
  rightOffset: number;
  onEdit: () => void;
  personalTastingLabel: 'Record tasting' | 'Continue tasting';
  hasPersonalTasting: boolean;
  onPersonalTasting: () => void;
  onViewTasting: () => void;
  onEditProductTasting: () => void;
  onContentLinks: () => void;
  onPublish: () => void;
  onStar: () => void;
  onSample: () => void;
  onShare: () => void;
  onInvoice: () => void;
  onCollect: () => void;
  onArchive: () => void;
  onClear: () => void;
  /** 'side' is the strip on the right edge. 'bottom' is the phone's stock
   *  screen, where a strip on the right covered the Source column: the same
   *  actions sit in a bar just above the bottom nav instead. */
  placement?: 'side' | 'bottom';
  /** Bottom bar only: tick every tea in the list on screen. */
  onSelectAll?: () => void;
  selectAllCount?: number;
}

const RAIL_WIDTH = 60;

interface RailButtonProps {
  label: string;
  accessibleLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'edit' | 'danger';
  children: React.ReactNode;
}

const RailButton: React.FC<RailButtonProps> = ({ label, accessibleLabel, onClick, disabled, variant = 'default', children }) => {
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
      aria-label={accessibleLabel ?? label}
      className={`tap-target flex flex-col items-center justify-center gap-1 w-[52px] min-h-[48px] rounded-[10px] px-0.5 py-1.5 transition-colors hover:bg-tea-surface disabled:opacity-40 disabled:cursor-not-allowed ${tone}`}
    >
      {children}
      <span className="text-ui-9 leading-none text-center" style={{ letterSpacing: '0.02em' }}>{label}</span>
    </button>
  );
};

export const InventoryActionRail: React.FC<InventoryActionRailProps> = ({
  open, selectedCount, isSingle, isBusy, rightOffset,
  canPublish,
  personalTastingLabel, hasPersonalTasting,
  onEdit, onPersonalTasting, onViewTasting, onEditProductTasting, onContentLinks,
  onPublish, onStar, onSample, onShare, onInvoice, onCollect, onArchive, onClear,
  placement = 'side', onSelectAll, selectAllCount,
}) => {
  const [moreOpen, setMoreOpen] = React.useState(false);
  // A new selection starts folded.
  React.useEffect(() => { if (!open) setMoreOpen(false); }, [open]);
  if (placement === 'bottom') {
    if (!open) return null;
    const BarButton = ({ label, accessibleLabel, onClick, disabled, children }: Omit<RailButtonProps, 'variant'>) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={accessibleLabel ?? label}
        className="flex flex-col items-center justify-center gap-1 min-h-[52px] text-tea-text disabled:opacity-40"
      >
        <span className="text-tea-gold">{children}</span>
        <span className="text-ui-11 leading-none">{label}</span>
      </button>
    );
    return createPortal(
      <div
        role="toolbar"
        aria-label="Selection actions"
        className="fixed left-0 right-0 bottom-nav z-drawer border-t border-tea-border bg-tea-surface px-2 pb-2"
      >
        <div className="flex items-center h-11 px-2">
          <span className="text-ui-14 font-medium text-tea-gold tabular-nums">{selectedCount} {selectedCount === 1 ? 'tea' : 'teas'} selected</span>
          <span className="flex-1" />
          {onSelectAll && selectAllCount !== undefined && selectAllCount > selectedCount && (
            <button type="button" onClick={onSelectAll} className="tap-target px-2 text-ui-13 text-tea-text-sec hover:text-tea-text">Select all {selectAllCount}</button>
          )}
          <button type="button" onClick={onClear} className="tap-target px-2 text-ui-13 text-tea-text-sec hover:text-tea-text">Clear</button>
        </div>
        {moreOpen && (
          <div className="grid grid-cols-4 gap-y-1 border-b border-tea-border pb-2 mb-1">
            {isSingle && (
              <>
                <BarButton label={personalTastingLabel === 'Record tasting' ? 'Taste' : 'Continue'} accessibleLabel={personalTastingLabel} onClick={onPersonalTasting}><NotebookPen size={19} aria-hidden="true" /></BarButton>
                {hasPersonalTasting && <BarButton label="Journal" accessibleLabel="View personal tasting" onClick={onViewTasting}><BookOpen size={19} aria-hidden="true" /></BarButton>}
                <BarButton label="Profile" accessibleLabel="Edit product tasting profile" onClick={onEditProductTasting}><FilePenLine size={19} aria-hidden="true" /></BarButton>
                <BarButton label="Writing" accessibleLabel="Manage linked writing" onClick={onContentLinks}><Link2 size={19} aria-hidden="true" /></BarButton>
              </>
            )}
            <BarButton label="Star" onClick={onStar} disabled={isBusy}><Star size={19} aria-hidden="true" /></BarButton>
            <BarButton label="Sample" onClick={onSample} disabled={isBusy}><FlaskConical size={19} aria-hidden="true" /></BarButton>
            <BarButton label="Share" onClick={onShare} disabled={isBusy}><Share2 size={19} aria-hidden="true" /></BarButton>
            {isSingle && <BarButton label="Archive" accessibleLabel="Archive selection" onClick={onArchive} disabled={isBusy}><Archive size={19} aria-hidden="true" /></BarButton>}
          </div>
        )}
        <div className="grid grid-cols-5">
          <BarButton label="Collection" accessibleLabel="Add to a collection" onClick={onCollect} disabled={isBusy}><Layers size={19} aria-hidden="true" /></BarButton>
          <BarButton label="Publish" accessibleLabel={canPublish ? 'Publish selection' : 'Publish unavailable until inventory arrival status is ready'} onClick={onPublish} disabled={isBusy || !canPublish}>
            {isBusy ? <Loader2 size={19} className="animate-spin" aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
          </BarButton>
          <BarButton label="Invoice" onClick={onInvoice} disabled={isBusy}><Receipt size={19} aria-hidden="true" /></BarButton>
          {isSingle
            ? <BarButton label="Edit" onClick={onEdit}><Pencil size={19} aria-hidden="true" /></BarButton>
            : <BarButton label="Archive" onClick={onArchive} disabled={isBusy}><Archive size={19} aria-hidden="true" /></BarButton>}
          <BarButton label={moreOpen ? 'Less' : 'More'} accessibleLabel={moreOpen ? 'Fewer actions' : 'More actions'} onClick={() => setMoreOpen(v => !v)}><MoreHorizontal size={19} aria-hidden="true" /></BarButton>
        </div>
      </div>,
      document.body,
    );
  }
  // Portal to document.body so the rail's `position: fixed` resolves against the
  // viewport, NOT against an ancestor. The admin shell wraps pages in a
  // framer-motion PageTransition (a `transform`), and the InventoryView root is
  // `overflow-hidden` for its height chain. A transformed/overflow ancestor would
  // otherwise become the containing block and clip the rail off-screen.
  return createPortal(
    <div
      className={`fixed top-0 bottom-nav pb-3 z-drawer flex flex-col items-center overflow-y-auto bg-tea-bg transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      style={{
        right: rightOffset,
        width: RAIL_WIDTH,
        // A thin inset gold hairline marks the rail's left edge without casting a
        // drop shadow onto the table. The earlier -12px blurred shadow smeared
        // shading over the right columns in both shrunken and expanded states.
        // The hairline is --tea-border, not a hand-mixed copy of it. What it
        // replaced carried the border token's alpha but a gold that was never
        // the palette's gold in either mode, so the rail's edge did not match
        // any other divider on the page and did not move when the theme did.
        boxShadow: 'inset 1px 0 0 var(--tea-border)',
        paddingTop: 12,
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

      {/* Edit: the ONLY door to the full ProductEditPanel, single-select only */}
      {isSingle && (
        <RailButton label="Edit" variant="edit" onClick={onEdit}>
          <Pencil size={19} aria-hidden="true" />
        </RailButton>
      )}
      <RailButton
        label="Publish"
        accessibleLabel={canPublish ? 'Publish selection' : 'Publish unavailable until inventory arrival status is ready'}
        onClick={onPublish}
        disabled={isBusy || !canPublish}
      >
        {isBusy ? <Loader2 size={19} className="animate-spin" aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
      </RailButton>
      <RailButton label="Invoice" onClick={onInvoice} disabled={isBusy}>
        <Receipt size={19} aria-hidden="true" />
      </RailButton>
      <RailButton label="Archive" variant="danger" onClick={onArchive} disabled={isBusy}>
        <Archive size={19} aria-hidden="true" />
      </RailButton>

      <div className="h-px bg-tea-border my-1.5" style={{ width: 36 }} />

      <button
        type="button"
        onClick={() => setMoreOpen(v => !v)}
        aria-expanded={moreOpen}
        aria-label={moreOpen ? 'Fewer actions' : 'More actions'}
        title={moreOpen ? 'Fewer actions' : 'More actions'}
        className="tap-target flex flex-col items-center justify-center gap-1 w-[52px] min-h-[48px] rounded-[10px] px-0.5 py-1.5 text-tea-text-sec transition-colors hover:bg-tea-surface"
      >
        <MoreHorizontal size={19} aria-hidden="true" />
        <span className="text-ui-9 leading-none text-center" style={{ letterSpacing: '0.02em' }}>{moreOpen ? 'Less' : 'More'}</span>
      </button>

      {moreOpen && (
        <>
          {isSingle && (
            <>
              <RailButton
                label={personalTastingLabel === 'Record tasting' ? 'Taste' : 'Continue'}
                accessibleLabel={personalTastingLabel}
                onClick={onPersonalTasting}
              >
                <NotebookPen size={19} aria-hidden="true" />
              </RailButton>
              {hasPersonalTasting && (
                <RailButton label="Journal" accessibleLabel="View personal tasting" onClick={onViewTasting}>
                  <BookOpen size={19} aria-hidden="true" />
                </RailButton>
              )}
              <RailButton label="Profile" accessibleLabel="Edit product tasting profile" onClick={onEditProductTasting}>
                <FilePenLine size={19} aria-hidden="true" />
              </RailButton>
              <RailButton label="Writing" accessibleLabel="Manage linked writing" onClick={onContentLinks}>
                <Link2 size={19} aria-hidden="true" />
              </RailButton>
            </>
          )}
          <RailButton label="Star" onClick={onStar} disabled={isBusy}>
            <Star size={19} aria-hidden="true" />
          </RailButton>
          <RailButton label="Sample" onClick={onSample} disabled={isBusy}>
            <FlaskConical size={19} aria-hidden="true" />
          </RailButton>
          <RailButton label="Share" onClick={onShare} disabled={isBusy}>
            <Share2 size={19} aria-hidden="true" />
          </RailButton>
          <RailButton label="Collect" onClick={onCollect} disabled={isBusy}>
            <Layers size={19} aria-hidden="true" />
          </RailButton>
        </>
      )}

      <div className="flex-1" />

      <RailButton label="Clear" onClick={onClear}>
        <XIcon size={19} aria-hidden="true" />
      </RailButton>
    </div>,
    document.body
  );
};

export const INVENTORY_ACTION_RAIL_WIDTH = RAIL_WIDTH;
