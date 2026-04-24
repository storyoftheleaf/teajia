import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NeedsAttention } from './primitives';
import type { TeaEvent } from '../../types/events';

interface MemberViewProps {
  user: { name?: string; email: string } | null;
  avatarDataUrl: string | null;
  onAvatarClick: () => void;

  journey?: {
    hasLinkedCustomer: boolean;
    sessionsAttended: number;
    totalTeas: number;
    seals: { eventId: string; title: string; date: string; flyerUrl?: string | null }[];
    milestones: string[];
    teaTypeMap: Record<string, number>;
    samples?: unknown[];
    compass?: unknown[];
  } | null;

  journalLastAt: string | null;
  journalLastTea: string | null;
  journalLastExcerpt: string | null;
  journalCount: number;
  collectionCount: number;
  compassProfile: string | null;
  cartCount: number;
  cartIsNew: boolean;

  nextEvent: TeaEvent | null;
  nextEventWithin24h: boolean;
  upcomingEventsCount: number;

  onClose: () => void;
  onOpenJournal: () => void;
  onOpenEvents: () => void;
  onOpenCart: () => void;
  onSignOut: () => void;
}

// ── Editorial helpers ──────────────────────────────────────────────────────

function getInitials(nameOrEmail: string): string {
  return nameOrEmail.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const DAY_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'] as const;
function daysWord(n: number): string {
  return DAY_WORDS[n] ?? String(n);
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/[\s,.;:—-]+$/, '') + '…';
}

/**
 * Synthesizes a single editorial line that describes the member's current
 * state. Never breaks — always returns something warm. Priority: imminent
 * session > recent note > collection > first-visit.
 */
function buildFrontispiece(args: {
  journalLastAt: string | null;
  journalLastTea: string | null;
  nextEvent: TeaEvent | null;
  nextEventWithin24h: boolean;
  collectionCount: number;
}): string {
  const { journalLastAt, journalLastTea, nextEvent, nextEventWithin24h, collectionCount } = args;

  if (nextEventWithin24h && nextEvent) {
    return `${nextEvent.title}, waiting.`;
  }

  if (journalLastAt) {
    const d = daysSince(journalLastAt);
    const subject = journalLastTea ? `the ${journalLastTea}` : 'the last pour';
    if (d === 0) return `A cup today — ${journalLastTea ?? 'noted'}.`;
    if (d === 1) return `A cup yesterday. ${journalLastTea ?? ''}`.trim();
    if (d < 7) return `${capitalize(daysWord(d))} days since ${subject}.`;
    if (d < 14) return `A week past ${subject}.`;
    if (d < 30) return 'A quieter month.';
    return 'Welcome back.';
  }

  if (collectionCount > 0) {
    return 'Your tins are here. Begin where you like.';
  }

  return 'A place is set.';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Shared content-preview block ───────────────────────────────────────────

const PreviewBlock: React.FC<{
  hint: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ hint, onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full text-left px-6 py-5 hover:bg-tea-surface/40 transition-colors border-t border-tea-border"
    style={{ WebkitTapHighlightColor: 'transparent' }}
  >
    <div className="text-[9px] uppercase tracking-[0.28em] text-tea-text-dim mb-2.5">{hint}</div>
    {children}
  </button>
);

// ── MemberView ─────────────────────────────────────────────────────────────

export const MemberView: React.FC<MemberViewProps> = ({
  user,
  avatarDataUrl,
  onAvatarClick,
  journey,
  journalLastAt,
  journalLastTea,
  journalLastExcerpt,
  journalCount,
  collectionCount,
  compassProfile,
  cartCount,
  cartIsNew,
  nextEvent,
  nextEventWithin24h,
  upcomingEventsCount,
  onClose,
  onOpenJournal,
  onOpenEvents,
  onOpenCart,
  onSignOut,
}) => {
  const navigate = useNavigate();
  const go = (route: string) => { onClose(); navigate(route); };

  const attention: { id: string; label: string; meta?: string; onClick: () => void; urgent?: boolean }[] = [];
  if (nextEventWithin24h && nextEvent) {
    attention.push({
      id: 'session-today',
      label: nextEvent.title,
      meta: 'Today',
      urgent: true,
      onClick: () => go(`/event/${nextEvent.slug}`),
    });
  }
  if (cartIsNew && cartCount > 0) {
    attention.push({
      id: 'cart',
      label: `${cartCount} item${cartCount === 1 ? '' : 's'} in your cart`,
      meta: 'Review',
      onClick: onOpenCart,
    });
  }

  const frontispiece = buildFrontispiece({
    journalLastAt,
    journalLastTea,
    nextEvent,
    nextEventWithin24h,
    collectionCount,
  });

  return (
    <div>
      {/* ── Identity — demoted to a small corner mark ─────────────────── */}
      <div className="px-6 pt-5 pb-0 flex justify-end">
        <button
          onClick={onAvatarClick}
          className="w-9 h-9 rounded-full bg-tea-gold/10 flex items-center justify-center border border-tea-border overflow-hidden"
          title={user?.name || user?.email || 'Change photo'}
          aria-label="Change photo"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {avatarDataUrl ? (
            <img src={avatarDataUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span className="text-[11px] font-serif text-tea-gold">
              {user ? getInitials(user.name || user.email) : '茶'}
            </span>
          )}
        </button>
      </div>

      {/* ── Frontispiece — one editorial line of current state ────────── */}
      <div className="px-6 pt-3 pb-2">
        <p
          className="text-[19px] leading-snug text-tea-text italic"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 400 }}
        >
          {frontispiece}
        </p>
      </div>

      {/* ── Attention — urgent items (conditional, collapses to nothing) ── */}
      <NeedsAttention items={attention} />

      {/* ── Last note — the centerpiece. Content preview, not a count. ── */}
      <PreviewBlock hint="Notes" onClick={onOpenJournal}>
        {journalCount > 0 ? (
          <>
            {journalLastExcerpt && (
              <p
                className="text-[14px] leading-snug text-tea-text italic mb-1.5"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                “{truncate(journalLastExcerpt, 120)}”
              </p>
            )}
            <div className="text-[11px] text-tea-text-sec tracking-[0.03em]">
              {journalLastTea && <span className="text-tea-text">{journalLastTea}</span>}
              {journalLastTea && journalLastAt && <span className="text-tea-text-dim"> · </span>}
              {journalLastAt && <span>{capitalize(daysWord(daysSince(journalLastAt)))} days past</span>}
              {!journalLastExcerpt && journalCount > 1 && (
                <span className="text-tea-text-dim"> · {journalCount} entries kept</span>
              )}
            </div>
          </>
        ) : (
          <p
            className="text-[14px] italic text-tea-text-sec"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            begin a note
          </p>
        )}
      </PreviewBlock>

      {/* ── Sessions seal strip — the member's own gatherings ─────────── */}
      {journey?.hasLinkedCustomer && (
        <PreviewBlock hint="Sessions" onClick={() => go('/account/journey')}>
          {journey.seals.length > 0 ? (
            <>
              <div className="flex items-center gap-1.5 mb-2">
                {journey.seals.slice(-5).map(s => (
                  <div
                    key={s.eventId}
                    className="w-7 h-7 rounded-full border border-tea-border overflow-hidden bg-tea-surface shrink-0"
                    title={s.title}
                  >
                    {s.flyerUrl ? (
                      <img src={s.flyerUrl} alt="" className="w-full h-full object-cover opacity-80" loading="lazy" />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-[8px] font-serif text-tea-gold/40">茶</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-tea-text-sec tracking-[0.03em]">
                <span className="text-tea-text">{journey.sessionsAttended}</span> gathering{journey.sessionsAttended !== 1 ? 's' : ''}
                {journey.totalTeas > 0 && <span className="text-tea-text-dim"> · {journey.totalTeas} teas past</span>}
              </div>
            </>
          ) : (
            <p
              className="text-[14px] italic text-tea-text-sec"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              no gatherings yet
            </p>
          )}
        </PreviewBlock>
      )}

      {/* ── Compass — pull-quote, not a row ───────────────────────────── */}
      <PreviewBlock hint="Compass" onClick={() => go('/compass')}>
        {compassProfile ? (
          <p
            className="text-[15px] leading-snug text-tea-text italic"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            “{compassProfile}”
          </p>
        ) : (
          <p
            className="text-[14px] italic text-tea-text-sec"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            find yours
          </p>
        )}
      </PreviewBlock>

      {/* ── Collection ────────────────────────────────────────────────── */}
      <PreviewBlock hint="Collection" onClick={() => go('/account/collection')}>
        {collectionCount > 0 ? (
          <p
            className="text-[14px] text-tea-text"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {collectionCount} tea{collectionCount !== 1 ? 's' : ''} kept.
          </p>
        ) : (
          <p
            className="text-[14px] italic text-tea-text-sec"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            no tins yet
          </p>
        )}
      </PreviewBlock>

      {/* ── Utility footer — all remaining paths, text links only ─────── */}
      <div className="px-6 pt-7 pb-[calc(44px+env(safe-area-inset-bottom,0px))] lg:pb-8 border-t border-tea-border mt-3">
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-tea-text-sec tracking-[0.04em]"
        >
          <button
            onClick={onOpenEvents}
            className="hover:text-tea-gold transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Sessions{upcomingEventsCount > 0 ? ` · ${upcomingEventsCount}` : ''}
          </button>
          <span className="text-tea-text-dim" aria-hidden="true">·</span>
          <button
            onClick={() => go('/account/orders')}
            className="hover:text-tea-gold transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Orders
          </button>
          <span className="text-tea-text-dim" aria-hidden="true">·</span>
          <button
            onClick={() => go('/spaces')}
            className="hover:text-tea-gold transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Our Spaces
          </button>
          <span className="text-tea-text-dim" aria-hidden="true">·</span>
          <button
            onClick={() => go('/magazine')}
            className="hover:text-tea-gold transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Magazine
          </button>
          <span className="text-tea-text-dim" aria-hidden="true">·</span>
          <button
            onClick={() => go('/account/settings')}
            className="hover:text-tea-gold transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Settings
          </button>
        </div>

        <button
          onClick={onSignOut}
          className="mt-6 text-tea-text-sec hover:text-tea-gold transition-colors text-[11px] uppercase tracking-[0.2em] font-medium"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};
