import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FlaskConical, X } from 'lucide-react';
import { useSampleCartStore } from '../../samples/sampleCartStore';
import SampleSetCreator from '../../samples/SampleSetCreator';
import { SampleCartPanel } from '../samples/SampleCartPanel';

export const SampleOrderAction: React.FC = () => {
  const count = useSampleCartStore((state) => state.items.length);
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setManaging(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
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
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Sample order (${count})`}
        className="tap-target inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-ui-12 text-tea-text-sec transition-colors hover:bg-tea-accent-sub hover:text-tea-text"
      >
        <FlaskConical size={15} />
        <span>Sample order</span>
        <span className="tabular-nums text-tea-text-dim">({count})</span>
      </button>

      {open && createPortal((
        <div ref={dialogRef} className="fixed inset-0 z-modal flex bg-tea-bg" role="dialog" aria-modal="true" aria-label="Sample order">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-14 shrink-0 items-center gap-3 border-b border-tea-border px-4">
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close Sample order"
                className="tap-target inline-flex h-8 w-8 items-center justify-center rounded-md text-tea-text-sec transition-colors hover:bg-tea-accent-sub hover:text-tea-text"
              >
                <X size={17} />
              </button>
              <h2 className="font-display text-ui-17 text-tea-text">{managing ? 'Sample sets' : 'Sample order'}</h2>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setManaging((value) => !value)}
                className="tap-target min-h-11 rounded-md px-3 text-ui-12 text-tea-gold transition-colors hover:bg-tea-accent-sub"
              >
                {managing ? 'Current order' : 'Manage sample sets'}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-nav">
              {managing ? <SampleSetCreator /> : <SampleCartPanel />}
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
};
