import React, { useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

type CurateActionButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children' | 'disabled' | 'onClick'
> & {
  'data-testid'?: string;
  'data-visual-state'?: string;
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

interface CurateFieldControlProps extends React.HTMLAttributes<HTMLElement> {
  id?: string;
  className?: string;
  'aria-describedby'?: string;
}

export const CurateField: React.FC<{
  label: string;
  status?: string;
  helper?: React.ReactNode;
  className?: string;
  children: React.ReactElement;
}> = ({ label, status, helper, className = '', children }) => {
  const generatedId = useId().replace(/:/g, '');
  const child = children as React.ReactElement<CurateFieldControlProps>;
  const controlId = child.props.id || `curate-field-${generatedId}`;
  const statusId = status ? `${controlId}-status` : undefined;
  const helperId = helper ? `${controlId}-helper` : undefined;
  const describedBy = [child.props['aria-describedby'], statusId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="relative">
        <label htmlFor={controlId} className="curate-floating-label">
          {label}
        </label>
        {status && (
          <span id={statusId} role="status" className="curate-inline-label pointer-events-none absolute right-3 top-1 text-tea-gold">
            {status}
          </span>
        )}
        {React.cloneElement(child, {
          id: controlId,
          className: `curate-field curate-field-with-label w-full ${child.props.className || ''}`,
          'aria-describedby': describedBy,
        })}
      </div>
      {helper && (
        <div id={helperId} className="curate-support text-tea-text-dim">
          {helper}
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
      : 'border-tea-gold bg-tea-gold text-tea-bg hover:bg-tea-gold-lt'
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
  className?: string;
}> = ({ neutral = [], primary, className = '' }) => {
  const gridClass = neutral.length > 1 ? 'grid-cols-3' : neutral.length === 1 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div className={`curate-action-band grid w-full ${gridClass} gap-2 ${className}`}>
      {neutral.map((action, index) => (
        <ActionButton key={`${action.label}-${index}`} action={action} />
      ))}
      <ActionButton action={primary} primary />
    </div>
  );
};

export const CurateRecordRow: React.FC<{
  title: string;
  metadata: string;
  status?: string;
  openLabel?: string;
  onOpen: () => void;
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
