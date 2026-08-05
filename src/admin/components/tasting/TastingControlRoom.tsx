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
import { Modal } from '../../../components/shared/Modal';
import { TabList, TabPanel, useTabsIds, type TabItem } from '../../../components/shared/Tabs';

type Tab = 'share' | 'live';

interface SessionEnvelope {
  session: { id: string; title?: string | null; status: 'active' | 'completed'; created_by_user_id: string };
}

const TABS: TabItem[] = [
  { id: 'share', label: 'Share' },
  { id: 'live', label: 'Live' },
];

export function TastingControlRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const tabsId = useTabsIds();
  const [confirmComplete, setConfirmComplete] = useState(false);

  // Derived from the URL: no separate state, so browser back/forward stays in sync.
  const tab: Tab = location.pathname.endsWith('/live') ? 'live' : 'share';

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

  const setTab = (next: string) => {
    const base = `/admin/tasting-events/${sessionId}`;
    navigate(next === 'live' ? `${base}/live` : base, { replace: true });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      {/* Title bar, narrow chrome */}
      <header className="px-4 md:px-6 lg:px-10 max-w-5xl w-full mx-auto h-16 flex items-end pb-3 gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/tasting-events')}
          className="text-tea-text-sec hover:text-tea-text inline-flex items-center gap-1 tap-target -ml-1"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span className="text-ui-13">Tasting events</span>
        </button>
        <div className="flex-1 min-w-0 flex items-baseline gap-3 justify-end">
          <h1 className="h2 text-tea-text truncate" aria-busy={isLoading}>
            {isLoading ? 'Loading…' : session?.title || 'Tasting'}
          </h1>
          {isCompleted && (
            <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS.archived}`}>
              Completed
            </span>
          )}
        </div>
      </header>

      {/* Tab strip */}
      <TabList
        tabs={TABS}
        activeId={tab}
        onChange={setTab}
        ariaLabel="Tasting control room sections"
        baseId={tabsId}
        className="px-4 md:px-6 lg:px-10 max-w-5xl w-full mx-auto"
      />

      {/* Body */}
      <main className="flex-1 overflow-auto">
        <TabPanel tabId="share" baseId={tabsId} isActive={tab === 'share'}>
          <ShareScreen sessionId={sessionId} sessionTitle={session?.title} />
        </TabPanel>
        <TabPanel tabId="live" baseId={tabsId} isActive={tab === 'live'}>
          <LiveMatrix sessionId={sessionId} />
        </TabPanel>
      </main>

      {!isCompleted && (
        <footer className="border-t border-tea-border bg-tea-bg">
          <div className="px-4 md:px-6 lg:px-10 max-w-5xl w-full mx-auto py-3 flex items-center justify-end pb-nav-gap lg:pb-3">
            <button
              type="button"
              onClick={() => setConfirmComplete(true)}
              className="tap-target px-3 rounded-md text-tea-text-sec hover:text-tea-text text-ui-13 transition-colors"
            >
              Complete tasting
            </button>
          </div>
        </footer>
      )}

      <Modal
        isOpen={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        title="End the session for everyone?"
        variant="center"
        hideClose
        initialFocus="container"
        disableBackdropClose
      >
        <div className="px-6 pb-6 pt-2">
          <p className="text-ui-13 text-tea-text-sec mb-6">
            Notes are kept. Guests can still read them later, but no new verdicts can be saved.
          </p>
          <div className="flex items-center justify-between gap-2 pt-4 border-t border-tea-border">
            <button
              type="button"
              onClick={() => setConfirmComplete(false)}
              className="tap-target px-3 rounded-md text-tea-text-sec hover:text-tea-text text-ui-13 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate()}
              className="tap-target inline-flex items-center gap-1.5 px-3 rounded-md cta-solid text-ui-12 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {completeMutation.isPending ? 'Ending…' : 'End session'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
