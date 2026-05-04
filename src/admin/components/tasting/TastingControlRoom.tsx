import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { api } from '../../../lib/api';
import { ShareScreen } from './ShareScreen';
import { LiveMatrix } from './LiveMatrix';

type Tab = 'share' | 'live';

interface SessionEnvelope {
  session: { id: string; title?: string | null; status: 'active' | 'completed'; created_by_user_id: string };
}

export function TastingControlRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const initialTab: Tab = location.pathname.endsWith('/live') ? 'live' : 'share';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const { data, isLoading } = useQuery<SessionEnvelope>({
    queryKey: ['session', sessionId],
    queryFn: () => api.sessions.get(sessionId!),
    enabled: !!sessionId,
    staleTime: 5_000,
  });

  const completeMutation = useMutation({
    mutationFn: () => api.sessions.complete(sessionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['tasting-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['tasting-host-live', sessionId] });
      setConfirmComplete(false);
    },
  });

  if (!sessionId) return null;

  const session = data?.session;
  const isCompleted = session?.status === 'completed';

  const setTabAndUrl = (next: Tab) => {
    setTab(next);
    const base = `/admin/tasting-events/${sessionId}`;
    navigate(next === 'live' ? `${base}/live` : base, { replace: true });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-tea-border flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/admin/tasting-events')}
          className="text-tea-text-sec hover:text-tea-text flex items-center gap-1 tap-target"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-ui-13">Tasting events</span>
        </button>

        <div className="flex-1 min-w-0 text-center">
          <p className="font-display font-light text-ui-17 text-tea-text truncate">
            {isLoading ? 'Loading…' : session?.title || 'Tasting'}
          </p>
          {isCompleted && (
            <p className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-sec mt-0.5">
              Completed
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-full bg-tea-elevated p-1">
          {(['share', 'live'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTabAndUrl(t)}
              className={[
                'px-4 py-1.5 rounded-full text-ui-12 tracking-wide transition-colors',
                tab === t ? 'bg-tea-gold text-tea-bg' : 'text-tea-text-sec hover:text-tea-text',
              ].join(' ')}
            >
              {t === 'share' ? 'Share' : 'Live'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {tab === 'share' && <ShareScreen sessionId={sessionId} sessionTitle={session?.title} />}
        {tab === 'live' && <LiveMatrix sessionId={sessionId} />}
      </div>

      {!isCompleted && (
        <footer className="px-6 py-3 border-t border-tea-border flex items-center justify-end">
          <button
            type="button"
            onClick={() => setConfirmComplete(true)}
            className="text-ui-12 text-tea-text-sec hover:text-tea-text"
          >
            Complete tasting
          </button>
        </footer>
      )}

      {confirmComplete && (
        <div className="fixed inset-0 z-50 bg-tea-bg/80 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="max-w-sm w-full rounded-2xl bg-tea-surface border border-tea-border p-6 text-center">
            <p className="font-display font-light text-ui-17 text-tea-text mb-2">
              End the session for everyone?
            </p>
            <p className="text-ui-12 text-tea-text-sec mb-6">
              Notes are kept. Guests can still read them later, but no new verdicts can be saved.
            </p>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setConfirmComplete(false)}
                className="text-ui-13 text-tea-text-sec hover:text-tea-text"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completeMutation.isPending}
                onClick={() => completeMutation.mutate()}
                className="rounded-full bg-tea-gold text-tea-bg px-5 py-2 text-ui-13 tracking-wide disabled:opacity-50"
              >
                {completeMutation.isPending ? 'Ending…' : 'End session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
