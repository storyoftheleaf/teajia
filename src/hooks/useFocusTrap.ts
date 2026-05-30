import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

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
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    ).filter(el => !el.closest('[hidden]'));

    const previousFocus = document.activeElement as HTMLElement | null;

    // Move focus in.
    if (initialFocus === 'container') {
      container.focus();
    } else if (initialFocus !== 'first') {
      const target = container.querySelector<HTMLElement>(initialFocus);
      (target ?? focusable[0])?.focus();
    } else {
      focusable[0]?.focus();
    }

    if (!focusable.length) {
      return () => previousFocus?.focus();
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
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
