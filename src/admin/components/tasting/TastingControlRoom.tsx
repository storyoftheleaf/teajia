import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { api } from '../../../lib/api';
import {
  STATUS_PILL_BASE,
  STATUS_PILL_VARIANTS,
} from '../../constants';
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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'share', label: 'Share' },
    { key: 'live', label: 'Live' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      {/* Title bar — narrow chrome */}
      <div className="px-4 md:px-6 lg:px-10 max-w-5xl w-full mx-auto h-16 flex items-end pb-3 gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/tasting-events')}
          className="text-tea-text-sec hover:text-tea-text inline-flex items-center gap-1 tap-target -ml-1"
        >
          <ChevronLeft size={16} />
          <span className="text-ui-13">Tasting events</span>
        </button>
        <div className="flex-1 min-w-0 flex items-baseline gap-3 justify-end">
          <h1 className="h2 text-tea-text truncate">
            {isLoading ? 'Loading…' : session?.title || 'Tasting'}
          </h1>
          {isCompleted && (
            <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS.archived}`}>
              Completed
            </span>
          )}
        </div>
      </div>

      {/* Tab strip — bottom-border underline (§6) */}
      <div className="px-4 md:px-6 lg:px-10 max-w-5xl w-full mx-auto flex items-center gap-5 overflow-x-auto hide-scrollbar border-b border-tea-border">
        {tabs.map(t => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTabAndUrl(t.key)}
              className={[
                'shrink-0 py-3 text-ui-12 uppercase tracking-caps font-sans border-b transition-colors -mb-px',
                isActive
                  ? 'text-tea-text border-tea-gold'
                  : 'text-tea-text-sec border-transparent hover:text-tea-text',
              ].join(' ')}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {tab === 'share' && <ShareScreen sessionId={sessionId} sessionTitle={session?.title} />}
        {tab === 'live' && <LiveMatrix sessionId={sessionId} />}
      </div>

      {!isCompleted && (
        <footer className="border-t border-tea-border bg-tea-bg">
          <div className="px-4 md:px-6 lg:px-10 max-w-5xl w-full mx-auto py-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setConfirmComplete(true)}
              className="px-3 py-1.5 rounded-md text-tea-text-sec hover:text-tea-text text-ui-13 transition-colors"
            >
              Complete tasting
            </button>
          </div>
        </footer>
      )}

      {confirmComplete && (
        <div className="fixed inset-0 z-modal bg-tea-bg/80 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="max-w-sm w-full rounded-xl bg-tea-surface border border-tea-border p-6">
            <p className="font-display font-light text-ui-17 text-tea-text mb-2">
              End the session for everyone?
            </p>
            <p className="text-ui-13 text-tea-text-sec mb-6">
              Notes are kept. Guests can still read them later, but no new verdicts can be saved.
            </p>
            <div className="flex items-center justify-between gap-2 pt-4 border-t border-tea-border">
              <button
                type="button"
                onClick={() => setConfirmComplete(false)}
                className="px-3 py-2 rounded-md text-tea-text-sec hover:text-tea-text text-ui-13 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completeMutation.isPending}
                onClick={() => completeMutation.mutate()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
