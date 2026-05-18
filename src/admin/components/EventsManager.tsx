import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, Copy, Bell, Search, X, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEvents } from '../hooks/useEventData';
import { useToast } from './Toast';
import { api } from '../../lib/api';
import { useAppStore } from '../store';
import { EventForm } from './EventForm';
import { Modal } from '../../components/shared/Modal';
import { TeaEvent, EventStatus } from '../../types/events';
import { STATUS_PILL_BASE, STATUS_PILL_VARIANTS, type StatusPillVariant } from '../constants';

const statusToVariant = (status: EventStatus): StatusPillVariant => {
  switch (status) {
    case 'active': return 'active';
    case 'archived': return 'archived';
    case 'completed': return 'success';
    case 'closed': return 'archived';
    case 'draft':
    default: return 'draft';
  }
};

type EventFilter = 'upcoming' | 'past' | 'drafts';

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

export const EventsManager: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: events = [], isLoading, refetch } = useEvents();
  const { memberships, activeAccountId } = useAppStore();
  const activeMembership = memberships.find(m => m.account_id === activeAccountId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState<{ event: TeaEvent; slug: string } | null>(null);
  const [searchRaw, setSearchRaw] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<EventFilter>('upcoming');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchRaw.trim().toLowerCase()), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchRaw]);

  const { upcomingCount, pastCount, draftCount, filteredByTab } = useMemo(() => {
    const now = new Date();
    let upcoming = 0, past = 0, drafts = 0;
    for (const ev of events) {
      const isPast = new Date(ev.eventDate) < now;
      if (ev.status === 'draft') drafts++;
      if (isPast) past++;
      if (ev.status !== 'draft' && !isPast) upcoming++;
    }
    const byTab = events.filter(ev => {
      const isPast = new Date(ev.eventDate) < now;
      if (filter === 'drafts') return ev.status === 'draft';
      if (filter === 'past') return isPast;
      return ev.status !== 'draft' && !isPast;
    });
    return { upcomingCount: upcoming, pastCount: past, draftCount: drafts, filteredByTab: byTab };
  }, [events, filter]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return filteredByTab;
    return filteredByTab.filter(ev => {
      const dateStr = formatEventDate(ev.eventDate).toLowerCase();
      return (
        ev.title.toLowerCase().includes(searchQuery) ||
        (ev.subtitle || '').toLowerCase().includes(searchQuery) ||
        dateStr.includes(searchQuery) ||
        (ev.locationName || '').toLowerCase().includes(searchQuery) ||
        (ev.areaHint || '').toLowerCase().includes(searchQuery) ||
        ev.status.toLowerCase().includes(searchQuery)
      );
    });
  }, [filteredByTab, searchQuery]);

  const handleDuplicate = async (e: React.MouseEvent, event: TeaEvent) => {
    e.stopPropagation();
    setDuplicateDialog({ event, slug: `${event.slug}-copy` });
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicateDialog || !duplicateDialog.slug.trim()) return;
    try {
      await api.events.duplicate(duplicateDialog.event.id, duplicateDialog.slug.trim());
      refetch();
      showToast('Event duplicated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to duplicate', 'error');
    } finally {
      setDuplicateDialog(null);
    }
  };

  const handleCreated = (createdEventId?: string) => {
    refetch();
    setIsFormOpen(false);
    if (createdEventId) {
      navigate(`/admin/events/${createdEventId}`);
    }
  };

  return (
    <>
    {/* Sticky header — title + subtitle counts */}
    <div className="sticky top-0 z-dropdown bg-tea-bg/90 backdrop-blur-md border-b border-tea-border flex-shrink-0">
      <div className="px-4 md:px-6 lg:px-10 max-w-5xl mx-auto pt-4 pb-3 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="h2 text-tea-text">Events</h1>
          <div className="label-caps text-tea-text-dim mt-1">
            UPCOMING · {upcomingCount} · PAST · {pastCount}
            {activeMembership && (
              <span className="hidden sm:inline"> · {activeMembership.account_name.toUpperCase()}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/admin/venues')}
            className="tap-target hidden md:inline-flex items-center gap-1.5 px-2.5 rounded-md text-xs text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <MapPin size={13} />
            Venues
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="tap-target inline-flex items-center gap-1.5 px-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors"
          >
            <Plus size={13} />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* Filter tabs — bottom-border underline */}
      <div className="px-4 md:px-6 lg:px-10 max-w-5xl mx-auto flex items-center gap-6 overflow-x-auto hide-scrollbar border-b border-tea-border">
        {([
          { key: 'upcoming', label: 'Upcoming', count: upcomingCount },
          { key: 'past',     label: 'Past',     count: pastCount },
          { key: 'drafts',   label: 'Drafts',   count: draftCount },
        ] as { key: EventFilter; label: string; count: number }[]).map(tab => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              aria-pressed={active}
              className={`tap-target shrink-0 text-xs font-semibold border-b transition-colors -mb-px focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tea-gold/50 ${
                active
                  ? 'text-tea-text border-tea-gold'
                  : 'text-tea-text-sec border-transparent hover:text-tea-text'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-ui-10 text-tea-text-dim font-mono tabular-nums">{tab.count}</span>
            </button>
          );
        })}
      </div>
    </div>

    <div className="px-4 md:px-6 lg:px-10 py-6 max-w-5xl mx-auto overflow-x-hidden">

      {/* Search */}
      {events.length > 0 && (
        <div className="relative mb-5">
          <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
          <input
            type="text"
            value={searchRaw}
            onChange={e => setSearchRaw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setSearchRaw(''); }}
            placeholder="Search by title, date, location, or status…"
            aria-label="Search events"
            className="w-full bg-transparent border-0 border-b border-tea-border rounded-none pl-6 pr-7 py-2 text-ui-14 font-serif text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none transition-colors"
          />
          {searchRaw && (
            <button
              onClick={() => setSearchRaw('')}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Event List */}
      {isLoading && events.length === 0 ? (
        <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden" aria-busy="true" aria-label="Loading events">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="px-5 py-4 animate-pulse flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-2/3 bg-tea-elevated rounded-md" />
                <div className="h-3 w-1/2 bg-tea-elevated/70 rounded-md" />
              </div>
              <div className="h-4 w-16 bg-tea-elevated/70 rounded-full shrink-0" />
            </li>
          ))}
        </ul>
      ) : events.length === 0 ? (
        <div className="py-20 text-center">
          <Calendar className="mx-auto mb-4 text-tea-text-dim/30" size={28} />
          <p className="font-serif italic text-sm text-tea-text-sec mb-6">No gatherings yet.</p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="tap-target inline-flex items-center gap-1.5 px-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
          >
            <Plus size={13} />
            Create First Event
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-tea-text-sec">Nothing matched. Try different words.</p>
          <button onClick={() => setSearchRaw('')} className="mt-2 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors">Clear search</button>
        </div>
      ) : (
        <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
          {filteredEvents.map((event, index) => {
            const confirmed = (event as any).confirmedCount || 0;
            const waitlist = (event as any).waitlistCount || 0;
            const requested = (event as any).requestedCount || 0;
            const interest = (event as any).interestCount || 0;
            const seatsRemaining = Math.max(0, event.totalCapacity - confirmed);
            const isFull = seatsRemaining <= 0;
            const isPast = new Date(event.eventDate) < new Date();

            const d = new Date(event.eventDate);
            const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const variant = statusToVariant(event.status);
            const location = event.areaHint || event.locationName;

            return (
              <motion.li
                key={event.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 12) * 0.04 }}
                className="relative group flex items-center"
              >
                {/* Row body — single real button for navigation. The pending/
                    interest links live in the action cluster as siblings, never
                    nested inside this button. */}
                <button
                  type="button"
                  onClick={() => navigate(`/admin/events/${event.id}`)}
                  aria-label={`${event.title}, ${event.status}, ${formatEventDate(event.eventDate)}`}
                  className={`min-w-0 flex-1 text-left px-5 py-4 hover:bg-tea-accent-sub transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-tea-gold/50 ${isPast ? 'opacity-60' : ''}`}
                >
                  <span className="block font-display text-ui-15 text-tea-text truncate">{event.title}</span>
                  <span className="block text-ui-12 text-tea-text-dim mt-1">
                    {dateLabel} · {timeStr}
                    {location && <span className="truncate"> · {location}</span>}
                    <span className={`tabular-nums ${isFull ? 'text-tea-error' : 'text-tea-text-sec'}`}>
                      {' · '}{isFull ? 'Full' : `${seatsRemaining}/${event.totalCapacity} seats`}
                      {waitlist > 0 && <span className="text-tea-text-dim ml-1">+{waitlist}</span>}
                    </span>
                  </span>
                  {event.subtitle && (
                    <span className="block font-body italic text-ui-12 text-tea-text-sec leading-snug mt-1 truncate">{event.subtitle}</span>
                  )}
                </button>

                <div className="flex items-center gap-2 shrink-0 pr-3">
                  {requested > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/events/${event.id}?tab=requests`)}
                      className="tap-target flex items-center gap-1 text-ui-11 text-tea-gold hover:text-tea-gold-lt transition-colors"
                      title={`${requested} pending requests`}
                    >
                      <Bell size={11} className="shrink-0" aria-hidden="true" />
                      {requested} pending
                    </button>
                  )}
                  {interest > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/events/${event.id}?tab=interest`)}
                      className="tap-target text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors"
                      title="Interest signups"
                    >
                      {interest} interested
                    </button>
                  )}
                  <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS[variant]}`}>
                    {event.status}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDuplicate(e, event)}
                    className="p-2 text-tea-text-dim hover:text-tea-text-sec transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 tap-target"
                    title="Duplicate event"
                    aria-label={`Duplicate ${event.title}`}
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      {/* Create Event Modal */}
      <EventForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleCreated}
      />

      {/* Duplicate Slug Dialog */}
      <Modal
        isOpen={!!duplicateDialog}
        onClose={() => setDuplicateDialog(null)}
        title="Duplicate Event"
        variant="center"
      >
        {duplicateDialog && (
          <>
            <div className="px-6 pt-4 pb-3">
              <p className="text-ui-12 text-tea-text-dim">Choose a unique slug for the duplicate.</p>
            </div>
            <div className="px-6 pb-4">
              <input
                type="text"
                value={duplicateDialog.slug}
                onChange={e => setDuplicateDialog(prev => prev ? { ...prev, slug: e.target.value } : null)}
                className="w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text font-mono placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors"
                placeholder="event-slug"
                aria-label="Duplicate event slug"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleConfirmDuplicate(); }}
              />
            </div>
            <div className="flex justify-between gap-2 px-6 py-4 border-t border-tea-border">
              <button type="button" onClick={() => setDuplicateDialog(null)} className="tap-target px-2 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors">Cancel</button>
              <button type="button" onClick={handleConfirmDuplicate} disabled={!duplicateDialog.slug.trim()} className="tap-target inline-flex items-center gap-1.5 px-3 rounded-md bg-tea-gold text-tea-bg text-ui-12 font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Duplicate</button>
            </div>
          </>
        )}
      </Modal>
    </div>
    </>
  );
};
