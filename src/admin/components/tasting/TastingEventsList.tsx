import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users, Coffee } from 'lucide-react';
import { api } from '../../../lib/api';
import { STATUS_PILL_BASE, STATUS_PILL_VARIANTS } from '../../constants';

interface SessionRow {
  id: string;
  title?: string | null;
  status: 'active' | 'completed';
  created_at: string;
  completed_at?: string | null;
  member_count: number;
  tea_count: number;
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

export function TastingEventsList() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<{ sessions: SessionRow[] }>({
    queryKey: ['tasting-sessions'],
    queryFn: () => api.sessions.list({ limit: 50 }),
    staleTime: 15_000,
  });

  const sessions = data?.sessions ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-tea-border flex items-center justify-between">
        <h1 className="font-display font-normal text-ui-20 text-tea-text">Tasting events</h1>
        <button
          type="button"
          onClick={() => navigate('/admin/tasting-events/new')}
          className="tap-target rounded-full bg-tea-gold text-tea-bg px-4 py-2 text-ui-13 tracking-wide flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          New
        </button>
      </header>

      <main className="flex-1 overflow-auto px-6 py-6 pb-nav-gap">
        {isLoading && <p role="status" className="text-ui-13 text-tea-text-sec">Loading…</p>}
        {!isLoading && sessions.length === 0 && (
          <div className="max-w-md mx-auto text-center py-16">
            <p className="font-display font-normal text-ui-20 text-tea-text mb-2">
              No tasting events yet
            </p>
            <p className="text-ui-13 text-tea-text-sec">
              Create one to mint a 6-digit code, then have guests scan or type it on their phones.
            </p>
            <button
              type="button"
              onClick={() => navigate('/admin/tasting-events/new')}
              className="tap-target mt-6 rounded-full bg-tea-gold text-tea-bg px-5 py-2 text-ui-13 tracking-wide inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              New tasting event
            </button>
          </div>
        )}

        <ul className="divide-y divide-tea-border">
          {sessions.map(s => {
            const isActive = s.status === 'active';
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/tasting-events/${s.id}`)}
                  className="w-full flex items-center gap-4 py-4 text-left hover:bg-tea-elevated px-3 -mx-3 rounded-xl transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-ui-15 text-tea-text truncate">
                        {s.title || 'Tasting'}
                      </span>
                      <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS[isActive ? 'active' : 'archived']}`}>
                        {isActive ? 'Active' : 'Completed'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-ui-11 text-tea-text-sec tracking-wide">
                      <span className="flex items-center gap-1">
                        <Coffee className="w-3 h-3" aria-hidden="true" />
                        {s.tea_count} tea{s.tea_count !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" aria-hidden="true" />
                        {s.member_count} {s.member_count === 1 ? 'guest' : 'guests'}
                      </span>
                      <span>{formatWhen(s.created_at)}</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
