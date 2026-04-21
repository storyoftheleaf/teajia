import React, { useState } from 'react';
import { ScrollText, Search, RefreshCw, Clock, User, Tag, Hash } from 'lucide-react';
import { useActivityLogs } from '../hooks/useAdminData';

interface ActivityLog {
  id: string;
  created_at: string;
  actor_email?: string;
  actor_name?: string;
  user_email?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string | Record<string, unknown>;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ActivityLogsPage: React.FC = () => {
  const [filterAction, setFilterAction] = useState('');

  const { data, isLoading, refetch, isRefetching } = useActivityLogs({ limit: 100 });

  const logs: ActivityLog[] = Array.isArray(data?.logs) ? data.logs : [];

  const filtered = filterAction.trim()
    ? logs.filter((log) =>
        log.action.toLowerCase().includes(filterAction.toLowerCase())
      )
    : logs;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-tea-border bg-tea-bg flex-shrink-0">
        <ScrollText size={17} className="text-tea-text-sec shrink-0" />
        <h1 className="text-sm font-semibold text-tea-text tracking-wide flex-1">Activity Log</h1>

        {/* Filter input */}
        <div className="relative hidden sm:block">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
          <input
            type="text"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="Filter by action…"
            className="pl-7 pr-3 py-1.5 text-xs bg-tea-surface border border-tea-border rounded-lg text-tea-text placeholder-tea-text-dim focus:outline-none focus:border-tea-text-sec transition-colors w-44"
          />
        </div>

        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Mobile filter */}
      <div className="sm:hidden px-4 py-2 border-b border-tea-border bg-tea-bg flex-shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
          <input
            type="text"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="Filter by action…"
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-tea-surface border border-tea-border rounded-lg text-tea-text placeholder-tea-text-dim focus:outline-none focus:border-tea-text-sec transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-tea-text-dim text-sm">
            Loading activity…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-tea-text-dim">
            <ScrollText size={24} strokeWidth={1.5} />
            <p className="text-sm">
              {filterAction ? 'No matching entries' : 'No activity recorded yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-tea-surface z-10">
              <tr className="border-b border-tea-border">
                <th className="text-left px-4 md:px-6 py-2.5 text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium whitespace-nowrap">
                  <span className="flex items-center gap-1.5"><Clock size={11} /> Time</span>
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium whitespace-nowrap">
                  <span className="flex items-center gap-1.5"><User size={11} /> User</span>
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium whitespace-nowrap">
                  <span className="flex items-center gap-1.5"><Tag size={11} /> Action</span>
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium whitespace-nowrap hidden md:table-cell">
                  Entity Type
                </th>
                <th className="text-left px-3 md:px-6 py-2.5 text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium whitespace-nowrap hidden md:table-cell">
                  <span className="flex items-center gap-1.5"><Hash size={11} /> Entity ID</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tea-border">
              {filtered.map((log) => {
                const actor = log.actor_email || log.actor_name || log.user_email || '—';
                const entityType = log.entity_type || '—';
                const entityId = log.entity_id
                  ? log.entity_id.length > 12
                    ? `${log.entity_id.slice(0, 8)}…`
                    : log.entity_id
                  : '—';

                return (
                  <tr
                    key={log.id}
                    className="hover:bg-tea-surface/50 transition-colors"
                  >
                    <td className="px-4 md:px-6 py-3 text-tea-text-dim whitespace-nowrap font-mono text-[11px]" title={log.created_at}>
                      {formatRelativeTime(log.created_at)}
                    </td>
                    <td className="px-3 py-3 text-tea-text-sec max-w-[140px] truncate" title={actor}>
                      {actor}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-tea-elevated text-tea-text">
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-tea-text-dim hidden md:table-cell">
                      {entityType}
                    </td>
                    <td className="px-3 md:px-6 py-3 text-tea-text-dim font-mono text-[11px] hidden md:table-cell" title={log.entity_id}>
                      {entityId}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex-shrink-0 px-4 md:px-6 py-2 border-t border-tea-border bg-tea-bg text-[10px] text-tea-text-dim">
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          {filterAction && ` matching "${filterAction}"`}
        </div>
      )}
    </div>
  );
};
