import React, { useRef, useState, useLayoutEffect, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AnchoredMenu — the one dropdown primitive for the whole site.
 *
 * SITE RULE (locked): menus ALWAYS render over the bars. There is no case on
 * this site where a menu should sit behind toolbars, table headers, or any
 * chrome. This component guarantees that by portaling the panel to
 * document.body (escaping every backdrop-blur / transform / z-index stacking
 * context an ancestor might create) and painting at the top z-layer.
 *
 * Never hand-roll a dropdown with `absolute` + `z-popover` again — those get
 * trapped in their parent's stacking context and paint behind the chrome.
 * Use this instead.
 *
 * Usage:
 *   <AnchoredMenu
 *     align="right"
 *     trigger={(props) => (
 *       <button {...props}><MoreHorizontal /></button>
 *     )}
 *   >
 *     {(close) => (
 *       <>
 *         <button onClick={() => { doThing(); close(); }}>Thing</button>
 *       </>
 *     )}
 *   </AnchoredMenu>
 */

interface TriggerProps {
  ref: React.Ref<HTMLButtonElement>;
  onClick: (e: React.MouseEvent) => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
}

interface AnchoredMenuProps {
  /** Renders the trigger button. Spread the passed props onto your button. */
  trigger: (props: TriggerProps) => React.ReactNode;
  /** Menu contents. Receives a `close` fn to call after an item is chosen. */
  children: (close: () => void) => React.ReactNode;
  /** Horizontal edge to align the panel to, relative to the trigger. Default 'right'. */
  align?: 'left' | 'right';
  /** Panel width in px. Default 192 (w-48). */
  width?: number;
  /** Extra classes for the panel. */
  className?: string;
  /** ARIA role for the panel. Default 'menu'. Use 'listbox' for option-style pickers. */
  role?: 'menu' | 'listbox';
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const VIEWPORT_PAD = 8;
const GAP = 8;

export const AnchoredMenu: React.FC<AnchoredMenuProps> = ({
  trigger,
  children,
  align = 'right',
  width = 192,
  className = '',
  role = 'menu',
  open: controlledOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback((next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }, [isControlled, onOpenChange]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const rawLeft = align === 'right' ? r.right - width : r.left;
      const left = Math.max(
        VIEWPORT_PAD,
        Math.min(rawLeft, window.innerWidth - width - VIEWPORT_PAD)
      );
      setPos({ top: r.bottom + GAP, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const triggerProps: TriggerProps = {
    ref: btnRef,
    onClick: (e) => { e.stopPropagation(); setOpen(!open); },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  };

  return (
    <>
      {trigger(triggerProps)}
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <>
              <div className="fixed inset-0 z-nav" onClick={close} />
              <motion.div
                role={role}
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.12 }}
                style={{ position: 'fixed', top: pos.top, left: pos.left, width }}
                className={`z-nav bg-tea-surface border border-tea-border shadow-2xl rounded-xl py-1 flex flex-col origin-top ${className}`}
                onClick={(e) => e.stopPropagation()}
              >
                {children(close)}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
