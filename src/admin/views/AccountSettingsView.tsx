import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, AlertTriangle, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../store';
import type { Account, AccountMember, AccountRole } from '../../types';

function useCurrentRole(): AccountRole | null {
  const { memberships, activeAccountId } = useAppStore();
  return useMemo(
    () => memberships.find((m) => m.account_id === activeAccountId)?.role ?? null,
    [memberships, activeAccountId],
  );
}

interface AccountSettingsViewProps {
  embedded?: boolean;
}

export const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({ embedded = false }) => {
  const { activeAccountId, setActiveAccount } = useAppStore();
  const currentRole = useCurrentRole();
  const canEdit = currentRole === 'owner';

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!activeAccountId) return;
    let cancelled = false;
    setLoading(true);
    api.accounts
      .get(activeAccountId)
      .then((data) => {
        if (cancelled) return;
        setAccount(data);
        setActiveAccount(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load account');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAccountId, setActiveAccount]);

  const update = <K extends keyof Account>(key: K, value: Account[K]) => {
    setAccount((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !activeAccountId) return;
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    try {
      const updated = await api.accounts.update(activeAccountId, {
        name: account.name,
        tagline: account.tagline,
        description: account.description,
        logo_url: account.logo_url,
        cover_image_url: account.cover_image_url,
        location_city: account.location_city,
        location_country: account.location_country,
        timezone: account.timezone,
        currency_default: account.currency_default,
        whatsapp_number: account.whatsapp_number,
        contact_email: account.contact_email,
        public_enabled: account.public_enabled,
      });
      setAccount(updated);
      setActiveAccount(updated);
      setSaveMsg('Saved.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!activeAccountId) {
    return (
      <div className="p-12 text-center text-tea-text-sec font-serif">
        No active account selected.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-tea-text-dim">
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-12 text-center text-tea-text-sec font-serif">
        {error || 'Account not found.'}
      </div>
    );
  }

  const disabled = !canEdit || saving;

  return (
    <div className="h-full overflow-y-auto">
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl text-tea-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            Account Settings
          </h1>
          <p className="text-xs text-tea-text-dim uppercase tracking-[0.15em]">
            {account.name}
          </p>
        </div>
      )}

      {!canEdit && (
        <div className="mb-4 px-4 py-3 rounded-md bg-tea-elevated text-xs text-tea-text-sec">
          You don't have permission to edit these settings. View only.
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-tea-elevated text-xs text-tea-text-sec">
          {error}
        </div>
      )}
      {saveMsg && (
        <div className="mb-4 px-4 py-3 rounded-md bg-tea-gold-lt text-xs text-tea-text">
          {saveMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Read-only section */}
        <div className="bg-tea-surface rounded-lg border border-tea-border p-5 space-y-4">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim mb-1">
            System
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReadOnlyField label="Slug" value={account.slug} />
            <ReadOnlyField label="Invoice Prefix" value={account.invoice_prefix ?? '—'} />
            <ReadOnlyField
              label="Platform Owner"
              value={account.is_platform_owner ? 'Yes' : 'No'}
            />
          </div>
        </div>

        {/* Editable profile */}
        <div className="bg-tea-surface rounded-lg border border-tea-border p-5 space-y-4">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim mb-1">
            Profile
          </h2>
          <Field
            label="Name"
            value={account.name}
            onChange={(v) => update('name', v)}
            disabled={disabled}
          />
          <Field
            label="Tagline"
            value={account.tagline ?? ''}
            onChange={(v) => update('tagline', v)}
            disabled={disabled}
          />
          <TextAreaField
            label="Description"
            value={account.description ?? ''}
            onChange={(v) => update('description', v)}
            disabled={disabled}
          />
          <Field
            label="Logo URL"
            value={account.logo_url ?? ''}
            onChange={(v) => update('logo_url', v)}
            disabled={disabled}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="City"
              value={account.location_city ?? ''}
              onChange={(v) => update('location_city', v)}
              disabled={disabled}
            />
            <Field
              label="Country"
              value={account.location_country ?? ''}
              onChange={(v) => update('location_country', v)}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Commerce */}
        <div className="bg-tea-surface rounded-lg border border-tea-border p-5 space-y-4">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim mb-1">
            Commerce
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="WhatsApp Number"
              value={account.whatsapp_number ?? ''}
              onChange={(v) => update('whatsapp_number', v)}
              disabled={disabled}
            />
            <Field
              label="Default Currency"
              value={account.currency_default ?? ''}
              onChange={(v) => update('currency_default', v)}
              disabled={disabled}
            />
          </div>
          <label className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              checked={!!account.public_enabled}
              onChange={(e) => update('public_enabled', e.target.checked)}
              disabled={disabled}
              className="accent-tea-gold"
            />
            <span className="text-sm text-tea-text">Public shop enabled</span>
          </label>
        </div>

        {canEdit && (
          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold uppercase tracking-[0.15em] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
              Save Changes
            </button>
          </div>
        )}
      </form>

      {/* Danger Zone */}
      {canEdit && (
        <div className="mt-10">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim mb-3">
            Danger Zone
          </h2>
          <TransferOwnershipSection account={account} accountId={activeAccountId!} />
        </div>
      )}
    </div>
    </div>
  );
};

// ─── Transfer Ownership ──────────────────────────────────────────────────────

type TransferStep = 'idle' | 'select-member' | 'confirm-name' | 'verify-password';

const TransferOwnershipSection: React.FC<{
  account: Account;
  accountId: string;
}> = ({ account, accountId }) => {
  const [step, setStep] = useState<TransferStep>('idle');
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const selectedMember = members.find((m) => m.user_id === selectedMemberId) ?? null;
  const nameMatches = confirmName.trim() === account.name.trim();

  const openFlow = async () => {
    setStep('select-member');
    setSelectedMemberId('');
    setConfirmName('');
    setPasswordInput('');
    setTransferError(null);
    setLoadingMembers(true);
    try {
      const data = await api.accounts.listMembers(accountId);
      setMembers(data.filter((m) => m.role !== 'owner'));
    } catch {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedMember) return;
    setTransferring(true);
    setTransferError(null);
    try {
      const result = await api.auth.verifyPassword(passwordInput);
      if (!result?.verified) {
        setTransferError('Incorrect password. Transfer cancelled.');
        setTransferring(false);
        return;
      }
      await api.accounts.transferOwnership(accountId, selectedMember.user_id);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transfer failed. Please try again.';
      setTransferError(msg.includes('401') || msg.toLowerCase().includes('incorrect') ? 'Incorrect password. Transfer cancelled.' : msg);
      setTransferring(false);
    }
  };

  return (
    <div className="bg-tea-surface rounded-lg border border-tea-border overflow-hidden">
      <div className="px-5 py-4 flex items-start gap-4">
        <AlertTriangle size={16} className="text-tea-text-dim mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-tea-text font-medium">Transfer Ownership</p>
          <p className="text-xs text-tea-text-dim mt-0.5">
            Transfer this account to another team member. You will lose owner access.
          </p>
        </div>
        {step === 'idle' && (
          <button
            type="button"
            onClick={openFlow}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-[0.12em] border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-text-dim transition-colors"
          >
            Transfer <ArrowRight size={11} />
          </button>
        )}
      </div>

      {/* Gate 1: Select target member */}
      {step === 'select-member' && (
        <div className="border-t border-tea-border px-5 py-4 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim">Step 1 of 3 — Select new owner</p>
          {loadingMembers ? (
            <div className="flex items-center gap-2 text-xs text-tea-text-dim py-2">
              <Loader2 size={12} className="animate-spin" /> Loading team members…
            </div>
          ) : members.length === 0 ? (
            <p className="text-xs text-tea-text-sec py-2">No other team members. Add a member first.</p>
          ) : (
            <>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-1.5">
                  New Owner
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-sm text-tea-text outline-none focus:ring-2 focus:ring-tea-gold/40"
                >
                  <option value="">— select a team member —</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name || m.email} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-between">
                <button
                  type="button"
                  onClick={() => setStep('idle')}
                  className="px-3 py-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedMemberId}
                  onClick={() => { setConfirmName(''); setStep('confirm-name'); }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-tea-elevated text-tea-text text-xs font-semibold uppercase tracking-[0.12em] hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  Next <ArrowRight size={11} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Gate 2: Type exact account name */}
      {step === 'confirm-name' && selectedMember && (
        <div className="border-t border-tea-border px-5 py-4 space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim">Step 2 of 3 — Confirm account name</p>
          <div className="bg-tea-bg rounded-md px-4 py-3 text-sm text-tea-text-sec space-y-1">
            <p>
              Transfer <span className="text-tea-text font-medium">{account.name}</span> to{' '}
              <span className="text-tea-text font-medium">{selectedMember.name || selectedMember.email}</span>?
            </p>
            <p className="text-xs text-tea-text-dim">{selectedMember.email} · current role: {selectedMember.role}</p>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-1.5">
              Type the account name to confirm
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={account.name}
              autoFocus
              className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-sm text-tea-text outline-none focus:ring-2 focus:ring-tea-gold/40 placeholder-tea-text-dim"
            />
            <p className="mt-1 text-[11px] text-tea-text-dim">
              Must match exactly: <span className="text-tea-text-sec font-mono">{account.name}</span>
            </p>
          </div>
          <div className="flex gap-2 justify-between">
            <button
              type="button"
              onClick={() => setStep('select-member')}
              className="px-3 py-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!nameMatches}
              onClick={() => { setPasswordInput(''); setTransferError(null); setStep('verify-password'); }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-tea-elevated text-tea-text text-xs font-semibold uppercase tracking-[0.12em] hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              Next <ArrowRight size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Gate 3: Re-enter password */}
      {step === 'verify-password' && selectedMember && (
        <div className="border-t border-tea-border px-5 py-4 space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim">Step 3 of 3 — Authorise</p>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-1.5">
              Re-enter your password to authorise
            </label>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setTransferError(null); }}
              autoFocus
              className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-sm text-tea-text outline-none focus:ring-2 focus:ring-tea-gold/40"
            />
          </div>
          {transferError && (
            <p className="text-xs text-tea-text-sec">{transferError}</p>
          )}
          <div className="flex gap-2 justify-between">
            <button
              type="button"
              onClick={() => setStep('confirm-name')}
              disabled={transferring}
              className="px-3 py-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={!passwordInput || transferring}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-tea-elevated text-tea-text text-xs font-semibold uppercase tracking-[0.12em] hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {transferring ? <Loader2 size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
              Transfer Ownership
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Field helpers ────────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => (
  <div>
    <label className="block text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-2">
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-tea-bg text-tea-text text-sm px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-tea-gold/40 disabled:opacity-60"
    />
  </div>
);

const TextAreaField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => (
  <div>
    <label className="block text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-2">
      {label}
    </label>
    <textarea
      value={value}
      rows={3}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-tea-bg text-tea-text text-sm px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-tea-gold/40 disabled:opacity-60 resize-none"
    />
  </div>
);

const ReadOnlyField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim mb-1">{label}</div>
    <div className="text-sm text-tea-text-sec font-mono">{value || '—'}</div>
  </div>
);

export default AccountSettingsView;
