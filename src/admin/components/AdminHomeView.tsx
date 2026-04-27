import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  ClipboardList,
  Users,
  Calendar,
  Camera,
  Compass,
  FlaskConical,
  UserCog,
  Settings,
  LayoutDashboard,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { LogoEmblem } from '../../components/Logos/LogoEmblem';
import type { PlatformRole } from '../../types';
import { useAccountFeatures } from '../../hooks/useAccountFeatures';
import { usePendingAttendees } from '../hooks/useEventData';
import { api } from '../../lib/api';

type TileData = {
  id: string;
  label: string;
  sub: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  path: string;
};

// All tiles — filtered at render time based on role
const memberTiles: TileData[] = [
  { id: 'compass',  label: 'Tea Compass', sub: 'Browse & capture',   icon: Compass,     path: '/admin/compass' },
  { id: 'capture',  label: 'Capture',     sub: 'Quick intake',       icon: Camera,      path: '/admin/capture' },
  { id: 'samples',  label: 'Samples',     sub: 'Sample sets',        icon: FlaskConical,path: '/admin/samples' },
  { id: 'events',   label: 'Events',      sub: 'Sessions & classes', icon: Calendar,    path: '/admin/events' },
];

const operationsTiles: TileData[] = [
  { id: 'activity', label: 'Activity',    sub: 'Orders & records',   icon: ClipboardList, path: '/admin/activity' },
  { id: 'people',   label: 'People',      sub: 'Customers & sources',icon: Users,         path: '/admin/people' },
];

const managementTiles: TileData[] = [
  { id: 'dashboard', label: 'Dashboard', sub: 'Analytics',      icon: LayoutDashboard, path: '/admin/dashboard' },
  { id: 'team',      label: 'Team',      sub: 'Members & roles',icon: UserCog,         path: '/admin/people?tab=team' },
  { id: 'account',   label: 'Account',   sub: 'Settings',       icon: Settings,        path: '/admin/account-settings' },
];

const platformTile: TileData = {
  id: 'platform', label: 'Platform', sub: 'Super admin', icon: ShieldCheck, path: '/admin/platform',
};

// ─── Tile components ────────────────────────────────────────────────────────

const SmallTile: React.FC<{ tile: TileData; onClick: () => void; badge?: number }> = ({ tile, onClick, badge }) => {
  const Icon = tile.icon;
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-3 p-3.5 rounded-xl bg-tea-surface border border-tea-border text-left transition-colors duration-100 active:bg-tea-elevated/70"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <Icon size={16} strokeWidth={1.7} className="text-tea-gold shrink-0" />
      <div className="min-w-0">
        <div className="text-ui-13 font-medium text-tea-text leading-tight truncate">{tile.label}</div>
        <div className="text-ui-11 text-tea-text-dim mt-0.5 leading-tight truncate">{tile.sub}</div>
      </div>
      {badge != null && badge > 0 && (
        <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 flex items-center justify-center text-ui-9 font-semibold bg-amber-400/20 text-amber-600 dark:text-amber-400 rounded-full num">
          {badge}
        </span>
      )}
    </button>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-ui-9 uppercase tracking-[0.25em] text-tea-text-dim font-medium mb-2.5 px-0.5">
    {children}
  </div>
);

// ─── Main view ───────────────────────────────────────────────────────────────

export const AdminHomeView: React.FC<{
  platformRole?: PlatformRole;
  isStaff?: boolean;
  isAdmin?: boolean;
  isPlatformAccount?: boolean;
}> = ({ platformRole, isStaff = false, isAdmin = false, isPlatformAccount = false }) => {
  const navigate = useNavigate();
  const { hasFeature } = useAccountFeatures();
  const compassEnabled = hasFeature('compass');
  const catalogEnabled = hasFeature('catalog_sharing');

  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['invoices-pending-summary'],
    staleTime: 30_000,
    enabled: isStaff,
    queryFn: async () => {
      const data = (await api.invoices.list(200)) as any[];
      return data.filter((o: any) => o.status === 'Pending');
    },
  });
  const { data: pendingRSVPs = [] } = usePendingAttendees();
  const pendingCount = isStaff ? pendingOrders.length + pendingRSVPs.length : 0;

  const { data: attentionItems = [] } = useQuery({
    queryKey: ['collections-needs-attention'],
    staleTime: 60_000,
    enabled: isAdmin,
    queryFn: async () => {
      const res = await api.collections.needsAttention();
      return res.items;
    },
  });

  const catalogTile: TileData = {
    id: 'catalog', label: 'Catalog', sub: 'Source from Teajia', icon: Package, path: '/admin/catalog',
  };

  const mgmtTiles = isAdmin
    ? [
        ...(!isPlatformAccount && catalogEnabled ? [catalogTile] : []),
        ...managementTiles,
        ...(platformRole ? [platformTile] : []),
      ]
    : [];

  const hubLabel = isAdmin ? 'Admin' : 'Back of House';

  return (
    <div className="h-full overflow-y-auto hide-scrollbar">
      <div className="relative flex flex-col px-4 pt-8 pb-6 gap-5">

        <div
          className="absolute inset-x-0 top-0 h-52 pointer-events-none"
          aria-hidden
          style={{ background: 'linear-gradient(to bottom, var(--tea-surface) 0%, transparent 100%)' }}
        />

        {/* ── Logo ──────────────────────────────────────────────────── */}
        <div className="relative flex flex-col items-center pt-4 pb-3 gap-3">
          <LogoEmblem size={72} color="var(--tea-text)" />
          <span
            className="text-ui-9 uppercase font-medium"
            style={{ letterSpacing: '0.35em', color: 'var(--tea-gold)', opacity: 0.55 }}
          >
            {hubLabel}
          </span>
        </div>

        {/* ── Hero tile: Inventory (management only) ────────────────── */}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin/inventory')}
            className="relative flex items-center gap-4 px-5 py-4 rounded-2xl bg-tea-surface border border-tea-border text-left transition-colors duration-100 active:bg-tea-elevated/70 active:scale-[0.985]"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Package size={20} strokeWidth={1.6} className="text-tea-gold shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-ui-15 font-semibold text-tea-text leading-tight">Inventory</div>
              <div className="text-ui-12 text-tea-text-sec mt-0.5">Tea & Teaware</div>
            </div>
            <ArrowRight size={15} className="text-tea-text-dim shrink-0" />
          </button>
        )}

        {/* ── Needs attention (admin) ───────────────────────────────── */}
        {isAdmin && attentionItems.length > 0 && (
          <div className="relative">
            <SectionLabel>Needs attention</SectionLabel>
            <ul className="flex flex-col gap-1 bg-tea-surface border border-tea-border rounded-2xl p-2">
              {attentionItems.slice(0, 5).map(item => (
                <li key={item.item_id}>
                  <button
                    onClick={() => navigate(`/admin/collections/${item.collection_id}?item=${item.item_id}`)}
                    className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left hover:bg-tea-elevated transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-ui-13 text-tea-text truncate">
                        {item.product_name}
                      </p>
                      <p className="text-ui-11 text-tea-text-dim truncate">
                        {item.issue === 'archived' ? 'Archived' : 'Out of stock'}
                        {' in '}
                        <span className="text-tea-text-sec">{item.collection_title}</span>
                      </p>
                    </div>
                    <span className="text-ui-10 uppercase tracking-[1.2px] text-tea-gold">Review</span>
                  </button>
                </li>
              ))}
              {attentionItems.length > 5 && (
                <li className="px-3 py-1.5 text-ui-10 text-tea-text-dim text-center">
                  + {attentionItems.length - 5} more
                </li>
              )}
            </ul>
          </div>
        )}

        {/* ── Member tools (always visible) ─────────────────────────── */}
        <div className="relative">
          <SectionLabel>Your tools</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            {memberTiles.map(tile => {
              if ((tile.id === 'compass' || tile.id === 'samples') && !compassEnabled) return null;
              return <SmallTile key={tile.id} tile={tile} onClick={() => navigate(tile.path)} />;
            })}
          </div>
        </div>

        {/* ── Operations (staff+) ───────────────────────────────────── */}
        {isStaff && (
          <div className="relative">
            <SectionLabel>Operations</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {operationsTiles.map(tile => (
                <SmallTile
                  key={tile.id}
                  tile={tile}
                  onClick={() => navigate(tile.path)}
                  badge={tile.id === 'activity' ? pendingCount : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Management (admin+) ───────────────────────────────────── */}
        {mgmtTiles.length > 0 && (
          <div className="relative">
            <SectionLabel>Management</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {mgmtTiles.map(tile => (
                <SmallTile key={tile.id} tile={tile} onClick={() => navigate(tile.path)} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminHomeView;
