import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, CalendarDays, ClipboardList, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { usePendingAttendees, PendingAttendee } from '../hooks/useEventData';
import { ApprovalCard } from './ApprovalCard';

function formatEventDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getDaysAge(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
}

export const PendingView: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: pendingAttendees = [], isLoading: loadingRSVPs } = usePendingAttendees();

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['invoices-pending-summary'],
    staleTime: 30_000,
    queryFn: async () => {
      const data = (await api.invoices.list(200)) as any[];
      return data.filter((o) => o.status === 'Pending');
    },
  });

  // Group pending RSVPs by eventId — stable unique key, not title+date
  const eventGroups = useMemo(() => {
    const groups = new Map<string, { eventId: string; title: string; date: string; attendees: PendingAttendee[] }>();
    for (const a of pendingAttendees) {
      if (!groups.has(a.eventId)) {
        groups.set(a.eventId, { eventId: a.eventId, title: a.eventTitle, date: a.eventDate, attendees: [] });
      }
      groups.get(a.eventId)!.attendees.push(a);
    }
    return Array.from(groups.values());
  }, [pendingAttendees]);

  const refreshRSVPs = (eventId?: string) => {
    // Invalidate the cross-event pending list
    queryClient.invalidateQueries({ queryKey: ['pending-attendees'] });
    // Invalidate the specific event's attendee cache so EventDetail stays fresh
    if (eventId) {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
    }
    // Invalidate the events list (requested_count badge on event cards)
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  return (
    <div className="flex flex-col gap-8 px-3 md:px-6 py-4 pb-nav-gap">

      {/* Pending Orders */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={14} className="text-tea-text-sec" />
            <span className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec">Pending Orders</span>
            {orders.length > 0 && (
              <span className="text-ui-10 bg-tea-gold/15 text-tea-gold dark:text-tea-gold px-1.5 py-0.5 rounded-full num">
                {orders.length}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/admin/activity?tab=orders')}
            className="flex items-center gap-1 text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            View all <ArrowRight size={12} />
          </button>
        </div>

        {loadingOrders ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin text-tea-text-dim" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-sm text-tea-text-dim py-4">No pending orders.</p>
        ) : (
          <div className="flex flex-col divide-y divide-tea-border rounded-xl border border-tea-border overflow-hidden">
            {orders.map((order) => {
              const total = (Number(order.computed_total) || 0) + (Number(order.shipping_cost_usd) || 0);
              const age = getDaysAge(order.created_at);
              return (
                <div key={order.id} className="flex items-center justify-between px-3 py-2.5 bg-tea-surface hover:bg-tea-elevated transition-colors">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-tea-text truncate">{order.customer_name || '—'}</span>
                    <span className="text-ui-11 text-tea-text-sec num">{order.invoice_number}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {age >= 7 && (
                      <span className="text-ui-10 text-tea-gold dark:text-tea-gold num">{age}d</span>
                    )}
                    {total > 0 && (
                      <span className="text-ui-12 text-tea-text num">
                        ${total.toFixed(2)}
                      </span>
                    )}
                    <span className="badge-status badge-status-gold">Pending</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pending Event RSVPs */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={14} className="text-tea-text-sec" />
          <span className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec">Pending Event RSVPs</span>
          {pendingAttendees.length > 0 && (
            <span className="text-ui-10 bg-tea-gold/15 text-tea-gold dark:text-tea-gold px-1.5 py-0.5 rounded-full num">
              {pendingAttendees.length}
            </span>
          )}
        </div>

        {loadingRSVPs ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin text-tea-text-dim" />
          </div>
        ) : eventGroups.length === 0 ? (
          <p className="text-sm text-tea-text-dim py-4">No pending RSVPs.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {eventGroups.map((group) => (
              <div key={group.eventId}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-tea-text">{group.title}</span>
                    <span className="text-ui-11 text-tea-text-sec">{formatEventDate(group.date)}</span>
                  </div>
                  <button
                    onClick={() => navigate(`/admin/events/${group.eventId}?tab=requests`)}
                    className="flex items-center gap-1 text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors"
                  >
                    Open event <ExternalLink size={11} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {group.attendees.map((attendee) => (
                    <ApprovalCard
                      key={attendee.id}
                      attendee={attendee}
                      onRefresh={() => refreshRSVPs(group.eventId)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
