import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SealIcon } from '../Icons';
import { Icons } from '../Icons';
import {
  ADMIN_TOOL_GROUPS,
  toolsForRole,
  groupTools,
  isRecentlyAdded,
  type AdminTool,
} from '../../admin/toolRegistry';
import { Row, SectionHeader, NeedsAttention } from './primitives';

interface OperatorViewProps {
  user: { name?: string; email: string } | null;
  avatarDataUrl: string | null;
  onAvatarClick: () => void;
  roleBadgeLabel: string | null;
  accountName: string | null;
  locationLabel: string | null;
  isPlatform: boolean;
  isOwner: boolean;

  pendingInvoiceCount: number;
  todayEventCount: number;
  unsyncedJournalCount: number;

  onClose: () => void;
  onOpenJournal: () => void;
  onOpenEvents: () => void;
  onOpenLocationSwitcher: () => void;
  onSignOut: () => void;
  memberCount: number;
}

function getInitials(nameOrEmail: string): string {
  return nameOrEmail.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

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
  onClose,
  onOpenJournal,
  onOpenEvents,
  onOpenLocationSwitcher,
  onSignOut,
  memberCount,
}) => {
  const navigate = useNavigate();
  const [myTeaOpen, setMyTeaOpen] = useState(false);

  const tools = toolsForRole({ isOwner, isPlatform });
  const grouped = groupTools(tools);

  const go = (route: string) => { onClose(); navigate(route); };

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

  return (
    <div>
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onAvatarClick}
            className="w-11 h-11 rounded-full bg-tea-gold/10 flex items-center justify-center border border-tea-border shrink-0 overflow-hidden relative group"
            title="Change photo"
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
                {user?.name || 'Tea Enthusiast'}
              </h3>
              {roleBadgeLabel && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-px text-[8px] uppercase tracking-[0.1em] text-tea-gold bg-tea-gold/10 rounded shrink-0">
                  {(isOwner || isPlatform) && <SealIcon className="w-2.5 h-2.5" />}
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

      {ADMIN_TOOL_GROUPS.map(group => {
        const list: AdminTool[] = grouped[group.id];
        if (list.length === 0) return null;
        return (
          <div key={group.id}>
            <SectionHeader>{group.label}</SectionHeader>
            <div>
              {list.map(tool => (
                <Row
                  key={tool.id}
                  label={tool.label}
                  onClick={() => go(tool.route)}
                  isNew={isRecentlyAdded(tool)}
                  trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
                  meta={
                    tool.id === 'activity' && pendingInvoiceCount > 0
                      ? `${pendingInvoiceCount} pending`
                      : tool.id === 'events' && todayEventCount > 0
                      ? `${todayEventCount} today`
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        );
      })}

      <SectionHeader>Personal</SectionHeader>
      <div>
        <Row
          label="My tea"
          onClick={() => setMyTeaOpen(v => !v)}
          trailing={
            <Icons.ChevronRight
              className={`w-3.5 h-3.5 text-tea-text/20 shrink-0 transition-transform ${myTeaOpen ? 'rotate-90' : ''}`}
            />
          }
        />
        {myTeaOpen && (
          <div>
            <Row label="Tasting Journal" onClick={onOpenJournal} subdued />
            <Row label="Collection" onClick={() => go('/account/collection')} subdued />
            <Row label="Compass Profile" onClick={() => go('/compass')} subdued />
            <Row label="Order History" onClick={() => go('/account/orders')} subdued />
            <Row label="Events Attending" onClick={onOpenEvents} subdued />
          </div>
        )}
      </div>

      <SectionHeader>Account</SectionHeader>
      <div>
        {memberCount >= 2 && (
          <Row
            label="Switch Location"
            onClick={onOpenLocationSwitcher}
            meta={`${memberCount} locations`}
            trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
          />
        )}
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
