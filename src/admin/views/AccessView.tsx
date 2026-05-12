import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { api, getTokenClaims } from '../../lib/api';
import { useAppStore, selectIsOwnerTier } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { ALL_BUNDLES, BUNDLE_DESCRIPTIONS, BUNDLE_LABELS } from '../../types';
import type { AccountMember, Bundle } from '../../types';

// Members & Access — Location Owner / Tea Master view at /admin/access.
// Per docs/NETWORK_ROLLOUT_PLAN.md §6-9 and docs/NETWORK_UI_BRIEF.md
// shared vocabulary. Wine-list rhythm. No avatars-in-circles. No role-as-pill.
// Bundles as comma-separated capability words underneath each name.

const sentenceForCount = (totalMembers: number, withFullAccess: number): string => {
  if (totalMembers === 0) return 'No one else has access yet.';
  const memberWord = totalMembers === 1 ? 'member' : 'members';
  if (withFullAccess === 0) return `${totalMembers === 1 ? 'One' : totalMembers} ${memberWord}.`;
  if (withFullAccess === 1) return `${totalMembers === 1 ? 'One' : totalMembers} ${memberWord}. One with full access.`;
  return `${totalMembers === 1 ? 'One' : totalMembers} ${memberWord}. ${withFullAccess} with full access.`;
};

const formatBundles = (bundles: Bundle[]): string => {
  if (!bundles || bundles.length === 0) return 'No bundles granted yet.';
  if (bundles.length === ALL_BUNDLES.length) return 'Full access.';
  return bundles.map(b => BUNDLE_LABELS[b]).join(' · ');
};

type AccessPresetId = 'sales' | 'inventory' | 'events' | 'content' | 'manager' | 'access-manager' | 'viewer';

const ACCESS_PRESETS: Array<{
  id: AccessPresetId;
  label: string;
  description: string;
  bundles: Bundle[];
}> = [
  {
    id: 'sales',
    label: 'Sales',
    description: 'Customers, orders, pricing, and checkout follow-up.',
    bundles: ['sell'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Products, sourcing fields, stock counts, and receiving stock.',
    bundles: ['catalog', 'stock'],
  },
  {
    id: 'events',
    label: 'Events',
    description: 'Sessions, guests, venues, RSVP review, and check-in.',
    bundles: ['gather'],
  },
  {
    id: 'content',
    label: 'Content',
    description: 'Collections and editorial publishing.',
    bundles: ['publish'],
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Daily operations without the power to grant access.',
    bundles: ['catalog', 'stock', 'gather', 'sell', 'publish'],
  },
  {
    id: 'access-manager',
    label: 'Access manager',
    description: 'Full account operations, including inviting and removing members.',
    bundles: [...ALL_BUNDLES],
  },
  {
    id: 'viewer',
    label: 'Viewer',
    description: 'No operational bundles. Useful for observation and training.',
    bundles: [],
  },
];

interface EditorSheetProps {
  member: AccountMember;
  isViewerOwner: boolean;
  onClose: () => void;
  onSave: (next: Bundle[]) => Promise<void>;
  onRemove: () => Promise<void> | void;
  accountId: string;
  accountName: string;
}

const EditorSheet: React.FC<EditorSheetProps> = ({ member, isViewerOwner, onClose, onSave, onRemove, accountId: _accountId, accountName }) => {
  const initialBundles = useMemo(() => member.bundles || [], [member.bundles]);
  const [working, setWorking] = useState<Set<Bundle>>(() => new Set(initialBundles));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const isOwner = member.role === 'owner';
  const dirty = useMemo(() => {
    if (working.size !== initialBundles.length) return true;
    for (const b of initialBundles) if (!working.has(b)) return true;
    return false;
  }, [working, initialBundles]);

  const toggle = (bundle: Bundle) => {
    if (isOwner) return; // owners always have all six
    if (bundle === 'members' && working.has('members') && member.role === 'owner') return;
    setWorking(prev => {
      const next = new Set(prev);
      if (next.has(bundle)) next.delete(bundle);
      else next.add(bundle);
      return next;
    });
  };

  const applyPreset = (bundles: Bundle[]) => {
    if (isOwner) return;
    setWorking(new Set(bundles));
  };

  const handleSave = async () => {
    if (!dirty || saving || isOwner) return;
    setSaving(true);
    setError(null);
    try {
      const next = ALL_BUNDLES.filter(b => working.has(b));
      await onSave(next);
    } catch (err: any) {
      setError(err?.message || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-tea-bg/80 z-drawer animate-fadeIn"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label={`Edit access for ${member.name || member.email}`}
        className="fixed top-0 right-0 bottom-0 z-modal w-full sm:w-[420px] bg-tea-surface border-l border-tea-border flex flex-col animate-slideInRight"
      >
        {/* Header — close X on the left per CLAUDE.md panel rule */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-tea-border">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -ml-1.5 rounded-md text-tea-text-sec hover:text-tea-text transition-colors tap-target"
            aria-label="Close"
            title="Close"
          >
            <X size={16} />
          </button>
          <div className="label-caps text-tea-text-dim">
            {isOwner ? 'Owner' : member.role === 'staff' ? 'Member' : 'Viewer'}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-nav-gap">
          <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-1`}>{member.name || member.email}</h2>
          {member.name && (
            <p className="text-tea-text-sec text-ui-12 mb-6">{member.email}</p>
          )}
          {!member.name && <div className="mb-6" />}

          {isOwner ? (
            <div className="text-tea-text-sec italic text-ui-15 leading-[1.6] mb-8">
              Owners always have access to everything.
            </div>
          ) : (
            <>
              <div className="text-tea-text-sec italic text-ui-13 mb-5">
                Start with a preset, then adjust individual capabilities if needed.
              </div>
              <div className="mb-7 space-y-1">
                {ACCESS_PRESETS.map(preset => {
                  const active = preset.bundles.length === working.size
                    && preset.bundles.every(bundle => working.has(bundle));
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.bundles)}
                      className={`w-full text-left py-2.5 px-3 -mx-3 rounded-[2px] transition-colors hover:bg-tea-elevated/50 ${
                        active ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                      }`}
                    >
                      <div className="font-display text-ui-15">{preset.label}</div>
                      <div className="text-ui-12 text-tea-text-dim mt-0.5 leading-[1.45]">
                        {preset.description}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="label-caps text-tea-text-dim mb-2">
                Capabilities
              </div>
              <div className="space-y-1">
                {ALL_BUNDLES.map(bundle => {
                  const active = working.has(bundle);
                  return (
                    <button
                      key={bundle}
                      type="button"
                      onClick={() => toggle(bundle)}
                      className={`w-full text-left py-3 px-3 -mx-3 rounded-[2px] transition-colors hover:bg-tea-elevated/50 ${
                        active ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                      }`}
                    >
                      <div className="font-display text-ui-17">{BUNDLE_LABELS[bundle]}</div>
                      <div className="text-ui-12 text-tea-text-dim mt-0.5 leading-[1.5]">
                        {BUNDLE_DESCRIPTIONS[bundle]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Dangerous actions — secondary color, never red. Inline confirm. */}
          {isViewerOwner && !isOwner && (
            <div className="mt-10 pt-6 border-t border-tea-border">
              {!confirmingRemove ? (
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  className="text-tea-text-sec hover:text-tea-text transition-colors text-ui-14 py-2"
                >
                  Remove from this account
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-tea-text-sec italic text-ui-14 leading-[1.6]">
                    Remove {member.name || member.email} from {accountName}?
                    They will lose access immediately. They can be re-invited.
                  </p>
                  <div className="flex items-center gap-6 text-ui-13">
                    <button
                      type="button"
                      onClick={() => setConfirmingRemove(false)}
                      disabled={removing}
                      className="text-tea-text-sec hover:text-tea-text transition-colors"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setRemoving(true);
                        try { await onRemove(); }
                        finally { setRemoving(false); setConfirmingRemove(false); }
                      }}
                      disabled={removing}
                      className="text-tea-text-sec hover:text-tea-text transition-colors disabled:text-tea-text-dim"
                    >
                      {removing ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-6 text-tea-text-sec italic text-ui-13 leading-[1.5]">
              {error}
            </div>
          )}
        </div>

        {/* Footer — Cancel left, Save right per CLAUDE.md */}
        <div className="border-t border-tea-border px-5 py-4 flex items-center justify-between gap-2 bg-tea-bg">
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving || isOwner}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </aside>
    </>
  );
};

export const AccessView: React.FC = () => {
  const activeAccount = useAppStore(s => s.activeAccount);
  const activeAccountId = useAppStore(s => s.activeAccountId);
  const isOwnerTier = useAppStore(selectIsOwnerTier);
  // Identify the viewer so we never let them edit their own bundles via this
  // surface — an owner toggling away their own `members` would lock themselves
  // out of the only screen that can grant it back.
  const currentUserId = useMemo(() => getTokenClaims()?.sub || null, []);

  const [members, setMembers] = useState<AccountMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AccountMember | null>(null);
  const [adding, setAdding] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPreset, setAddPreset] = useState<AccessPresetId>('sales');
  const [addBusy, setAddBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<{ email: string; url: string; copied: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!activeAccountId) return;
    setError(null);
    try {
      const { members } = await api.accounts.getAccess(activeAccountId);
      setMembers(members);
    } catch (err: any) {
      setError(err?.message || 'Could not reach the server. Showing the last known state.');
    }
  }, [activeAccountId]);

  useEffect(() => { load(); }, [load]);

  const owners = useMemo(() => (members || []).filter(m => m.role === 'owner'), [members]);
  const staffAndViewers = useMemo(
    () => (members || []).filter(m => m.role !== 'owner'),
    [members]
  );
  const totalCount = (members || []).length;
  const fullAccessCount = (members || []).filter(m => (m.bundles?.length || 0) === ALL_BUNDLES.length).length;

  const handleAddMember = async () => {
    const email = addEmail.trim().toLowerCase();
    if (!email || !activeAccountId || addBusy) return;
    setAddBusy(true);
    setError(null);
    setInviteLink(null);
    try {
      const result = await api.accounts.addMember(activeAccountId, email, 'staff');
      const preset = ACCESS_PRESETS.find(item => item.id === addPreset);
      if (preset && result.user_id) {
        await api.accounts.setMemberBundles(activeAccountId, result.user_id, preset.bundles);
      }
      if (result.invite_link) {
        setInviteLink({
          email,
          url: `${window.location.origin}${result.invite_link}`,
          copied: false,
        });
      }
      setAddEmail('');
      setAddPreset('sales');
      setAdding(false);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not add this person. Check the email and try again.');
    } finally {
      setAddBusy(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink.url);
    setInviteLink({ ...inviteLink, copied: true });
    window.setTimeout(() => {
      setInviteLink(current => current ? { ...current, copied: false } : current);
    }, 1800);
  };

  // Optimistic save — patch the row in place while the network call flies,
  // roll back if it rejects. Errors bubble back into EditorSheet so the inline
  // error message appears next to the toggles.
  const handleSaveBundles = async (next: Bundle[]) => {
    if (!editing || !activeAccountId) return;
    const userId = editing.user_id;
    const previous = editing.bundles || [];
    setMembers(prev => prev
      ? prev.map(m => m.user_id === userId ? { ...m, bundles: next } : m)
      : prev
    );
    try {
      await api.accounts.setMemberBundles(activeAccountId, userId, next);
      setEditing(null);
      // Re-fetch in the background to reconcile any server-side derivations.
      load();
    } catch (err) {
      // Roll back the row on failure so what's on screen matches the server.
      setMembers(prev => prev
        ? prev.map(m => m.user_id === userId ? { ...m, bundles: previous } : m)
        : prev
      );
      throw err;
    }
  };

  // Confirmation lives inline inside EditorSheet — this just executes the removal.
  const handleRemove = async () => {
    if (!editing || !activeAccountId) return;
    try {
      await api.accounts.removeMember(activeAccountId, editing.user_id);
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not remove this member.');
    }
  };

  if (!activeAccountId) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-3xl mx-auto">
        <p className="text-tea-text-sec italic">No active account.</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-3xl mx-auto">
      {/* Header — quiet location name + summary sentence */}
      <header className="mb-8">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>
          {activeAccount?.name || 'Access'}
        </h1>
        <p className="label-caps text-tea-text-dim mt-1">Members & access</p>
        {members && (
          <p className="text-tea-text-sec text-ui-14 mt-3">
            {sentenceForCount(totalCount, fullAccessCount)}
          </p>
        )}
      </header>

      {error && (
        <div className="mb-6 text-ui-12 text-tea-error">{error}</div>
      )}

      {members === null && !error && (
        <div className="text-tea-text-sec text-ui-14">Loading roster…</div>
      )}

      {members && members.length === 0 && (
        <div className="text-tea-text-sec text-ui-14 leading-[1.7] mb-8">
          You haven't invited anyone to help run this place yet.
        </div>
      )}

      {inviteLink && (
        <div className="mb-8 bg-tea-surface border border-tea-border rounded-md p-4 space-y-3">
          <div>
            <p className="text-tea-text font-display text-ui-17">Invite created for {inviteLink.email}</p>
            <p className="text-tea-text-sec text-ui-13 leading-[1.5] mt-1">
              Send this link to the new member. It lets them set a password and join this account.
            </p>
          </div>
          <div className="flex gap-2">
            <code className="flex-1 min-w-0 bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-11 text-tea-text-sec font-mono truncate">
              {inviteLink.url}
            </code>
            <button
              type="button"
              onClick={copyInviteLink}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text transition-colors text-ui-12 tap-target"
            >
              {inviteLink.copied ? <Check size={12} /> : <Copy size={12} />}
              {inviteLink.copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Owners group */}
      {owners.length > 0 && (
        <section className="mb-10">
          {owners.map(m => (
            <RosterRow
              key={m.user_id}
              member={m}
              onClick={isOwnerTier && m.user_id !== currentUserId ? () => setEditing(m) : undefined}
              isSelf={m.user_id === currentUserId}
            />
          ))}
        </section>
      )}

      {/* Members group — divider only if both sections present */}
      {owners.length > 0 && staffAndViewers.length > 0 && (
        <div className="border-t border-tea-border my-8" />
      )}

      {staffAndViewers.length > 0 && (
        <section className="mb-10">
          {staffAndViewers.map(m => (
            <RosterRow
              key={m.user_id}
              member={m}
              onClick={isOwnerTier && m.user_id !== currentUserId ? () => setEditing(m) : undefined}
              isSelf={m.user_id === currentUserId}
            />
          ))}
        </section>
      )}

      {/* Add member */}
      {isOwnerTier && (
        <div className="mt-12">
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
            >
              Add Member
            </button>
          ) : (
            <div className="space-y-3 bg-tea-surface border border-tea-border rounded-xl p-5">
              <div>
                <label className="label-caps text-tea-text-sec mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  placeholder="email@example.com"
                  autoFocus
                  className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddMember();
                    if (e.key === 'Escape') { setAdding(false); setAddEmail(''); setAddPreset('sales'); }
                  }}
                />
              </div>
              <div className="space-y-2">
                <div className="label-caps text-tea-text-sec">
                  Access preset
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ACCESS_PRESETS.map(preset => {
                    const active = addPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setAddPreset(preset.id)}
                        className={`text-left rounded-md border px-3 py-2 transition-colors ${
                          active
                            ? 'border-tea-gold/40 bg-tea-gold/10 text-tea-text'
                            : 'border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub'
                        }`}
                      >
                        <div className="font-display text-ui-14">{preset.label}</div>
                        <div className="text-ui-11 text-tea-text-dim leading-[1.45] mt-0.5">
                          {formatBundles(preset.bundles)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setAdding(false); setAddEmail(''); setAddPreset('sales'); }}
                  className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={!addEmail.includes('@') || addBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {addBusy ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {editing && editing.user_id !== currentUserId && (
        <EditorSheet
          member={editing}
          isViewerOwner={isOwnerTier}
          onClose={() => setEditing(null)}
          onSave={handleSaveBundles}
          onRemove={handleRemove}
          accountId={activeAccountId}
          accountName={activeAccount?.name || 'this account'}
        />
      )}
    </div>
  );
};

interface RosterRowProps {
  member: AccountMember;
  onClick?: () => void;
  isSelf?: boolean;
}

const RosterRow: React.FC<RosterRowProps> = ({ member, onClick, isSelf }) => {
  const displayName = member.name || member.email;
  const tierLabel =
    member.role === 'owner' ? 'Owner'
    : member.role === 'staff' ? 'Member'
    : 'Viewer';
  const bundlesText = formatBundles(member.bundles || []);
  const isInvited = member.status === 'invited' || (member.invited_at && !member.joined_at);

  const Wrap: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    onClick ? (
      <button type="button" onClick={onClick} className="w-full text-left py-4 -mx-3 px-3 rounded-[2px] hover:bg-tea-elevated/40 transition-colors group">
        {children}
      </button>
    ) : (
      <div className="py-4">{children}</div>
    );

  return (
    <Wrap>
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="font-display text-ui-17 text-tea-text">{displayName}</div>
            <div className="text-tea-text-sec text-ui-11 uppercase tracking-[0.1em]">{tierLabel}</div>
            {isInvited && (
              <div className="text-tea-text-sec italic text-ui-12">Not yet accepted</div>
            )}
            {isSelf && (
              <div className="text-tea-text-sec italic text-ui-12">You</div>
            )}
          </div>
          <div className="text-tea-text-sec text-ui-13 mt-1.5 leading-[1.5]">
            {bundlesText}
          </div>
        </div>
        {onClick && (
          <span className="text-tea-text-sec group-hover:text-tea-gold text-ui-13 transition-colors shrink-0">
            Edit
          </span>
        )}
      </div>
    </Wrap>
  );
};
