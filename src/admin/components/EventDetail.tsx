import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Lock, Edit3, Loader2, Users, Clock, MapPin, Share2, Bell, BookOpen, AlarmClock } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { useEvent, useAttendees } from '../hooks/useEventData';
import { useToast } from './Toast';
import { EventForm } from './EventForm';
import { AttendeeTable } from './AttendeeTable';
import { TeaMenuEditor } from './TeaMenuEditor';
import { NotificationPanel } from './NotificationPanel';
import { PostSessionEditor } from './PostSessionEditor';
import { ApprovalCard } from './ApprovalCard';
import { BriefingCardsEditor } from './BriefingCardsEditor';
import { ReminderTimeline } from './ReminderTimeline';
import { ShareSheet } from './ShareSheet';
import { EventStatus, BriefingCard } from '../../types/events';

type TabKey = 'requests' | 'attendees' | 'briefing' | 'reminders' | 'tea-menu' | 'notifications' | 'post-session';

const STATUS_STYLES: Record<EventStatus, string> = {
  draft: 'bg-tea-text-sec/10 text-tea-text-sec',
  active: 'bg-tea-gold/15 text-tea-gold',
  closed: 'bg-tea-text-sec/10 text-tea-text-sec',
  archived: 'bg-tea-text-sec/10 text-tea-text-sec line-through',
};

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: event, isLoading, refetch: refetchEvent } = useEvent(id!);
  const { data: attendees = [], refetch: refetchAttendees } = useAttendees(id!);

  const [activeTab, setActiveTab] = useState<TabKey>('requests');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [closingRsvp, setClosingRsvp] = useState(false);
  const [savingBriefing, setSavingBriefing] = useState(false);
  const [briefingCards, setBriefingCards] = useState<BriefingCard[] | null>(null);

  if (isLoading || !event) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-tea-text-sec" size={24} />
      </div>
    );
  }

  // Sync local briefing state on first load
  if (briefingCards === null && event.briefingCards !== undefined) {
    setBriefingCards(event.briefingCards);
  }
  const localBriefingCards = briefingCards ?? event.briefingCards ?? [];

  const confirmedCount = attendees.filter(a => a.status === 'confirmed').length;
  const waitlistCount = attendees.filter(a => a.status === 'waitlist').length;
  const requestedCount = attendees.filter(a => a.status === 'requested').length;
  const capacityPct = event.totalCapacity > 0 ? Math.min((confirmedCount / event.totalCapacity) * 100, 100) : 0;

  const handleCloseRsvp = async () => {
    if (!confirm('Close RSVPs for this event? Guests will no longer be able to register.')) return;
    setClosingRsvp(true);
    try {
      await api.events.update(event.id, { status: 'closed' });
      refetchEvent();
      showToast('RSVPs closed', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to close', 'error');
    } finally {
      setClosingRsvp(false);
    }
  };

  const handleSaveBriefing = async () => {
    setSavingBriefing(true);
    try {
      await api.events.update(event.id, {
        briefing_cards: JSON.stringify(localBriefingCards),
      });
      showToast('Briefing cards saved', 'success');
      refetchEvent();
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSavingBriefing(false);
    }
  };

  const TABS: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'requests', label: 'Requests', badge: requestedCount },
    { key: 'attendees', label: 'Attendees' },
    { key: 'briefing', label: 'Briefing' },
    { key: 'reminders', label: 'Reminders' },
    { key: 'tea-menu', label: 'Tea Menu' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'post-session', label: 'Post-Session' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/events')}
        className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors mb-4"
      >
        <ArrowLeft size={14} /> Back to Events
      </button>

      {/* Header card */}
      <div className="bg-tea-surface border border-tea-border rounded-md p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-xl font-serif text-tea-text">{event.title}</h1>
              <span className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[event.status]}`}>
                {event.status}
              </span>
              {requestedCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-medium">
                  <Bell size={9} className="shrink-0" />
                  {requestedCount} pending
                </span>
              )}
            </div>
            {event.subtitle && (
              <p className="text-sm text-tea-text-sec mb-2">{event.subtitle}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-tea-text-sec flex-wrap">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatEventDate(event.eventDate)}
              </span>
              {event.areaHint ? (
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {event.areaHint}
                </span>
              ) : event.locationName ? (
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {event.locationName}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsShareOpen(true)}
              className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text px-3 py-1.5 border border-tea-border rounded-md hover:border-tea-gold/30 transition-colors"
            >
              <Share2 size={12} /> Share
            </button>
            <button
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text px-3 py-1.5 border border-tea-border rounded-md hover:border-tea-gold/30 transition-colors"
            >
              <Edit3 size={12} /> Edit
            </button>
          </div>
        </div>

        {/* Capacity bar */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-3">
            {/* Three-segment bar */}
            <div className="flex-1 max-w-[300px]">
              <div className="h-2 bg-tea-bg rounded-full overflow-hidden flex">
                {/* Confirmed — solid gold */}
                <div
                  className="h-full bg-tea-gold transition-all duration-500 flex-shrink-0"
                  style={{ width: `${event.totalCapacity > 0 ? Math.min((confirmedCount / event.totalCapacity) * 100, 100) : 0}%` }}
                />
                {/* Pending approval — lighter, dashed-pattern via repeating gradient */}
                <div
                  className="h-full flex-shrink-0 transition-all duration-500"
                  style={{
                    width: `${event.totalCapacity > 0 ? Math.min((requestedCount / event.totalCapacity) * 100, 100 - Math.min((confirmedCount / event.totalCapacity) * 100, 100)) : 0}%`,
                    background: 'repeating-linear-gradient(90deg, var(--tea-gold) 0px, var(--tea-gold) 3px, transparent 3px, transparent 7px)',
                    opacity: 0.45,
                  }}
                />
                {/* Waitlist — dimmest */}
                <div
                  className="h-full bg-tea-text-sec/25 flex-shrink-0 transition-all duration-500"
                  style={{ width: `${event.totalCapacity > 0 ? Math.min((waitlistCount / event.totalCapacity) * 100, Math.max(0, 100 - Math.min(((confirmedCount + requestedCount) / event.totalCapacity) * 100, 100))) : 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-tea-text-sec flex-wrap">
              <span className="flex items-center gap-1">
                <Users size={11} />
                {confirmedCount}/{event.totalCapacity}
              </span>
              {requestedCount > 0 && (
                <span className="text-tea-text-sec">+{requestedCount} pending</span>
              )}
              {waitlistCount > 0 && (
                <span className="text-tea-text-dim">+{waitlistCount} waitlist</span>
              )}
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px] text-tea-text-dim">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-tea-gold" />
              Confirmed
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ background: 'repeating-linear-gradient(90deg, var(--tea-gold) 0px, var(--tea-gold) 2px, transparent 2px, transparent 5px)', opacity: 0.7 }}
              />
              Pending
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-tea-text-sec/25" />
              Waitlist
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {event.status === 'active' && (
            <button
              onClick={handleCloseRsvp}
              disabled={closingRsvp}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/30 transition-colors"
            >
              {closingRsvp ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />}
              Close RSVP
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative mb-6">
        <div className="flex gap-0.5 border-b border-tea-border overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-tea-gold text-tea-gold'
                  : 'border-transparent text-tea-text-sec hover:text-tea-text-sec'
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${
                  activeTab === tab.key
                    ? 'bg-tea-gold/20 text-tea-gold'
                    : 'bg-amber-500/15 text-amber-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Right-fade scroll indicator */}
        <div className="pointer-events-none absolute right-0 inset-y-0 w-8 bg-gradient-to-l from-tea-surface to-transparent" />
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* ── Requests tab ── */}
        {activeTab === 'requests' && (
          <div>
            {requestedCount === 0 ? (
              <div className="text-center py-12 text-tea-text-sec text-sm">
                <Bell className="mx-auto mb-3 text-tea-text-dim" size={24} />
                <p>No pending requests</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-xl">
                {attendees
                  .filter(a => a.status === 'requested')
                  .map(attendee => (
                    <ApprovalCard
                      key={attendee.id}
                      attendee={attendee}
                      onRefresh={refetchAttendees}
                    />
                  ))
                }
              </div>
            )}
          </div>
        )}

        {/* ── Attendees tab ── */}
        {activeTab === 'attendees' && (
          <AttendeeTable
            attendees={attendees}
            eventId={event.id}
            onRefresh={refetchAttendees}
          />
        )}

        {/* ── Briefing tab ── */}
        {activeTab === 'briefing' && (
          <div className="max-w-xl space-y-4">
            <BriefingCardsEditor
              cards={localBriefingCards}
              onChange={setBriefingCards}
              saving={savingBriefing}
            />
            {localBriefingCards.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveBriefing}
                  disabled={savingBriefing}
                  className="flex items-center gap-2 bg-tea-gold text-tea-bg px-4 py-2 rounded-md text-xs font-medium hover:bg-tea-gold-lt transition-colors disabled:opacity-50"
                >
                  {savingBriefing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save Briefing Cards
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Reminders tab ── */}
        {activeTab === 'reminders' && (
          <div className="max-w-xl">
            <ReminderTimeline event={event} />
          </div>
        )}

        {/* ── Tea Menu tab ── */}
        {activeTab === 'tea-menu' && (
          <TeaMenuEditor eventId={event.id} />
        )}

        {/* ── Notifications tab ── */}
        {activeTab === 'notifications' && (
          <NotificationPanel eventId={event.id} event={event} />
        )}

        {/* ── Post-Session tab ── */}
        {activeTab === 'post-session' && (
          <PostSessionEditor eventId={event.id} />
        )}
      </motion.div>

      {/* Edit Event Modal */}
      <EventForm
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        initialData={event}
        onSuccess={() => {
          refetchEvent();
          setIsEditOpen(false);
        }}
      />

      {/* Share Sheet */}
      {isShareOpen && (
        <ShareSheet
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          event={event}
        />
      )}
    </div>
  );
};
