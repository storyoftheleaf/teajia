import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { api } from '../../../lib/api';
import { TeaPicker } from './TeaPicker';
import { useEvents } from '../../hooks/useEventData';

export function TastingEventForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [eventId, setEventId] = useState(searchParams.get('eventId') || '');
  const { data: events = [], isLoading: eventsLoading, isError: eventsFailed, refetch: reloadEvents } = useEvents();
  const selectedEventAvailable = !eventId || events.some(event => event.id === eventId);
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (picked.length === 0) { setError('Pick at least one tea'); return; }
    if (!selectedEventAvailable) { setError('Choose an available RSVP event or a standalone tasting'); return; }
    setSubmitting(true);
    try {
      const res = await api.sessions.create({
        title: title.trim() || undefined,
        product_ids: picked.map(p => p.id),
        event_id: eventId || undefined,
      });
      const sessionId = res?.session?.id;
      if (!sessionId) throw new Error('Could not create session');
      navigate(`/admin/tasting-events/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="px-4 py-2 border-b border-tea-border flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/admin/tasting-events')}
          className="grid h-11 w-11 place-items-center text-tea-text-sec hover:text-tea-text"
          aria-label="Back to events"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <h1 className={TYPOGRAPHY_CLASSES.h2}>Events</h1>
      </header>

      <form onSubmit={create} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="max-w-xl mx-auto space-y-8">
            <div className="space-y-1">
              <h2 className={TYPOGRAPHY_CLASSES.h3}>Taste together</h2>
              <p className={TYPOGRAPHY_CLASSES.bodyLight}>Share a join code with guests. They can rate each tea as you serve it, and you can see their ratings live.</p>
            </div>
            <label className="block">
              <span className="block text-ui-11 uppercase tracking-[0.14em] text-tea-text-sec mb-2">
                Title (optional)
              </span>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Saturday tasting"
                className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold focus:outline-none py-2 text-ui-17 text-tea-text"
              />
            </label>

            <div className="space-y-2">
              <label className="block">
                <span className="block text-ui-11 uppercase tracking-[0.14em] text-tea-text-sec mb-2">
                  RSVP event (optional)
                </span>
                <select
                  value={eventId}
                  onChange={e => setEventId(e.target.value)}
                  aria-busy={eventsLoading}
                  className="w-full min-h-11 rounded-md border border-tea-border bg-tea-surface px-3 text-ui-14 text-tea-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tea-gold"
                >
                  <option value="">Standalone tasting</option>
                  {eventId && !selectedEventAvailable && (
                    <option value={eventId} disabled>{eventsLoading ? 'Loading RSVP event…' : 'RSVP event unavailable'}</option>
                  )}
                  {events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
                </select>
              </label>
              {eventsFailed && (
                <button type="button" onClick={() => reloadEvents()} className="tap-target text-ui-13 text-tea-text-sec hover:text-tea-text">
                  Retry RSVP events
                </button>
              )}
            </div>

            <div
              role="group"
              aria-labelledby="teas-group-label"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'form-error' : undefined}
            >
              <span
                id="teas-group-label"
                className="block text-ui-11 uppercase tracking-[0.14em] text-tea-text-sec mb-3"
              >
                Teas <span aria-hidden="true" className="text-tea-error">*</span>
                <span className="sr-only">(required)</span>
              </span>
              <TeaPicker picked={picked} onChange={setPicked} />
            </div>

            {error && <p id="form-error" role="alert" className="text-ui-13 text-tea-error">{error}</p>}
          </div>
        </div>

        <footer className="px-6 py-4 border-t border-tea-border flex items-center justify-between pb-nav-gap">
          <button
            type="button"
            onClick={() => navigate('/admin/tasting-events')}
            className="text-tea-text-sec hover:text-tea-text text-ui-13 tap-target"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || picked.length === 0 || !selectedEventAvailable}
            className="btn-primary tap-target"
          >
            {submitting ? 'Creating…' : 'Create group tasting'}
          </button>
        </footer>
      </form>
    </div>
  );
}
