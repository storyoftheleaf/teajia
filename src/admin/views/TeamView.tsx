// @deprecated TeamView is superseded by AccessView at /admin/access (Members &
// Access sub-step 0.5). This file remains because PeopleView still renders it
// as a tab; remove that reference and delete this file when ready. Reference:
// docs/NETWORK_ROLLOUT_PLAN.md Step 0.6.
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, UserPlus, Trash2, X, ShieldCheck, Shield, Settings } from 'lucide-react';
import { api, getTokenClaims } from '../../lib/api';
import { useAppStore } from '../store';
import type { AccountMember, AccountRole, PlatformRole } from '../../types';

const ROLES: AccountRole[] = ['owner', 'staff', 'viewer'];

const roleLabel: Record<AccountRole, string> = {
  owner: 'Owner',
  staff: 'Staff',
  viewer: 'Viewer',
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
  onClose: () => void;
  onPermissionsUpdated: (userId: string, permissions: Record<string, boolean>) => void;
  onOwnershipTransferred: () => void;
}

const MemberSettingsModal: React.FC<MemberSettingsModalProps> = ({
  member,
  accountId,
  ownerCount,
  currentUserId,
  onClose,
  onPermissionsUpdated,
  onOwnershipTransferred,
}) => {
  const [permissions, setPermissions] = useState<Record<string, boolean>>(member.permissions ?? {});
  const [canCreateCollections, setCanCreateCollections] = useState<boolean>(
    !!member.can_create_collections,
  );
  const [permBusy, setPermBusy] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [curatorBusy, setCuratorBusy] = useState(false);

  const isSelf = member.user_id === currentUserId;
  const isLastOwner = member.role === 'owner' && ownerCount <= 1;

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
    if (!confirm(`Transfer account ownership to ${member.name || member.email}? They will become owner and your role will change to staff.`)) return;
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

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Member settings"
    >
      <div className="w-full max-w-md bg-tea-surface rounded-lg border border-tea-border shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-tea-border">
          <div>
            <h2 className="text-base text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
              {member.name || member.email}
            </h2>
            <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim mt-0.5">
              {roleLabel[member.role]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Feature Permissions */}
          <div>
            <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-3">
              Feature Access
            </p>
            <div className="space-y-3">
              {KNOWN_PERMISSIONS.map(({ key, label, description }) => (
                <label
                  key={key}
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={!!permissions[key]}
                      onChange={(e) => handlePermissionToggle(key, e.target.checked)}
                      disabled={permBusy}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        permissions[key]
                          ? 'bg-tea-gold border-tea-gold'
                          : 'bg-tea-bg border-tea-border group-hover:border-tea-gold/50'
                      }`}
                      onClick={() => !permBusy && handlePermissionToggle(key, !permissions[key])}
                    >
                      {permissions[key] && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-tea-bg" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-tea-text leading-tight">{label}</p>
                    <p className="text-ui-10 text-tea-text-dim mt-0.5 leading-relaxed">{description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Curator Access */}
          <div className="pt-2 border-t border-tea-border">
            <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-3">
              Curator Access
            </p>
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={canCreateCollections}
                  onChange={(e) => handleCuratorToggle(e.target.checked)}
                  disabled={curatorBusy}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    canCreateCollections
                      ? 'bg-tea-gold border-tea-gold'
                      : 'bg-tea-bg border-tea-border group-hover:border-tea-gold/50'
                  }`}
                  onClick={() => !curatorBusy && handleCuratorToggle(!canCreateCollections)}
                >
                  {canCreateCollections && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-tea-bg" />
                    </svg>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-tea-text leading-tight">Can create collections</p>
                <p className="text-ui-10 text-tea-text-dim mt-0.5 leading-relaxed">
                  Member can create and publish their own collections. Requests still route to you.
                </p>
              </div>
            </label>
          </div>

          {msg && (
            <div className="text-xs text-tea-text-sec bg-tea-elevated px-3 py-2 rounded-md">
              {msg}
            </div>
          )}

          {/* Transfer Ownership — only for non-self members who aren't already the only owner */}
          {!isSelf && !isLastOwner && (
            <div className="pt-2 border-t border-tea-border">
              <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-2">
                Ownership
              </p>
              <button
                type="button"
                onClick={handleTransferOwnership}
                disabled={transferBusy}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-tea-text-sec border border-tea-border hover:border-tea-gold/50 hover:text-tea-text transition-colors disabled:opacity-50"
              >
                {transferBusy && <Loader2 className="animate-spin" size={11} />}
                Transfer Ownership to {member.name || member.email}
              </button>
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
  const [rowBusy, setRowBusy] = useState<string | null>(null);
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
      <div className="p-12 text-center text-tea-text-sec font-serif">
        No active account selected.
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="p-12 text-center text-tea-text-sec font-serif">
        You don't have permission to view the team.
      </div>
    );
  }

  const ownerCount = members.filter((m) => m.role === 'owner').length;

  const handleRoleChange = async (userId: string, role: AccountRole) => {
    if (!canEditRoles) return;
    setRowBusy(userId);
    try {
      await api.accounts.updateMember(activeAccountId, userId, role);
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role } : m)));
    } catch (err: any) {
      setError(err?.message || 'Failed to update role');
    } finally {
      setRowBusy(null);
    }
  };

  const handleRemove = async (member: AccountMember) => {
    if (!canEditRoles) return;
    if (member.user_id === currentUserId) {
      setError("You can't remove yourself.");
      return;
    }
    if (member.role === 'owner' && ownerCount <= 1) {
      setError("You can't remove the last owner.");
      return;
    }
    if (!confirm(`Remove ${member.name || member.email} from this account?`)) return;
    setRowBusy(member.user_id);
    try {
      await api.accounts.removeMember(activeAccountId, member.user_id);
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
    } catch (err: any) {
      setError(err?.message || 'Failed to remove member');
    } finally {
      setRowBusy(null);
    }
  };

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
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl text-tea-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            Team
          </h1>
          {activeAccountName && (
            <p className="text-xs text-tea-text-dim uppercase tracking-[0.15em]">
              {activeAccountName}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setInviteOpen(true);
            setInviteMsg(null);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <UserPlus size={14} />
          Invite
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-tea-elevated text-xs text-tea-text-sec">
          {error}
        </div>
      )}

      <div className="bg-tea-surface rounded-lg overflow-hidden border border-tea-border">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-tea-text-dim">
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center text-tea-text-dim text-sm font-serif italic">
            No team members yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim">
                <th className="text-left font-medium px-4 py-3 border-b border-tea-border">Name</th>
                <th className="text-left font-medium px-4 py-3 border-b border-tea-border">Email</th>
                <th className="text-left font-medium px-4 py-3 border-b border-tea-border">Role</th>
                <th className="text-left font-medium px-4 py-3 border-b border-tea-border">Joined</th>
                {canEditRoles && (
                  <th className="text-right font-medium px-4 py-3 border-b border-tea-border"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = m.user_id === currentUserId;
                const isLastOwner = m.role === 'owner' && ownerCount <= 1;
                return (
                  <tr key={m.user_id} className="hover:bg-tea-elevated/30 transition-colors">
                    <td className="px-4 py-3 text-tea-text">
                      <div className="flex items-center gap-2 flex-wrap">
                        {m.name || '—'}
                        {isSelf && (
                          <span className="text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim">you</span>
                        )}
                        {m.platform_role === 'platform_owner' && (
                          <span className="badge-status badge-status-gold flex items-center gap-0.5">
                            <ShieldCheck size={9} />Super Owner
                          </span>
                        )}
                        {m.platform_role === 'platform_admin' && (
                          <span className="badge-status badge-status-default flex items-center gap-0.5">
                            <Shield size={9} />Platform Admin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-tea-text-sec">{m.email}</td>
                    <td className="px-4 py-3">
                      {canEditRoles && !isSelf ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.user_id, e.target.value as AccountRole)}
                          disabled={rowBusy === m.user_id}
                          className="bg-tea-bg text-tea-text text-xs px-2 py-1 rounded-md outline-none focus:ring-2 focus:ring-tea-gold/40"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {roleLabel[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-tea-text-sec text-xs uppercase tracking-[0.1em]">
                          {roleLabel[m.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-tea-text-dim text-xs">
                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                    </td>
                    {canEditRoles && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSettingsMember(m)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tea-text-dim hover:text-tea-text hover:bg-tea-elevated/60 transition-colors"
                            aria-label="Member settings"
                            title="Permissions & ownership"
                          >
                            <Settings size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(m)}
                            disabled={isSelf || isLastOwner || rowBusy === m.user_id}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-tea-text-dim hover:text-tea-text hover:bg-tea-elevated/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Remove member"
                            title={
                              isSelf
                                ? "You can't remove yourself"
                                : isLastOwner
                                  ? "Can't remove the last owner"
                                  : 'Remove member'
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {inviteOpen && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Invite team member"
        >
          <div className="w-full max-w-md bg-tea-surface rounded-lg border border-tea-border shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-tea-border">
              <h2 className="text-lg text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
                Invite Member
              </h2>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="text-tea-text-dim hover:text-tea-text transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-5 space-y-4">
              <div>
                <label className="block text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email"
                  className="w-full bg-tea-bg text-tea-text text-sm px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-tea-gold/40"
                />
              </div>
              <div>
                <label className="block text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as AccountRole)}
                  className="w-full bg-tea-bg text-tea-text text-sm px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-tea-gold/40"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel[r]}
                    </option>
                  ))}
                </select>
              </div>
              {inviteMsg && (
                <div className="text-xs text-tea-text-sec bg-tea-elevated px-3 py-2 rounded-md">
                  {inviteMsg}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="px-4 py-2 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteBusy || !inviteEmail}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
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
          onClose={() => setSettingsMember(null)}
          onPermissionsUpdated={(userId, permissions) => {
            setMembers((prev) =>
              prev.map((m) => (m.user_id === userId ? { ...m, permissions } : m)),
            );
          }}
          onOwnershipTransferred={loadMembers}
        />
      )}
    </div>
  );
};

export default TeamView;
