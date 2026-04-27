import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../lib/store';

// First-touch orientation paragraph. Appears once at the top of a network
// destination, dismissible, never returns. Stored per-account in localStorage
// so each partner's first visit gets the explanation.
//
// Editorial register per .impeccable.md: italic body in tertiary color, quiet
// dismiss link, no icons, no border, no background tint. Reads as a footnote,
// not a banner. One paragraph per surface (NETWORK_UI_BRIEF first-touch rule).

const STORAGE_PREFIX = 'teajia.network.firstTouch';

const keyFor = (surface: string, accountId: string | null | undefined): string =>
  `${STORAGE_PREFIX}.${surface}.${accountId ?? 'none'}`;

const hasDismissed = (surface: string, accountId: string | null | undefined): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(keyFor(surface, accountId)) === '1';
  } catch {
    return true;
  }
};

const markDismissed = (surface: string, accountId: string | null | undefined): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(keyFor(surface, accountId), '1');
  } catch {
    // localStorage unavailable. Note will reappear next visit; acceptable.
  }
};

interface FirstTouchNoteProps {
  /** Stable id for this surface ("catalog", "suggestions", "wholesale", etc.) */
  surface: string;
  /** Editorial paragraph. JSX so callers can italicize phrases inline. */
  children: React.ReactNode;
}

export const FirstTouchNote: React.FC<FirstTouchNoteProps> = ({ surface, children }) => {
  const activeAccountId = useAppStore(s => s.activeAccountId);
  // Hydrate dismissed state on mount only. Treat undefined while hydrating
  // as "show" so the SSR/CSR flicker is brief and forward-only.
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    setDismissed(hasDismissed(surface, activeAccountId));
  }, [surface, activeAccountId]);

  if (dismissed) return null;

  const dismiss = () => {
    markDismissed(surface, activeAccountId);
    setDismissed(true);
  };

  return (
    <aside className="mb-8 pb-6 border-b border-tea-border">
      <div className="flex items-start gap-6">
        <p className="font-body italic text-[14px] text-tea-text-sec leading-[1.7] flex-1">
          {children}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="font-body text-[12px] text-tea-text-sec hover:text-tea-text transition-colors shrink-0 mt-[3px]"
          aria-label="Dismiss this note"
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
};

export default FirstTouchNote;
