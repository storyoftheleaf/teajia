import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { AccountMembership } from '../../types';

interface AccountSwitcherChipProps {
  memberships: AccountMembership[];
  activeAccountId: string | null;
  switchingTo: string | null;
  onSwitch: (membership: AccountMembership) => void;
}

/**
 * Compact account-switcher chip for the top of the AccountPanel.
 *
 * Renders nothing when the user only has one membership. Otherwise shows a
 * pill-shaped chip with the active account name + a chevron. Tapping the chip
 * opens a small dropdown listing all memberships — tapping a row switches and
 * closes. The active row gets a check + tea-gold accent treatment.
 *
 * Tap targets meet WCAG 2.5.5 (>=44x44 via .tap-target invisible padding).
 */
export const AccountSwitcherChip: React.FC<AccountSwitcherChipProps> = ({
  memberships,
  activeAccountId,
  switchingTo,
  onSwitch,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Only render when user has more than one membership.
  if (memberships.length <= 1) return null;

  const active = memberships.find(m => m.account_id === activeAccountId) ?? null;
  const activeName = active?.account_name ?? 'Select account';

  // Click outside closes
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleRowClick = (m: AccountMembership) => {
    if (m.account_id === activeAccountId) {
      setOpen(false);
      return;
    }
    onSwitch(m);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Switch account. Current account: ${activeName}`}
        className={`tap-target inline-flex items-center gap-2 max-w-full pl-3 pr-2 py-1.5 rounded-full border text-ui-12 font-medium transition-colors ${
          open
            ? 'border-tea-gold bg-tea-gold/8 text-tea-text'
            : 'border-tea-border bg-tea-surface text-tea-text hover:bg-tea-gold/5'
        }`}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-tea-gold shrink-0" />
        <span className="truncate">{activeName}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-tea-text-sec transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Switch account"
          className="absolute left-0 top-full mt-1.5 min-w-full w-max max-w-[280px] z-50 rounded-md border border-tea-border bg-tea-elevated shadow-2xl overflow-hidden"
        >
          <ul className="max-h-[320px] overflow-y-auto py-1">
            {memberships.map(m => {
              const isActive = m.account_id === activeAccountId;
              const isLoading = switchingTo === m.account_id;
              return (
                <li key={m.account_id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    disabled={!!switchingTo}
                    onClick={() => handleRowClick(m)}
                    className={`tap-target w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      isActive
                        ? 'bg-tea-gold/8 text-tea-text'
                        : 'text-tea-text hover:bg-tea-gold/5'
                    } disabled:opacity-60`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isActive ? 'bg-tea-gold' : 'bg-tea-text-sec'
                      }`}
                    />
                    <span className="text-ui-13 truncate flex-1">{m.account_name}</span>
                    {isLoading ? (
                      <span className="w-3.5 h-3.5 border border-tea-border border-t-tea-text-sec rounded-full animate-spin shrink-0" />
                    ) : isActive ? (
                      <Check className="w-3.5 h-3.5 text-tea-gold shrink-0" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
