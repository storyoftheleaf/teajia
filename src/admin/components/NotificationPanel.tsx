import React, { useState } from 'react';
import { Bell, Copy, Check, Loader2, Send, CheckCircle, AlertCircle, Clock } from 'lucide-react';
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
  pending: { icon: <Clock size={10} />, className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  sent: { icon: <CheckCircle size={10} />, className: 'bg-green-500/10 text-green-400 border-green-500/30' },
  failed: { icon: <AlertCircle size={10} />, className: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

function formatEventTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function generateReminderMessage(name: string, event: TeaEvent): string {
  const time = formatEventTime(event.eventDate);
  const eventUrl = `${window.location.origin}/event/${event.slug}`;
  return `Hi ${name}! \u{1F375}\n\nThis is a reminder about ${event.title} tomorrow at ${time}.\n\nAre you still coming?\n\u2705 Confirm: ${eventUrl}?action=confirm\n\u274C Cancel: ${eventUrl}?action=cancel\n\nLooking forward to seeing you!`;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ eventId, event }) => {
  const { showToast } = useToast();
  const { data: notifications = [], refetch } = useEventNotifications(eventId);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.events.createNotifications(eventId);
      refetch();
      showToast('Reminders generated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const copyMessage = async (notif: EventNotification) => {
    try {
      await navigator.clipboard.writeText(notif.messageTemplate);
      setCopiedId(notif.id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast('Copied to clipboard', 'info');
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

  // toggleSent disabled — api.events.updateNotification does not exist.
  // The API only supports createNotifications. Manual status toggling is not available.
  const toggleSent = async (_notif: EventNotification) => {
    showToast('Manual status toggling is not supported by the API', 'info');
  };

  const pendingCount = notifications.filter(n => n.status === 'pending').length;
  const sentCount = notifications.filter(n => n.status === 'sent').length;

  return (
    <div>
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 text-xs text-tea-text-dim">
          <span>{notifications.length} total</span>
          <span className="text-amber-400">{pendingCount} pending</span>
          <span className="text-green-400">{sentCount} sent</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyAllMessages}
            disabled={pendingCount === 0}
            className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text px-3 py-1.5 border border-tea-border rounded-md hover:border-tea-gold/30 transition-colors disabled:opacity-40"
          >
            <Copy size={12} /> Copy All Pending
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs bg-tea-gold text-tea-bg px-3 py-1.5 rounded-md hover:bg-tea-gold-lt transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
            Generate Reminders
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="text-center py-8 text-tea-text-dim text-sm">
          <Bell className="mx-auto mb-2" size={20} />
          <p>No notifications yet</p>
          <p className="text-xs mt-1">Generate check-in reminders for all confirmed attendees</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => {
            const statusStyle = STATUS_STYLES[notif.status];
            return (
              <div key={notif.id} className="bg-tea-surface border border-tea-border rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-tea-text font-medium">{notif.attendeeName || 'Guest'}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full border ${statusStyle.className}`}>
                        {statusStyle.icon}
                        {notif.status}
                      </span>
                    </div>
                    <pre className="text-xs text-tea-text-dim whitespace-pre-wrap font-sans leading-relaxed mt-1 max-h-24 overflow-y-auto">
                      {notif.messageTemplate}
                    </pre>
                    {notif.sentAt && (
                      <span className="text-[10px] text-tea-text-dim mt-1 block">
                        Sent: {new Date(notif.sentAt).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => copyMessage(notif)}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-tea-border text-tea-text-dim hover:text-tea-text hover:border-tea-gold/30 transition-colors"
                    >
                      {copiedId === notif.id ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                      {copiedId === notif.id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => toggleSent(notif)}
                      disabled={loadingId === notif.id}
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${
                        notif.status === 'sent'
                          ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                          : 'border-tea-border text-tea-text-dim hover:text-tea-text hover:border-tea-gold/30'
                      }`}
                    >
                      {loadingId === notif.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Send size={10} />
                      )}
                      {notif.status === 'sent' ? 'Unsend' : 'Mark Sent'}
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
