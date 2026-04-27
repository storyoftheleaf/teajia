import React, { useState } from 'react';
import { Bell, Copy, Check, Loader2, Send, CheckCircle, AlertCircle, Clock, Mail, Eye, EyeOff, X } from 'lucide-react';
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
  pending: { icon: <Clock size={10} />, className: 'bg-tea-surface text-tea-text-sec' },
  sent: { icon: <CheckCircle size={10} />, className: 'bg-tea-surface text-tea-text-sec' },
  failed: { icon: <AlertCircle size={10} />, className: 'bg-tea-surface text-tea-text-sec' },
};

function formatEventTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function formatEventDateFull(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/** Compose the invite message template shown in the preview. */
function composeInviteMessage(name: string, event: TeaEvent): string {
  const time = formatEventTime(event.eventDate);
  const date = formatEventDateFull(event.eventDate);
  const rsvpUrl = `${window.location.origin}/event/${event.slug}`;
  const lines = [
    `Hi ${name}! 🍵`,
    ``,
    `You've been approved for *${event.title}* — we're looking forward to having you.`,
    ``,
    `📅 ${date}`,
    `🕐 ${time}`,
    event.areaHint ? `📍 ${event.areaHint}` : null,
    ``,
    `Your confirmation and full details are here:`,
    rsvpUrl,
    ``,
    `See you soon.`,
  ].filter((l): l is string => l !== null);
  return lines.join('\n');
}

/** Compose the reminder message template. */
function generateReminderMessage(name: string, event: TeaEvent): string {
  const time = formatEventTime(event.eventDate);
  const eventUrl = `${window.location.origin}/event/${event.slug}`;
  return `Hi ${name}! 🍵\n\nThis is a reminder about ${event.title} tomorrow at ${time}.\n\nAre you still coming?\n✅ Confirm: ${eventUrl}?action=confirm\n❌ Cancel: ${eventUrl}?action=cancel\n\nLooking forward to seeing you!`;
}

// ── Invite Send Confirmation Modal ────────────────────────────────────────
interface SendConfirmModalProps {
  approvedCount: number;
  previewMessage: string;
  onConfirm: () => void;
  onClose: () => void;
  isSending: boolean;
}

const SendConfirmModal: React.FC<SendConfirmModalProps> = ({
  approvedCount,
  previewMessage,
  onConfirm,
  onClose,
  isSending,
}) => {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div
      className="fixed inset-0 z-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-tea-bg border border-tea-border rounded-md p-6 max-w-md w-full shadow-2xl animate-[scaleIn_0.25s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <Mail size={18} className="text-tea-gold mt-0.5 shrink-0" />
            <button onClick={onClose} className="p-1 text-tea-text-sec hover:text-tea-text transition-colors shrink-0" aria-label="Close">
            <X size={16} />
          </button>
          <div>
              <h3 className="font-serif text-lg text-tea-text mb-1">Send Event Invites</h3>
              <p className="text-sm text-tea-text-sec">
                This will send WhatsApp/email invites to{' '}
                <span className="text-tea-text font-medium">{approvedCount} approved</span>{' '}
                {approvedCount === 1 ? 'attendee' : 'attendees'}.
              </p>
            </div>
          </div>
        </div>

        {/* Preview toggle */}
        <button
          onClick={() => setShowPreview(v => !v)}
          className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-gold transition-colors mb-3"
        >
          {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
          {showPreview ? 'Hide message preview' : 'Preview invite message'}
        </button>

        {showPreview && (
          <div className="mb-4 p-4 bg-tea-surface border border-tea-border rounded-sm">
            <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-2">
              Message template (sent to each attendee)
            </p>
            <pre className="text-xs text-tea-text-sec whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
              {previewMessage}
            </pre>
          </div>
        )}

        <p className="text-xs text-tea-text-dim mb-5">
          Note: actual delivery depends on the connected messaging provider. If none is configured, invites will be queued but not sent.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-tea-surface border border-tea-border text-tea-text text-xs uppercase tracking-[0.15em] rounded-sm hover:bg-tea-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSending}
            className="flex-1 py-2.5 bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.15em] rounded-sm hover:bg-tea-gold-lt disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {isSending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Send size={12} />
            )}
            {isSending ? 'Sending...' : 'Send Now'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ── Invite Email Status Block ─────────────────────────────────────────────
interface InviteStatusBlockProps {
  event: TeaEvent;
  approvedCount: number;
  lastSentAt: string | null;
  onSend: () => void;
}

const InviteStatusBlock: React.FC<InviteStatusBlockProps> = ({
  event,
  approvedCount,
  lastSentAt,
  onSend,
}) => {
  if (lastSentAt) {
    return (
      <div className="mb-6 p-4 bg-tea-surface border border-tea-border rounded-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle size={16} className="text-tea-text-sec mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-tea-text">Invites sent</p>
              <p className="text-xs text-tea-text-sec mt-0.5">
                Sent {new Date(lastSentAt).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={onSend}
            className="text-ui-10 text-tea-text-dim hover:text-tea-text-sec uppercase tracking-[0.1em] transition-colors shrink-0"
          >
            Resend
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 bg-tea-surface border border-tea-border rounded-md">
      <div className="flex items-start gap-3">
        <Mail size={16} className="text-tea-gold/60 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-tea-text mb-1">Event invites not sent</p>
          <p className="text-xs text-tea-text-sec leading-relaxed mb-3">
            Send WhatsApp/email invites to all{' '}
            {approvedCount > 0
              ? <span className="text-tea-text">{approvedCount} approved attendee{approvedCount === 1 ? '' : 's'}</span>
              : 'approved attendees'}{' '}
            with their confirmation link and event details.
          </p>
          <button
            onClick={onSend}
            disabled={approvedCount === 0}
            className="flex items-center gap-1.5 text-xs bg-tea-gold text-tea-bg px-3 py-1.5 rounded-sm hover:bg-tea-gold-lt disabled:opacity-40 transition-colors"
          >
            <Send size={11} />
            Send Invites
          </button>
          {approvedCount === 0 && (
            <p className="text-ui-10 text-tea-text-dim mt-1">
              No approved attendees yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ eventId, event }) => {
  const { showToast } = useToast();
  const { data: notifications = [], refetch } = useEventNotifications(eventId);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [lastInviteSentAt, setLastInviteSentAt] = useState<string | null>(null);
  const [invitesSentCount, setInvitesSentCount] = useState<number | null>(null);

  // Count approved attendees from the notification list (type approval = sent invite context)
  // We approximate: attendees with status === 'sent' are already notified
  const approvedCount = notifications.filter(n => n.type === 'approval').length;

  // Compose the preview message using a placeholder attendee name
  const previewMessage = composeInviteMessage('Guest', event);

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

  const handleSendInvites = async () => {
    setSendingInvites(true);
    try {
      const result = await api.events.sendEventInvites(eventId);
      const sentCount = typeof result?.sent === 'number' ? result.sent : approvedCount;
      setLastInviteSentAt(new Date().toISOString());
      setInvitesSentCount(sentCount);
      setShowSendConfirm(false);
      refetch();
      showToast(`${sentCount} invite${sentCount === 1 ? '' : 's'} sent`, 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to send invites', 'error');
    } finally {
      setSendingInvites(false);
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
        event={event}
        approvedCount={approvedCount || 1}
        lastSentAt={lastInviteSentAt}
        onSend={() => setShowSendConfirm(true)}
      />

      {/* Invite result banner */}
      {invitesSentCount !== null && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-500/8 border border-green-500/20 rounded-md text-xs text-green-400">
          <CheckCircle size={12} className="shrink-0" />
          {invitesSentCount} {invitesSentCount === 1 ? 'invite' : 'invites'} sent successfully.
        </div>
      )}

      {/* Reminders section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 text-xs text-tea-text-sec">
          <span className="font-medium text-tea-text">Reminders</span>
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
                      <span className={`inline-flex items-center gap-1 text-ui-10 uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full ${statusStyle.className}`}>
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
                      className="flex items-center gap-1 text-ui-10 px-2 py-1 rounded border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/30 transition-colors"
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

      {/* Send confirmation modal */}
      {showSendConfirm && (
        <SendConfirmModal
          approvedCount={approvedCount || 1}
          previewMessage={previewMessage}
          onConfirm={handleSendInvites}
          onClose={() => setShowSendConfirm(false)}
          isSending={sendingInvites}
        />
      )}
    </div>
  );
};
