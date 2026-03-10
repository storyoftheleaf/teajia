import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Link2, MessageCircle, Lock, Edit3, Loader2, Users, Clock, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { useEvent, useAttendees } from '../hooks/useEventData';
import { useToast } from './Toast';
import { EventForm } from './EventForm';
import { AttendeeTable } from './AttendeeTable';
import { TeaMenuEditor } from './TeaMenuEditor';
import { NotificationPanel } from './NotificationPanel';
import { PostSessionEditor } from './PostSessionEditor';
import { EventStatus } from '../../types/events';

type TabKey = 'attendees' | 'tea-menu' | 'notifications' | 'post-session';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'attendees', label: 'Attendees' },
  { key: 'tea-menu', label: 'Tea Menu' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'post-session', label: 'Post-Session' },
];

const STATUS_STYLES: Record<EventStatus, string> = {
  draft: 'bg-tea-text-dim/10 text-tea-text-dim',
  active: 'bg-tea-gold/15 text-tea-gold',
  closed: 'bg-tea-text-sec/10 text-tea-text-sec',
  archived: 'bg-tea-text-dim/10 text-tea-text-dim line-through',
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
  const { data: event, isLoading, refetch: refetchEvent } = useEvent(id);
  const { data: attendees = [], refetch: refetchAttendees } = useAttendees(id);

  const [activeTab, setActiveTab] = useState<TabKey>('attendees');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [closingRsvp, setClosingRsvp] = useState(false);

  if (isLoading || !event) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-tea-text-dim" size={24} />
      </div>
    );
  }

  const confirmedCount = attendees.filter(a => a.status === 'confirmed').length;
  const waitlistCount = attendees.filter(a => a.status === 'waitlist').length;
  const capacityPct = event.totalCapacity > 0 ? Math.min((confirmedCount / event.totalCapacity) * 100, 100) : 0;

  const eventUrl = `${window.location.origin}/event/${event.slug}`;
  const goldenUrl = `${eventUrl}?access=golden`;
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(`You're invited to ${event.title}!\n\n${eventUrl}`)}`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(label);
      setTimeout(() => setCopiedLink(null), 2000);
      showToast(`${label} copied`, 'info');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/events')}
        className="flex items-center gap-1.5 text-xs text-tea-text-dim hover:text-tea-text transition-colors mb-4"
      >
        <ArrowLeft size={14} /> Back to Events
      </button>

      {/* Header */}
      <div className="bg-tea-surface border border-tea-border rounded-md p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-serif text-tea-text">{event.title}</h1>
              <span className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[event.status]}`}>
                {event.status}
              </span>
            </div>
            {event.subtitle && (
              <p className="text-sm text-tea-text-sec mb-2">{event.subtitle}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-tea-text-dim">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatEventDate(event.eventDate)}
              </span>
              {event.locationName && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {event.locationName}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsEditOpen(true)}
            className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text px-3 py-1.5 border border-tea-border rounded-md hover:border-tea-gold/30 transition-colors shrink-0"
          >
            <Edit3 size={12} /> Edit Event
          </button>
        </div>

        {/* Capacity bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 max-w-[300px]">
            <div className="h-1.5 bg-tea-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-tea-gold rounded-full transition-all duration-500"
                style={{ width: `${capacityPct}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-tea-text-dim">
            <span className="flex items-center gap-1">
              <Users size={11} />
              {confirmedCount}/{event.totalCapacity} confirmed
            </span>
            {waitlistCount > 0 && (
              <span className="text-tea-gold">+{waitlistCount} waitlist</span>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => copyToClipboard(eventUrl, 'Event Link')}
            className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border transition-colors ${
              copiedLink === 'Event Link'
                ? 'border-green-500/30 text-green-400 bg-green-500/5'
                : 'border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/30'
            }`}
          >
            {copiedLink === 'Event Link' ? <Check size={11} /> : <Link2 size={11} />}
            Copy Event Link
          </button>

          <button
            onClick={() => copyToClipboard(goldenUrl, 'Golden Link')}
            className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border transition-colors ${
              copiedLink === 'Golden Link'
                ? 'border-green-500/30 text-green-400 bg-green-500/5'
                : 'border-tea-gold/30 text-tea-gold hover:bg-tea-gold/5'
            }`}
          >
            {copiedLink === 'Golden Link' ? <Check size={11} /> : <Copy size={11} />}
            Copy Golden Link
          </button>

          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/30 transition-colors"
          >
            <MessageCircle size={11} /> Share via WhatsApp
          </a>

          {event.status === 'active' && (
            <button
              onClick={handleCloseRsvp}
              disabled={closingRsvp}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-tea-border text-tea-text-dim hover:text-tea-text hover:border-tea-gold/30 transition-colors"
            >
              {closingRsvp ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />}
              Close RSVP
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-tea-border mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-tea-gold text-tea-gold'
                : 'border-transparent text-tea-text-dim hover:text-tea-text-sec'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'attendees' && (
          <AttendeeTable
            attendees={attendees}
            eventId={event.id}
            onRefresh={refetchAttendees}
          />
        )}
        {activeTab === 'tea-menu' && (
          <TeaMenuEditor eventId={event.id} />
        )}
        {activeTab === 'notifications' && (
          <NotificationPanel eventId={event.id} event={event} />
        )}
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
    </div>
  );
};
