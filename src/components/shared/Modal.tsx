import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../Icons';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';

type ModalVariant = 'center' | 'sheet' | 'panel';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible name. Provide either `title` (rendered + used as label) or `ariaLabel`. */
  title?: React.ReactNode;
  ariaLabel?: string;
  /**
   * center — centered card (default). Close X top-right.
   * sheet — bottom sheet on mobile, centered card on desktop. Close X top-left.
   * panel — full-screen panel. Close X top-left.
   */
  variant?: ModalVariant;
  /** Hide the built-in close button (e.g. when a header toolbar owns it). */
  hideClose?: boolean;
  /** Where to send focus on open. Defaults to first focusable element. */
  initialFocus?: 'first' | 'container' | string;
  /** Disable closing on backdrop click (use for destructive confirms). */
  disableBackdropClose?: boolean;
  /** Extra classes for the dialog panel. */
  className?: string;
  /** Optional right-aligned header content (toolbar). */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

const VARIANT_BACKDROP: Record<ModalVariant, string> = {
  center: 'flex items-center justify-center p-4',
  sheet: 'flex items-end sm:items-center sm:justify-center sm:p-4',
  panel: '',
};

const VARIANT_PANEL: Record<ModalVariant, string> = {
  center:
    'w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-tea-border bg-tea-surface shadow-lg animate-[scaleIn_0.2s_ease-out]',
  sheet:
    'w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-xl sm:rounded-xl border border-tea-border bg-tea-surface shadow-lg animate-[slideUp_0.3s_ease-out]',
  panel: 'fixed inset-0 bg-tea-surface flex flex-col animate-[fadeIn_0.2s_ease-out]',
};

let modalTitleSeq = 0;

/**
 * Accessible modal primitive. Handles focus trap, focus restore, Escape-to-close,
 * scroll lock, backdrop click, and the project's Close-X position rules.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  ariaLabel,
  variant = 'center',
  hideClose = false,
  initialFocus = 'first',
  disableBackdropClose = false,
  className = '',
  headerActions,
  children,
}) => {
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen, { initialFocus });
  useScrollLock(isOpen);
  const titleId = React.useMemo(() => `modal-title-${++modalTitleSeq}`, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Close X position: top-right for centered modals, top-left for sheets/panels.
  const closeOnLeft = variant !== 'center';

  const closeButton = !hideClose && (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="tap-target text-tea-text-sec hover:text-tea-text transition-colors rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tea-gold/50"
    >
      <Icons.Close className="w-5 h-5" />
    </button>
  );

  const header = (title || headerActions || closeButton) && (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-tea-border">
      {closeOnLeft && closeButton}
      {title && (
        <h2 id={titleId} className="font-display text-ui-20 text-tea-text flex-1 min-w-0">
          {title}
        </h2>
      )}
      {!title && <span className="flex-1" />}
      {headerActions}
      {!closeOnLeft && closeButton}
    </div>
  );

  const dialog = (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-label={!title ? ariaLabel : undefined}
      tabIndex={initialFocus === 'container' ? -1 : undefined}
      className={`${VARIANT_PANEL[variant]} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {header}
      {children}
    </div>
  );

  if (variant === 'panel') {
    return createPortal(
      <div className="fixed inset-0 z-modal">{dialog}</div>,
      document.body
    );
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-modal bg-tea-overlay animate-[fadeIn_0.2s_ease-out] ${VARIANT_BACKDROP[variant]}`}
      onClick={disableBackdropClose ? undefined : onClose}
    >
      {dialog}
    </div>,
    document.body
  );
};
