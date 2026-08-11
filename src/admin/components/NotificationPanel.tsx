import React, { useState } from 'react';
import { Bell, Copy, Check, Loader2, CheckCircle, AlertCircle, Clock, Mail } from 'lucide-react';
import { api } from '../../lib/api';
import { useEventNotifications } from '../hooks/useEventData';
import { useToast } from './Toast';
import { TeaEvent, EventNotification } from '../../types/events';

type NotificationStatus = 'pending' | 'sent' | 'failed';

interface NotificationPanelProps {
  eventId: string;
  event: TeaEvent;
}

const STATUS_STYLES: Record<NotificationStatus, { icon: React.ReactNode; className: string }> = {
  pending: { icon: <Clock size={10} />, className: 'bg-tea-surface text-tea-readgold' },
  sent: { icon: <CheckCircle size={10} />, className: 'bg-tea-surface text-tea-green' },
  failed: { icon: <AlertCircle size={10} />, className: 'bg-tea-surface text-tea-error' },
};

// ── Invite Email Status Block ─────────────────────────────────────────────
interface InviteStatusBlockProps {
  approvedCount: number;
}

const InviteStatusBlock: React.FC<InviteStatusBlockProps> = ({
  approvedCount,
}) => {
  return (
    <div className="mb-6 p-4 bg-tea-surface border border-tea-border rounded-md">
      <div className="flex items-start gap-3">
        <Mail size={16} className="text-tea-text-sec mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-tea-text mb-1">Email delivery unavailable</p>
          <p className="text-xs text-tea-text-sec leading-relaxed">
            Automated email delivery is not configured. Copy the prepared reminders below and send them through your current channel
            {approvedCount > 0 ? ` for ${approvedCount} approved attendee${approvedCount === 1 ? '' : 's'}` : ''}.
          </p>
        </div>
      </div>
    </div>
  );
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ eventId }) => {
  const { showToast } = useToast();
  const { data: notifications = [], refetch } = useEventNotifications(eventId);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Count approved attendees from the notification list (type approval = sent invite context)
  // We approximate: attendees with status === 'sent' are already notified
  const approvedCount = notifications.filter(n => n.type === 'approval').length;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.events.createNotifications(eventId);
      refetch();
      showToast('Reminders generated', 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to generate', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const copyMessage = async (notif: EventNotification) => {
    try {
      await navigator.clipboard.writeText(notif.messageTemplate ?? '');
      setCopiedId(notif.id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast('Copied.', 'info');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const copyAllMessages = async () => {
    const pending = notifications.filter(n => n.status === 'pending');
    if (pending.length === 0) {
      showToast('No pending messages to copy', 'info');
      return;
    }
    const allMessages = pending
      .map(n => `--- ${n.attendeeName || 'Guest'} ---\n${n.messageTemplate}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(allMessages);
      showToast(`${pending.length} messages copied`, 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const pendingCount = notifications.filter(n => n.status === 'pending').length;
  const sentCount = notifications.filter(n => n.status === 'sent').length;

  return (
    <div>
      {/* ── Invite send block ── */}
      <InviteStatusBlock
        approvedCount={approvedCount}
      />

      {/* Reminders section header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-4 text-ui-12 text-tea-text-sec flex-wrap">
          <span className="text-tea-text">Reminders</span>
          <span>{notifications.length} total</span>
          <span className="text-tea-text-sec">{pendingCount} pending</span>
          <span className="text-tea-gold">{sentCount} sent</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyAllMessages}
            disabled={pendingCount === 0}
            className="tap-target inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub text-xs transition-colors disabled:opacity-40"
          >
            <Copy size={12} /> Copy All Pending
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="tap-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
            Generate Reminders
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="text-center py-8 text-tea-text-sec text-sm">
          <Bell className="mx-auto mb-2" size={20} />
          <p>No reminders yet</p>
          <p className="text-xs mt-1">Generate check-in reminders for all confirmed attendees</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => {
            const statusStyle = STATUS_STYLES[notif.status as NotificationStatus] ?? STATUS_STYLES.pending;
            return (
              <div key={notif.id} className="bg-tea-surface border border-tea-border rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-tea-text font-medium">{notif.attendeeName || 'Guest'}</span>
                      <span className={`inline-flex items-center gap-1 label-caps px-2 py-0.5 rounded-full ring-1 ring-inset ring-tea-border ${statusStyle.className}`}>
                        {statusStyle.icon}
                        {notif.status}
                      </span>
                    </div>
                    <pre className="text-xs text-tea-text-sec whitespace-pre-wrap font-sans leading-relaxed mt-1 max-h-24 overflow-y-auto">
                      {notif.messageTemplate}
                    </pre>
                    {notif.sentAt && (
                      <span className="text-ui-10 text-tea-text-sec mt-1 block">
                        Sent: {new Date(notif.sentAt).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => copyMessage(notif)}
                      className="tap-target flex items-center gap-1 text-ui-10 px-2 py-1 rounded border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/30 transition-colors"
                    >
                      {copiedId === notif.id ? <Check size={10} className="text-tea-text-sec" /> : <Copy size={10} />}
                      {copiedId === notif.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
