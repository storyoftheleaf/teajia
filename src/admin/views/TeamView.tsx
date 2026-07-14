// @deprecated TeamView is superseded by AccessView at /admin/access (Members &
// Access sub-step 0.5). This file remains because PeopleView still renders it
// as a tab; remove that reference and delete this file when ready. Reference:
// See docs/ARCHITECTURE.md for membership and access rules.
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, UserPlus, X, ShieldCheck, Shield, MoreHorizontal } from 'lucide-react';
import { api, getTokenClaims } from '../../lib/api';
import { useAppStore } from '../store';
import type { AccountMember, AccountRole } from '../../types';

const ROLES: AccountRole[] = ['owner', 'staff', 'viewer'];

const roleLabel: Record<AccountRole, string> = {
  owner: 'Owner',
  staff: 'Staff',
  viewer: 'Viewer',
};

// ── Canonical status pill (matches DesignSystemShowcase §8a) ──────────────
type StatusVariant = 'draft' | 'active' | 'archived' | 'success' | 'error';
const STATUS_PILL_VARIANTS: Record<StatusVariant, string> = {
  draft: 'bg-tea-elevated text-tea-text-sec',
  active: 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40',
  archived: 'bg-tea-elevated text-tea-text-dim',
  success: 'bg-tea-green/10 text-tea-green ring-1 ring-inset ring-tea-green/40',
  error: 'bg-tea-error/10 text-tea-error ring-1 ring-inset ring-tea-error/40',
};
const StatusPill: React.FC<{ variant?: StatusVariant; children: React.ReactNode }> = ({ variant = 'draft', children }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-ui-9 uppercase font-sans tracking-caps ${STATUS_PILL_VARIANTS[variant]}`}>
    {children}
  </span>
);

const ROLE_PILL: Record<AccountRole, { variant: StatusVariant; label: string }> = {
  owner: { variant: 'success', label: 'Owner' },
  staff: { variant: 'active', label: 'Staff' },
  viewer: { variant: 'draft', label: 'Viewer' },
};

const initialsFor = (member: AccountMember): string => {
  const source = (member.name || member.email || '').trim();
  if (!source) return '·';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0] + parts[1]![0]).toUpperCase();
  const word = parts[0] || source;
  return word.slice(0, 2).toUpperCase();
};

const KNOWN_PERMISSIONS: { key: string; label: string; description: string }[] = [
  { key: 'ai_wisdom', label: 'AI Wisdom Generation', description: 'Can generate lore, terroir, and experience descriptions for teas' },
];

function useCurrentRole(): AccountRole | null {
  const { memberships, activeAccountId } = useAppStore();
  return useMemo(
    () => memberships.find((m) => m.account_id === activeAccountId)?.role ?? null,
    [memberships, activeAccountId],
  );
}

interface MemberSettingsModalProps {
  member: AccountMember;
  accountId: string;
  ownerCount: number;
  currentUserId: string | null;
  canEditRoles: boolean;
  onClose: () => void;
  onPermissionsUpdated: (userId: string, permissions: Record<string, boolean>) => void;
  onRoleChanged: (userId: string, role: AccountRole) => void;
  onOwnershipTransferred: () => void;
  onRemoved: (userId: string) => void;
}

const MemberSettingsModal: React.FC<MemberSettingsModalProps> = ({
  member,
  accountId,
  ownerCount,
  currentUserId,
  canEditRoles,
  onClose,
  onPermissionsUpdated,
  onRoleChanged,
  onOwnershipTransferred,
  onRemoved,
}) => {
  const [permissions, setPermissions] = useState<Record<string, boolean>>(member.permissions ?? {});
  const [canCreateCollections, setCanCreateCollections] = useState<boolean>(
    !!member.can_create_collections,
  );
  const [role, setRole] = useState<AccountRole>(member.role);
  const [permBusy, setPermBusy] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [curatorBusy, setCuratorBusy] = useState(false);

  const isSelf = member.user_id === currentUserId;
  const isLastOwner = member.role === 'owner' && ownerCount <= 1;

  const handleRoleChange = async (next: AccountRole) => {
    if (next === role) return;
    setRoleBusy(true);
    setMsg(null);
    try {
      await api.accounts.updateMember(accountId, member.user_id, next);
      setRole(next);
      onRoleChanged(member.user_id, next);
      setMsg('Role saved.');
    } catch (err: any) {
      setMsg(err?.message || 'Failed to update role');
    } finally {
      setRoleBusy(false);
    }
  };

  const handlePermissionToggle = async (key: string, value: boolean) => {
    const next = { ...permissions, [key]: value };
    setPermissions(next);
    setPermBusy(true);
    setMsg(null);
    try {
      await api.accounts.updateMemberPermissions(accountId, member.user_id, next);
      onPermissionsUpdated(member.user_id, next);
      setMsg('Permissions saved.');
    } catch (err: any) {
      setMsg(err?.message || 'Failed to save permissions');
      setPermissions(permissions); // revert
    } finally {
      setPermBusy(false);
    }
  };

  const handleCuratorToggle = async (value: boolean) => {
    setCanCreateCollections(value);
    setCuratorBusy(true);
    setMsg(null);
    try {
      await api.accounts.setCuratorFlag(accountId, member.user_id, value);
      setMsg('Curator access saved.');
    } catch (err: any) {
      setMsg(err?.message || 'Failed to save curator access');
      setCanCreateCollections(!value); // revert
    } finally {
      setCuratorBusy(false);
    }
  };

  const handleTransferOwnership = async () => {
    setTransferBusy(true);
    setMsg(null);
    try {
      await api.accounts.transferOwnership(accountId, member.user_id);
      onOwnershipTransferred();
      onClose();
    } catch (err: any) {
      setMsg(err?.message || 'Failed to transfer ownership');
      setTransferBusy(false);
    }
  };

  const handleRemove = async () => {
    setRemoveBusy(true);
    setMsg(null);
    try {
      await api.accounts.removeMember(accountId, member.user_id);
      onRemoved(member.user_id);
      onClose();
    } catch (err: any) {
      setMsg(err?.message || 'Failed to remove member');
      setRemoveBusy(false);
      setConfirmingRemove(false);
    }
  };

  // Toggle row pattern matches AccessView capability toggles
  const Toggle: React.FC<{ active: boolean; onClick: () => void; disabled?: boolean; label: string }> = ({ active, onClick, disabled, label }) => (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`${label} ${active ? 'enabled' : 'disabled'}`}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 disabled:opacity-50 ${
        active ? 'bg-tea-gold' : 'bg-tea-elevated ring-1 ring-inset ring-tea-border'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-tea-bg transition-transform ${
          active ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Member settings"
    >
      <div className="w-full max-w-md relative bg-tea-surface rounded-xl border border-tea-border shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md text-tea-text-sec hover:text-tea-text transition-colors tap-target"
          aria-label="Close"
          title="Close"
        >
          <X size={16} />
        </button>
        <div className="px-5 py-4 border-b border-tea-border pr-12 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-tea-elevated text-tea-text-sec font-display text-ui-14 flex items-center justify-center flex-shrink-0">
            {initialsFor(member)}
          </div>
          <div className="min-w-0">
            <h2 className="h3 text-tea-text truncate">
              {member.name || member.email}
            </h2>
            {member.name && (
              <p className="text-ui-12 text-tea-text-dim mt-0.5 truncate">{member.email}</p>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Role */}
          {canEditRoles && !isSelf && (
            <div>
              <p className="label-caps text-tea-text-sec mb-2">Role</p>
              <div className="flex items-center gap-2 flex-wrap">
                {ROLES.map((r) => {
                  const active = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleChange(r)}
                      disabled={roleBusy}
                      className={`px-3 py-1.5 rounded-md text-ui-12 transition-colors disabled:opacity-50 ${
                        active
                          ? 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40'
                          : 'border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub'
                      }`}
                    >
                      {roleLabel[r]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feature Permissions */}
          <div>
            <p className="label-caps text-tea-text-sec mb-3">Feature Access</p>
            <div>
              {KNOWN_PERMISSIONS.map(({ key, label, description }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 py-2 border-b border-tea-border last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="text-ui-13 text-tea-text">{label}</div>
                    <div className="text-ui-11 text-tea-text-dim mt-0.5 leading-[1.5]">{description}</div>
                  </div>
                  <Toggle
                    active={!!permissions[key]}
                    onClick={() => handlePermissionToggle(key, !permissions[key])}
                    disabled={permBusy}
                    label={label}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Curator Access */}
          <div>
            <p className="label-caps text-tea-text-sec mb-3">Curator Access</p>
            <div className="flex items-center justify-between gap-3 py-2 border-b border-tea-border">
              <div className="min-w-0">
                <div className="text-ui-13 text-tea-text">Can create collections</div>
                <div className="text-ui-11 text-tea-text-dim mt-0.5 leading-[1.5]">
                  Member can create and publish their own collections. Requests still route to you.
                </div>
              </div>
              <Toggle
                active={canCreateCollections}
                onClick={() => handleCuratorToggle(!canCreateCollections)}
                disabled={curatorBusy}
                label="Can create collections"
              />
            </div>
          </div>

          {msg && (
            <div className="text-ui-12 text-tea-text-sec italic">
              {msg}
            </div>
          )}

          {/* Transfer Ownership — only for non-self members who aren't already the only owner */}
          {!isSelf && !isLastOwner && canEditRoles && (
            <div className="pt-4 border-t border-tea-border">
              <p className="label-caps text-tea-text-sec mb-2">Ownership</p>
              <button
                type="button"
                onClick={handleTransferOwnership}
                disabled={transferBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-ui-12 text-tea-text-sec border border-tea-border hover:text-tea-text hover:bg-tea-accent-sub transition-colors disabled:opacity-50"
              >
                {transferBusy && <Loader2 className="animate-spin" size={11} />}
                Transfer ownership to {member.name || member.email}
              </button>
            </div>
          )}

          {/* Remove — destructive with inline confirm */}
          {!isSelf && !isLastOwner && canEditRoles && (
            <div className="pt-4 border-t border-tea-border">
              {!confirmingRemove ? (
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  className="text-tea-text-sec hover:text-tea-text transition-colors text-ui-13"
                >
                  Remove from this account
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-tea-text-sec text-ui-13 leading-[1.6] italic">
                    Remove {member.name || member.email}? They will lose access immediately.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingRemove(false)}
                      disabled={removeBusy}
                      className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={handleRemove}
                      disabled={removeBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error text-tea-bg text-xs font-semibold hover:bg-tea-error/90 transition-colors disabled:opacity-40"
                    >
                      {removeBusy ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const TeamView: React.FC = () => {
  const { activeAccountId, memberships } = useAppStore();
  const currentRole = useCurrentRole();
  const claims = getTokenClaims();
  const currentUserId = claims?.sub ?? null;

  const [members, setMembers] = useState<AccountMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AccountRole>('staff');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [settingsMember, setSettingsMember] = useState<AccountMember | null>(null);

  const canManage = currentRole === 'owner';
  const canEditRoles = currentRole === 'owner';

  const activeAccountName = memberships.find((m) => m.account_id === activeAccountId)?.account_name;

  const loadMembers = async () => {
    if (!activeAccountId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.accounts.listMembers(activeAccountId);
      const list = Array.isArray(data) ? data : (data as any)?.members ?? [];
      setMembers(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId]);

  if (!activeAccountId) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-3xl mx-auto">
        <p className="text-tea-text-sec italic">No active account selected.</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-3xl mx-auto">
        <p className="text-tea-text-sec italic">You don't have permission to view the team.</p>
      </div>
    );
  }

  const ownerCount = members.filter((m) => m.role === 'owner').length;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      const added = await api.accounts.addMember(activeAccountId, inviteEmail, inviteRole);
      setMembers((prev) => {
        const existingIdx = prev.findIndex((m) => m.user_id === added.user_id);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = added;
          return next;
        }
        return [...prev, added];
      });
      setInviteMsg(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('staff');
    } catch (err: any) {
      setInviteMsg(err?.message || 'Failed to invite member');
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-3xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="h2 text-tea-text">Team</h1>
          {activeAccountName && (
            <p className="label-caps text-tea-text-dim mt-1">{activeAccountName}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setInviteOpen(true);
            setInviteMsg(null);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
        >
          <UserPlus size={13} />
          Invite
        </button>
      </header>

      {error && (
        <div className="mb-4 text-ui-12 text-tea-error">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-tea-text-dim">
          <Loader2 className="animate-spin" size={18} />
        </div>
      ) : members.length === 0 ? (
        <div className="text-tea-text-sec text-ui-14 leading-[1.7]">
          No team members yet.
        </div>
      ) : (
        <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
          {members.map((m) => {
            const isSelf = m.user_id === currentUserId;
            const pill = ROLE_PILL[m.role] || ROLE_PILL.viewer;
            const displayName = m.name || m.email;
            const hasName = !!m.name;
            const canOpen = canEditRoles && !isSelf;
            const Inner = (
              <div className="flex items-center gap-3 w-full">
                <div className="w-10 h-10 rounded-full bg-tea-elevated text-tea-text-sec font-display text-ui-14 flex items-center justify-center flex-shrink-0">
                  {initialsFor(m)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <div className="font-display text-ui-15 text-tea-text truncate">{displayName}</div>
                    {isSelf && (
                      <span className="text-tea-text-sec italic text-ui-11">You</span>
                    )}
                    {m.platform_role === 'platform_owner' && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-ui-9 uppercase font-sans tracking-caps bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40">
                        <ShieldCheck size={9} />Super Owner
                      </span>
                    )}
                    {m.platform_role === 'platform_admin' && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-ui-9 uppercase font-sans tracking-caps bg-tea-elevated text-tea-text-sec">
                        <Shield size={9} />Platform Admin
                      </span>
                    )}
                  </div>
                  {hasName && (
                    <div className="text-ui-12 text-tea-text-dim mt-0.5 truncate">{m.email}</div>
                  )}
                  {m.joined_at && (
                    <div className="text-ui-11 text-tea-text-dim mt-0.5">
                      Joined {new Date(m.joined_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
                  {canOpen && (
                    <span
                      aria-hidden
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-tea-text-sec group-hover:text-tea-text transition-colors tap-target"
                    >
                      <MoreHorizontal size={16} />
                    </span>
                  )}
                </div>
              </div>
            );
            return (
              <li key={m.user_id}>
                {canOpen ? (
                  <button
                    type="button"
                    onClick={() => setSettingsMember(m)}
                    className="w-full text-left px-4 py-3 hover:bg-tea-accent-sub transition-colors group flex items-center"
                  >
                    {Inner}
                  </button>
                ) : (
                  <div className="px-4 py-3 flex items-center">{Inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {inviteOpen && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Invite team member"
        >
          <div className="w-full max-w-md relative bg-tea-surface rounded-xl border border-tea-border shadow-2xl">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-md text-tea-text-sec hover:text-tea-text transition-colors tap-target"
              aria-label="Close"
              title="Close"
            >
              <X size={16} />
            </button>
            <div className="px-5 py-4 border-b border-tea-border pr-12">
              <h2 className="h3 text-tea-text">Invite Member</h2>
            </div>
            <form onSubmit={handleInvite} className="p-5 space-y-3">
              <div>
                <label className="label-caps text-tea-text-sec mb-1.5 block">Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
                />
              </div>
              <div>
                <label className="label-caps text-tea-text-sec mb-1.5 block">Role</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {ROLES.map((r) => {
                    const active = inviteRole === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setInviteRole(r)}
                        className={`px-3 py-1.5 rounded-md text-ui-12 transition-colors ${
                          active
                            ? 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40'
                            : 'border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub'
                        }`}
                      >
                        {roleLabel[r]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {inviteMsg && (
                <div className="text-ui-12 text-tea-text-sec italic">
                  {inviteMsg}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteBusy || !inviteEmail}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40"
                >
                  {inviteBusy && <Loader2 className="animate-spin" size={12} />}
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {settingsMember && activeAccountId && (
        <MemberSettingsModal
          member={settingsMember}
          accountId={activeAccountId}
          ownerCount={ownerCount}
          currentUserId={currentUserId}
          canEditRoles={canEditRoles}
          onClose={() => setSettingsMember(null)}
          onPermissionsUpdated={(userId, permissions) => {
            setMembers((prev) =>
              prev.map((m) => (m.user_id === userId ? { ...m, permissions } : m)),
            );
          }}
          onRoleChanged={(userId, role) => {
            setMembers((prev) =>
              prev.map((m) => (m.user_id === userId ? { ...m, role } : m)),
            );
          }}
          onRemoved={(userId) => {
            setMembers((prev) => prev.filter((m) => m.user_id !== userId));
          }}
          onOwnershipTransferred={loadMembers}
        />
      )}
    </div>
  );
};

export default TeamView;
