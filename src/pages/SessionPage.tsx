import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Check, Copy, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api, getTokenClaims } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/shared/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  tea_name: string;
  position: number;
  tea_metadata: TeaMetadata;
}

interface SessionMember {
  user_id: string;
  name: string;
  username?: string;
  joined_at: string;
  completed_at?: string | null;
}

interface MyVerdict {
  session_tea_id: string;
  verdict: string;
  notes?: string;
  tasting_data?: Record<string, unknown>;
}

interface Session {
  id: string;
  title?: string;
  status: 'active' | 'completed';
  invite_token?: string;
  created_by_user_id: string;
}

interface SessionData {
  session: Session;
  teas: SessionTea[];
  members: SessionMember[];
  my_verdicts: MyVerdict[];
}

interface AggregatedVerdict {
  session_tea_id: string;
  user_id: string;
  user_name: string;
  tea_name: string;
  verdict: string;
  notes?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VERDICT_OPTIONS = ['love', 'like', 'neutral', 'pass'] as const;
type VerdictOption = typeof VERDICT_OPTIONS[number];

const VERDICT_LABELS: Record<VerdictOption, string> = {
  love: 'Love',
  like: 'Like',
  neutral: 'Neutral',
  pass: 'Pass',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Session['status'] }) {
  if (status === 'completed') {
    return (
      <span className="text-xs text-tea-text-dim tracking-wide uppercase">
        Completed
      </span>
    );
  }
  return (
    <span className="text-xs text-tea-gold tracking-wide uppercase">
      Active
    </span>
  );
}

function MembersStrip({ members }: { members: SessionMember[] }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-3">
      {members.map((m) => (
        <div
          key={m.user_id}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tea-surface text-sm text-tea-text"
        >
          {m.name || m.username || 'Member'}
          {m.completed_at && (
            <Check className="w-3.5 h-3.5 text-tea-gold flex-shrink-0" strokeWidth={2.5} />
          )}
        </div>
      ))}
    </div>
  );
}

function TeaPhoto({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  if (error || !src) return null;
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
    />
  );
}

interface TeaCardProps {
  tea: SessionTea;
  existingVerdict?: MyVerdict;
  sessionId: string;
  disabled: boolean;
}

function TeaCard({ tea, existingVerdict, sessionId, disabled }: TeaCardProps) {
  const queryClient = useQueryClient();
  const { toasts, dismiss, showError } = useToast();
  const meta = tea.tea_metadata;

  const [selectedVerdict, setSelectedVerdict] = useState<VerdictOption | ''>(
    (existingVerdict?.verdict as VerdictOption) || ''
  );
  const [notes, setNotes] = useState(existingVerdict?.notes || '');
  const [submitted, setSubmitted] = useState(!!existingVerdict);

  // Sync if external data changes (e.g., after refetch)
  useEffect(() => {
    if (existingVerdict) {
      setSelectedVerdict((existingVerdict.verdict as VerdictOption) || '');
      setNotes(existingVerdict.notes || '');
      setSubmitted(true);
    }
  }, [existingVerdict]);

  const mutation = useMutation({
    mutationFn: (data: { verdict: string; notes: string }) =>
      api.sessions.submitVerdict(sessionId, tea.id, data),
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    },
    onError: () => {
      showError('Could not submit verdict — please try again');
    },
  });

  const handleSubmit = () => {
    if (!selectedVerdict) return;
    mutation.mutate({ verdict: selectedVerdict, notes });
  };

  const displayName = meta.name || tea.tea_name;

  return (
    <>
    <ToastContainer toasts={toasts} onDismiss={dismiss} />
    <div className="mx-4 mb-4 rounded-xl bg-tea-surface border border-tea-border overflow-hidden">
      <div className="p-4">
        <div className="flex gap-3">
          {meta.photo && <TeaPhoto src={meta.photo} alt={displayName} />}
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-tea-text leading-snug">{displayName}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {meta.type && (
                <span className="text-xs text-tea-text-sec">{meta.type}</span>
              )}
              {meta.form && (
                <span className="text-xs text-tea-text-dim">{meta.form}</span>
              )}
              {meta.year && (
                <span className="text-xs text-tea-text-dim">{meta.year}</span>
              )}
              {meta.originRegion && (
                <span className="text-xs text-tea-text-dim">{meta.originRegion}</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {VERDICT_OPTIONS.map((v) => {
              const isActive = selectedVerdict === v;
              return (
                <button
                  key={v}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setSelectedVerdict(v);
                    setSubmitted(false);
                  }}
                  className={[
                    'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-tea-gold text-tea-bg'
                      : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text',
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  {VERDICT_LABELS[v]}
                </button>
              );
            })}
          </div>

          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSubmitted(false);
            }}
            disabled={disabled}
            placeholder="notes"
            rows={2}
            className="mt-3 w-full bg-tea-elevated text-tea-text text-sm placeholder-tea-text-dim rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-tea-gold disabled:opacity-50"
          />

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedVerdict || disabled || mutation.isPending}
              className="px-5 py-2 rounded-full text-sm font-medium bg-tea-gold text-tea-bg disabled:opacity-40 transition-opacity"
            >
              {mutation.isPending ? 'Saving...' : submitted ? 'Update' : 'Submit'}
            </button>
            {submitted && !mutation.isPending && (
              <span className="text-xs text-tea-text-dim flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            {mutation.isError && (
              <span className="text-xs text-red-400">Failed — try again</span>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

interface RevealPanelProps {
  sessionId: string;
  teas: SessionTea[];
}

const VERDICT_ORDER: VerdictOption[] = ['love', 'like', 'neutral', 'pass'];

function RevealPanel({ sessionId, teas }: RevealPanelProps) {
  const { data } = useQuery({
    queryKey: ['session-verdicts', sessionId],
    queryFn: () => api.sessions.verdicts(sessionId),
    staleTime: 0,
  });

  const verdicts: AggregatedVerdict[] = data?.verdicts ?? [];

  return (
    <div className="mx-4 mb-6">
      <h2 className="text-sm font-medium text-tea-text-sec uppercase tracking-widest mb-4">Results</h2>
      {teas.map((tea) => {
        const teaVerdicts = verdicts.filter((v) => v.session_tea_id === tea.id);
        const counts: Record<string, number> = {};
        for (const v of teaVerdicts) {
          counts[v.verdict] = (counts[v.verdict] || 0) + 1;
        }
        const total = teaVerdicts.length || 1;
        const displayName = tea.tea_metadata.name || tea.tea_name;

        return (
          <div key={tea.id} className="mb-6 rounded-xl bg-tea-surface border border-tea-border p-4">
            <p className="text-base font-medium text-tea-text mb-3">{displayName}</p>

            <div className="space-y-2 mb-4">
              {VERDICT_ORDER.map((v) => {
                const count = counts[v] || 0;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={v} className="flex items-center gap-2 text-sm">
                    <span className="w-16 text-tea-text-dim text-right flex-shrink-0">
                      {VERDICT_LABELS[v]}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-tea-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full bg-tea-gold transition-all duration-500"
                        style={{ width: count > 0 ? `${pct}%` : '0%' }}
                      />
                    </div>
                    <span className="w-6 text-tea-text-dim flex-shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>

            {teaVerdicts.length > 0 && (
              <div className="space-y-2 border-t border-tea-border pt-3">
                {teaVerdicts.map((v, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-tea-text-sec font-medium min-w-0 flex-shrink-0">
                      {v.user_name}
                    </span>
                    <span className="text-tea-gold-lt flex-shrink-0">{VERDICT_LABELS[v.verdict as VerdictOption] ?? v.verdict}</span>
                    {v.notes && (
                      <span className="text-tea-text-dim min-w-0 truncate">{v.notes}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showReveal, setShowReveal] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery<SessionData>({
    queryKey: ['session', id],
    queryFn: () => api.sessions.get(id!),
    enabled: !!id,
    staleTime: 15_000,
  });

  // Poll every 30 seconds
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
    }, 30_000);
    return () => clearInterval(interval);
  }, [id, queryClient]);

  const joinMutation = useMutation({
    mutationFn: () => api.sessions.join(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => api.sessions.complete(id!),
    onSuccess: () => {
      setShowReveal(true);
      queryClient.invalidateQueries({ queryKey: ['session', id] });
    },
  });

  const handleCopyInvite = useCallback(() => {
    if (!data?.session.invite_token) return;
    const url = `${window.location.origin}/session/join/${data.session.invite_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [data?.session.invite_token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center">
        <p className="text-tea-text-dim text-sm">Loading session...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-tea-text mb-2">Session not found</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-tea-text-dim underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const { session, teas, members, my_verdicts } = data;

  const currentUserId = getTokenClaims()?.sub;
  const currentUserMember = members.find((m) => m.user_id === currentUserId);
  const isCurrentUserHost = !!currentUserId && currentUserId === session.created_by_user_id;

  const isMember = !!currentUserMember;
  const isCompleted = session.status === 'completed';
  const revealVisible = isCompleted || showReveal;

  const verdictMap = new Map(my_verdicts.map((v) => [v.session_tea_id, v]));

  const sortedTeas = [...teas].sort((a, b) => a.position - b.position);

  return (
    <div className="min-h-screen bg-tea-bg pb-[calc(44px+env(safe-area-inset-bottom,0px))]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-tea-bg border-b border-tea-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-shrink-0 -ml-1 p-1 text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-medium text-tea-text truncate">
              {session.title || 'Tasting Session'}
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <StatusBadge status={session.status} />
              <span className="text-xs text-tea-text-dim flex items-center gap-1">
                <Users className="w-3 h-3" />
                {members.length} member{members.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Members strip */}
      {members.length > 0 && <MembersStrip members={members} />}

      {/* Join prompt */}
      {!isMember && user && (
        <div className="mx-4 mb-4 p-4 rounded-xl bg-tea-surface border border-tea-border flex items-center justify-between gap-3">
          <p className="text-sm text-tea-text-sec">You are not in this session yet.</p>
          <button
            type="button"
            onClick={() => joinMutation.mutate()}
            disabled={joinMutation.isPending}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium bg-tea-gold text-tea-bg disabled:opacity-50"
          >
            {joinMutation.isPending ? 'Joining...' : 'Join Session'}
          </button>
        </div>
      )}

      {/* Tea cards */}
      <div className="mt-2">
        {sortedTeas.map((tea) => (
          <TeaCard
            key={tea.id}
            tea={tea}
            existingVerdict={verdictMap.get(tea.id)}
            sessionId={session.id}
            disabled={isCompleted || !isMember}
          />
        ))}
      </div>

      {/* Host controls */}
      {isCurrentUserHost && (
        <div className="mx-4 mb-4 flex flex-wrap gap-3">
          {!isCompleted && (
            <button
              type="button"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="flex-1 min-w-[160px] py-2.5 rounded-full text-sm font-medium bg-tea-gold text-tea-bg disabled:opacity-50 transition-opacity"
            >
              {completeMutation.isPending ? 'Completing...' : 'Complete Session & Reveal'}
            </button>
          )}
          {session.invite_token && (
            <button
              type="button"
              onClick={handleCopyInvite}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-tea-surface border border-tea-border text-tea-text-sec hover:text-tea-text transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied' : 'Share Invite'}
            </button>
          )}
        </div>
      )}

      {/* Reveal panel */}
      {revealVisible && (
        <RevealPanel sessionId={session.id} teas={sortedTeas} />
      )}

      {/* Show reveal for non-host when session is active (if they want to peek) */}
      {!revealVisible && isCompleted === false && isMember && !isCurrentUserHost && (
        <div className="h-4" />
      )}
    </div>
  );
}
