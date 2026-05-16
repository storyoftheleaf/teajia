import React, { useState } from 'react';
import { Check, Clock, Star, ChevronDown, ChevronUp, Loader2, Minus, Plus, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useToast } from './Toast';
import { EventAttendee } from '../../types/events';

interface ApprovalCardProps {
  attendee: EventAttendee;
  onRefresh: () => void;
}

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return '';
  }
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({ attendee, onRefresh }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState<'approve' | 'deny' | 'waitlist' | null>(null);
  const [denyExpanded, setDenyExpanded] = useState(false);
  const [denyMessage, setDenyMessage] = useState('');
  const [whatsappNotifyUrl, setWhatsappNotifyUrl] = useState<string | null>(null);

  const requestedGuests = attendee.guestRequests?.length ?? 0;
  const maxGuests = requestedGuests;

  // How many guests to approve: start at however many were requested
  const [approvedGuestCount, setApprovedGuestCount] = useState(requestedGuests);

  const isGolden = attendee.accessTier === 'golden';
  const isReturning = (attendee.sessionsAttended ?? 0) > 0;

  const handleApprove = async () => {
    setLoading('approve');
    try {
      const result: any = await api.events.approveAttendee(attendee.id, {
        approved_guests: approvedGuestCount,
      });
      if (result?.whatsapp_notify_url) setWhatsappNotifyUrl(result.whatsapp_notify_url);
      showToast(`${attendee.fullName} approved`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve', 'error');
    } finally {
      setLoading(null);
    }
  };


  const handleWaitlist = async () => {
    setLoading('waitlist');
    try {
      await api.events.waitlistAttendee(attendee.id);
      showToast(`${attendee.fullName} moved to waitlist`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to move to waitlist', 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleDeny = async () => {
    setLoading('deny');
    try {
      await api.events.denyAttendee(attendee.id, {
        message: denyMessage.trim() || undefined,
      });
      showToast(`${attendee.fullName} denied`, 'info');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to deny', 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className="bg-tea-surface border border-tea-border rounded-md p-4 space-y-3"
    >
      {/* Row 1: Name + meta */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {attendee.customerId ? (
              <button
                onClick={() => navigate(`/admin/people/${attendee.customerId}`)}
                className="text-sm font-medium text-tea-text hover:text-tea-gold transition-colors"
              >
                {attendee.fullName}
              </button>
            ) : (
              <span className="text-sm font-medium text-tea-text">{attendee.fullName}</span>
            )}
            {isGolden && (
              <span className="flex items-center gap-0.5 text-ui-10 text-tea-gold uppercase tracking-[0.12em]">
                <Star size={9} fill="currentColor" /> Golden
              </span>
            )}
            {requestedGuests > 0 && (
              <span className="text-ui-11 text-tea-text-sec">+{requestedGuests} guest{requestedGuests !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-ui-11 text-tea-text-sec">
            {attendee.phoneNumber && <span>{attendee.phoneNumber}</span>}
            <span>{timeAgo(attendee.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Row 2: Guest request descriptions */}
      {attendee.guestRequests && attendee.guestRequests.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attendee.guestRequests.map((gr, i) => (
            <span
              key={i}
              className="text-ui-11 text-tea-text-dim bg-tea-elevated/40 px-2 py-0.5 rounded-md"
            >
              "{gr.nameHint}"
            </span>
          ))}
        </div>
      )}

      {/* Row 3: Journey preview */}
      {isReturning && (
        <div className="border-t border-tea-border pt-2.5 text-ui-11 text-tea-text-sec">
          {attendee.sessionsAttended} session{attendee.sessionsAttended !== 1 ? 's' : ''} attended
          {attendee.favoriteTypes && attendee.favoriteTypes.length > 0 && (
            <span> · fav: {attendee.favoriteTypes.join(', ')}</span>
          )}
        </div>
      )}

      {/* Row 4: Guest count stepper (only if they brought guests) */}
      {requestedGuests > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-ui-11 text-tea-text-sec">Guest slots:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setApprovedGuestCount(Math.max(0, approvedGuestCount - 1))}
              disabled={approvedGuestCount === 0}
              className="w-5 h-5 flex items-center justify-center rounded text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"
            >
              <Minus size={10} />
            </button>
            <span className="text-xs text-tea-text w-4 text-center">{approvedGuestCount}</span>
            <button
              type="button"
              onClick={() => setApprovedGuestCount(Math.min(maxGuests, approvedGuestCount + 1))}
              disabled={approvedGuestCount === maxGuests}
              className="w-5 h-5 flex items-center justify-center rounded text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"
            >
              <Plus size={10} />
            </button>
          </div>
          <span className="text-ui-10 text-tea-text-dim">of {requestedGuests} requested</span>
        </div>
      )}

      {/* Row 5: Actions — collapses to notify button post-approval */}
      {whatsappNotifyUrl ? (
        <div className="flex items-center gap-2 pt-1">
          <a
            href={whatsappNotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 px-3 py-1.5 rounded transition-colors"
          >
            <Check size={11} />
            Notify via WhatsApp
          </a>
          <span className="text-ui-10 text-tea-text-dim">Approved</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            type="button"
            onClick={handleApprove}
            disabled={!!loading}
            className="flex items-center gap-1.5 text-xs bg-tea-gold/15 text-tea-gold hover:bg-tea-gold/25 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
          >
            {loading === 'approve' ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            Approve
          </button>

          <button
            type="button"
            onClick={handleWaitlist}
            disabled={!!loading}
            className="flex items-center gap-1.5 text-xs bg-tea-elevated/50 text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated px-3 py-1.5 rounded transition-colors disabled:opacity-50"
          >
            {loading === 'waitlist' ? <Loader2 size={11} className="animate-spin" /> : <Clock size={11} />}
            Waitlist
          </button>

          <button
            type="button"
            onClick={() => setDenyExpanded(!denyExpanded)}
            disabled={!!loading}
            className="flex items-center gap-1.5 text-xs text-tea-text-dim hover:text-tea-text-sec px-3 py-1.5 rounded transition-colors disabled:opacity-50"
          >
            {denyExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            Deny
          </button>
        </div>
      )}

      {/* Deny message expansion */}
      <AnimatePresence>
        {denyExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-1 space-y-2">
              <textarea
                value={denyMessage}
                onChange={(e) => setDenyMessage(e.target.value)}
                placeholder="Optional note to guest (leave blank for no message)"
                className="w-full border border-tea-border bg-transparent focus:border-tea-gold/50 outline-none text-xs text-tea-text p-2 rounded resize-none placeholder:text-tea-text-dim"
                rows={2}
              />
              <button
                type="button"
                onClick={handleDeny}
                disabled={!!loading}
                className="text-xs text-tea-text-sec hover:text-tea-text px-3 py-1.5 rounded border border-tea-border hover:border-tea-border transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading === 'deny' ? <Loader2 size={11} className="animate-spin" /> : null}
                Confirm Deny
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
