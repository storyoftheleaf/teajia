import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Store, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import { api, hydrateAccountStateFromToken, type PlatformAccount } from '../../lib/api';
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
  const { memberships, activeAccountId, platformRole } = useAppStore();
  const isPlatformOwner = platformRole === 'platform_owner' || platformRole === 'platform_admin';
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [networkAccounts, setNetworkAccounts] = useState<PlatformAccount[]>([]);
  const [networkLoaded, setNetworkLoaded] = useState(false);
  const [networkLoading, setNetworkLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Lazy-fetch the full network account list when a platform owner opens the dropdown.
  useEffect(() => {
    if (!open || !isPlatformOwner || networkLoaded || networkLoading) return;
    let cancelled = false;
    setNetworkLoading(true);
    api.platform.listAccounts()
      .then(res => { if (!cancelled) { setNetworkAccounts(res.accounts); setNetworkLoaded(true); } })
      .catch(err => { console.error('[AccountSwitcher] failed to load network accounts', err); if (!cancelled) setNetworkLoaded(true); })
      .finally(() => { if (!cancelled) setNetworkLoading(false); });
    return () => { cancelled = true; };
  }, [open, isPlatformOwner, networkLoaded, networkLoading]);

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

  if (memberships.length === 0 && !isPlatformOwner) return null;

  const memberAccountIds = new Set(memberships.map(m => m.account_id));
  const otherNetworkAccounts = networkAccounts.filter(a => !memberAccountIds.has(a.id));
  const activeNetworkAccount = networkAccounts.find(a => a.id === activeAccountId && !memberAccountIds.has(a.id));

  const displayName = active?.account_name ?? activeNetworkAccount?.name ?? 'Select account';
  const displayRole = active ? roleLabel[active.role] : (activeNetworkAccount ? 'Operating as' : '');
  const initials = active ? initialsOf(active.account_name) : (activeNetworkAccount ? initialsOf(activeNetworkAccount.name) : '');

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
            <span className="text-ui-10 font-bold text-tea-gold tracking-wider">
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
              <div className="text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim">
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
          className="absolute left-0 right-0 bottom-full mb-2 bg-tea-surface rounded-xl shadow-2xl overflow-hidden z-priority border border-tea-border"
        >
          <div className="px-3 py-2 text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim border-b border-tea-border">
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
                      <span className="text-ui-10 font-bold text-tea-gold tracking-wider">
                        {initialsOf(m.account_name)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-tea-text truncate">
                      {m.account_name}
                    </div>
                    <div className="text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim">
                      {roleLabel[m.role]}
                    </div>
                  </div>
                  {isActive && <Check size={13} className="text-tea-gold shrink-0" />}
                </button>
              );
            })}
          </div>

          {isPlatformOwner && (
            <>
              <div className="px-3 py-2 text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim border-t border-b border-tea-border flex items-center gap-1.5">
                <ShieldCheck size={10} className="text-tea-gold" />
                All Network Accounts
              </div>
              <div className="max-h-64 overflow-y-auto">
                {networkLoading ? (
                  <div className="px-3 py-3 text-ui-10 text-tea-text-dim">Loading…</div>
                ) : otherNetworkAccounts.length === 0 ? (
                  <div className="px-3 py-3 text-ui-10 text-tea-text-dim">
                    {networkLoaded ? 'No other accounts.' : ''}
                  </div>
                ) : (
                  otherNetworkAccounts.map(a => {
                    const isActive = a.id === activeAccountId;
                    const isBusy = switching === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleSwitch(a.id)}
                        disabled={isBusy}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                          isActive ? 'bg-tea-gold-lt' : 'hover:bg-tea-elevated/60'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-md bg-tea-elevated flex items-center justify-center shrink-0">
                          <span className="text-ui-10 font-bold text-tea-gold tracking-wider">
                            {initialsOf(a.name)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-tea-text truncate">
                            {a.name}
                          </div>
                          <div className="text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim truncate">
                            {a.location_city || a.slug}
                          </div>
                        </div>
                        {isActive && <Check size={13} className="text-tea-gold shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
