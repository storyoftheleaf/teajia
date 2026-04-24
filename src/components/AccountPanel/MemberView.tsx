import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../Icons';
import { Row, SectionHeader, NeedsAttention } from './primitives';
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

function getInitials(nameOrEmail: string): string {
  return nameOrEmail.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const MemberView: React.FC<MemberViewProps> = ({
  user,
  avatarDataUrl,
  onAvatarClick,
  journey,
  journalLastAt,
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

  const topTypes = journey?.teaTypeMap
    ? Object.entries(journey.teaTypeMap).sort(([, a], [, b]) => b - a).slice(0, 2).map(([t]) => t)
    : [];

  return (
    <div>
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onAvatarClick}
            className="w-11 h-11 rounded-full bg-tea-gold/10 flex items-center justify-center border border-tea-border shrink-0 overflow-hidden"
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
            <h3 className="font-serif text-[15px] text-tea-text truncate leading-tight">
              {user?.name || 'Tea Enthusiast'}
            </h3>
            <div className="text-[11px] text-tea-text-sec truncate mt-0.5">
              {user?.email ?? ''}
            </div>
          </div>
        </div>
      </div>

      <NeedsAttention items={attention} />

      {journey?.hasLinkedCustomer && (
        <div className="px-6 pt-5 pb-2">
          <button
            onClick={() => go('/account/journey')}
            className="w-full text-left group flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-tea-gold/8 border border-tea-border flex items-center justify-center shrink-0 group-hover:border-tea-gold/30 transition-colors">
              <span className="font-serif text-[17px] text-tea-gold/50 group-hover:text-tea-gold/70 transition-colors leading-none">茶</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-serif text-[14px] text-tea-text leading-tight">Your journey</span>
                <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />
              </div>
              <div className="text-[11px] text-tea-text-sec leading-tight mt-0.5">
                <span className="font-serif text-tea-text">{journey.sessionsAttended}</span>
                {' '}gathering{journey.sessionsAttended !== 1 ? 's' : ''}
                {journey.totalTeas > 0 && <span className="text-tea-text-dim"> · {journey.totalTeas} teas</span>}
                {topTypes.length > 0 && <span className="text-tea-text-dim"> · {topTypes.join(', ')}</span>}
              </div>
              {journey.seals.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  {journey.seals.slice(-5).map(s => (
                    <div key={s.eventId} className="w-5 h-5 rounded-full border border-tea-border overflow-hidden bg-tea-surface shrink-0">
                      {s.flyerUrl
                        ? <img src={s.flyerUrl} alt="" className="w-full h-full object-cover opacity-70" />
                        : <span className="flex items-center justify-center w-full h-full text-[7px] font-serif text-tea-gold/40">茶</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </button>
        </div>
      )}

      <SectionHeader>Your tea life</SectionHeader>
      <div>
        <Row
          label="Tasting Journal"
          onClick={onOpenJournal}
          meta={journalCount > 0
            ? `${journalCount} · last ${journalLastAt ? formatRelative(journalLastAt) : '—'}`
            : undefined}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Collection"
          onClick={() => go('/account/collection')}
          meta={collectionCount > 0 ? `${collectionCount} teas` : undefined}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Tea Compass"
          onClick={() => go('/compass')}
          meta={compassProfile ?? undefined}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Order History"
          onClick={() => go('/account/orders')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Cart"
          onClick={onOpenCart}
          meta={cartCount > 0 ? `${cartCount} item${cartCount === 1 ? '' : 's'}` : undefined}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
      </div>

      <SectionHeader>The network</SectionHeader>
      <div>
        <Row
          label="Sessions"
          onClick={onOpenEvents}
          meta={upcomingEventsCount > 0 ? `${upcomingEventsCount} upcoming` : 'Browse'}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Our Spaces"
          onClick={() => go('/spaces')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Magazine"
          onClick={() => go('/magazine')}
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
