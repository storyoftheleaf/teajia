import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BowlSteam, CalendarBlank, Heart, Tray, ArrowsLeftRight, Wrench, Path, BookOpen, Compass, Package, NotePencil, IdentificationCard, Receipt, Storefront, UsersThree } from '@phosphor-icons/react';
import { ADMIN_CONNECTION_ROUTES } from '../navigationConnections';
import { NeedsAttention, daysWord } from './primitives';
import type { TeaMasterReadiness } from '../readiness/teaMasterReadiness';
import type { AttentionItem } from '../../lib/api';
import type { PayAccessTable } from '../profile/types';
import { PayAccessRequestRow, soFarLine } from '../profile/PayAccessPanel';

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
  /**
   * The global account type, which is a narrower thing than owning this shop.
   * An invited tea master owns their table without being platform staff, and
   * the two tiles gated on this open pages that admit platform staff only.
   */
  isPlatformOwner: boolean;
  canPublish: boolean;
  canSell: boolean;
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
  /**
   * Everything the order system is holding for this operator: unanswered
   * requests, orders still to price, reported payments nobody has checked,
   * paid orders not yet sent. Derived in `index.tsx` and passed down.
   *
   * `null` means we do not know yet (still loading, the read failed, or this
   * reader has no operator standing). Only `[]` means nothing is waiting, and
   * only `[]` earns the calm line.
   */
  attentionItems?: AttentionItem[] | null;
  /**
   * What is left before this person is set up as a tea master, both halves of
   * it. `null` when it is not known yet, or when the reader is not a tea master
   * and is not becoming one. Disappears entirely once nothing is left: this is
   * a setup aid, not a permanent dashboard.
   */
  readiness?: TeaMasterReadiness | null;
  /**
   * Pay is private: who asked to see this person's payment details and who
   * already can. `null` when the reader has no public profile, or it is not
   * known yet. The requests get Approve and Decline right here; the rest is a
   * row into the profile page.
   */
  payAccess?: PayAccessTable | null;
  onApprovePayAccess?: (grantId: string) => void;
  onDeclinePayAccess?: (grantId: string) => void;
  payAccessBusy?: boolean;

  // Actions
  onClose: () => void;
  onOpenJournal: () => void;
  onOpenEvents: () => void;
  onOpenCellar: () => void;
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

// ── What needs you ────────────────────────────────────────────────────────
// The order system announces work in four places. This gathers it into one
// list, oldest waiter first, and each row says what kind of waiting it is so
// it can be understood without being opened.

/** At most this many rows; the rest are named by the frontispiece and live in Orders. */
const ATTENTION_ROW_CAP = 6;

/** Past this, a wait has gone on long enough to earn the bronze dot. */
const URGENT_AFTER_HOURS = 48;

const ATTENTION_NOTE: Record<AttentionItem['kind'], string> = {
  request: 'nobody has answered',
  unpriced: 'waiting to be priced',
  claim: 'payment reported, unchecked',
  unsent: 'paid, not sent',
};

function hoursWaiting(iso: string, now: number): number {
  const started = new Date(iso).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, (now - started) / 3600000);
}

/**
 * How long it has waited, as a phrase that can follow a comma.
 * Used for the frontispiece, and as the row meta when the server sends none.
 */
export function waitPhrase(iso: string, now: number = Date.now()): string {
  const hours = hoursWaiting(iso, now);
  if (hours < 1) return 'in the last hour';
  if (hours < 24) {
    const h = Math.floor(hours);
    return h === 1 ? 'for an hour' : `for ${daysWord(h)} hours`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return 'since yesterday';
  if (days < 7) return `for ${daysWord(days)} days`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'for over a week' : `for over ${daysWord(weeks)} weeks`;
}

/**
 * The frontispiece line when we know what is waiting. A sentence, never a
 * count sitting on its own, and warm when the list is empty.
 */
export function buildWaitingLine(items: AttentionItem[], now: number = Date.now()): string {
  if (items.length === 0) return 'the table is clear.';
  const oldest = items.reduce((a, b) =>
    new Date(a.waiting_since).getTime() <= new Date(b.waiting_since).getTime() ? a : b,
  );
  const phrase = waitPhrase(oldest.waiting_since, now);
  if (items.length === 1) return `one waiting, ${phrase}.`;
  return `${daysWord(items.length)} waiting, the oldest ${phrase}.`;
}

/** Oldest waiter first, across all four kinds rather than grouped by kind. */
export function sortByWaiting(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort(
    (a, b) => new Date(a.waiting_since).getTime() - new Date(b.waiting_since).getTime(),
  );
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
        <span className="min-w-[20px] h-5 px-1.5 cta-solid text-ui-10 font-bold rounded-full flex items-center justify-center leading-none">
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
 * LaunchpadView: Your Table as a tile launchpad instead of a stat dashboard.
 *
 * Six tiles, tier-gated:
 *   Steep · Sessions · Remember · Inbound · Switch · Workshop
 *
 * Reader/Member sees 4-5 (Switch only if multi-store membership; Workshop hidden).
 * Owner/Admin sees all 6.
 *
 * Each tile is a place you go, not a stat you check, verbs lowercase Cormorant,
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
  isPlatformOwner,
  canPublish,
  canSell,
  membershipsCount,
  pendingInvoiceCount,
  todayEventCount,
  inboundUnreadCount,
  journalLastAt,
  journalLastTea,
  collectionCount,
  dispositionName,
  nextEvent,
  attentionItems = null,
  readiness = null,
  payAccess = null,
  onApprovePayAccess,
  onDeclinePayAccess,
  payAccessBusy = false,
  onClose,
  onOpenJournal,
  onOpenEvents,
  onOpenCellar,
  onOpenLocationSwitcher,
  onSignOut,
}) => {
  const navigate = useNavigate();

  const displayName = user?.name || user?.email?.split('@')[0] || 'You';
  const initial = displayName.charAt(0).toUpperCase();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Day-status voice line, picks the most pressing thing and speaks it.
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

  // ── What needs you ──────────────────────────────────────────────────────
  // Only an operator ever receives a queue. A member or a signed-in customer
  // is handed `null` and never sees any of this.
  const waiting = React.useMemo(
    () => (attentionItems ? sortByWaiting(attentionItems) : null),
    [attentionItems],
  );
  const shownWaiting = waiting ? waiting.slice(0, ATTENTION_ROW_CAP) : [];
  const waitingIsTruncated = waiting != null && waiting.length > ATTENTION_ROW_CAP;

  const attentionRows = shownWaiting.map(item => ({
    id: `${item.kind}-${item.id}`,
    label: item.label,
    note: ATTENTION_NOTE[item.kind],
    meta: item.meta ?? waitPhrase(item.waiting_since),
    urgent: hoursWaiting(item.waiting_since, Date.now()) >= URGENT_AFTER_HOURS,
    onClick: () => { onClose(); navigate(item.href); },
  }));

  // The frontispiece speaks the queue when it knows it, and stays on the old
  // voice when it does not, so it never claims a calm it has not measured.
  const frontispiece = waiting == null ? dayStatus : buildWaitingLine(waiting);

  // Nothing to finish means nothing to show. A completed checklist that stays on
  // screen turns a setup aid into wallpaper.
  const setupNext = readiness && !readiness.isComplete ? readiness.nextStep : null;

  // The attention block is the one place the panel counts this work. When it
  // is showing, the workshop tile drops its badge rather than offering a
  // second, differently-scoped tally of the same shop.
  const attentionIsShowing = waiting != null && waiting.length > 0;

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
      onClick: () => { onClose(); navigate('/account/collection'); },
    },
    {
      // Stock spine step 4: the personal cellar, tea the user actually owns,
      // with a quantity. Private; distinct from "remember" (favorited shop teas).
      id: 'cellar',
      verb: 'cellar',
      hint: 'tea you own',
      icon: <Package {...ICON_PROPS} />,
      onClick: onOpenCellar,
    },
    {
      id: 'discover',
      verb: 'discover',
      hint: dispositionName ?? 'find your tea',
      icon: <Path {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/discover'); },
    },
    {
      id: 'profile',
      verb: 'profile',
      hint: 'public identity & payment',
      icon: <IdentificationCard {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/account/profile'); },
    },
    ...(canSell ? [{
      id: 'orders',
      verb: 'orders',
      hint: 'sales & fulfillment',
      icon: <Receipt {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/admin/activity?tab=orders'); },
    } as LaunchpadTile] : []),
    // Collections are the shareable unit. Curators (publish bundle) get their
    // create/manage home; everyone else gets their shelf of collections shared
    // with or saved by them.
    canPublish ? {
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
      hint: attentionIsShowing
        ? 'tools & records'
        : pendingInvoiceCount > 0
          ? pendingInvoiceCount === 1 ? 'one invoice pending' : `${pendingInvoiceCount} invoices pending`
          : 'all settled',
      icon: <Wrench {...ICON_PROPS} />,
      badge: !attentionIsShowing && pendingInvoiceCount > 0 ? pendingInvoiceCount : undefined,
      accent: !attentionIsShowing && pendingInvoiceCount > 0,
      onClick: () => { onClose(); navigate('/admin/dashboard'); },
    } as LaunchpadTile] : []),
    ...(canPublish ? [{
      id: 'write',
      verb: 'write',
      hint: 'create an article',
      icon: <NotePencil {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/admin/magazine'); },
    } as LaunchpadTile] : []),
    ...(isOwner ? [{
      // The shop's own record: its name, its contact, its currency, and the
      // control that opens it to buyers. Reachable from here because the setup
      // card that used to point at it goes away once setup is finished, and a
      // tea master still needs to come back and change a tagline in a year.
      id: 'table-settings',
      verb: 'table settings',
      hint: 'your shop\u2019s own details',
      icon: <Storefront {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/admin/account-settings'); },
    } as LaunchpadTile] : []),
    ...(isOwner ? [{
      // Inviting someone to help was reachable only through screens a tea
      // master could not open, so in practice nobody could add their own staff.
      id: 'helpers',
      verb: 'helpers',
      hint: 'who can help run this',
      icon: <UsersThree {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/admin/access'); },
    } as LaunchpadTile] : []),
    ...(isOwner ? [{
      id: 'tea-masters',
      verb: 'tea masters',
      hint: 'profiles & associations',
      icon: <IdentificationCard {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate(ADMIN_CONNECTION_ROUTES.teaMasters); },
    } as LaunchpadTile] : []),
    ...(canPublish ? [{
      id: 'wisdom',
      verb: 'wisdom',
      hint: 'knowledge & relationships',
      icon: <Compass {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate(ADMIN_CONNECTION_ROUTES.wisdom); },
    } as LaunchpadTile] : []),
    // Both destination pages admit platform staff only and say so on arrival,
    // so offering them to a shop owner is offering a door that refuses them.
    ...(isPlatformOwner ? [{
      id: 'briefing',
      verb: 'walk-throughs',
      hint: 'run it, test it',
      icon: <Compass {...ICON_PROPS} />,
      onClick: () => { onClose(); navigate('/account/briefing'); },
    } as LaunchpadTile] : []),
    ...(isPlatformOwner ? [{
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
        {/* Avatar, large, central, the "portrait at the door" */}
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
          {frontispiece}
        </div>
      </div>

      {/* ── Setting up ────────────────────────────────────────────────────
          The first surface that knows about both halves of being a tea master:
          the person who can be paid, and the shop that sells. Present only
          while something is left, and gone the moment it is finished. */}
      {setupNext && readiness && (
        <section className="mb-10" aria-label="Setting up as a Tea Master">
          <div className="font-sans text-ui-11 text-tea-text-dim uppercase tracking-[0.18em] mb-2">
            Setting up
          </div>
          <button
            onClick={() => { onClose(); navigate(setupNext.route); }}
            className="w-full rounded-xl border border-tea-border bg-tea-surface px-4 py-4 text-left transition-colors hover:bg-tea-gold/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <span className="block font-sans text-ui-12 text-tea-text-sec">
              {readiness.completeCount} of {readiness.totalCount} steps done
            </span>
            <span className="mt-1.5 block font-display text-ui-17 text-tea-text">
              {setupNext.label}
            </span>
            <span className="mt-1 block font-sans text-ui-12 text-tea-text-sec leading-[1.5]">
              {setupNext.detail}
            </span>
          </button>
        </section>
      )}

      {/* ── What needs you ────────────────────────────────────────────────
          One list for work the shop announces in four separate places,
          oldest waiter first. Each row says what kind of waiting it is, so
          it reads without being opened. Absent entirely when nothing is
          waiting, the frontispiece above carries that. */}
      {attentionRows.length > 0 && (
        <section className="mb-10" aria-label="What needs you">
          <div className="font-sans text-ui-11 text-tea-text-dim uppercase tracking-[0.18em] mb-2">
            What needs you
          </div>
          <NeedsAttention items={attentionRows} className="" />
          {waitingIsTruncated && (
            <button
              onClick={() => { onClose(); navigate('/admin/activity?tab=orders'); }}
              className="mt-3 py-2 -my-0.5 font-display italic text-ui-15 text-tea-text-sec hover:text-tea-text transition-colors"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              the rest are in orders.
            </button>
          )}
        </section>
      )}

      {/* ── Payment requests ─────────────────────────────────────────────────
          Pay is private, and approval is permanent. Someone pressed Pay on this
          person's page and asked; the answer is given here, once, with Approve
          on the right and Decline on the left. Under it, the two rows that
          carry the rest: who can already see it, and the share link. */}
      {payAccess && (payAccess.pending.length > 0 || payAccess.approved.length > 0 || payAccess.share_link) && (
        <section className="mb-10" aria-label="Payment details requests" data-testid="table-pay-access">
          <div className="font-sans text-ui-11 text-tea-text-dim uppercase tracking-[0.18em] mb-2">
            Payment
          </div>
          {payAccess.pending.length > 0 && (
            <ul className="divide-y divide-tea-border border-t border-tea-border">
              {payAccess.pending.map(grant => (
                <PayAccessRequestRow
                  key={grant.id}
                  grant={grant}
                  busy={Boolean(payAccessBusy)}
                  onApprove={() => onApprovePayAccess?.(grant.id)}
                  onDecline={() => onDeclinePayAccess?.(grant.id)}
                />
              ))}
            </ul>
          )}
          <div className="border-t border-tea-border">
            <button
              type="button"
              onClick={() => { onClose(); navigate('/account/profile#pay-access'); }}
              className="flex min-h-[52px] w-full items-center justify-between border-b border-tea-border text-left"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className="min-w-0"><span className="block font-display text-[24px] leading-[1.08] text-tea-text">People who can see it</span><span className="mt-1 block font-body text-ui-13 italic text-tea-text-sec">{soFarLine(payAccess.approved.length)}</span></span>
            </button>
            <button
              type="button"
              onClick={() => { onClose(); navigate('/account/profile#pay-access'); }}
              className="flex min-h-[52px] w-full items-center justify-between border-b border-tea-border text-left"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className="min-w-0"><span className="block font-display text-[24px] leading-[1.08] text-tea-text">Share pay link</span><span className="mt-1 block font-body text-ui-13 italic text-tea-text-sec">From your table, or from an invoice.</span></span>
            </button>
          </div>
        </section>
      )}

      {/* ── Tile grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 lg:gap-3">
        {tiles.map(tile => <Tile key={tile.id} {...tile} />)}
      </div>

      {/* ── Footer: sign out (only thing not a tile, it's an exit) ───────── */}
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
