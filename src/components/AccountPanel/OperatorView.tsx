import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, PenLine, Users, Compass, Bookmark, ShoppingBag, Sprout, BookOpen, GraduationCap } from 'lucide-react';
import { SealIcon } from '../Icons';
import {
  ADMIN_TOOL_GROUPS,
  toolsForRole,
  groupTools,
  isRecentlyAdded,
  type AdminTool,
  type AdminToolGroup,
} from '../../admin/toolRegistry';
import {
  NeedsAttention,
  PreviewBlock,
  FOOTER_LINK_CLASS,
  capitalize,
  daysSince,
  daysWord,
  getInitials,
  truncate,
} from './primitives';
import type { TeaEvent } from '../../types/events';

const ICON_PROPS = { size: 13, strokeWidth: 1.5 } as const;
const GROUP_ICON_PROPS = { size: 14, strokeWidth: 1.5 } as const;

const GROUP_ICONS: Record<AdminToolGroup, React.ReactNode> = {
  sell:    <ShoppingBag {...GROUP_ICON_PROPS} />,
  source:  <Sprout {...GROUP_ICON_PROPS} />,
  gather:  <Users {...GROUP_ICON_PROPS} />,
  publish: <BookOpen {...GROUP_ICON_PROPS} />,
  teach:   <GraduationCap {...GROUP_ICON_PROPS} />,
};

interface OperatorViewProps {
  user: { name?: string; email: string } | null;
  avatarDataUrl: string | null;
  onAvatarClick: () => void;
  roleBadgeLabel: string | null;
  accountName: string | null;
  locationLabel: string | null;
  isPlatform: boolean;
  isOwner: boolean;

  // Operational signals
  pendingInvoiceCount: number;
  todayEventCount: number;
  unsyncedJournalCount: number;

  // Personal practice (unified Bench — Adrian IS the shop)
  journalLastAt: string | null;
  journalLastTea: string | null;
  journalLastExcerpt: string | null;
  journalCount: number;
  collectionCount: number;
  compassProfile: string | null;
  journey?: {
    hasLinkedCustomer: boolean;
    sessionsAttended: number;
    totalTeas: number;
    seals: { eventId: string; title: string; date: string; flyerUrl?: string | null }[];
    milestones: string[];
    teaTypeMap: Record<string, number>;
  } | null;
  nextEvent: TeaEvent | null;
  nextEventWithin24h: boolean;

  onClose: () => void;
  onOpenJournal: () => void;
  onOpenEvents: () => void;
  onOpenLocationSwitcher: () => void;
  onSignOut: () => void;
  memberCount: number;
}

/**
 * Synthesizes the operator's current state in one editorial line.
 * Composes a phrase from up to two signals (sessions, invoices, journal,
 * restock, etc.). Always returns a line of prose, never a count dump.
 */
function buildOperatorFrontispiece(args: {
  todayEventCount: number;
  pendingInvoiceCount: number;
  unsyncedJournalCount: number;
  nextEventWithin24h: boolean;
  nextEvent: TeaEvent | null;
}): string {
  const { todayEventCount, pendingInvoiceCount, unsyncedJournalCount } = args;

  const parts: string[] = [];
  if (todayEventCount === 1) parts.push('One session today');
  else if (todayEventCount > 1) parts.push(`${capitalize(daysWord(todayEventCount))} sessions today`);

  if (pendingInvoiceCount === 1) parts.push('one invoice waiting');
  else if (pendingInvoiceCount > 1) parts.push(`${pendingInvoiceCount} invoices waiting`);

  if (parts.length === 0 && unsyncedJournalCount > 0) {
    return `${capitalize(daysWord(unsyncedJournalCount))} note${unsyncedJournalCount === 1 ? '' : 's'} still to sync.`;
  }

  if (parts.length === 0) return 'The bench is clear.';
  if (parts.length === 1) return `${parts[0]}.`;
  return `${parts[0]}, ${parts[1]}.`;
}

function formatTodayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatDaysAgo(n: number): string {
  if (n === 0) return 'Today';
  if (n === 1) return 'Yesterday';
  return `${capitalize(daysWord(n))} days past`;
}

// ── OperatorView ───────────────────────────────────────────────────────────

export const OperatorView: React.FC<OperatorViewProps> = ({
  user,
  avatarDataUrl,
  onAvatarClick,
  roleBadgeLabel,
  accountName,
  locationLabel,
  isPlatform,
  isOwner,
  pendingInvoiceCount,
  todayEventCount,
  unsyncedJournalCount,
  journalLastAt,
  journalLastTea,
  journalLastExcerpt,
  journalCount,
  collectionCount,
  compassProfile,
  journey,
  nextEvent,
  nextEventWithin24h,
  onClose,
  onOpenJournal,
  onOpenEvents,
  onOpenLocationSwitcher,
  onSignOut,
  memberCount,
}) => {
  const navigate = useNavigate();
  const tools = toolsForRole({ isOwner, isPlatform });
  const grouped = groupTools(tools);

  const go = (route: string) => { onClose(); navigate(route); };

  // ── Attention (urgent items, unchanged semantics) ─────────────────────
  const attention: { id: string; label: string; meta?: string; onClick: () => void; urgent?: boolean }[] = [];
  if (todayEventCount > 0) {
    attention.push({
      id: 'today-event',
      label: `${todayEventCount} session${todayEventCount === 1 ? '' : 's'} today`,
      meta: 'Today',
      urgent: true,
      onClick: () => go('/admin/events'),
    });
  }
  if (pendingInvoiceCount > 0) {
    attention.push({
      id: 'pending-invoices',
      label: `${pendingInvoiceCount} invoice${pendingInvoiceCount === 1 ? '' : 's'} pending`,
      meta: 'Review',
      onClick: () => go('/admin/activity'),
    });
  }
  if (unsyncedJournalCount > 0) {
    attention.push({
      id: 'unsynced-journal',
      label: `${unsyncedJournalCount} journal entr${unsyncedJournalCount === 1 ? 'y' : 'ies'} unsynced`,
      onClick: onOpenJournal,
    });
  }

  const frontispiece = buildOperatorFrontispiece({
    todayEventCount,
    pendingInvoiceCount,
    unsyncedJournalCount,
    nextEventWithin24h,
    nextEvent,
  });

  const todayLabel = formatTodayLabel();

  return (
    <div>
      {/* ── Identity — small corner mark with role + account/location ── */}
      <div className="px-6 pt-5 pb-0 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.24em] text-tea-text-sec font-medium">
            {todayLabel}
          </div>
          {accountName && (
            <div className="text-[12px] text-tea-text-sec truncate mt-1.5 tracking-[0.02em]">
              {accountName}{locationLabel ? ` · ${locationLabel}` : ''}
            </div>
          )}
        </div>
        <button
          onClick={onAvatarClick}
          className="w-11 h-11 rounded-full bg-tea-gold/10 flex items-center justify-center border border-tea-border overflow-hidden shrink-0 relative"
          title={user?.name || user?.email || 'Change photo'}
          aria-label="Change photo"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {avatarDataUrl ? (
            <img src={avatarDataUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span className="text-[13px] font-serif text-tea-gold">
              {user ? getInitials(user.name || user.email) : '茶'}
            </span>
          )}
          {roleBadgeLabel && (isOwner || isPlatform) && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-tea-bg border border-tea-border flex items-center justify-center"
              aria-label={roleBadgeLabel}
            >
              <SealIcon className="w-2.5 h-2.5 text-tea-gold" />
            </span>
          )}
        </button>
      </div>

      {/* ── Frontispiece — one editorial line synthesizing current state ── */}
      <div className="px-6 pt-3 pb-2">
        <p
          className="text-[20px] leading-snug text-tea-text italic"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 400 }}
        >
          {frontispiece}
        </p>
      </div>

      {/* ── Attention — urgent items ─────────────────────────────────── */}
      <NeedsAttention items={attention} />

      {/* ── Today's sessions ─────────────────────────────────────────── */}
      {todayEventCount > 0 && (
        <PreviewBlock hint="On the bench" icon={<Calendar {...ICON_PROPS} />} onClick={() => go('/admin/events')}>
          <p className="text-[15px] text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
            {todayEventCount} session{todayEventCount === 1 ? '' : 's'} scheduled today.
          </p>
        </PreviewBlock>
      )}

      {/* ── Pending invoices ─────────────────────────────────────────── */}
      {pendingInvoiceCount > 0 && (
        <PreviewBlock hint="Waiting" icon={<Clock {...ICON_PROPS} />} onClick={() => go('/admin/activity')}>
          <p className="text-[15px] text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
            {pendingInvoiceCount} invoice{pendingInvoiceCount === 1 ? '' : 's'} pending review.
          </p>
        </PreviewBlock>
      )}

      {/* ── Last note — Adrian's own notes are operational knowledge ── */}
      <PreviewBlock hint="Notes" icon={<PenLine {...ICON_PROPS} />} onClick={onOpenJournal}>
        {journalCount > 0 ? (
          <>
            {journalLastExcerpt && (
              <p
                className="text-[15px] leading-snug text-tea-text italic mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                “{truncate(journalLastExcerpt, 120)}”
              </p>
            )}
            <div className="text-[12px] text-tea-text-sec tracking-[0.02em]">
              {journalLastTea && <span className="text-tea-text">{journalLastTea}</span>}
              {journalLastTea && journalLastAt && <span className="text-tea-text-sec"> · </span>}
              {journalLastAt && <span>{formatDaysAgo(daysSince(journalLastAt))}</span>}
              {!journalLastExcerpt && journalCount > 1 && (
                <span className="text-tea-text-sec"> · {journalCount} entries kept</span>
              )}
            </div>
          </>
        ) : (
          <p className="text-[15px] italic text-tea-text-sec" style={{ fontFamily: 'var(--font-display)' }}>
            begin a note
          </p>
        )}
      </PreviewBlock>

      {/* ── Sessions seal strip (if linked customer) ─────────────────── */}
      {journey?.hasLinkedCustomer && journey.seals.length > 0 && (
        <PreviewBlock hint="Gatherings" icon={<Users {...ICON_PROPS} />} onClick={() => go('/account/journey')}>
          <div className="flex items-center gap-1.5 mb-2">
            {journey.seals.slice(-5).map(s => (
              <div
                key={s.eventId}
                className="w-7 h-7 rounded-full border border-tea-border overflow-hidden bg-tea-surface shrink-0"
                title={s.title}
              >
                {s.flyerUrl ? (
                  <img src={s.flyerUrl} alt="" className="w-full h-full object-cover opacity-90" loading="lazy" />
                ) : (
                  <span className="flex items-center justify-center w-full h-full text-[10px] font-serif text-tea-gold/70">茶</span>
                )}
              </div>
            ))}
          </div>
          <div className="text-[12px] text-tea-text-sec tracking-[0.02em]">
            <span className="text-tea-text">{journey.sessionsAttended}</span> gathering{journey.sessionsAttended !== 1 ? 's' : ''}
            {journey.totalTeas > 0 && <span className="text-tea-text-sec"> · {journey.totalTeas} teas past</span>}
          </div>
        </PreviewBlock>
      )}

      {/* ── Compass ──────────────────────────────────────────────────── */}
      {compassProfile && (
        <PreviewBlock hint="Compass" icon={<Compass {...ICON_PROPS} />} onClick={() => go('/compass')}>
          <p
            className="text-[16px] leading-snug text-tea-text italic"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            “{compassProfile}”
          </p>
        </PreviewBlock>
      )}

      {/* ── Collection ───────────────────────────────────────────────── */}
      {collectionCount > 0 && (
        <PreviewBlock hint="Collection" icon={<Bookmark {...ICON_PROPS} />} onClick={() => go('/account/collection')}>
          <p className="text-[15px] text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
            {collectionCount} tea{collectionCount !== 1 ? 's' : ''} kept.
          </p>
        </PreviewBlock>
      )}

      {/* ── Tools — grouped by domain, icon-anchored headers ─────────── */}
      {ADMIN_TOOL_GROUPS.map(group => {
        const list: AdminTool[] = grouped[group.id];
        if (list.length === 0) return null;
        return (
          <div key={group.id} className="border-t border-tea-border pt-7 pb-5">
            <div className="px-6 pb-3">
              <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.22em] text-tea-text font-medium">
                <span className="text-tea-gold/70 shrink-0 flex items-center" aria-hidden="true">{GROUP_ICONS[group.id]}</span>
                <span>{group.label}</span>
              </div>
              <div className="w-8 h-px bg-tea-gold/40 mt-2 ml-[22px]" aria-hidden="true" />
            </div>
            <div className="px-6 flex flex-wrap gap-x-5 gap-y-3">
              {list.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => go(tool.route)}
                  className="text-[14px] text-tea-text-sec hover:text-tea-gold transition-colors tracking-[0.01em] flex items-center gap-1.5 py-1 -my-1"
                  style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
                >
                  {tool.label}
                  {isRecentlyAdded(tool) && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-tea-gold" aria-label="Recently added" />
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* ── Utility footer — quiet text links ────────────────────────── */}
      <div className="px-6 pt-6 pb-[calc(44px+env(safe-area-inset-bottom,0px))] lg:pb-8 border-t border-tea-border mt-3">
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-tea-text-sec tracking-[0.03em]"
        >
          <button
            onClick={() => go('/account/orders')}
            className={FOOTER_LINK_CLASS}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Orders
          </button>
          <span className="text-tea-text-sec" aria-hidden="true">·</span>
          <button
            onClick={onOpenEvents}
            className={FOOTER_LINK_CLASS}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Events attending
          </button>
          {memberCount >= 2 && (
            <>
              <span className="text-tea-text-sec" aria-hidden="true">·</span>
              <button
                onClick={onOpenLocationSwitcher}
                className={FOOTER_LINK_CLASS}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                Switch location · {memberCount}
              </button>
            </>
          )}
          <span className="text-tea-text-sec" aria-hidden="true">·</span>
          <button
            onClick={() => go('/account/settings')}
            className={FOOTER_LINK_CLASS}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Settings
          </button>
        </div>

        <button
          onClick={onSignOut}
          className="mt-6 py-2 -my-2 text-tea-text-sec hover:text-tea-gold transition-colors text-[12px] uppercase tracking-[0.2em] font-medium"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};
