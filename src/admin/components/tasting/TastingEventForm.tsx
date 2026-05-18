import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { api } from '../../../lib/api';
import { TeaPicker } from './TeaPicker';

export function TastingEventForm() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (picked.length === 0) { setError('Pick at least one tea'); return; }
    setSubmitting(true);
    try {
      const res = await api.sessions.create({
        title: title.trim() || undefined,
        product_ids: picked.map(p => p.id),
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
      <header className="px-6 py-4 border-b border-tea-border grid grid-cols-[1fr_auto_1fr] items-center">
        <button
          type="button"
          onClick={() => navigate('/admin/tasting-events')}
          className="text-tea-text-sec hover:text-tea-text flex items-center gap-1 tap-target justify-self-start"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span className="text-ui-13">Tasting events</span>
        </button>
        <h1 className="font-display font-light text-ui-20 text-tea-text">New tasting event</h1>
        <div />
      </header>

      <form onSubmit={create} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="max-w-xl mx-auto space-y-8">
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
            disabled={submitting || picked.length === 0}
            className="tap-target rounded-full bg-tea-gold text-tea-bg px-6 py-2 text-ui-13 tracking-wide disabled:opacity-40"
          >
            {submitting ? 'Creating…' : 'Create event'}
          </button>
        </footer>
      </form>
    </div>
  );
}
