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
import { ADMIN_TOOL_GROUPS, groupTools, toolsForRole, type AdminTool } from '../../admin/toolRegistry';
import { staffToolsForPanel } from './workflows';

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

  // Bundle-aware shift toolbar. Your Table is the permission home, so it shows
  // every workflow this staff member can actually enter, including tools that
  // also appear in desktop/mobile admin navigation.
  const memberships = useAppStore((s) => s.memberships);
  const activeAccountId = useAppStore((s) => s.activeAccountId);
  const activeMembership = memberships.find(m => m.account_id === activeAccountId);
  const bundles = activeMembership?.bundles ?? [];
  const shiftTools = useMemo(() => {
    return staffToolsForPanel(toolsForRole({ isOwner: false, isPlatform: false, bundles }));
  }, [bundles]);
  const groupedShiftTools = useMemo(() => groupTools(shiftTools), [shiftTools]);

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
          className="w-12 h-12 rounded-full bg-tea-elevated flex items-center justify-center border border-tea-border overflow-hidden shrink-0"
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
        </button>
      </div>

      {/* ── Frontispiece ─────────────────────────────────────────────── */}
      <div className="px-6 pt-3 pb-2">
        <p className="font-body italic text-ui-17 leading-snug text-tea-text">
          {frontispiece}
        </p>
        {roleBadgeLabel && (
          <span className="inline-flex mt-2 px-2 py-0.5 rounded-full text-ui-9 uppercase tracking-caps bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40">
            {roleBadgeLabel}
          </span>
        )}
      </div>

      {/* ── Attention ───────────────────────────────────────────────── */}
      <NeedsAttention items={attention} />

      {/* ── Today's sessions preview ────────────────────────────────── */}
      {todayEventCount > 0 && (
        <PreviewBlock hint="On the bench" icon={<Calendar {...ICON_PROPS} />} onClick={onOpenEvents}>
          <p className="font-display text-ui-15 text-tea-text">
            {todayEventCount} session{todayEventCount === 1 ? '' : 's'} to prep.
          </p>
        </PreviewBlock>
      )}

      {/* ── Shift tools — bundle-aware text-link cluster ────────────── */}
      {shiftTools.length > 0 ? (
        <div className="border-t border-tea-border px-6 pt-7 pb-5">
          <div className="flex items-center gap-2 label-caps text-tea-text-dim">
            <span className="text-tea-text-sec shrink-0 flex items-center" aria-hidden="true"><Wrench size={14} strokeWidth={1.5} /></span>
            <span>Shift access</span>
          </div>
          <div className="w-8 h-px bg-tea-gold/40 mt-2 mb-3.5 ml-[22px]" aria-hidden="true" />
          <div className="space-y-4">
            {ADMIN_TOOL_GROUPS.map(group => {
              const list: AdminTool[] = groupedShiftTools[group.id];
              if (list.length === 0) return null;
              return (
                <div key={group.id}>
                  <div className="text-ui-10 uppercase tracking-caps text-tea-text-dim mb-1.5">
                    {group.label}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {list.map((tool: AdminTool, i: number) => (
                      <React.Fragment key={tool.id}>
                        {i > 0 && <span className="text-tea-text-dim" aria-hidden="true">·</span>}
                        <button
                          onClick={() => go(tool.route)}
                          className="font-display text-ui-15 text-tea-text-sec hover:text-tea-text py-1 -my-1 transition-colors"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          {tool.label}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border-t border-tea-border px-6 pt-7 pb-5">
          <div className="flex items-center gap-2 label-caps text-tea-text-dim">
            <span className="text-tea-text-sec shrink-0 flex items-center" aria-hidden="true"><Wrench size={14} strokeWidth={1.5} /></span>
            <span>Shift access</span>
          </div>
          <p className="mt-3 body-light">
            No workflows have been granted yet. Ask an owner to add bundles in Members & Access.
          </p>
        </div>
      )}

      {/* ── Learn — quiet text links ────────────────────────────────── */}
      <div className="border-t border-tea-border px-6 pt-7 pb-5">
        <div className="flex items-center gap-2 label-caps text-tea-text-dim">
          <span className="text-tea-text-sec shrink-0 flex items-center" aria-hidden="true"><BookOpen size={14} strokeWidth={1.5} /></span>
          <span>Learn</span>
        </div>
        <div className="w-8 h-px bg-tea-gold/40 mt-2 mb-3.5 ml-[22px]" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            onClick={() => go('/magazine')}
            className="font-display text-ui-15 text-tea-text-sec hover:text-tea-text py-1 -my-1 transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Magazine
          </button>
          <span className="text-tea-text-dim" aria-hidden="true">·</span>
          <button
            onClick={() => go('/craft')}
            className="font-display text-ui-15 text-tea-text-sec hover:text-tea-text py-1 -my-1 transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Craft
          </button>
        </div>
      </div>

      {/* ── Utility footer ──────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-[calc(52px+env(safe-area-inset-bottom,0px))] lg:pb-8 border-t border-tea-border mt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ui-12 text-tea-text-sec tracking-[0.03em]">
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
          className="mt-6 py-2 -my-2 text-tea-text-sec hover:text-tea-text transition-colors text-ui-12 uppercase tracking-[0.15em]"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};
