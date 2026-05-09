import React from 'react';
import { BookOpen, Package } from 'lucide-react';
import { useCompassSaveMode } from '../../lib/compassSaveMode';

interface SaveModeToggleProps {
  /** When the user has no active shop account, promotion is impossible — disable
   *  the Inventory segment and show a hint tooltip instead of hiding it. */
  inventoryDisabled?: boolean;
  className?: string;
  /** When true, drops the leading "Save to" label and the helper line below.
   *  Used in cramped contexts (the desktop right-column action bar) where
   *  the longer form would crowd out the Done button. */
  compact?: boolean;
}

const HELPER_TEXT = {
  personal: 'Goes to your private tasting library.',
  inventory: 'Adds a Draft product to your shop drafts queue.',
  inventoryDisabled: 'Join or select an account to save items as inventory.',
};

/**
 * Segmented Personal · Inventory toggle for Compass capture. The leading
 * "Save to" label and the descriptive helper line below make it clear what
 * each mode does — the toggle on its own is too opaque (Personal *what*?
 * Inventory of *what*?). Sticky to last choice via localStorage.
 */
export const SaveModeToggle: React.FC<SaveModeToggleProps> = ({
  inventoryDisabled = false,
  className = '',
  compact = false,
}) => {
  const mode = useCompassSaveMode((s) => s.mode);
  const setMode = useCompassSaveMode((s) => s.setMode);

  // If the user lands here with Inventory selected but no account, fall back to
  // Personal so the active segment never lies about what the next save will do.
  React.useEffect(() => {
    if (inventoryDisabled && mode === 'inventory') setMode('personal');
  }, [inventoryDisabled, mode, setMode]);

  const helper = inventoryDisabled && mode !== 'inventory'
    ? HELPER_TEXT.personal
    : HELPER_TEXT[mode];

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {!compact && (
          <span className="text-ui-11 uppercase tracking-[0.1em] text-tea-text-dim font-medium">
            Save to
          </span>
        )}
        <div
          role="radiogroup"
          aria-label="Save mode"
          className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-tea-elevated border border-tea-border"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'personal'}
            onClick={() => setMode('personal')}
            data-testid="save-mode-personal"
            className={`tap-target flex items-center gap-1.5 px-2.5 py-1 rounded-md text-ui-11 font-medium transition-colors ${
              mode === 'personal'
                ? 'bg-tea-gold/15 text-tea-gold'
                : 'text-tea-text-sec hover:text-tea-text'
            }`}
          >
            <BookOpen size={11} strokeWidth={1.75} />
            Personal
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'inventory'}
            onClick={() => { if (!inventoryDisabled) setMode('inventory'); }}
            disabled={inventoryDisabled}
            data-testid="save-mode-inventory"
            title={inventoryDisabled ? HELPER_TEXT.inventoryDisabled : undefined}
            className={`tap-target flex items-center gap-1.5 px-2.5 py-1 rounded-md text-ui-11 font-medium transition-colors ${
              inventoryDisabled
                ? 'text-tea-text-sec opacity-50 cursor-not-allowed'
                : mode === 'inventory'
                  ? 'bg-tea-gold/15 text-tea-gold'
                  : 'text-tea-text-sec hover:text-tea-text'
            }`}
          >
            <Package size={11} strokeWidth={1.75} />
            Inventory
          </button>
        </div>
      </div>
      <p
        className="text-ui-11 text-tea-text-sec leading-snug"
        data-testid="save-mode-helper"
      >
        {inventoryDisabled && mode !== 'inventory'
          ? HELPER_TEXT.inventoryDisabled
          : helper}
      </p>
    </div>
  );
};

export default SaveModeToggle;
