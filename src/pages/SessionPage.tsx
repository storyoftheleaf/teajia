import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Check, Send } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api, getTokenClaims } from '../lib/api';
import { TastingSession } from '../components/tasting/TastingSession';
import { buildTastingPicksMessage, buildWhatsAppUrl } from '../lib/whatsapp';
import type { TastingData } from '../types';

interface TeaMetadata {
  name?: string;
  type?: string;
  form?: string;
  year?: string | number;
  originRegion?: string;
  photo?: string;
}

interface SessionTea {
  id: string;
  product_id?: string | null;
  tea_name: string;
  position: number;
  tea_metadata: TeaMetadata;
}

interface SessionMember {
  user_id: string;
  name?: string | null;
  username?: string | null;
}

interface MyVerdict {
  session_tea_id: string;
  verdict?: string;
  notes?: string;
  tasting_data?: Record<string, unknown> | null;
}

interface SessionData {
  session: {
    id: string;
    title?: string | null;
    status: 'active' | 'completed';
    created_by_user_id: string;
    account_id: string;
  };
  teas: SessionTea[];
  members: SessionMember[];
  my_verdicts: MyVerdict[];
}

const HOST_WHATSAPP = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '';

function teaPhoto(t: SessionTea): string | null {
  return t.tea_metadata?.photo ?? null;
}

function teaDisplayName(t: SessionTea): string {
  return t.tea_metadata?.name || t.tea_name || 'Tea';
}

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
function romanShort(i: number): string { return ROMAN[i] ?? String(i + 1); }

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTeaId, setActiveTeaId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<SessionData>({
    queryKey: ['session', id],
    queryFn: () => api.sessions.get(id!),
    enabled: !!id,
    staleTime: 5_000,
  });

  // Tighten guest poll to 20s, pause while a tasting modal is open (matches plan).
  useEffect(() => {
    if (!id || activeTeaId) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
    }, 20_000);
    return () => clearInterval(interval);
  }, [id, activeTeaId, queryClient]);

  const sortedTeas = useMemo(
    () => (data?.teas ?? []).slice().sort((a, b) => a.position - b.position),
    [data?.teas]
  );

  const verdictByTea = useMemo(() => {
    const map = new Map<string, MyVerdict>();
    (data?.my_verdicts ?? []).forEach(v => map.set(v.session_tea_id, v));
    return map;
  }, [data?.my_verdicts]);

  const tastedCount = sortedTeas.filter(t => verdictByTea.get(t.id)).length;

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-tea-bg flex items-center justify-center">
        <p className="text-tea-text-sec text-ui-13">Loading session…</p>
      </div>
    );
  }

  if (isError || !data) {
    const msg = (error as any)?.message || 'Session not found';
    return (
      <div className="min-h-dvh bg-tea-bg flex flex-col items-center justify-center px-6 text-center">
        <p className="text-tea-text mb-3">{msg}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-ui-13 text-tea-text-sec hover:text-tea-text underline"
        >
          Back to home
        </button>
      </div>
    );
  }

  const session = data.session;
  const claims = getTokenClaims();
  const guestName = (user?.name?.split(' ')[0] || claims?.name || '').trim() || 'Guest';
  const guestEmail = user?.email || claims?.email || '';

  const activeTea = activeTeaId ? sortedTeas.find(t => t.id === activeTeaId) ?? null : null;

  const handleSendPicks = () => {
    const picks = sortedTeas.flatMap(t => {
      const v = verdictByTea.get(t.id);
      if (!v) return [];
      const td = (v.tasting_data ?? {}) as Record<string, unknown>;
      const wouldBuy = (td as any)?.wouldBuy === true;
      return [{ teaName: teaDisplayName(t), verdict: v.verdict ?? undefined, wouldBuy }];
    });
    if (picks.length === 0) return;
    const msg = buildTastingPicksMessage({
      guestName,
      guestEmail,
      sessionTitle: session.title,
      picks,
    });
    window.open(buildWhatsAppUrl(HOST_WHATSAPP, msg), '_blank');
  };

  return (
    <div className="min-h-dvh bg-tea-bg text-tea-text flex flex-col">
      <header className="sticky top-0 z-10 bg-tea-bg/95 backdrop-blur border-b border-tea-border">
        <div className="flex items-center px-4 py-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Leave"
            className="text-tea-text-sec hover:text-tea-text flex items-center gap-1 tap-target"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-ui-13">Leave</span>
          </button>
          <div className="flex-1 text-center min-w-0 px-2">
            <p className="font-display font-light text-ui-17 text-tea-text truncate">
              {session.title || 'Tasting'}
            </p>
            <p className="text-ui-11 text-tea-text-sec mt-0.5 tracking-wide">
              with Adrian · {sortedTeas.length} tea{sortedTeas.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="w-[68px]" aria-hidden />
        </div>

        <div className="px-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-tea-border overflow-hidden rounded-full">
              <div
                className="h-full bg-tea-gold transition-all duration-500"
                style={{ width: sortedTeas.length ? `${(tastedCount / sortedTeas.length) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-ui-11 text-tea-text-sec tracking-wide">
              {tastedCount} of {sortedTeas.length} tasted
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-32">
        <ul className="space-y-3">
          {sortedTeas.map((tea, i) => {
            const v = verdictByTea.get(tea.id);
            const tasted = !!v;
            return (
              <li key={tea.id}>
                <button
                  type="button"
                  onClick={() => setActiveTeaId(tea.id)}
                  className="w-full flex items-center gap-4 rounded-xl bg-tea-elevated px-4 py-3 text-left hover:bg-tea-surface transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-tea-surface overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {teaPhoto(tea) ? (
                      <img src={teaPhoto(tea)!} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-tea-text-sec text-ui-13">
                        {romanShort(i)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-ui-15 text-tea-text leading-tight truncate">
                      {teaDisplayName(tea)}
                    </p>
                    <p className="text-ui-11 text-tea-text-sec mt-1 tracking-wide truncate">
                      {[tea.tea_metadata?.type, tea.tea_metadata?.year, tea.tea_metadata?.originRegion]
                        .filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span
                    className={[
                      'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                      tasted ? 'bg-tea-gold text-tea-bg' : 'border border-tea-border',
                    ].join(' ')}
                    aria-label={tasted ? 'Tasted' : 'Not yet'}
                  >
                    {tasted && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-center text-ui-11 text-tea-text-sec">
          Stay on this screen until you save.
        </p>
      </main>

      {tastedCount > 0 && (
        <div className="fixed left-0 right-0 bottom-0 px-4 pt-3 pb-nav-gap bg-gradient-to-t from-tea-bg via-tea-bg to-tea-bg/0">
          <button
            type="button"
            onClick={handleSendPicks}
            className="w-full rounded-full bg-tea-gold text-tea-bg py-3 text-ui-15 tracking-wide flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send my picks
          </button>
        </div>
      )}

      {activeTea && (
        <TastingSession
          item={{
            id: activeTea.product_id || activeTea.id,
            name: teaDisplayName(activeTea),
            type: activeTea.tea_metadata?.type,
            image: teaPhoto(activeTea) ?? undefined,
            sourceType: 'session',
            eventId: session.id,
            eventTitle: session.title ?? undefined,
          }}
          showVerdict
          onClose={() => setActiveTeaId(null)}
          onAfterSave={(td: TastingData, verdict, wouldBuy) => {
            const firstNote = td?.notes?.[0];
            const notesText = typeof firstNote === 'string'
              ? firstNote
              : firstNote?.text;
            // wouldBuy is a separate kwarg on TastingSession, not part of TastingData.
            // Stash it into tasting_data so the host live matrix can read it back
            // alongside `quality` from the same field.
            void api.sessions.submitVerdict(session.id, activeTea.id, {
              verdict: verdict ?? undefined,
              would_buy: wouldBuy ?? undefined,
              tasting_data: { ...td, wouldBuy: wouldBuy ?? false },
              notes: notesText,
            }).catch(() => {
              /* journal bridge is the safety net */
            });
            queryClient.invalidateQueries({ queryKey: ['session', session.id] });
          }}
        />
      )}
    </div>
  );
}
