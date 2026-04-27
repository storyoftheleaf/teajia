import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Wrench, BookOpen } from 'lucide-react';
import {
  NeedsAttention,
  PreviewBlock,
  FOOTER_LINK_CLASS,
  capitalize,
  daysWord,
  getInitials,
} from './primitives';
import { useAppStore } from '../../lib/store';
import { toolsForRole, type AdminTool } from '../../admin/toolRegistry';

const ICON_PROPS = { size: 13, strokeWidth: 1.5 } as const;

interface StaffViewProps {
  user: { name?: string; email: string } | null;
  avatarDataUrl: string | null;
  onAvatarClick: () => void;
  roleBadgeLabel: string | null;
  accountName: string | null;
  locationLabel: string | null;

  todayEventCount: number;

  onClose: () => void;
  onOpenEvents: () => void;
  onSignOut: () => void;
}

function buildStaffFrontispiece(todayEventCount: number): string {
  if (todayEventCount === 0) return 'The bench is quiet.';
  if (todayEventCount === 1) return 'One session today.';
  return `${capitalize(daysWord(todayEventCount))} sessions today.`;
}

function formatTodayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── StaffView ──

export const StaffView: React.FC<StaffViewProps> = ({
  user,
  avatarDataUrl,
  onAvatarClick,
  roleBadgeLabel,
  accountName,
  locationLabel,
  todayEventCount,
  onClose,
  onOpenEvents,
  onSignOut,
}) => {
  const navigate = useNavigate();
  const go = (route: string) => { onClose(); navigate(route); };

  // Bundle-aware shift toolbar. The same set of admin tools shown to the
  // operator is filtered down to the bundles this staff member actually holds.
  // Bottom-bar tools (rendered as primary mobile nav) are excluded so the
  // panel doesn't duplicate them.
  const memberships = useAppStore((s) => s.memberships);
  const activeAccountId = useAppStore((s) => s.activeAccountId);
  const activeMembership = memberships.find(m => m.account_id === activeAccountId);
  const bundles = activeMembership?.bundles ?? [];
  const BOTTOM_BAR_TOOL_IDS = new Set(['compass', 'inventory', 'activity', 'events', 'people', 'capture']);
  const shiftTools = useMemo(() => {
    return toolsForRole({ isOwner: false, isPlatform: false, bundles })
      .filter(t => !BOTTOM_BAR_TOOL_IDS.has(t.id));
  }, [bundles]);

  const attention = todayEventCount > 0 ? [{
    id: 'today',
    label: `${todayEventCount} session${todayEventCount === 1 ? '' : 's'} today`,
    meta: 'Prep',
    urgent: true,
    onClick: () => go('/admin/events'),
  }] : [];

  const frontispiece = buildStaffFrontispiece(todayEventCount);
  const todayLabel = formatTodayLabel();

  return (
    <div>
      {/* ── Identity — date + account, avatar in corner ─────────────── */}
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
          className="w-11 h-11 rounded-full bg-tea-gold/10 flex items-center justify-center border border-tea-border overflow-hidden shrink-0"
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
        </button>
      </div>

      {/* ── Frontispiece ─────────────────────────────────────────────── */}
      <div className="px-6 pt-3 pb-2">
        <p
          className="text-[20px] leading-snug text-tea-text italic"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 400 }}
        >
          {frontispiece}
        </p>
        {roleBadgeLabel && (
          <div className="text-[11px] uppercase tracking-[0.18em] text-tea-gold mt-2">
            {roleBadgeLabel}
          </div>
        )}
      </div>

      {/* ── Attention ───────────────────────────────────────────────── */}
      <NeedsAttention items={attention} />

      {/* ── Today's sessions preview ────────────────────────────────── */}
      {todayEventCount > 0 && (
        <PreviewBlock hint="On the bench" icon={<Calendar {...ICON_PROPS} />} onClick={onOpenEvents}>
          <p className="text-[15px] text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
            {todayEventCount} session{todayEventCount === 1 ? '' : 's'} to prep.
          </p>
        </PreviewBlock>
      )}

      {/* ── Shift tools — bundle-aware text-link cluster ────────────── */}
      {shiftTools.length > 0 && (
        <div className="border-t border-tea-border px-6 pt-7 pb-5">
          <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.22em] text-tea-text font-medium">
            <span className="text-tea-gold/70 shrink-0 flex items-center" aria-hidden="true"><Wrench size={14} strokeWidth={1.5} /></span>
            <span>Shift</span>
          </div>
          <div className="w-8 h-px bg-tea-gold/40 mt-2 mb-3.5 ml-[22px]" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-tea-text-sec tracking-[0.01em]">
            {shiftTools.map((tool: AdminTool, i: number) => (
              <React.Fragment key={tool.id}>
                {i > 0 && <span className="text-tea-text-sec" aria-hidden="true">·</span>}
                <button
                  onClick={() => go(tool.route)}
                  className="py-1 -my-1 hover:text-tea-gold transition-colors"
                  style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
                >
                  {tool.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ── Learn — quiet text links ────────────────────────────────── */}
      <div className="border-t border-tea-border px-6 pt-7 pb-5">
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.22em] text-tea-text font-medium">
          <span className="text-tea-gold/70 shrink-0 flex items-center" aria-hidden="true"><BookOpen size={14} strokeWidth={1.5} /></span>
          <span>Learn</span>
        </div>
        <div className="w-8 h-px bg-tea-gold/40 mt-2 mb-3.5 ml-[22px]" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-tea-text-sec tracking-[0.01em]">
          <button
            onClick={() => go('/magazine')}
            className="py-1 -my-1 hover:text-tea-gold transition-colors"
            style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
          >
            Magazine
          </button>
          <span className="text-tea-text-sec" aria-hidden="true">·</span>
          <button
            onClick={() => go('/craft')}
            className="py-1 -my-1 hover:text-tea-gold transition-colors"
            style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
          >
            Craft
          </button>
        </div>
      </div>

      {/* ── Utility footer ──────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-[calc(44px+env(safe-area-inset-bottom,0px))] lg:pb-8 border-t border-tea-border mt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-tea-text-sec tracking-[0.03em]">
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
