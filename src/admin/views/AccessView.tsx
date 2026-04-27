import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
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

interface EditorSheetProps {
  member: AccountMember;
  isViewerOwner: boolean;
  onClose: () => void;
  onSaved: () => void;
  onRemove: () => Promise<void> | void;
  accountId: string;
  accountName: string;
}

const EditorSheet: React.FC<EditorSheetProps> = ({ member, isViewerOwner, onClose, onSaved, onRemove, accountId, accountName }) => {
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

  const handleSave = async () => {
    if (!dirty || saving || isOwner) return;
    setSaving(true);
    setError(null);
    try {
      const next = ALL_BUNDLES.filter(b => working.has(b));
      await api.accounts.setMemberBundles(accountId, member.user_id, next);
      onSaved();
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
            className="text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
          <div className="text-tea-text-sec text-[11px] uppercase tracking-[0.1em]">
            {isOwner ? 'Owner' : member.role === 'staff' ? 'Member' : 'Viewer'}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-nav-gap">
          <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-1`}>{member.name || member.email}</h2>
          {member.name && (
            <p className="text-tea-text-sec text-[12px] mb-6">{member.email}</p>
          )}
          {!member.name && <div className="mb-6" />}

          {isOwner ? (
            <div className="text-tea-text-sec italic text-[15px] leading-[1.6] mb-8">
              Owners always have access to everything.
            </div>
          ) : (
            <>
              <div className="text-tea-text-sec italic text-[13px] mb-5">
                Tap a capability to grant or revoke it.
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
                      <div className="font-display text-[17px]">{BUNDLE_LABELS[bundle]}</div>
                      <div className="text-[12px] text-tea-text-dim mt-0.5 leading-[1.5]">
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
                  className="text-tea-text-sec hover:text-tea-text transition-colors text-[14px] py-2"
                >
                  Remove from this account
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-tea-text-sec italic text-[14px] leading-[1.6]">
                    Remove {member.name || member.email} from {accountName}?
                    They will lose access immediately. They can be re-invited.
                  </p>
                  <div className="flex items-center gap-6 text-[13px]">
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
            <div className="mt-6 text-tea-text-sec italic text-[13px] leading-[1.5]">
              {error}
            </div>
          )}
        </div>

        {/* Footer — Cancel left, Save right per CLAUDE.md */}
        <div className="border-t border-tea-border px-5 py-4 flex items-center justify-between bg-tea-surface">
          <button
            type="button"
            onClick={onClose}
            className="text-tea-text-sec hover:text-tea-text transition-colors text-[14px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving || isOwner}
            className="text-[14px] font-display tracking-[0.04em] py-1 px-1 transition-colors disabled:text-tea-text-dim disabled:cursor-not-allowed text-tea-gold hover:text-tea-gold-lt"
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

  const [members, setMembers] = useState<AccountMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AccountMember | null>(null);
  const [adding, setAdding] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addBusy, setAddBusy] = useState(false);

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
    try {
      await api.accounts.addMember(activeAccountId, email, 'staff');
      setAddEmail('');
      setAdding(false);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not add this person. Check the email and try again.');
    } finally {
      setAddBusy(false);
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
      <header className="mb-10">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>
          {activeAccount?.name || 'Access'}
        </h1>
        {members && (
          <p className="text-tea-text-sec italic text-[15px]">
            {sentenceForCount(totalCount, fullAccessCount)}
          </p>
        )}
      </header>

      {error && (
        <div className="mb-6 text-tea-text-sec italic text-[14px]">{error}</div>
      )}

      {members === null && !error && (
        <div className="text-tea-text-sec italic text-[14px]">Loading roster…</div>
      )}

      {members && members.length === 0 && (
        <div className="text-tea-text-sec italic text-[15px] leading-[1.7] mb-8">
          You haven't invited anyone to help run this place yet.
        </div>
      )}

      {/* Owners group */}
      {owners.length > 0 && (
        <section className="mb-10">
          {owners.map(m => (
            <RosterRow
              key={m.user_id}
              member={m}
              onClick={isOwnerTier ? () => setEditing(m) : undefined}
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
              onClick={isOwnerTier ? () => setEditing(m) : undefined}
            />
          ))}
        </section>
      )}

      {/* Add member — text-link, not a button */}
      {isOwnerTier && (
        <div className="mt-12">
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-tea-text-sec hover:text-tea-gold transition-colors text-[14px] font-display"
            >
              Add a member
            </button>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                placeholder="email@example.com"
                autoFocus
                className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-[15px] py-2 transition-colors"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddMember();
                  if (e.key === 'Escape') { setAdding(false); setAddEmail(''); }
                }}
              />
              <div className="flex items-center justify-between text-[13px]">
                <button
                  type="button"
                  onClick={() => { setAdding(false); setAddEmail(''); }}
                  className="text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={!addEmail.includes('@') || addBusy}
                  className="text-tea-gold hover:text-tea-gold-lt disabled:text-tea-text-dim disabled:cursor-not-allowed transition-colors"
                >
                  {addBusy ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {editing && (
        <EditorSheet
          member={editing}
          isViewerOwner={isOwnerTier}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
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
}

const RosterRow: React.FC<RosterRowProps> = ({ member, onClick }) => {
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
            <div className="font-display text-[17px] text-tea-text">{displayName}</div>
            <div className="text-tea-text-sec text-[11px] uppercase tracking-[0.1em]">{tierLabel}</div>
            {isInvited && (
              <div className="text-tea-text-sec italic text-[12px]">Not yet accepted</div>
            )}
          </div>
          <div className="text-tea-text-sec text-[13px] mt-1.5 leading-[1.5]">
            {bundlesText}
          </div>
        </div>
        {onClick && (
          <span className="text-tea-text-sec group-hover:text-tea-gold text-[13px] transition-colors shrink-0">
            Edit
          </span>
        )}
      </div>
    </Wrap>
  );
};
