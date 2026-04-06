import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Store } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import { api, hydrateAccountStateFromToken } from '../../lib/api';
import type { AccountMembership, AccountRole } from '../../types';

const roleLabel: Record<AccountRole, string> = {
  owner: 'Owner',
  staff: 'Staff',
  viewer: 'Viewer',
};

function initialsOf(name: string): string {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

interface Props {
  compact?: boolean;
}

export const AccountSwitcher: React.FC<Props> = ({ compact = false }) => {
  const { memberships, activeAccountId } = useAppStore();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const active: AccountMembership | undefined = memberships.find(
    (m) => m.account_id === activeAccountId,
  );

  const handleSwitch = async (accountId: string) => {
    if (accountId === activeAccountId) {
      setOpen(false);
      return;
    }
    setSwitching(accountId);
    try {
      await api.accounts.switch(accountId);
      // Re-hydrate memberships + active_account_id from fresh JWT
      hydrateAccountStateFromToken();
      // Invalidate all cached queries so data re-fetches under new account context
      queryClient.invalidateQueries();
    } catch (err) {
      console.error('Account switch failed', err);
    } finally {
      setSwitching(null);
      setOpen(false);
    }
  };

  if (memberships.length === 0) return null;

  const displayName = active?.account_name ?? 'Select account';
  const displayRole = active ? roleLabel[active.role] : '';
  const initials = active ? initialsOf(active.account_name) : '';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-tea-elevated/40 hover:bg-tea-elevated/70 transition-colors text-left focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch account"
      >
        <div className="w-7 h-7 rounded-md bg-tea-gold-lt flex items-center justify-center shrink-0">
          {active?.logo_url ? (
            <img
              src={active.logo_url}
              alt=""
              className="w-full h-full object-cover rounded-md"
            />
          ) : initials ? (
            <span className="text-[10px] font-bold text-tea-gold tracking-wider">
              {initials}
            </span>
          ) : (
            <Store className="w-3.5 h-3.5 text-tea-gold" />
          )}
        </div>
        {!compact && (
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-tea-text truncate">
              {displayName}
            </div>
            {displayRole && (
              <div className="text-[9px] uppercase tracking-[0.15em] text-tea-text-dim">
                {displayRole}
              </div>
            )}
          </div>
        )}
        <ChevronDown
          size={12}
          className={`text-tea-text-dim shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 bottom-full mb-2 bg-tea-surface rounded-lg shadow-2xl overflow-hidden z-priority border border-tea-border"
        >
          <div className="px-3 py-2 text-[9px] uppercase tracking-[0.2em] text-tea-text-dim border-b border-tea-border">
            Your Tea Houses
          </div>
          <div className="max-h-64 overflow-y-auto">
            {memberships.map((m) => {
              const isActive = m.account_id === activeAccountId;
              const isBusy = switching === m.account_id;
              return (
                <button
                  key={m.account_id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSwitch(m.account_id)}
                  disabled={isBusy}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                    isActive ? 'bg-tea-gold-lt' : 'hover:bg-tea-elevated/60'
                  }`}
                >
                  <div className="w-7 h-7 rounded-md bg-tea-elevated flex items-center justify-center shrink-0">
                    {m.logo_url ? (
                      <img
                        src={m.logo_url}
                        alt=""
                        className="w-full h-full object-cover rounded-md"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-tea-gold tracking-wider">
                        {initialsOf(m.account_name)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-tea-text truncate">
                      {m.account_name}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.15em] text-tea-text-dim">
                      {roleLabel[m.role]}
                    </div>
                  </div>
                  {isActive && <Check size={13} className="text-tea-gold shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
