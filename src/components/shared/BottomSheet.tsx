import React from 'react';
import { Drawer } from 'vaul';
import { Check, ChevronRight, X } from 'lucide-react';

/**
 * BottomSheet — a Vaul-backed sheet that slides up from the bottom of the
 * viewport with native iOS feel: drag handle, drag-to-dismiss, glass
 * surface, and the page behind subtly scales down so the sheet reads as a
 * lifted plane. Used app-wide for picker UIs (Material, Era, Category…)
 * and for any modal that benefits from "where my thumb lives" placement.
 *
 * Wrap your content in <BottomSheet> and use <SheetOption> for the typical
 * list-of-choices layout. Anything more bespoke (the Clay picker's photo
 * grid) can render arbitrary children inside the same shell.
 */

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Subtitle / context line shown under the title. */
  description?: string;
  /** When true, lets the sheet expand close to full-screen (~92% viewport)
   *  for content-heavy pickers like the clay swatch grid. */
  large?: boolean;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  open, onOpenChange, title, description, large = false, children,
}) => {
  const maxHeight = large ? '92vh' : '78vh';

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-modal bg-black/55 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-modal flex flex-col rounded-t-3xl border-t border-tea-border outline-none focus:outline-none"
          style={{
            maxHeight,
            background: 'rgb(var(--tea-bg-rgb) / 0.92)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            boxShadow:
              '0 -10px 40px -8px rgb(var(--tea-bg-rgb) / 0.7), inset 0 1px 0 rgb(var(--tea-gold-rgb) / 0.08)',
          }}
        >
          {/* Drag handle — Vaul listens to drag gestures on the entire
              Content; the visible bar is purely an affordance. */}
          <div className="flex justify-center pt-2 pb-1 shrink-0" aria-hidden>
            <div className="w-10 h-1 rounded-full bg-tea-text-sec/40" />
          </div>

          {/* Title row — Cancel on the left per project Cancel/Close rules */}
          <div className="flex items-center gap-3 px-4 pt-2 pb-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="tap-target text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.75} />
            </button>
            <div className="flex-1 min-w-0">
              <Drawer.Title
                className="text-base text-tea-text font-medium truncate"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
              >
                {title}
              </Drawer.Title>
              {description && (
                <Drawer.Description className="text-ui-11 text-tea-text-sec truncate">
                  {description}
                </Drawer.Description>
              )}
              {!description && (
                // Always emit a Description for a11y (Drawer requires it),
                // visually hidden when none was supplied.
                <Drawer.Description className="sr-only">{title}</Drawer.Description>
              )}
            </div>
          </div>

          {/* Body — scrollable list/grid lives here. The bottom padding
              clears the BottomTabBar (52px + safe area) so the last option
              isn't occluded by it. On lg+ the nav is hidden and pb-nav-gap
              automatically collapses to pb-4. */}
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-nav-gap">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

/**
 * SheetOption — the canonical list-row inside a BottomSheet. Big enough to
 * tap with a thumb (56px), serif label, optional leading visual, optional
 * trailing chevron when picking opens a sub-sheet. Selected state is a
 * gold tint plus a check, not a coloured chip.
 */
interface SheetOptionProps {
  label: string;
  /** Small line under the label — e.g. tea name in Chinese, era hint */
  hint?: string;
  /** Left-side icon, swatch, or thumbnail */
  leading?: React.ReactNode;
  selected?: boolean;
  /** Show a chevron to indicate the option drills into a sub-flow */
  hasSubflow?: boolean;
  onSelect: () => void;
}

export const SheetOption: React.FC<SheetOptionProps> = ({
  label, hint, leading, selected, hasSubflow, onSelect,
}) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
      selected
        ? 'bg-tea-gold/[0.10] text-tea-gold'
        : 'text-tea-text hover:bg-tea-gold/[0.06] active:bg-tea-gold/[0.10]'
    }`}
  >
    {leading && <span className="shrink-0 flex items-center justify-center">{leading}</span>}
    <span className="flex-1 min-w-0">
      <span className={`block truncate text-base ${selected ? 'font-semibold' : 'font-medium'}`}>
        {label}
      </span>
      {hint && (
        <span className="block truncate text-ui-11 text-tea-text-sec mt-0.5">{hint}</span>
      )}
    </span>
    {selected && !hasSubflow && (
      <Check size={16} strokeWidth={2.5} className="shrink-0 text-tea-gold" />
    )}
    {hasSubflow && (
      <ChevronRight size={16} strokeWidth={1.75} className={`shrink-0 ${selected ? 'text-tea-gold' : 'text-tea-text-sec'}`} />
    )}
  </button>
);

export default BottomSheet;
