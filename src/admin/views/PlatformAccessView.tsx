import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { AccountApplication, AccountKind } from '../../types';

const initialsForName = (raw: string): string => {
  const source = (raw || '').trim();
  if (!source) return '·';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0] + parts[1]![0]).toUpperCase();
  const word = parts[0] || source;
  return word.slice(0, 2).toUpperCase();
};

const TIER_CHIP_ACTIVE = 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40';
const TIER_CHIP_INACTIVE = 'bg-tea-elevated text-tea-text-sec';

// Platform tier: Members & Access at /admin/access/platform.
// Per docs/ARCHITECTURE.md.
// Two registers in one component: this is the platform-tier register
// showing the union of all accounts. Adrian acts on the network from here.

interface PlatformAccount {
  id: string;
  slug: string;
  name: string;
  kind?: AccountKind;
  status?: string;
  trust_tier?: string;
  contact_email?: string;
  owner_email?: string;
  is_platform_owner?: boolean;
}

const TIER_LABEL: Record<string, string> = {
  basic: 'Basic',
  verified: 'Verified',
  partner: 'Partner',
};

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
};

export const PlatformAccessView: React.FC = () => {
  const platformRole = useAppStore(s => s.platformRole);
  const isPlatformOwner = platformRole === 'platform_owner';

  const [tab, setTab] = useState<'accounts' | 'platform'>('accounts');
  const [accounts, setAccounts] = useState<PlatformAccount[] | null>(null);
  const [applications, setApplications] = useState<AccountApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [acctData, appData] = await Promise.all([
        api.platform.listAccounts(),
        api.platform.listApplications({ status: 'pending' }),
      ]);
      setAccounts(acctData.accounts as PlatformAccount[]);
      setApplications(appData.applications);
    } catch (err: any) {
      setError(err?.message || 'Could not reach the server. Showing the last known state.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const list = accounts || [];
    return {
      locations: list.filter(a => (a.kind || 'location') === 'location' && !a.is_platform_owner).length,
      masters: list.filter(a => a.kind === 'master').length,
      pending: applications?.length || 0,
    };
  }, [accounts, applications]);

  if (!platformRole) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-3xl mx-auto">
        <p className="text-tea-text-sec text-ui-14">This view is for platform tier only.</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-4xl mx-auto">
      {/* Header: three quiet counts as type, not KPI cards */}
      <header className="mb-8">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>The network</h1>
        <p className="label-caps text-tea-text-dim mt-1">Platform tier · accounts and operators</p>
        <div className="flex items-baseline gap-6 flex-wrap text-tea-text-sec mt-4">
          <CountLine value={counts.locations} label="Locations" />
          <span aria-hidden className="text-tea-border">·</span>
          <CountLine value={counts.masters} label="Tea Masters" />
          <span aria-hidden className="text-tea-border">·</span>
          <CountLine value={counts.pending} label="Pending" emphasis={counts.pending > 0} />
        </div>
      </header>

      {/* Tab strip, bottom-border underline */}
      <nav className="flex items-center gap-6 mb-8 border-b border-tea-border">
        <TabButton active={tab === 'accounts'} onClick={() => setTab('accounts')}>
          Accounts
        </TabButton>
        {isPlatformOwner && (
          <TabButton active={tab === 'platform'} onClick={() => setTab('platform')}>
            Platform
          </TabButton>
        )}
      </nav>

      {error && (
        <div className="mb-6 text-ui-12 text-tea-error">{error}</div>
      )}

      {tab === 'accounts' && (
        <AccountsRegister
          accounts={accounts}
          applications={applications}
          onChange={load}
        />
      )}

      {tab === 'platform' && isPlatformOwner && (
        <PlatformRegister onChange={load} />
      )}
    </div>
  );
};

const CountLine: React.FC<{ value: number; label: string; emphasis?: boolean }> = ({ value, label, emphasis }) => (
  <span className={`${emphasis ? 'text-tea-gold' : ''}`}>
    <span className="font-display text-[24px] font-normal">{value}</span>{' '}
    <span className="text-ui-13 tracking-[0.04em]">{label}</span>
  </span>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`py-2.5 text-ui-12 uppercase tracking-caps transition-colors ${
      active
        ? 'text-tea-text border-b border-tea-gold'
        : 'text-tea-text-sec hover:text-tea-text border-b border-transparent'
    }`}
  >
    {children}
  </button>
);

// ── Accounts register, pending → locations → masters ──────────────────────

interface AccountsRegisterProps {
  accounts: PlatformAccount[] | null;
  applications: AccountApplication[] | null;
  onChange: () => Promise<void> | void;
}

const AccountsRegister: React.FC<AccountsRegisterProps> = ({ accounts, applications, onChange }) => {
  if (accounts === null) {
    return <div className="text-tea-text-sec text-ui-14">Loading network…</div>;
  }

  const locations = accounts.filter(a => (a.kind || 'location') === 'location');
  const masters = accounts.filter(a => a.kind === 'master');
  const pending = applications || [];

  return (
    <div>
      {/* Pending, only if non-empty (per brief: "omitted entirely when empty") */}
      {pending.length > 0 && (
        <section className="mb-12">
          <SectionLabel>Pending applications</SectionLabel>
          <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
            {pending.map(app => (
              <PendingRow key={app.id} application={app} onChange={onChange} />
            ))}
          </ul>
        </section>
      )}

      {locations.length > 0 && (
        <section className="mb-12">
          <SectionLabel>Locations</SectionLabel>
          <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
            {locations.map(a => <AccountRow key={a.id} account={a} onChange={onChange} />)}
          </ul>
        </section>
      )}

      {masters.length > 0 && (
        <section className="mb-12">
          <SectionLabel>Tea Masters</SectionLabel>
          <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
            {masters.map(a => <AccountRow key={a.id} account={a} onChange={onChange} />)}
          </ul>
        </section>
      )}

      {locations.length === 0 && masters.length === 0 && pending.length === 0 && (
        <div className="text-tea-text-sec text-ui-14 leading-[1.7]">
          No accounts yet.
        </div>
      )}
    </div>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="label-caps text-tea-text-sec mb-4">
    {children}
  </div>
);

const AccountRow: React.FC<{ account: PlatformAccount; onChange: () => Promise<void> | void }> = ({ account, onChange }) => {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<'suspend' | 'reactivate' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isSuspended = account.status === 'suspended';

  const handleAction = (action: 'suspend' | 'reactivate') => {
    setConfirming(action);
    setReason('');
    setError(null);
  };

  const handleConfirm = async () => {
    if (!confirming || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (confirming === 'suspend') {
        await api.platform.suspendAccount(account.id, reason.trim() || undefined);
      } else {
        await api.platform.reactivateAccount(account.id, reason.trim() || undefined);
      }
      setConfirming(null);
      setReason('');
      await onChange();
    } catch (err: any) {
      setError(err?.message || `Could not ${confirming}.`);
    } finally {
      setBusy(false);
    }
  };

  const tierKey = account.trust_tier || '';
  const tierLabel = TIER_LABEL[tierKey] || tierKey;
  const tierIsActive = tierKey === 'verified' || tierKey === 'partner';

  return (
    <li className={`px-4 py-3 ${isSuspended && !confirming ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3 w-full">
        <div className="w-10 h-10 rounded-full bg-tea-elevated text-tea-text-sec font-display text-ui-14 flex items-center justify-center flex-shrink-0">
          {initialsForName(account.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-ui-15 text-tea-text truncate">{account.name}</div>
          {(account.owner_email || account.contact_email) && (
            <div className="text-ui-12 text-tea-text-dim mt-0.5 truncate">
              {account.owner_email || account.contact_email}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {tierKey && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-ui-9 uppercase font-sans tracking-caps ${
                tierIsActive ? TIER_CHIP_ACTIVE : TIER_CHIP_INACTIVE
              }`}
            >
              {tierLabel}
            </span>
          )}
          {isSuspended && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-ui-9 uppercase font-sans tracking-caps bg-tea-error/10 text-tea-error ring-1 ring-inset ring-tea-error/40">
              Suspended
            </span>
          )}
          {!confirming && (
            <button
              type="button"
              onClick={() => handleAction(isSuspended ? 'reactivate' : 'suspend')}
              disabled={busy}
              aria-label={isSuspended ? 'Reactivate account' : 'Suspend account'}
              title={isSuspended ? 'Reactivate' : 'Suspend'}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors tap-target"
            >
              <MoreHorizontal size={16} />
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div className="mt-4 space-y-3 bg-tea-surface border border-tea-border rounded-xl p-4">
          <p className="text-ui-14 text-tea-text-sec leading-[1.6]">
            {confirming === 'suspend'
              ? `Suspend ${account.name}? No one in this account will be able to act, including the owner. The account's data is preserved.`
              : `Reactivate ${account.name}?`}
          </p>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={confirming === 'suspend' ? 'Reason (optional)' : 'Note (optional)'}
            autoFocus
            className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { setConfirming(null); setReason(''); }}
              disabled={busy}
              className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-40 ${
                confirming === 'suspend'
                  ? 'bg-tea-error text-tea-bg hover:bg-tea-error/90'
                  : 'cta-solid'
              }`}
            >
              {busy ? `${confirming === 'suspend' ? 'Suspending' : 'Reactivating'}…` : `Confirm ${confirming === 'suspend' ? 'Suspend' : 'Reactivate'}`}
            </button>
          </div>
          {error && (
            <p className="text-ui-12 text-tea-error">{error}</p>
          )}
        </div>
      )}
    </li>
  );
};

const PendingRow: React.FC<{ application: AccountApplication; onChange: () => Promise<void> | void }> = ({ application, onChange }) => {
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const [mode, setMode] = useState<'idle' | 'approve' | 'decline'>('idle');
  const [trustTier, setTrustTier] = useState<'basic' | 'verified' | 'partner'>('basic');
  const [declineNote, setDeclineNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setBusy('approve');
    setError(null);
    try {
      await api.platform.decideApplication(application.id, 'approve', { trust_tier: trustTier });
      await onChange();
    } catch (err: any) {
      setError(err?.message || 'Could not approve.');
    } finally {
      setBusy(null);
    }
  };

  const handleDecline = async () => {
    setBusy('decline');
    setError(null);
    try {
      await api.platform.decideApplication(application.id, 'decline', { decision_note: declineNote.trim() || undefined });
      await onChange();
    } catch (err: any) {
      setError(err?.message || 'Could not decline.');
    } finally {
      setBusy(null);
    }
  };

  const displayName = application.applicant_name || application.applicant_email;
  const kindLabel = application.proposed_account_kind === 'master' ? 'Tea Master' : 'Location';

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3 w-full">
        <div className="w-10 h-10 rounded-full bg-tea-elevated text-tea-text-sec font-display text-ui-14 flex items-center justify-center flex-shrink-0">
          {initialsForName(displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-ui-15 text-tea-text truncate">{displayName}</div>
          <div className="text-ui-12 text-tea-text-dim mt-0.5 truncate">{application.applicant_email}</div>
          <div className="text-ui-12 text-tea-text-sec mt-1">
            Applied {formatDate(application.created_at)} for a {kindLabel} account.
          </div>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-ui-9 uppercase font-sans tracking-caps bg-tea-elevated text-tea-text-sec flex-shrink-0">
          Pending
        </span>
      </div>

      {application.note && (
        <div className="text-tea-text-sec text-ui-13 leading-[1.6] mt-3 pl-4 border-l border-tea-border italic">
          "{application.note}"
        </div>
      )}

      {mode === 'idle' && (
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => { setMode('approve'); setError(null); }}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => { setMode('decline'); setError(null); }}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error text-tea-bg text-xs font-semibold hover:bg-tea-error/90 transition-colors disabled:opacity-40"
          >
            Decline
          </button>
        </div>
      )}

      {mode === 'approve' && (
        <div className="space-y-3 bg-tea-surface border border-tea-border rounded-xl p-4">
          <div>
            <div className="label-caps text-tea-text-sec mb-2">Trust tier</div>
            <div className="flex items-center gap-2 flex-wrap">
              {(['basic', 'verified', 'partner'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrustTier(t)}
                  className={`px-3 py-1.5 rounded-md text-ui-12 transition-colors ${
                    trustTier === t
                      ? 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40'
                      : 'border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub'
                  }`}
                >
                  {TIER_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { setMode('idle'); }}
              disabled={busy !== null}
              className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40"
            >
              {busy === 'approve' ? 'Approving…' : 'Confirm Approval'}
            </button>
          </div>
        </div>
      )}

      {mode === 'decline' && (
        <div className="space-y-3 bg-tea-surface border border-tea-border rounded-xl p-4">
          <p className="text-ui-14 text-tea-text-sec leading-[1.6]">
            Decline {application.applicant_name || application.applicant_email}'s application?
          </p>
          <input
            type="text"
            value={declineNote}
            onChange={e => setDeclineNote(e.target.value)}
            placeholder="A reason helps the applicant (optional)"
            autoFocus
            className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { setMode('idle'); setDeclineNote(''); }}
              disabled={busy !== null}
              className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error text-tea-bg text-xs font-semibold hover:bg-tea-error/90 transition-colors disabled:opacity-40"
            >
              {busy === 'decline' ? 'Declining…' : 'Confirm Decline'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-ui-12 text-tea-error mt-3">{error}</div>
      )}
    </li>
  );
};

// ── Platform register, invite Tea Master + audit log peek ──────────────

const PlatformRegister: React.FC<{ onChange: () => Promise<void> | void }> = ({ onChange }) => {
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ claim_link: string | null; email: string; email_sent: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [auditEntries, setAuditEntries] = useState<any[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    api.platform.getAuditLog({ limit: 5 })
      .then(d => setAuditEntries(d.entries))
      .catch(err => setAuditError(err?.message || null));
  }, []);

  const handleInvite = async () => {
    if (!email.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await api.platform.inviteTeaMaster({
        email: email.trim().toLowerCase(),
        name: name.trim() || undefined,
        note: note.trim() || undefined,
      });
      setResult({ claim_link: res.claim_link, email: email.trim(), email_sent: res.email_sent });
      setEmail(''); setName(''); setNote('');
      setInviting(false);
      await onChange();
    } catch (err: any) {
      setError(err?.message || 'Could not send invite.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* Invite Tea Master */}
      <section className="mb-12">
        <SectionLabel>Invite a Tea Master</SectionLabel>
        {!inviting ? (
          <button
            type="button"
            onClick={() => { setInviting(true); setResult(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors"
          >
            Invite Tea Master
          </button>
        ) : (
          <div className="space-y-3 max-w-md bg-tea-surface border border-tea-border rounded-xl p-5">
            <div>
              <label className="label-caps text-tea-text-sec mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@example.com"
                autoFocus
                className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="label-caps text-tea-text-sec mb-1.5 block">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Optional"
                className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="label-caps text-tea-text-sec mb-1.5 block">Note</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Why this person (audit-only, optional)"
                rows={2}
                className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none resize-none"
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setInviting(false); setEmail(''); setName(''); setNote(''); }}
                className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInvite}
                disabled={!email.includes('@') || busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
            {error && <div className="text-ui-12 text-tea-error">{error}</div>}
          </div>
        )}
        {result && (
          <div className="mt-4 text-tea-text-sec text-ui-13 leading-[1.6]">
            <div>Tea Master account created for {result.email}.</div>
            {result.email_sent ? (
              <div className="mt-1">Invite email sent.</div>
            ) : (
              result.claim_link && (
                <div className="mt-1 text-tea-text">
                  Invite created, but email could not be sent. Share this link manually:{' '}
                  <code className="font-mono text-ui-12 text-tea-text bg-tea-elevated px-2 py-0.5 rounded-md">{result.claim_link}</code>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* Audit log peek */}
      <section>
        <SectionLabel>Recent activity</SectionLabel>
        {auditError && <div className="text-ui-12 text-tea-error">{auditError}</div>}
        {auditEntries === null && !auditError && (
          <div className="text-ui-13 text-tea-text-dim">Loading…</div>
        )}
        {auditEntries && auditEntries.length === 0 && (
          <div className="text-ui-13 text-tea-text-dim">No activity yet.</div>
        )}
        {auditEntries && auditEntries.length > 0 && (
          <div className="space-y-3">
            {auditEntries.map(entry => (
              <div key={entry.id} className="text-tea-text text-ui-14 leading-[1.6]">
                <span className="text-tea-text-dim font-mono text-ui-12">{formatDate(entry.created_at)}</span>
                {' · '}
                <span>{entry.actor_email || 'system'} {entry.action.replace(/_/g, ' ').replace(/\./g, ' ')}{entry.target_id ? ` · ${entry.target_id}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
