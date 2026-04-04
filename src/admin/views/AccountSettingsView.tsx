import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../store';
import type { Account, AccountRole } from '../../types';

function useCurrentRole(): AccountRole | null {
  const { memberships, activeAccountId } = useAppStore();
  return useMemo(
    () => memberships.find((m) => m.account_id === activeAccountId)?.role ?? null,
    [memberships, activeAccountId],
  );
}

export const AccountSettingsView: React.FC = () => {
  const { activeAccountId, setActiveAccount } = useAppStore();
  const currentRole = useCurrentRole();
  const canEdit = currentRole === 'owner' || currentRole === 'manager';

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
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl text-tea-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          Account Settings
        </h1>
        <p className="text-xs text-tea-text-dim uppercase tracking-[0.15em]">
          {account.name}
        </p>
      </div>

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
    </div>
  );
};

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
