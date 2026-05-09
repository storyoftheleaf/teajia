import React from 'react';
import { BookOpen, Package } from 'lucide-react';
import { useCompassSaveMode } from '../../lib/compassSaveMode';

interface SaveModeToggleProps {
  /** When the user has no active shop account, promotion is impossible — disable
   *  the Inventory segment and show a hint tooltip instead of hiding it. */
  inventoryDisabled?: boolean;
  /** Used to drive query-param-based pre-selection (e.g. ?mode=inventory from Drafts). */
  className?: string;
}

/**
 * Segmented Personal · Inventory toggle for Compass capture. Always-visible
 * teaches the dual purpose of the surface; sticky to last choice (localStorage).
 */
export const SaveModeToggle: React.FC<SaveModeToggleProps> = ({
  inventoryDisabled = false,
  className = '',
}) => {
  const mode = useCompassSaveMode((s) => s.mode);
  const setMode = useCompassSaveMode((s) => s.setMode);

  // If the user lands here with Inventory selected but no account, fall back to
  // Personal so the active segment never lies about what the next save will do.
  React.useEffect(() => {
    if (inventoryDisabled && mode === 'inventory') setMode('personal');
  }, [inventoryDisabled, mode, setMode]);

  return (
    <div
      role="radiogroup"
      aria-label="Save mode"
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-tea-elevated border border-tea-border ${className}`}
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
        title={inventoryDisabled ? 'Join or select an account to add inventory items.' : undefined}
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
  );
};

export default SaveModeToggle;
