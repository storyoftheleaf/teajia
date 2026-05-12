import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine, Users, Compass, ShoppingBag, Sprout, BookOpen, GraduationCap, Globe } from 'lucide-react';
import { SealIcon } from '../Icons';
import {
  ADMIN_TOOL_GROUPS,
  toolsForRole,
  groupTools,
  isRecentlyAdded,
  type AdminTool,
  type AdminToolGroup,
} from '../../admin/toolRegistry';
import { OPERATOR_SUPPORT_LINKS, type FirstDoorReadiness, type ReadinessState } from './workflows';
import {
  PreviewBlock,
  Instrument,
  ConsoleGrid,
  PrimaryVerb,
  IdentityCard,
  StatusPill,
  capitalize,
  daysSince,
  daysWord,
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
  network: <Globe {...GROUP_ICON_PROPS} />,
};

interface OperatorViewProps {
  user: { name?: string; email: string } | null;
  avatarDataUrl: string | null;
  onAvatarClick: () => void;
  roleBadgeLabel: string | null;
  accountName: string | null;
  locationLabel: string | null;
  activeStoreSlug: string;
  currencyLabel: string | null;
  isFirstDoorCandidate: boolean;
  firstDoorReadiness: FirstDoorReadiness;
  isPlatform: boolean;
  isOwner: boolean;

  // Operational signals
  pendingInvoiceCount: number;
  todayEventCount: number;
  unsyncedJournalCount: number;
  inboundUnreadCount: number;

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

function readinessLabel(state: ReadinessState): string {
  if (state === 'done') return 'Done';
  if (state === 'next') return 'Next';
  return 'Open';
}

// ── OperatorView ───────────────────────────────────────────────────────────

export const OperatorView: React.FC<OperatorViewProps> = ({
  user,
  avatarDataUrl,
  onAvatarClick,
  roleBadgeLabel,
  accountName,
  locationLabel,
  activeStoreSlug,
  currencyLabel,
  isFirstDoorCandidate,
  firstDoorReadiness,
  isPlatform,
  isOwner,
  pendingInvoiceCount,
  todayEventCount,
  unsyncedJournalCount,
  inboundUnreadCount,
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

  // ── Urgency resolution — exactly one tile may be urgent ───────────
  // Priority: today's sessions > pending invoices > inbound collections
  // > unsynced journal. The same key drives both the bronze-fill on the
  // matching Instrument and the bordered/filled variant of PrimaryVerb,
  // so the screen always carries exactly one bronze moment.
  type UrgentKey =
    | 'today-event'
    | 'pending-invoices'
    | 'inbound-collections'
    | 'unsynced-journal'
    | null;

  const urgentKey: UrgentKey =
    todayEventCount > 0 ? 'today-event'
    : pendingInvoiceCount > 0 ? 'pending-invoices'
    : inboundUnreadCount > 0 ? 'inbound-collections'
    : unsyncedJournalCount > 0 ? 'unsynced-journal'
    : null;

  const primaryVerb: { label: string; onClick: () => void } | null = (() => {
    if (urgentKey === 'today-event') {
      return {
        label: todayEventCount === 1 ? 'Open today’s session' : `Open ${todayEventCount} sessions today`,
        onClick: () => go('/admin/events'),
      };
    }
    if (urgentKey === 'pending-invoices') {
      return {
        label: pendingInvoiceCount === 1 ? 'Review 1 invoice' : `Review ${pendingInvoiceCount} invoices`,
        onClick: () => go('/admin/activity'),
      };
    }
    if (urgentKey === 'inbound-collections') {
      return {
        label: inboundUnreadCount === 1 ? 'Open shared collection' : `Open ${inboundUnreadCount} shared collections`,
        onClick: () => go('/admin/collections'),
      };
    }
    if (urgentKey === 'unsynced-journal') {
      return {
        label: 'Sync notes',
        onClick: onOpenJournal,
      };
    }
    if (journalCount === 0) {
      return { label: 'Begin a note', onClick: onOpenJournal };
    }
    return { label: 'Open inventory', onClick: () => go('/admin/inventory') };
  })();

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
          <div className="label-caps text-tea-text-dim">
            {todayLabel}
          </div>
          {accountName && (
            <div className="text-ui-12 text-tea-text-sec truncate mt-1.5">
              {accountName}{locationLabel ? ` · ${locationLabel}` : ''}
            </div>
          )}
        </div>
        <button
          onClick={onAvatarClick}
          className="w-12 h-12 rounded-full bg-tea-elevated flex items-center justify-center border border-tea-border overflow-hidden shrink-0 relative"
          title={user?.name || user?.email || 'Change photo'}
          aria-label="Change photo"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {avatarDataUrl ? (
            <img src={avatarDataUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span className="font-display text-ui-15 text-tea-text-sec">
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
        <p className="font-body italic text-ui-17 leading-snug text-tea-text">
          {frontispiece}
        </p>
      </div>

      {/* ── Console — asymmetric instrument deck ─────────────────────
          One hero tile across the top + four smaller tiles in a 2×2
          beneath it. The hero is whichever signal is urgent; if nothing
          is urgent, Today anchors the deck (showing "—" is part of the
          language, not an error state). Exactly one tile may carry
          bronze fill; the PrimaryVerb below picks up the bronze when the
          deck is silent. */}
      {(() => {
        const tiles = {
          today: (
            <Instrument
              key="today"
              value={todayEventCount}
              label="Today"
              sublabel="sessions"
              urgent={urgentKey === 'today-event'}
              onClick={() => go('/admin/events')}
            />
          ),
          invoices: (
            <Instrument
              key="invoices"
              value={pendingInvoiceCount}
              label="Invoices"
              sublabel="pending"
              urgent={urgentKey === 'pending-invoices'}
              onClick={() => go('/admin/activity')}
            />
          ),
          inbound: (
            <Instrument
              key="inbound"
              value={inboundUnreadCount}
              label="Inbound"
              sublabel="shared"
              urgent={urgentKey === 'inbound-collections'}
              onClick={() => go('/admin/collections')}
            />
          ),
          notes: (
            <Instrument
              key="notes"
              value={journalCount}
              label="Notes"
              sublabel="kept"
              urgent={urgentKey === 'unsynced-journal'}
              onClick={onOpenJournal}
            />
          ),
          collection: (
            <Instrument
              key="collection"
              value={collectionCount}
              label="Collection"
              sublabel="teas"
              onClick={() => go('/account/collection')}
            />
          ),
        } as const;

        type TileKey = keyof typeof tiles;
        const heroKey: TileKey =
          urgentKey === 'today-event' ? 'today'
          : urgentKey === 'pending-invoices' ? 'invoices'
          : urgentKey === 'inbound-collections' ? 'inbound'
          : urgentKey === 'unsynced-journal' ? 'notes'
          : 'today';

        const order: TileKey[] = ['today', 'invoices', 'inbound', 'notes', 'collection'];
        const ordered = [heroKey, ...order.filter(k => k !== heroKey)];
        const [heroChild, ...restChildren] = ordered.map(k => tiles[k]);
        const heroPropsOverride = React.cloneElement(
          heroChild as React.ReactElement<{ size?: 'hero' | 'small' }>,
          { size: 'hero' }
        );

        return (
          <ConsoleGrid>
            {heroPropsOverride}
            {restChildren}
          </ConsoleGrid>
        );
      })()}

      {/* ── Primary verb — single state-driven CTA ─────────────────────
          Filled bronze when there is no urgent tile (verb owns the
          bronze). Bordered bronze when an urgent tile is already filled
          (so we never show two bronze fills at once). */}
      {primaryVerb && (
        <PrimaryVerb
          label={primaryVerb.label}
          onClick={primaryVerb.onClick}
          variant={urgentKey ? 'bordered' : 'filled'}
        />
      )}

      {/* ── Last note — Adrian's own notes are operational knowledge ── */}
      <PreviewBlock hint="Notes" icon={<PenLine {...ICON_PROPS} />} onClick={onOpenJournal}>
        {journalCount > 0 ? (
          <>
            {journalLastExcerpt && (
              <p
                className="text-ui-15 leading-snug text-tea-text italic mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                “{truncate(journalLastExcerpt, 120)}”
              </p>
            )}
            <div className="text-ui-12 text-tea-text-sec tracking-[0.02em]">
              {journalLastTea && <span className="text-tea-text">{journalLastTea}</span>}
              {journalLastTea && journalLastAt && <span className="text-tea-text-sec"> · </span>}
              {journalLastAt && <span>{formatDaysAgo(daysSince(journalLastAt))}</span>}
              {!journalLastExcerpt && journalCount > 1 && (
                <span className="text-tea-text-sec"> · {journalCount} entries kept</span>
              )}
            </div>
          </>
        ) : (
          <p className="text-ui-15 italic text-tea-text-sec" style={{ fontFamily: 'var(--font-display)' }}>
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
                  <span className="flex items-center justify-center w-full h-full text-ui-10 font-serif text-tea-gold/70">茶</span>
                )}
              </div>
            ))}
          </div>
          <div className="text-ui-12 text-tea-text-sec tracking-[0.02em]">
            <span className="text-tea-text">{journey.sessionsAttended}</span> gathering{journey.sessionsAttended !== 1 ? 's' : ''}
            {journey.totalTeas > 0 && <span className="text-tea-text-sec"> · {journey.totalTeas} teas past</span>}
          </div>
        </PreviewBlock>
      )}

      {/* ── Compass ──────────────────────────────────────────────────── */}
      {compassProfile && (
        <PreviewBlock hint="Compass" icon={<Compass {...ICON_PROPS} />} onClick={() => go('/admin/compass')}>
          <p
            className="text-ui-16 leading-snug text-tea-text italic"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            “{compassProfile}”
          </p>
        </PreviewBlock>
      )}

      {/* ── First door — the explicit opening checklist for a new location ── */}
      {isFirstDoorCandidate && (
        <section className="mt-6 border-t border-tea-border" aria-label="Opening workflow">
          <header className="px-6 pt-5 pb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-ui-10 uppercase tracking-[0.28em] text-tea-text-sec font-medium">
                Opening a table
              </div>
              <div className="text-ui-11 text-tea-text-sec tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                {firstDoorReadiness.completeCount}/{firstDoorReadiness.totalCount}
              </div>
            </div>
            <p className="mt-2 text-ui-14 text-tea-text-sec leading-relaxed" style={{ fontFamily: 'var(--font-display)' }}>
              First-door workflow{locationLabel ? ` · ${locationLabel}` : ''}{currencyLabel ? ` · ${currencyLabel}` : ''}.
            </p>
            {firstDoorReadiness.nextStep && (
              <button
                onClick={() => go(firstDoorReadiness.nextStep!.route)}
                className="mt-4 w-full min-h-[44px] px-4 py-3 border border-tea-gold/40 text-left text-tea-gold hover:bg-tea-gold/10 transition-colors"
                style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
              >
                <span className="block text-ui-11 uppercase tracking-[0.2em] font-medium">Next step</span>
                <span className="block mt-1 text-ui-15 text-tea-text leading-tight">{firstDoorReadiness.nextStep.label}</span>
              </button>
            )}
          </header>
          <ul>
            {firstDoorReadiness.steps.map((step, index) => (
              <li key={step.id}>
                <button
                  onClick={() => go(step.route)}
                  className="w-full text-left px-6 py-3 border-t border-tea-border hover:bg-tea-surface/60 active:bg-tea-surface transition-colors"
                  style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
                >
                  <span className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-5 h-5 rounded-full border border-tea-border text-ui-10 text-tea-gold flex items-center justify-center shrink-0 tabular-nums"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="block text-ui-15 text-tea-text leading-tight">{step.label}</span>
                        <span
                          className={[
                            'text-ui-10 uppercase tracking-[0.14em] shrink-0',
                            step.state === 'done'
                              ? 'text-tea-gold'
                              : step.state === 'next'
                              ? 'text-tea-text'
                              : 'text-tea-text-sec',
                          ].join(' ')}
                        >
                          {readinessLabel(step.state)}
                        </span>
                      </span>
                      <span className="block mt-1 text-ui-12 text-tea-text-sec leading-snug">{step.description}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
            <li>
              <button
                onClick={() => go(`/store/${activeStoreSlug}`)}
                className="w-full text-left px-6 py-3 border-t border-tea-border hover:bg-tea-surface/60 active:bg-tea-surface transition-colors"
                style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
              >
                <span className="flex items-start gap-3">
                  <span
                    className="mt-0.5 w-5 h-5 rounded-full border border-tea-border text-ui-10 text-tea-gold flex items-center justify-center shrink-0 tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {firstDoorReadiness.totalCount + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-ui-15 text-tea-text leading-tight">Preview storefront</span>
                    <span className="block mt-1 text-ui-12 text-tea-text-sec leading-snug">
                      Check what a guest sees before the first public order or session.
                    </span>
                  </span>
                </span>
              </button>
            </li>
          </ul>
          <div className="px-6 pt-5 pb-1 border-t border-tea-border">
            <div className="text-ui-10 uppercase tracking-[0.28em] text-tea-text-sec font-medium mb-3">
              Support
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-ui-14 text-tea-text-sec tracking-[0.01em]">
              {OPERATOR_SUPPORT_LINKS.map((link, i) => {
                const route = link.id === 'storefront-preview' ? `/store/${activeStoreSlug}` : link.route;
                return (
                  <React.Fragment key={link.id}>
                    {i > 0 && <span className="text-tea-text-sec" aria-hidden="true">·</span>}
                    <button
                      onClick={() => go(route)}
                      className="py-1 -my-1 hover:text-tea-gold transition-colors"
                      style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
                    >
                      {link.label}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Tools — table of contents
          Single-column list. Each group is a small-caps header row
          followed by its tools stacked vertically. No empty cells, no
          forced grid alignment. Rhythm comes from generous space
          between groups and tighter rhythm inside them. */}
      <nav className="mt-6 border-t border-tea-border" aria-label="Admin tools">
        {ADMIN_TOOL_GROUPS.map((group, gIdx) => {
          const list: AdminTool[] = grouped[group.id];
          if (list.length === 0) return null;
          return (
            <section
              key={group.id}
              className={gIdx > 0 ? 'mt-1' : ''}
            >
              <header className="px-6 pt-5 pb-2 flex items-center gap-2">
                <span className="text-tea-text-dim shrink-0 flex items-center" aria-hidden="true">
                  {GROUP_ICONS[group.id]}
                </span>
                <span className="text-ui-10 uppercase tracking-[0.28em] text-tea-text-sec font-medium">
                  {group.label}
                </span>
              </header>
              <ul>
                {list.map(tool => (
                  <li key={tool.id}>
                    <button
                      onClick={() => go(tool.route)}
                      className={[
                        'w-full text-left px-6 py-2.5',
                        'flex items-center gap-2',
                        'text-ui-15 text-tea-text leading-tight',
                        'hover:bg-tea-surface/60 active:bg-tea-surface',
                        'transition-colors',
                      ].join(' ')}
                      style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
                    >
                      <span className="flex-1 truncate">{tool.label}</span>
                      {isRecentlyAdded(tool) && (
                        <span
                          className="inline-block w-1 h-1 rounded-full bg-tea-gold/60 shrink-0"
                          aria-label="Recently added"
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>

      {/* ── Footer — same table-of-contents vocabulary as the tools
          above, with a labeled "Account" group and a trailing Sign Out
          row that's tied into the same rhythm rather than orphaned. */}
      <section className="mt-6 border-t border-tea-border">
        <header className="px-6 pt-5 pb-2 flex items-center gap-2">
          <span className="text-ui-10 uppercase tracking-[0.28em] text-tea-text-sec font-medium">
            Account
          </span>
        </header>
        <ul>
          <li>
            <button
              onClick={onOpenEvents}
              className="w-full text-left px-6 py-2.5 text-ui-15 text-tea-text leading-tight hover:bg-tea-surface/60 active:bg-tea-surface transition-colors"
              style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
            >
              Events attending
            </button>
          </li>
          {memberCount >= 2 && (
            <li>
              <button
                onClick={onOpenLocationSwitcher}
                className="w-full text-left px-6 py-2.5 text-ui-15 text-tea-text leading-tight hover:bg-tea-surface/60 active:bg-tea-surface transition-colors flex items-center gap-2"
                style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
              >
                <span className="flex-1">Switch location</span>
                <span className="text-ui-12 text-tea-text-sec font-mono tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                  {memberCount}
                </span>
              </button>
            </li>
          )}
          <li>
            <button
              onClick={() => go('/account/settings')}
              className="w-full text-left px-6 py-2.5 text-ui-15 text-tea-text leading-tight hover:bg-tea-surface/60 active:bg-tea-surface transition-colors"
              style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
            >
              Settings
            </button>
          </li>
        </ul>
        <div className="px-6 pt-5 pb-[calc(52px+env(safe-area-inset-bottom,0px))] lg:pb-8">
          <button
            onClick={onSignOut}
            className="text-ui-12 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-text transition-colors py-2 -my-2"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Sign Out
          </button>
        </div>
      </section>
    </div>
  );
};
