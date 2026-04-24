import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NeedsAttention } from './primitives';

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

// ── Editorial helpers ──

function getInitials(nameOrEmail: string): string {
  return nameOrEmail.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const DAY_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'] as const;
function daysWord(n: number): string {
  return DAY_WORDS[n] ?? String(n);
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

// ── Shared content-preview block ──

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
          <div className="text-[9px] uppercase tracking-[0.3em] text-tea-text-dim">
            {todayLabel}
          </div>
          {accountName && (
            <div className="text-[11px] text-tea-text-sec truncate mt-1 tracking-[0.03em]">
              {accountName}{locationLabel ? ` · ${locationLabel}` : ''}
            </div>
          )}
        </div>
        <button
          onClick={onAvatarClick}
          className="w-9 h-9 rounded-full bg-tea-gold/10 flex items-center justify-center border border-tea-border overflow-hidden shrink-0"
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

      {/* ── Frontispiece ─────────────────────────────────────────────── */}
      <div className="px-6 pt-3 pb-2">
        <p
          className="text-[19px] leading-snug text-tea-text italic"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 400 }}
        >
          {frontispiece}
        </p>
        {roleBadgeLabel && (
          <div className="text-[10px] uppercase tracking-[0.2em] text-tea-gold/80 mt-2">
            {roleBadgeLabel}
          </div>
        )}
      </div>

      {/* ── Attention ───────────────────────────────────────────────── */}
      <NeedsAttention items={attention} />

      {/* ── Today's sessions preview ────────────────────────────────── */}
      {todayEventCount > 0 && (
        <PreviewBlock hint="On the bench" onClick={onOpenEvents}>
          <p className="text-[14px] text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
            {todayEventCount} session{todayEventCount === 1 ? '' : 's'} to prep.
          </p>
        </PreviewBlock>
      )}

      {/* ── Shift tools — compact text-link cluster ─────────────────── */}
      <div className="border-t border-tea-border px-6 py-4">
        <div className="text-[9px] uppercase tracking-[0.28em] text-tea-text-dim mb-2.5">Shift</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-tea-text-sec tracking-[0.02em]">
          <button
            onClick={() => go('/admin/inventory')}
            className="hover:text-tea-gold transition-colors"
            style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
          >
            Inventory
          </button>
          <span className="text-tea-text-dim" aria-hidden="true">·</span>
          <button
            onClick={() => go('/admin/activity?qi=1')}
            className="hover:text-tea-gold transition-colors"
            style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
          >
            Quick invoice
          </button>
          <span className="text-tea-text-dim" aria-hidden="true">·</span>
          <button
            onClick={() => go('/admin/capture')}
            className="hover:text-tea-gold transition-colors"
            style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
          >
            Quick capture
          </button>
        </div>
      </div>

      {/* ── Learn — quiet text links ────────────────────────────────── */}
      <div className="border-t border-tea-border px-6 py-4">
        <div className="text-[9px] uppercase tracking-[0.28em] text-tea-text-dim mb-2.5">Learn</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-tea-text-sec tracking-[0.02em]">
          <button
            onClick={() => go('/magazine')}
            className="hover:text-tea-gold transition-colors"
            style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
          >
            Magazine
          </button>
          <span className="text-tea-text-dim" aria-hidden="true">·</span>
          <button
            onClick={() => go('/learn')}
            className="hover:text-tea-gold transition-colors"
            style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
          >
            Learn
          </button>
        </div>
      </div>

      {/* ── Utility footer ──────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-[calc(44px+env(safe-area-inset-bottom,0px))] lg:pb-8 border-t border-tea-border mt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-tea-text-sec tracking-[0.04em]">
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
