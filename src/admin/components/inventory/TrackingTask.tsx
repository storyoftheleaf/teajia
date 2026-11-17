import React from 'react';
import { Modal } from '../../../components/shared/Modal';

/** Focused editing workspace; tracking stays a stable list behind it. */
export function TrackingTask({ open, onClose, title, children, compact = false, initialFocus = 'container' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  compact?: boolean;
  initialFocus?: string;
}) {
  return <Modal isOpen={open} onClose={onClose} title={title} variant={compact ? 'center' : 'panel'} initialFocus={initialFocus}
    className={`tracking-task font-sans text-ui-12 text-tea-text ${compact ? 'flex flex-col sm:!max-w-2xl' : ''}`}
    headerActions={!compact && <button type="button" className="tap-target purchase-tracking-button" onClick={onClose}>Done</button>}>
    <div className="tracking-task-scroll pb-nav-gap"><div className="tracking-task-content">{children}</div></div>
  </Modal>;
}
