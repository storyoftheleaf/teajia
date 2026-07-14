import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FlaskConical, X } from 'lucide-react';
import { useSampleCartStore } from '../../samples/sampleCartStore';
import SampleSetCreator from '../../samples/SampleSetCreator';
import { SampleCartPanel } from '../samples/SampleCartPanel';

interface SampleOrderActionProps {
  open: boolean;
  managing: boolean;
  initialSetId?: string;
  onOpenChange: (open: boolean) => void;
  onRequestCloseRoute?: () => void;
  onManagingChange: (managing: boolean) => void;
  onCaptureTea: () => void;
  onBrowseLibrary: () => void;
}

export const SampleOrderAction: React.FC<SampleOrderActionProps> = ({
  open, managing, initialSetId, onOpenChange, onRequestCloseRoute, onManagingChange, onCaptureTea, onBrowseLibrary,
}) => {
  const count = useSampleCartStore((state) => state.items.length);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const hasFocusedOpenRef = useRef(false);
  const [nestedOverlayOpen, setNestedOverlayOpen] = React.useState(false);

  const close = () => {
    onOpenChange(false);
    onManagingChange(false);
    onRequestCloseRoute?.();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) {
      hasFocusedOpenRef.current = false;
      return;
    }
    if (!hasFocusedOpenRef.current) {
      closeRef.current?.focus();
      hasFocusedOpenRef.current = true;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (nestedOverlayOpen) return;
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, nestedOverlayOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label={`Sample list (${count})`}
        className="curate-compact-target shrink-0 text-tea-text-sec transition-colors hover:text-tea-text"
        data-curate-compact-target
      >
        <span className="curate-compact-chrome whitespace-nowrap border-l border-tea-border px-2 text-ui-12" data-curate-compact-chrome>
          <FlaskConical size={14} />
          <span>Samples</span>
          <span className="tabular-nums text-tea-text-dim">({count})</span>
        </span>
      </button>

      {open && createPortal((
        <div ref={dialogRef} className="fixed inset-0 z-modal flex bg-tea-bg" role="dialog" aria-modal="true" aria-label="Samples workspace">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-14 shrink-0 items-center gap-3 border-b border-tea-border px-4">
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close Samples workspace"
                className="tap-target inline-flex h-8 w-8 items-center justify-center rounded-md text-tea-text-sec transition-colors hover:bg-tea-accent-sub hover:text-tea-text"
              >
                <X size={17} />
              </button>
              <h2 className="font-display text-ui-16 text-tea-text">{managing ? 'Sample batches' : 'Sample list'}</h2>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => onManagingChange(!managing)}
                className="tap-target min-h-11 rounded-md px-3 text-ui-12 text-tea-gold transition-colors hover:bg-tea-accent-sub"
              >
                {managing ? 'Back to Sample list' : 'View Sample batches'}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-nav">
              {managing ? <SampleSetCreator key={initialSetId ?? 'sample-sets'} initialSetId={initialSetId} onNestedOverlayChange={setNestedOverlayOpen} /> : <SampleCartPanel onCaptureTea={onCaptureTea} onBrowseLibrary={onBrowseLibrary} />}
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
};
