import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Calendar, Copy, Users, Clock, Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEvents } from '../hooks/useEventData';
import { useToast } from './Toast';
import { api } from '../../lib/api';
import { EventForm } from './EventForm';
import { TeaEvent, EventStatus } from '../../types/events';

const STATUS_STYLES: Record<EventStatus, string> = {
  draft: 'bg-tea-text-sec/10 text-tea-text-sec',
  active: 'bg-tea-gold/15 text-tea-gold',
  closed: 'bg-tea-text-sec/10 text-tea-text-sec',
  archived: 'bg-tea-text-sec/10 text-tea-text-sec line-through',
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
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleDuplicate = async (e: React.MouseEvent, event: TeaEvent) => {
    e.stopPropagation();
    const newSlug = prompt('Enter slug for duplicated event:');
    if (!newSlug) return;
    try {
      await api.events.duplicate(event.id, newSlug);
      refetch();
      showToast('Event duplicated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to duplicate', 'error');
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
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-serif text-tea-text tracking-wide">Events</h1>
          <p className="text-xs text-tea-text-sec mt-1 tracking-wide">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 bg-tea-gold text-tea-bg px-4 py-2.5 rounded-md text-sm font-medium hover:bg-tea-gold-lt transition-colors"
        >
          <Plus size={14} />
          Create Event
        </button>
      </div>

      {/* Event List */}
      {events.length === 0 ? (
        <div className="bg-tea-surface border border-tea-border rounded-md p-12 text-center">
          <Calendar className="mx-auto mb-4 text-tea-text-sec" size={32} />
          <p className="text-tea-text-sec text-sm mb-4">No events yet</p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-2 bg-tea-gold text-tea-bg px-4 py-2 rounded-md text-sm font-medium hover:bg-tea-gold-lt transition-colors"
          >
            <Plus size={14} />
            Create your first event
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event, index) => {
            const confirmed = (event as any).confirmedCount || 0;
            const waitlist = (event as any).waitlistCount || 0;
            const requested = (event as any).requestedCount || 0;
            const capacityPct = event.totalCapacity > 0 ? Math.min((confirmed / event.totalCapacity) * 100, 100) : 0;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => navigate(`/admin/events/${event.id}`)}
                className="bg-tea-surface border border-tea-border rounded-md p-4 cursor-pointer hover:border-tea-gold/30 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-medium text-tea-text truncate">{event.title}</h3>
                      <span className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[event.status]}`}>
                        {event.status}
                      </span>
                      {event.format && event.format !== 'private_tasting' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-tea-text-sec/10 text-tea-text-sec capitalize">
                          {event.format.replace(/_/g, ' ')}
                        </span>
                      )}
                      {/* Request count badge */}
                      {requested > 0 && (
                        <span className="flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-medium">
                          <Bell size={9} className="shrink-0" />
                          {requested} request{requested !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {event.subtitle && (
                      <p className="text-xs text-tea-text-sec truncate mb-1">{event.subtitle}</p>
                    )}

                    <div className="flex items-center gap-4 text-[11px] text-tea-text-sec mt-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {formatEventDate(event.eventDate)}
                      </span>
                      {event.areaHint ? (
                        <span className="truncate">{event.areaHint}</span>
                      ) : event.locationName ? (
                        <span className="truncate">{event.locationName}</span>
                      ) : null}
                    </div>

                    {/* Capacity bar */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 max-w-[200px]">
                        <div className="h-1.5 bg-tea-bg rounded-full overflow-hidden">
                          <div
                            className="h-full bg-tea-gold rounded-full transition-all duration-500"
                            style={{ width: `${capacityPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-tea-text-sec flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users size={10} />
                          {confirmed}/{event.totalCapacity}
                        </span>
                        {waitlist > 0 && (
                          <span className="text-tea-gold">+{waitlist} waitlist</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Duplicate button */}
                  <button
                    onClick={(e) => handleDuplicate(e, event)}
                    className="p-2 text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Duplicate event"
                  >
                    <Copy size={14} />
                  </button>
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
    </div>
  );
};
