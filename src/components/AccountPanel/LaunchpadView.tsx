import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BowlSteam, CalendarBlank, Heart, Tray, ArrowsLeftRight, Wrench, Path, BookOpen, Compass, NotePencil } from '@phosphor-icons/react';

interface LaunchpadTile {
  id: string;
  verb: string;
  hint: string;
  icon: React.ReactNode;
  badge?: number;
  accent?: boolean; // gold border highlight for things that need attention
  onClick: () => void;
}

interface LaunchpadViewProps {
  // Identity
  user: { name?: string; email: string } | null;
  avatarDataUrl: string | null;
  onAvatarClick: () => void;
  roleBadgeLabel: string | null;
  accountName: string | null;
  locationLabel: string | null;

  // Tier
  isOwner: boolean;
  isStaffOrOwner: boolean;
  membershipsCount: number;

  // Signals
  pendingInvoiceCount: number;
  todayEventCount: number;
  inboundUnreadCount: number;
  journalLastAt: string | null;
  journalLastTea: string | null;
  collectionCount: number;
  /** Tea Discovery disposition name, if the onboarding quiz has been taken. */
  dispositionName: string | null;
  nextEvent: { eventDate: string } | null;

  // Actions
  onClose: () => void;
  onOpenJournal: () => void;
  onOpenEvents: () => void;
  onOpenLocationSwitcher: () => void;
  onSignOut: () => void;
}

const ICON_PROPS = { size: 18, weight: 'light' as const };

function formatRelativeShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return diffMin < 1 ? 'just now' : `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return diffDays === 1 ? 'yesterday' : `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatEventDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const Tile: React.FC<LaunchpadTile> = ({ verb, hint, icon, badge, accent, onClick }) => (
  <button
    onClick={onClick}
    className={`group relative w-full min-h-[96px] rounded-xl flex flex-col justify-between text-left p-4 transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/40 ${
      accent
        ? 'bg-tea-surface border border-tea-gold/40 hover:border-tea-gold/60'
        : 'bg-tea-surface border border-tea-border hover:border-tea-gold/30'
    }`}
    style={{
      backgroundImage: accent
        ? 'radial-gradient(circle at 100% 0%, rgb(var(--tea-gold-rgb) / 0.06), transparent 60%)'
        : undefined,
    }}
  >
    {/* Icon + badge */}
    <div className="flex items-start justify-between">
      <div
        className={`shrink-0 transition-colors duration-200 ${
          accent ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
        }`}
      >
        {icon}
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 bg-tea-gold text-tea-bg text-ui-10 font-bold rounded-full flex items-center justify-center leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </div>

    {/* Verb + hint */}
    <div>
      <div
        className={`font-display text-ui-20 leading-[1.05] tracking-[0.01em] lowercase transition-colors duration-200 ${
          accent ? 'text-tea-gold' : 'text-tea-text'
        }`}
      >
        {verb}
      </div>
      <div className="font-sans text-ui-12 text-tea-text-sec mt-1 truncate">
        {hint}
      </div>
    </div>
  </button>
);

/**
 * LaunchpadView — Your Table as a tile launchpad instead of a stat dashboard.
 *
 * Six tiles, tier-gated:
 *   Steep · Sessions · Remember · Inbound · Switch · Workshop
 *
 * Reader/Member sees 4-5 (Switch only if multi-store membership; Workshop hidden).
 * Owner/Admin sees all 6.
 *
 * Each tile is a place you go, not a stat you check — verbs lowercase Cormorant,
 * hint line tells you what's there, badge counts only when actionable.
 */
export const LaunchpadView: React.FC<LaunchpadViewProps> = ({
  user,
  avatarDataUrl,
  onAvatarClick,
  roleBadgeLabel,
  accountName,
  locationLabel,
  isOwner,
  isStaffOrOwner,
  membershipsCount,
  pendingInvoiceCount,
  todayEventCount,
  inboundUnreadCount,
  journalLastAt,
  journalLastTea,
  collectionCount,
  dispositionName,
  nextEvent,
  onClose,
  onOpenJournal,
  onOpenEvents,
  onOpenLocationSwitcher,
  onSignOut,
}) => {
  const navigate = useNavigate();

  const displayName = user?.name || user?.email?.split('@')[0] || 'You';
  const initial = displayName.charAt(0).toUpperCase();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Day-status voice line — picks the most pressing thing and speaks it.
  const dayStatus: string =
    pendingInvoiceCount > 0
      ? pendingInvoiceCount === 1
        ? 'one invoice waiting.'
        : `${pendingInvoiceCount} invoices waiting.`
      : todayEventCount > 0
        ? todayEventCount === 1 ? 'one session today.' : `${todayEventCount} sessions today.`
        : inboundUnreadCount > 0
          ? inboundUnreadCount === 1 ? 'one share to open.' : `${inboundUnreadCount} shares to open.`
          : 'a quiet day.';

  // Tile definitions
  const tiles: LaunchpadTile[] = [
    {
      id: 'steep',
      verb: 'steep',
      hint: journalLastTea
        ? `${journalLastTea} · ${formatRelativeShort(journalLastAt)}`
        : 'begin a session',
      icon: <BowlSteam {...ICON_PROPS} />,
      onClick: onOpenJournal,
    },
    {
      id: 'sessions',
      verb: 'sessions',
      hint: nextEvent ? `next · ${formatEventDay(nextEvent.eventDate)}` : 'none on the books',
      icon: <CalendarBlank {...ICON_PROPS} />,
      badge: todayEventCount > 0 ? todayEventCount : undefined,
      onClick: onOpenEvents,
    },
    {
      id: 'remember',
      verb: 'remember',
      hint: collectionCount > 0
        ? `${collectionCount} tea${collectionCount === 1 ? '' : 's'} kept`
        : 'no favorites yet',
      icon: <Heart {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/account/journey?tab=collection'); },
    },
    {
      id: 'discover',
      verb: 'discover',
      hint: dispositionName ?? 'find your tea',
      icon: <Path {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/discover'); },
    },
    // Collections are the shareable unit. Curators (publish bundle) get their
    // create/manage home; everyone else gets their shelf of collections shared
    // with or saved by them.
    isStaffOrOwner ? {
      id: 'collections',
      verb: 'collections',
      hint: inboundUnreadCount > 0
        ? inboundUnreadCount === 1 ? 'one share to open' : `${inboundUnreadCount} shares to open`
        : 'curate & share',
      icon: <Tray {...ICON_PROPS} />,
      badge: inboundUnreadCount > 0 ? inboundUnreadCount : undefined,
      accent: inboundUnreadCount > 0,
      onClick: () => { onClose(); navigate('/admin/collections'); },
    } as LaunchpadTile : {
      id: 'collections',
      verb: 'collections',
      hint: 'shared with you',
      icon: <Tray {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/account/collections'); },
    } as LaunchpadTile,
    ...(membershipsCount > 1 ? [{
      id: 'switch',
      verb: 'switch',
      hint: `${membershipsCount} table${membershipsCount === 1 ? '' : 's'}`,
      icon: <ArrowsLeftRight {...ICON_PROPS} />,
      onClick: onOpenLocationSwitcher,
    } as LaunchpadTile] : []),
    ...(isOwner ? [{
      id: 'workshop',
      verb: 'workshop',
      hint: pendingInvoiceCount > 0
        ? pendingInvoiceCount === 1 ? 'one invoice pending' : `${pendingInvoiceCount} invoices pending`
        : 'all settled',
      icon: <Wrench {...ICON_PROPS} />,
      badge: pendingInvoiceCount > 0 ? pendingInvoiceCount : undefined,
      accent: pendingInvoiceCount > 0,
      onClick: () => { onClose(); navigate('/admin/dashboard'); },
    } as LaunchpadTile] : []),
    ...(isStaffOrOwner ? [{
      id: 'write',
      verb: 'write',
      hint: 'create an article',
      icon: <NotePencil {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/admin/magazine'); },
    } as LaunchpadTile] : []),
    ...(isOwner ? [{
      id: 'briefing',
      verb: 'walk-throughs',
      hint: 'run it, test it',
      icon: <Compass {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/account/briefing'); },
    } as LaunchpadTile] : []),
    ...(isOwner ? [{
      id: 'docs',
      verb: 'library',
      hint: 'everything we built',
      icon: <BookOpen {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/account/docs'); },
    } as LaunchpadTile] : []),
  ];

  return (
    <div className="px-6 lg:px-12 pt-8 pb-12 max-w-[920px] mx-auto w-full">

      {/* ── Identity zone ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center mb-10">
        {/* Avatar — large, central, the "portrait at the door" */}
        <button
          onClick={onAvatarClick}
          className="relative w-20 h-20 rounded-full bg-tea-surface border border-tea-gold/30 flex items-center justify-center overflow-hidden transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
          aria-label="Edit avatar"
        >
          {avatarDataUrl ? (
            <img src={avatarDataUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-[32px] text-tea-gold leading-none">{initial}</span>
          )}
        </button>

        {/* Name */}
        <div className="font-display text-[22px] text-tea-text mt-4 tracking-[0.01em]">
          {displayName}
        </div>

        {/* Role / location subline */}
        {(roleBadgeLabel || accountName || locationLabel) && (
          <div className="font-sans text-ui-12 text-tea-text-sec mt-1 tracking-[0.04em]">
            {[roleBadgeLabel, accountName, locationLabel].filter(Boolean).join(' · ')}
          </div>
        )}

        {/* Day + voice */}
        <div className="font-sans text-ui-11 text-tea-text-dim uppercase tracking-[0.18em] mt-6">
          {today}
        </div>
        <div className="font-display italic text-[18px] text-tea-text mt-2">
          {dayStatus}
        </div>
      </div>

      {/* ── Tile grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 lg:gap-3">
        {tiles.map(tile => <Tile key={tile.id} {...tile} />)}
      </div>

      {/* ── Footer: sign out (only thing not a tile — it's an exit) ───────── */}
      <div className="flex justify-center mt-10">
        <button
          onClick={onSignOut}
          className="font-sans text-ui-12 text-tea-text-dim hover:text-tea-text-sec tracking-[0.18em] uppercase transition-colors py-3 px-6"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};
