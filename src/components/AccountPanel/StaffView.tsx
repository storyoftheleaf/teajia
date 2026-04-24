import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../Icons';
import { Row, SectionHeader, NeedsAttention } from './primitives';

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

function getInitials(nameOrEmail: string): string {
  return nameOrEmail.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

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

  return (
    <div>
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onAvatarClick}
            className="w-11 h-11 rounded-full bg-tea-gold/10 flex items-center justify-center border border-tea-border shrink-0 overflow-hidden"
          >
            {avatarDataUrl ? (
              <img src={avatarDataUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <span className="text-sm font-serif text-tea-gold font-medium">
                {user ? getInitials(user.name || user.email) : '茶'}
              </span>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-[15px] text-tea-text truncate leading-tight">
                {user?.name || 'Tea Staff'}
              </h3>
              {roleBadgeLabel && (
                <span className="inline-flex items-center px-1.5 py-px text-[8px] uppercase tracking-[0.1em] text-tea-gold bg-tea-gold/10 rounded shrink-0">
                  {roleBadgeLabel}
                </span>
              )}
            </div>
            {accountName && (
              <div className="text-[11px] text-tea-text-sec truncate mt-0.5">
                {accountName}{locationLabel ? ` · ${locationLabel}` : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      <NeedsAttention items={attention} />

      <SectionHeader>Your shift</SectionHeader>
      <div>
        <Row
          label="Today's sessions"
          onClick={onOpenEvents}
          meta={todayEventCount > 0 ? `${todayEventCount}` : 'None'}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Inventory"
          onClick={() => go('/admin/inventory')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Quick Invoice"
          onClick={() => go('/admin/activity?qi=1')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Quick Capture"
          onClick={() => go('/admin/capture')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
      </div>

      <SectionHeader>Learn</SectionHeader>
      <div>
        <Row
          label="Magazine"
          onClick={() => go('/magazine')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Learn"
          onClick={() => go('/learn')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
      </div>

      <SectionHeader>Account</SectionHeader>
      <div>
        <Row
          label="Settings"
          onClick={() => go('/account/settings')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
      </div>

      <div className="px-6 pt-6 pb-[calc(44px+env(safe-area-inset-bottom,0px))] lg:pb-8">
        <button
          onClick={onSignOut}
          className="w-full py-2.5 text-tea-text-sec hover:text-tea-gold transition-colors text-[11px] uppercase tracking-[0.2em] font-medium"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};
