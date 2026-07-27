import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Subtrees a browser already keeps out of the tab order.
 *
 * `[inert]` and `[aria-hidden="true"]` were missing, which is why the shop's
 * carousel modal could not use this hook and hand-rolled its own trap instead:
 * that dialog renders up to four blurred preview cards either side of the live
 * one, each a full product card with a dozen buttons in it, all marked inert
 * and aria-hidden. Counting them made the "first" and "last" focusable elements
 * two invisible controls in a neighbouring tea, so the trap would have cycled a
 * keyboard reader into a card they were not looking at.
 */
const IGNORED_SUBTREES = '[hidden], [inert], [aria-hidden="true"]';

interface FocusTrapOptions {
  /**
   * Which element to focus when the trap activates.
   * - 'first' (default) — the first focusable descendant.
   * - 'container' — the container itself (must have tabIndex={-1}).
   * - a selector — the first matching focusable descendant; falls back to 'first'.
   */
  initialFocus?: 'first' | 'container' | string;
}

/**
 * Traps Tab focus within a container while `active`, focuses an element on
 * activation, and restores focus to the previously-focused element on cleanup.
 *
 * The focusable list is read at the moment Tab is pressed, not once when the
 * trap arms. A dialog whose contents change while it stays open (the shop
 * carousel swaps the whole card when you press an arrow key) otherwise keeps
 * cycling against the elements it saw on the first render, which are by then
 * detached from the document and cannot take focus at all.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  options: FocusTrapOptions = {}
) {
  const ref = useRef<T>(null);
  const { initialFocus = 'first' } = options;

  useEffect(() => {
    if (!active || !ref.current) return;
    const container = ref.current;

    const focusableNow = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS))
        .filter(el => !el.closest(IGNORED_SUBTREES));

    const previousFocus = document.activeElement as HTMLElement | null;

    // Move focus in.
    if (initialFocus === 'container') {
      container.focus();
    } else if (initialFocus !== 'first') {
      const target = container.querySelector<HTMLElement>(initialFocus);
      (target ?? focusableNow()[0])?.focus();
    } else {
      focusableNow()[0]?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = focusableNow();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === container) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [active, initialFocus]);

  return ref;
}
