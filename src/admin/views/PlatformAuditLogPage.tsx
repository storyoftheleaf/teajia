import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, X as XIcon, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import type { AuditLogEntry } from '../../lib/api';
import { useAppStore } from '../store';

const LIMIT = 50;

const ACTION_LABELS: Record<string, string> = {
  'account.created': 'Account created',
  'account.active': 'Account reactivated',
  'account.reactivated': 'Account reactivated',
  'account.suspended': 'Account suspended',
  'account.trust_tier_changed': 'Trust tier changed',
  'account.upgraded_to_location': 'Tea Master upgraded to Location',
  'feature.toggled': 'Feature toggled',
  'platform_role.changed': 'Platform role changed',
  'user.invite_resent': 'Invite resent',
  'ownership.transferred': 'Ownership transferred',
  // Members & Access (Step 0)
  'member.bundles_updated': 'Member bundles updated',
  'application.approved': 'Application approved',
  'application.declined': 'Application declined',
  'tea_master.invited': 'Tea Master invited',
  // Network listings (Step 2)
  'listing.carried': 'Carried tea from network',
  'listing.updated': 'Listing edited',
  // Suggestions (Step 3)
  'suggestion.created': 'Canonical edit suggested',
  'suggestion.decided': 'Suggestion reviewed',
  // Wholesale (Step 4)
  'wholesale.created': 'Wholesale order drafted',
  'wholesale.updated': 'Wholesale draft edited',
  'wholesale.submitted': 'Wholesale order submitted',
  'wholesale.replied': 'Wholesale supplier replied',
  'wholesale.confirmed': 'Wholesale order confirmed',
  'wholesale.shipped': 'Wholesale order shipped',
  'wholesale.received': 'Wholesale order received',
  'wholesale.cancelled': 'Wholesale order cancelled',
  'wholesale.nudged': 'Wholesale supplier nudged',
  // Adoption queue (Step 6)
  'profile.suggested_for_network': 'Tea suggested for network',
  'profile.adoption_adopted': 'Tea adopted into network',
  'profile.adoption_declined': 'Network adoption declined',
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const PlatformAuditLogPage: React.FC = () => {
  const navigate = useNavigate();
  const { platformRole } = useAppStore();

  const [allEntries, setAllEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});

  // Load account name lookup once so we can render "Operating as <name>"
  // when an actor's active account differs from the action's target.
  useEffect(() => {
    let cancelled = false;
    api.platform.listAccounts()
      .then(d => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const a of d.accounts) map[a.id] = a.name || a.slug || a.id;
        setAccountNames(map);
      })
      .catch(() => { /* non-fatal — UI just won't show the friendly name */ });
    return () => { cancelled = true; };
  }, []);

  // Filters
  const [searchAction, setSearchAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async (off: number, replace = false) => {
    setLoading(true);
    try {
      const d = await api.platform.getAuditLog({ limit: LIMIT, offset: off });
      setAllEntries(prev => replace ? d.entries : [...prev, ...d.entries]);
      setHasMore(d.entries.length === LIMIT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0, true); }, [load]);

  const handleLoadMore = () => {
    const next = offset + LIMIT;
    setOffset(next);
    load(next, false);
  };

  const handleRefresh = () => {
    setOffset(0);
    load(0, true);
  };

  // Extract unique action types for filter
  const actionTypes = useMemo(() => {
    const set = new Set(allEntries.map(e => e.action));
    return Array.from(set).sort();
  }, [allEntries]);

  // Client-side filtering
  const filtered = useMemo(() => {
    return allEntries.filter(e => {
      if (searchAction && !e.action.toLowerCase().includes(searchAction.toLowerCase()) &&
          !(ACTION_LABELS[e.action] || '').toLowerCase().includes(searchAction.toLowerCase())) {
        return false;
      }
      if (dateFrom) {
        const from = new Date(dateFrom).getTime();
        if (new Date(e.created_at).getTime() < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo).getTime() + 86400_000; // include end of day
        if (new Date(e.created_at).getTime() > to) return false;
      }
      return true;
    });
  }, [allEntries, searchAction, dateFrom, dateTo]);

  const hasFilters = !!searchAction || !!dateFrom || !!dateTo;

  if (!platformRole) {
    return (
      <div className="p-10 text-center text-tea-text-sec font-serif">
        Platform access required.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto hide-scrollbar px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/platform')}
          className="p-1.5 text-tea-text-dim hover:text-tea-text transition-colors"
          aria-label="Back to platform admin"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg text-tea-text font-serif">Platform Audit Log</h1>
          <p className="text-ui-11 text-tea-text-dim uppercase tracking-[0.12em]">
            All platform-level actions
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="ml-auto p-1.5 text-tea-text-dim hover:text-tea-text transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-5">
        {/* Action search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
          <input
            type="text"
            value={searchAction}
            onChange={e => setSearchAction(e.target.value)}
            placeholder="Filter by action type…"
            list="action-types-list"
            className="w-full bg-tea-surface border border-tea-border rounded-md pl-8 pr-8 py-2 text-sm text-tea-text outline-none focus:ring-2 focus:ring-tea-gold/40 placeholder-tea-text-dim"
          />
          <datalist id="action-types-list">
            {actionTypes.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
          </datalist>
          {searchAction && (
            <button
              type="button"
              onClick={() => setSearchAction('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text"
              aria-label="Clear filter"
            >
              <XIcon size={12} />
            </button>
          )}
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-ui-9 uppercase tracking-display text-tea-text-dim mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-sm text-tea-text outline-none focus:ring-2 focus:ring-tea-gold/40"
            />
          </div>
          <div>
            <label className="block text-ui-9 uppercase tracking-display text-tea-text-dim mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-sm text-tea-text outline-none focus:ring-2 focus:ring-tea-gold/40"
            />
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between text-xs text-tea-text-dim">
            <span>{filtered.length} of {allEntries.length} entries</span>
            <button
              type="button"
              onClick={() => { setSearchAction(''); setDateFrom(''); setDateTo(''); }}
              className="hover:text-tea-text transition-colors uppercase tracking-caps"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Log entries */}
      {loading && allEntries.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 size={18} className="animate-spin text-tea-text-dim" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-tea-text-dim text-sm font-serif">
          No entries match your filters.
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(entry => {
            let details: Record<string, string | number | boolean> = {};
            try { details = JSON.parse(entry.details); } catch { /* ignore */ }

            // Show "Operating as X" when the actor's active account context
            // differs from the action's target account (cross-account write).
            const actorAcct = entry.actor_account_id || null;
            const targetAcct = entry.account_id || null;
            const showActingAs = !!actorAcct && actorAcct !== targetAcct;
            const actingAsName = actorAcct
              ? (accountNames[actorAcct] || actorAcct.slice(0, 8))
              : null;

            return (
              <div key={entry.id} className="inset-panel px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-tea-text text-ui-13 font-medium">
                      {ACTION_LABELS[entry.action] || entry.action}
                    </p>
                    <p className="text-tea-text-dim text-ui-11 truncate">
                      <span className="text-tea-text-sec">{entry.actor_email}</span>
                      {showActingAs && actingAsName && (
                        <span className="text-tea-text-sec"> · operating as {actingAsName}</span>
                      )}
                      {typeof details.name === 'string' && details.name ? ` → ${details.name}` : typeof details.email === 'string' && details.email ? ` → ${details.email}` : ''}
                      {details.from != null && details.to != null ? ` · ${String(details.from) || 'none'} → ${String(details.to) || 'none'}` : ''}
                      {typeof details.feature === 'string' && details.feature ? ` · ${details.feature} ${details.enabled ? 'on' : 'off'}` : ''}
                    </p>
                    <p className="text-ui-10 text-tea-text-dim mt-0.5 font-mono">
                      target: {entry.target_type} · {entry.target_id}
                    </p>
                  </div>
                  <span className="text-ui-10 text-tea-text-dim shrink-0 tabular-nums">
                    {formatDate(entry.created_at)}
                  </span>
                </div>
              </div>
            );
          })}

          {hasMore && !hasFilters && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loading}
              className="pill w-full justify-center flex items-center gap-1.5 mt-2"
            >
              {loading ? <Loader2 size={10} className="animate-spin" /> : null}
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PlatformAuditLogPage;
