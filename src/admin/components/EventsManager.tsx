import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Calendar, Copy, Bell, Search, X, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEvents } from '../hooks/useEventData';
import { useToast } from './Toast';
import { api } from '../../lib/api';
import { useAppStore } from '../store';
import { EventForm } from './EventForm';
import { TeaEvent, EventStatus } from '../../types/events';

const STATUS_STYLES: Record<EventStatus, string> = {
  draft: 'bg-tea-text-sec/10 text-tea-text-sec',
  active: 'bg-tea-gold/15 text-tea-gold',
  closed: 'bg-tea-text-sec/10 text-tea-text-sec',
  archived: 'bg-tea-text-sec/10 text-tea-text-dim line-through',
  completed: 'bg-emerald-500/10 text-emerald-400',
};

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchRaw.trim().toLowerCase()), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchRaw]);

  const filteredEvents = searchQuery
    ? events.filter(ev => {
        const dateStr = formatEventDate(ev.eventDate).toLowerCase();
        return (
          ev.title.toLowerCase().includes(searchQuery) ||
          (ev.subtitle || '').toLowerCase().includes(searchQuery) ||
          dateStr.includes(searchQuery) ||
          (ev.locationName || '').toLowerCase().includes(searchQuery) ||
          (ev.areaHint || '').toLowerCase().includes(searchQuery) ||
          ev.status.toLowerCase().includes(searchQuery)
        );
      })
    : events;

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-tea-text-sec" size={24} />
      </div>
    );
  }

  return (
    <>
    <div className="sticky top-0 z-dropdown bg-tea-bg/90 backdrop-blur-md border-b border-tea-border flex-shrink-0 flex items-center justify-between h-16 px-4 md:px-6 lg:px-10">
      <h1 className="font-serif font-normal text-2xl lg:text-3xl text-tea-text leading-tight tracking-[0.02em]" style={{ fontFamily: 'var(--font-display)' }}>Events</h1>
      <div className="flex items-center gap-2">
        {activeMembership && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-tea-surface border border-tea-border shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-tea-gold/60" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec truncate max-w-[120px]">
              {activeMembership.account_name}
            </span>
          </div>
        )}
        <button
          onClick={() => navigate('/admin/venues')}
          className="flex items-center gap-1.5 text-sm text-tea-text-sec hover:text-tea-text border border-tea-border px-3 py-2 rounded-md hover:border-tea-gold/40 transition-colors"
        >
          <MapPin size={13} />
          Venues
        </button>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/40 px-4 py-2 rounded-md text-sm transition-colors"
        >
          <Plus size={14} />
          Create Event
        </button>
      </div>
    </div>
    <div className="p-6 max-w-5xl mx-auto overflow-x-hidden">

      {/* Search */}
      {events.length > 0 && (
        <div className="relative mb-6">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
          <input
            type="text"
            value={searchRaw}
            onChange={e => setSearchRaw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setSearchRaw(''); }}
            placeholder="Search by title, date, location, or status…"
            className="w-full pl-9 pr-8 py-2.5 text-sm bg-tea-surface/60 border border-tea-border text-tea-text placeholder:text-tea-text-dim/50 focus:outline-none focus:border-tea-gold/50 transition-colors rounded-sm"
          />
          {searchRaw && (
            <button
              onClick={() => setSearchRaw('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text transition-colors"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Event List */}
      {events.length === 0 ? (
        <div className="py-20 text-center">
          <Calendar className="mx-auto mb-4 text-tea-text-dim/30" size={28} />
          <p className="font-serif italic text-sm text-tea-text-sec mb-6">No gatherings yet.</p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-2 bg-tea-gold text-tea-bg px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-tea-gold-lt transition-colors rounded-sm"
          >
            <Plus size={13} />
            Create your first event
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-tea-text-sec">Nothing matched — try different words.</p>
          <button onClick={() => setSearchRaw('')} className="mt-2 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors">Clear search</button>
        </div>
      ) : (
        <div className="border-t border-tea-border">
          {filteredEvents.map((event, index) => {
            const confirmed = (event as any).confirmedCount || 0;
            const waitlist = (event as any).waitlistCount || 0;
            const requested = (event as any).requestedCount || 0;
            const interest = (event as any).interestCount || 0;
            const seatsRemaining = Math.max(0, event.totalCapacity - confirmed);
            const isFull = seatsRemaining <= 0;
            const isPast = new Date(event.eventDate) < new Date();

            const d = new Date(event.eventDate);
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const dateNum = String(d.getDate()).padStart(2, '0');
            const monthName = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => navigate(`/admin/events/${event.id}`)}
                aria-label={`${event.title}, ${event.status}, ${formatEventDate(event.eventDate)}`}
                className={`flex gap-5 py-5 border-b border-tea-border cursor-pointer hover:opacity-75 transition-opacity group${isPast ? ' opacity-50' : ''}`}
              >
                {/* Date column */}
                <div className="w-14 shrink-0 text-center pt-0.5">
                  <div className="text-[9px] tracking-[0.25em] text-tea-text-dim uppercase">{dayName}</div>
                  <div className={`font-serif text-[30px] font-normal leading-none mt-0.5 ${isPast ? 'text-tea-text-sec' : 'text-tea-text'}`}>{dateNum}</div>
                  <div className="text-[9px] tracking-[0.2em] text-tea-text-dim mt-0.5">{monthName}</div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="font-serif text-base font-medium text-tea-text leading-snug">{event.title}</h3>
                        <span className={`text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5 font-semibold ${STATUS_STYLES[event.status]}`}>
                          {event.status}
                        </span>
                        {requested > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/events/${event.id}?tab=requests`); }}
                            className="flex items-center gap-1 text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 font-semibold uppercase tracking-[0.15em] hover:bg-amber-500/30 transition-colors"
                          >
                            <Bell size={8} className="shrink-0" />
                            {requested}
                          </button>
                        )}
                        {interest > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/events/${event.id}?tab=interest`); }}
                            className="flex items-center gap-1 text-[9px] bg-tea-text-sec/10 text-tea-text-sec px-1.5 py-0.5 font-semibold uppercase tracking-[0.15em] hover:bg-tea-text-sec/20 transition-colors"
                            title="Interest signups"
                          >
                            {interest} interested
                          </button>
                        )}
                      </div>
                      {event.subtitle && (
                        <p className="font-serif italic text-[13px] text-tea-text-sec leading-snug">{event.subtitle}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-tea-text-dim flex-wrap">
                        <span>{timeStr}</span>
                        {(event.areaHint || event.locationName) && (
                          <>
                            <span className="w-[3px] h-[3px] rounded-full bg-tea-text-dim shrink-0" />
                            <span>{event.areaHint ?? event.locationName}</span>
                          </>
                        )}
                        <span className={`ml-auto font-medium tabular-nums ${isFull ? 'text-red-400' : 'text-tea-gold'}`}>
                          {isFull ? 'Full' : `${seatsRemaining}/${event.totalCapacity} seats`}
                          {waitlist > 0 && <span className="text-tea-text-dim ml-1">+{waitlist}</span>}
                        </span>
                      </div>
                    </div>

                    {/* Duplicate button */}
                    <button
                      onClick={(e) => handleDuplicate(e, event)}
                      className="p-2 text-tea-text-dim hover:text-tea-text-sec transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0 mt-0.5"
                      title="Duplicate event"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Event Modal */}
      <EventForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleCreated}
      />

      {/* Duplicate Slug Dialog */}
      {duplicateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDuplicateDialog(null)}>
          <div className="bg-tea-surface border border-tea-border rounded-lg p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-serif text-tea-text mb-1">Duplicate Event</h3>
            <p className="text-xs text-tea-text-sec mb-4">Choose a unique slug for the duplicated event.</p>
            <input
              type="text"
              value={duplicateDialog.slug}
              onChange={e => setDuplicateDialog(prev => prev ? { ...prev, slug: e.target.value } : null)}
              className="w-full bg-tea-bg border border-tea-border rounded px-3 py-2 text-sm text-tea-text font-mono outline-none focus:border-tea-gold/50 mb-4"
              placeholder="event-slug"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleConfirmDuplicate(); if (e.key === 'Escape') setDuplicateDialog(null); }}
            />
            <div className="flex gap-2 justify-between">
              <button onClick={() => setDuplicateDialog(null)} className="px-3 py-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors">Cancel</button>
              <button onClick={handleConfirmDuplicate} disabled={!duplicateDialog.slug.trim()} className="px-4 py-1.5 text-xs bg-tea-gold text-tea-bg rounded hover:bg-tea-gold-lt transition-colors disabled:opacity-40">Duplicate</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};
