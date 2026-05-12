import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAppStore } from '../store';

const LIMIT = 100;

const ACTION_LABELS: Record<string, string> = {
  'platform.acting_as.entered': 'Platform admin entered the account',
  'product.created': 'Product created',
  'product.updated': 'Product updated',
  'product.deleted': 'Product deleted',
  'product.featured': 'Product featured',
  'product.unfeatured': 'Product unfeatured',
  'collection.published_to_shop': 'Collection published to shop',
  'collection.unpublished_from_shop': 'Collection unpublished from shop',
  'member.bundles_updated': 'Member access updated',
  'account.suspended': 'Account suspended',
  'account.reactivated': 'Account reactivated',
  'account.trust_tier_changed': 'Trust tier changed',
  'feature.toggled': 'Feature toggled',
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

export const AccountActivityView: React.FC = () => {
  const navigate = useNavigate();
  const activeAccountId = useAppStore(s => s.activeAccountId);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeAccountId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.accounts.getActivity(activeAccountId, { limit: LIMIT })
      .then(res => { if (!cancelled) setEntries(res.entries); })
      .catch(err => { if (!cancelled) setError(err?.message || 'Failed to load activity'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeAccountId]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg text-tea-text">
      <div className="flex-none border-b border-tea-border px-4 md:px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text text-xs"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-serif uppercase tracking-[0.18em] text-tea-text">Activity Log</h1>
          <p className="text-ui-11 text-tea-text-sec mt-0.5">
            Platform-admin actions taken inside this account, newest first.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-tea-text-dim text-xs">
              <Loader2 size={14} className="animate-spin" /> Loading activity…
            </div>
          ) : error ? (
            <p className="py-12 text-center text-xs text-tea-error">{error}</p>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center">
              <ShieldCheck size={20} className="text-tea-text-dim mx-auto mb-2" />
              <p className="text-sm text-tea-text">No platform-admin activity yet.</p>
              <p className="text-ui-11 text-tea-text-dim mt-1">
                When the platform admin operates inside your account, every action will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {entries.map(e => {
                const label = ACTION_LABELS[e.action] || e.action;
                const details = (typeof e.details === 'object' && e.details) || {};
                const detailKeys = Object.keys(details).slice(0, 4);
                return (
                  <li key={e.id} className="bg-tea-surface rounded-lg border border-tea-border px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-tea-text">{label}</span>
                      <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim shrink-0">
                        {formatDate(e.created_at)}
                      </span>
                    </div>
                    <div className="text-ui-11 text-tea-text-sec mt-1">
                      by {e.actor_email || 'unknown'}
                      {e.target_type && e.target_id && (
                        <span className="text-tea-text-dim">
                          {' '}· {e.target_type}:{String(e.target_id).slice(0, 8)}
                        </span>
                      )}
                    </div>
                    {detailKeys.length > 0 && (
                      <div className="text-ui-11 text-tea-text-dim mt-1 truncate">
                        {detailKeys.map(k => `${k}: ${JSON.stringify(details[k])}`).join('  ·  ')}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
