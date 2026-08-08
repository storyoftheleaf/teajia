import React, { useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ChevronDown } from 'lucide-react';

/**
 * Four type roles on the Curate working surface, and only four:
 *   row heading      font-display text-ui-20
 *   field value      16px (.curate-field / .curate-primary). Never smaller, or iOS zooms.
 *   secondary fact   text-ui-12 (.curate-support) for sentences, facts and equations
 *   micro-caps label text-ui-10 uppercase (.curate-floating-label, .curate-inline-label,
 *                    .curate-field-flag, .curate-field-marks)
 *
 * One caps rule: micro-caps are for LABELS of three words or fewer. Sentences,
 * derived facts, warnings and values stay in sentence case. CurateField owns the
 * label lane so the rule holds for every field without each caller restating it.
 */

type CurateActionButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children' | 'disabled' | 'onClick'
> & {
  'data-testid'?: string;
  'data-visual-state'?: string;
  ref?: React.Ref<HTMLButtonElement>;
};

export interface CurateActionSpec {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busyLabel?: string;
  busy?: boolean;
  ariaLabel?: string;
  /** Adapter-only DOM attributes such as disclosure ARIA and existing test ids. */
  buttonProps?: CurateActionButtonProps;
}

export type CurateActionBandColumnCount = 1 | 2 | 3 | 4;
export interface CurateActionBandColumns {
  base: CurateActionBandColumnCount;
  sm?: CurateActionBandColumnCount;
}

interface CurateFieldControlProps extends React.HTMLAttributes<HTMLElement> {
  id?: string;
  className?: string;
  'aria-describedby'?: string;
}

/**
 * 'note' is a fact the wisdom base derived and there is nothing to do about it.
 * 'warning' is something the operator has to correct.
 */
export type CurateFieldHelperTone = 'note' | 'warning';

export const CurateField: React.FC<{
  label: string;
  status?: string;
  helper?: React.ReactNode;
  helperTone?: CurateFieldHelperTone;
  /** The value arrived from the wisdom base, not from the vendor record. */
  derived?: boolean;
  /** Short count telling the operator a suggestion list is attached, e.g. "79 cultivars". */
  suggestions?: string;
  /** Where the current value came from. */
  provenance?: { state: string; label: string };
  className?: string;
  children: React.ReactElement;
}> = ({ label, status, helper, helperTone = 'note', derived = false, suggestions, provenance, className = '', children }) => {
  const generatedId = useId().replace(/:/g, '');
  const child = children as React.ReactElement<CurateFieldControlProps>;
  const controlId = child.props.id || `curate-field-${generatedId}`;
  const statusId = status ? `${controlId}-status` : undefined;
  const suggestionsId = suggestions ? `${controlId}-suggestions` : undefined;
  const derivedId = derived ? `${controlId}-derived` : undefined;
  const provenanceId = provenance ? `${controlId}-provenance` : undefined;
  const helperId = helper ? `${controlId}-helper` : undefined;
  const describedBy = [child.props['aria-describedby'], statusId, suggestionsId, derivedId, provenanceId, helperId].filter(Boolean).join(' ') || undefined;
  // Native select chrome collides with the chevron, so selects get house chrome:
  // arrow suppressed, chevron drawn at the end of the value line.
  const isSelect = child.type === 'select';

  return (
    <div className={`min-w-0 space-y-1 ${className}`}>
      <div className="relative">
        {/* The label lane. Label and Confirm sit left in the label register so
            neither can be mistaken for an action; provenance sits right, dim. */}
        <div className="curate-field-lane">
          <label htmlFor={controlId} className="curate-floating-label">
            {label}
          </label>
          {status && (
            <span id={statusId} role="status" className="curate-field-flag">{status}</span>
          )}
          {(suggestions || derived || provenance) && (
            <span className="curate-field-marks">
              {suggestions && <span id={suggestionsId}>{suggestions}</span>}
              {derived && <span id={derivedId}>From base</span>}
              {provenance && <span id={provenanceId} data-provenance={provenance.state}>{provenance.label}</span>}
            </span>
          )}
        </div>
        {React.cloneElement(child, {
          id: controlId,
          className: `curate-field curate-field-with-label curate-field-inset w-full ${status ? 'curate-field-attention ' : ''}${isSelect ? 'curate-field-select' : ''} ${child.props.className || ''}`,
          'aria-describedby': describedBy,
        })}
        {isSelect && (
          <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute bottom-2 right-3 text-tea-text-sec" />
        )}
      </div>
      {helper && (
        <div id={helperId} className={`curate-field-note ${helperTone === 'warning' ? 'curate-field-note-warning' : 'curate-field-note-derived'}`}>
          {helperTone === 'warning' && <AlertCircle size={12} aria-hidden="true" className="mt-[2px] shrink-0" />}
          <span className="min-w-0 break-words">{helper}</span>
        </div>
      )}
    </div>
  );
};

export const CurateDisclosure: React.FC<{
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ id, label, open, onToggle, disabled = false, children }) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-expanded={open}
      aria-controls={id}
      className="curate-action w-full justify-start py-1 text-left disabled:cursor-not-allowed disabled:text-tea-text-dim"
      data-curate-action
    >
      <motion.span
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ duration: 0.2 }}
        className="inline-flex"
        aria-hidden="true"
      >
        <ChevronDown size={14} />
      </motion.span>
      <span>{label}</span>
    </button>

    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          id={id}
          role="region"
          aria-label={label}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const ActionButton: React.FC<{ action: CurateActionSpec; primary?: boolean }> = ({ action, primary = false }) => {
  const { className = '', ...buttonProps } = action.buttonProps || {};
  const unavailable = !!(action.disabled || action.busy);
  const visibleLabel = action.busy && action.busyLabel ? action.busyLabel : action.label;
  const chromeClass = primary
    ? unavailable && !action.busy
      ? 'border-tea-border bg-tea-surface text-tea-text-sec'
      : 'border-tea-gold cta-solid'
    : 'border-tea-border bg-tea-bg text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text';

  return (
    <button
      {...buttonProps}
      type="button"
      onClick={action.onClick}
      disabled={unavailable}
      aria-busy={action.busy || undefined}
      aria-label={action.ariaLabel || visibleLabel}
      className={`curate-action curate-compact-target w-full font-medium disabled:cursor-not-allowed ${className}`}
      data-curate-action
      data-curate-compact-target
    >
      <span className={`curate-compact-chrome w-full border ${chromeClass}`} data-curate-compact-chrome>
        {visibleLabel}
      </span>
    </button>
  );
};

export const CurateActionBand: React.FC<{
  neutral?: CurateActionSpec[];
  primary: CurateActionSpec;
  primaryIndex?: number;
  columns?: CurateActionBandColumns;
  className?: string;
  testId?: string;
  withBandChrome?: boolean;
}> = ({ neutral = [], primary, primaryIndex, columns, className = '', testId, withBandChrome = true }) => {
  const baseColumnClasses: Record<CurateActionBandColumnCount, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };
  const smColumnClasses: Record<CurateActionBandColumnCount, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' };
  const inferredColumnCount: CurateActionBandColumnCount = neutral.length > 1 ? 3 : neutral.length === 1 ? 2 : 1;
  const gridClass = columns
    ? `${baseColumnClasses[columns.base]}${columns.sm ? ` ${smColumnClasses[columns.sm]}` : ''}`
    : baseColumnClasses[inferredColumnCount];
  const resolvedPrimaryIndex = Math.min(Math.max(primaryIndex ?? neutral.length, 0), neutral.length);
  const orderedActions: Array<{ action: CurateActionSpec; primary: boolean }> = neutral.map((action) => ({ action, primary: false }));
  orderedActions.splice(resolvedPrimaryIndex, 0, { action: primary, primary: true });

  return (
    <div data-testid={testId} className={`${withBandChrome ? 'curate-action-band ' : ''}grid w-full ${gridClass} gap-2 ${className}`}>
      {orderedActions.map(({ action, primary: actionIsPrimary }, index) => (
        <ActionButton key={`${action.label}-${index}`} action={action} primary={actionIsPrimary} />
      ))}
    </div>
  );
};

export const CurateRecordRow: React.FC<{
  title: string;
  metadata: string;
  status?: string;
  openLabel?: string;
  onOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
  deleteLabel?: string;
  onDelete?: () => void;
  busy?: boolean;
}> = ({
  title,
  metadata,
  status,
  openLabel = 'Open',
  onOpen,
  deleteLabel = 'Delete',
  onDelete,
  busy = false,
}) => (
  <div className="curate-cluster flex flex-wrap items-center gap-2" aria-busy={busy || undefined}>
    <div className="min-w-0 flex-1">
      <div className="curate-primary truncate">{title}</div>
      <div className="curate-support flex flex-wrap items-center gap-x-2 text-tea-text-dim">
        <span>{metadata}</span>
        {status && <span role="status" className="text-tea-text-sec">{status}</span>}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-1">
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label={deleteLabel}
          className="curate-action curate-compact-target disabled:cursor-not-allowed"
          data-curate-action
          data-curate-compact-target
        >
          <span className="curate-compact-chrome text-tea-text-sec hover:text-tea-text" data-curate-compact-chrome>
            {deleteLabel}
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        aria-label={openLabel}
        className="curate-action curate-compact-target disabled:cursor-not-allowed"
        data-curate-action
        data-curate-compact-target
      >
        <span className="curate-compact-chrome border border-tea-border bg-tea-bg text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text" data-curate-compact-chrome>
          {openLabel}
        </span>
      </button>
    </div>
  </div>
);
