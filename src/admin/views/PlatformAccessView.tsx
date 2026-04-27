import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { AccountApplication, AccountKind } from '../../types';

// Platform tier — Members & Access at /admin/access/platform.
// Per docs/NETWORK_ROLLOUT_PLAN.md §7-9.
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
        <p className="text-tea-text-sec italic">This view is for platform tier only.</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-4xl mx-auto">
      {/* Header — three quiet counts as type, not KPI cards */}
      <header className="mb-10">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-4`}>The network</h1>
        <div className="flex items-baseline gap-6 flex-wrap text-tea-text-sec">
          <CountLine value={counts.locations} label="Locations" />
          <span aria-hidden className="text-tea-border">·</span>
          <CountLine value={counts.masters} label="Tea Masters" />
          <span aria-hidden className="text-tea-border">·</span>
          <CountLine value={counts.pending} label="Pending" emphasis={counts.pending > 0} />
        </div>
      </header>

      {/* Quiet tab divider — text-link tabs, no chrome */}
      <nav className="flex gap-6 mb-8 border-b border-tea-border">
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
        <div className="mb-6 text-tea-text-sec italic text-[14px]">{error}</div>
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
    <span className="font-display text-[24px] font-light">{value}</span>{' '}
    <span className="text-[13px] tracking-[0.04em]">{label}</span>
  </span>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`pb-3 -mb-px font-display text-[15px] tracking-[0.04em] transition-colors ${
      active
        ? 'text-tea-text border-b border-tea-gold'
        : 'text-tea-text-sec hover:text-tea-text border-b border-transparent'
    }`}
  >
    {children}
  </button>
);

// ── Accounts register — pending → locations → masters ──────────────────────

interface AccountsRegisterProps {
  accounts: PlatformAccount[] | null;
  applications: AccountApplication[] | null;
  onChange: () => Promise<void> | void;
}

const AccountsRegister: React.FC<AccountsRegisterProps> = ({ accounts, applications, onChange }) => {
  if (accounts === null) {
    return <div className="text-tea-text-sec italic text-[14px]">Loading network…</div>;
  }

  const locations = accounts.filter(a => (a.kind || 'location') === 'location');
  const masters = accounts.filter(a => a.kind === 'master');
  const pending = applications || [];

  return (
    <div>
      {/* Pending — only if non-empty (per brief: "omitted entirely when empty") */}
      {pending.length > 0 && (
        <section className="mb-12">
          <SectionLabel>Pending applications</SectionLabel>
          {pending.map(app => (
            <PendingRow key={app.id} application={app} onChange={onChange} />
          ))}
        </section>
      )}

      {locations.length > 0 && (
        <section className="mb-12">
          <SectionLabel>Locations</SectionLabel>
          {locations.map(a => <AccountRow key={a.id} account={a} onChange={onChange} />)}
        </section>
      )}

      {masters.length > 0 && (
        <section className="mb-12">
          <SectionLabel>Tea Masters</SectionLabel>
          {masters.map(a => <AccountRow key={a.id} account={a} onChange={onChange} />)}
        </section>
      )}

      {locations.length === 0 && masters.length === 0 && pending.length === 0 && (
        <div className="text-tea-text-sec italic text-[15px] leading-[1.7]">
          No accounts yet.
        </div>
      )}
    </div>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-tea-text-sec text-[11px] uppercase tracking-[0.12em] mb-4">
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

  return (
    <div className={`py-4 ${isSuspended && !confirming ? 'opacity-50' : ''}`}>
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="font-display text-[17px] text-tea-text">{account.name}</div>
            {account.trust_tier && (
              <div className="text-tea-text-sec text-[11px] uppercase tracking-[0.1em]">
                {TIER_LABEL[account.trust_tier] || account.trust_tier}
              </div>
            )}
            {isSuspended && (
              <div className="text-tea-text-sec italic text-[12px]">Suspended</div>
            )}
          </div>
          {(account.owner_email || account.contact_email) && (
            <div className="text-tea-text-sec text-[13px] mt-1">
              {account.owner_email || account.contact_email}
            </div>
          )}
        </div>
        {!confirming && (
          <button
            type="button"
            onClick={() => handleAction(isSuspended ? 'reactivate' : 'suspend')}
            disabled={busy}
            className="text-tea-text-sec hover:text-tea-text transition-colors text-[13px] shrink-0"
          >
            {isSuspended ? 'Reactivate' : 'Suspend'}
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-4 space-y-3">
          <p className="text-tea-text-sec italic text-[14px] leading-[1.6]">
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
            className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-[14px] py-1.5 transition-colors"
          />
          <div className="flex items-center gap-6 text-[13px]">
            <button
              type="button"
              onClick={() => { setConfirming(null); setReason(''); }}
              disabled={busy}
              className="text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="text-tea-text-sec hover:text-tea-text transition-colors disabled:text-tea-text-dim"
            >
              {busy ? `${confirming === 'suspend' ? 'Suspending' : 'Reactivating'}…` : `Confirm ${confirming}`}
            </button>
          </div>
          {error && (
            <p className="text-tea-text-sec italic text-[13px]">{error}</p>
          )}
        </div>
      )}
    </div>
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

  return (
    <div className="py-5 border-b border-tea-border last:border-b-0">
      <div className="font-body text-[15px] leading-[1.65] text-tea-text mb-3">
        <span className="font-display">{application.applicant_name || application.applicant_email}</span>
        {' '}<span className="text-tea-text-sec">({application.applicant_email})</span>
        {' '}<span className="text-tea-text-sec text-[13px]">applied {formatDate(application.created_at)}</span>
        {' '}<span className="text-tea-text-sec text-[13px]">for a {application.proposed_account_kind === 'master' ? 'Tea Master' : 'Location'} account.</span>
      </div>
      {application.note && (
        <div className="text-tea-text-sec italic text-[14px] leading-[1.6] mb-4 pl-4 border-l border-tea-border">
          "{application.note}"
        </div>
      )}

      {mode === 'idle' && (
        <div className="flex gap-6 items-baseline text-[14px]">
          <button
            type="button"
            onClick={() => { setMode('approve'); setError(null); }}
            disabled={busy !== null}
            className="text-tea-gold hover:text-tea-gold-lt transition-colors"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => { setMode('decline'); setError(null); }}
            disabled={busy !== null}
            className="text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Decline
          </button>
        </div>
      )}

      {mode === 'approve' && (
        <div className="space-y-3">
          <div className="flex items-baseline gap-4 text-[14px] flex-wrap">
            <span className="text-tea-text-sec">Trust tier:</span>
            {(['basic', 'verified', 'partner'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTrustTier(t)}
                className={`font-display tracking-[0.04em] transition-colors ${
                  trustTier === t ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                }`}
              >
                {TIER_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="flex gap-6 items-baseline text-[14px]">
            <button
              type="button"
              onClick={() => { setMode('idle'); }}
              disabled={busy !== null}
              className="text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy !== null}
              className="text-tea-gold hover:text-tea-gold-lt transition-colors disabled:text-tea-text-dim"
            >
              {busy === 'approve' ? 'Approving…' : 'Confirm approval'}
            </button>
          </div>
        </div>
      )}

      {mode === 'decline' && (
        <div className="space-y-3">
          <p className="text-tea-text-sec italic text-[14px] leading-[1.6]">
            Decline {application.applicant_name || application.applicant_email}'s application?
          </p>
          <input
            type="text"
            value={declineNote}
            onChange={e => setDeclineNote(e.target.value)}
            placeholder="A reason helps the applicant (optional)"
            autoFocus
            className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-[14px] py-1.5 transition-colors"
          />
          <div className="flex gap-6 items-baseline text-[14px]">
            <button
              type="button"
              onClick={() => { setMode('idle'); setDeclineNote(''); }}
              disabled={busy !== null}
              className="text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={busy !== null}
              className="text-tea-text-sec hover:text-tea-text transition-colors disabled:text-tea-text-dim"
            >
              {busy === 'decline' ? 'Declining…' : 'Confirm decline'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-tea-text-sec italic text-[13px] mt-3">{error}</div>
      )}
    </div>
  );
};

// ── Platform register — invite Tea Master + audit log peek ──────────────

const PlatformRegister: React.FC<{ onChange: () => Promise<void> | void }> = ({ onChange }) => {
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ claim_link: string | null; email: string } | null>(null);
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
      setResult({ claim_link: res.claim_link, email: email.trim() });
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
            className="text-tea-text-sec hover:text-tea-gold transition-colors text-[14px] font-display"
          >
            Invite a Tea Master
          </button>
        ) : (
          <div className="space-y-4 max-w-md">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              autoFocus
              className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-[15px] py-2 transition-colors"
            />
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-[15px] py-2 transition-colors"
            />
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Why this person (optional, audit-only)"
              rows={2}
              className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-[14px] py-2 italic transition-colors resize-none"
            />
            <div className="flex items-center justify-between text-[13px] pt-1">
              <button
                type="button"
                onClick={() => { setInviting(false); setEmail(''); setName(''); setNote(''); }}
                className="text-tea-text-sec hover:text-tea-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInvite}
                disabled={!email.includes('@') || busy}
                className="text-tea-gold hover:text-tea-gold-lt disabled:text-tea-text-dim disabled:cursor-not-allowed transition-colors"
              >
                {busy ? 'Sending…' : 'Send invite'}
              </button>
            </div>
            {error && <div className="text-tea-text-sec italic text-[13px]">{error}</div>}
          </div>
        )}
        {result && (
          <div className="mt-4 text-tea-text-sec text-[13px] leading-[1.6]">
            <div>Tea Master account created for {result.email}.</div>
            {result.claim_link && (
              <div className="mt-1">
                Claim link to share manually:{' '}
                <code className="font-mono text-[12px] text-tea-text bg-tea-elevated px-2 py-0.5 rounded-[2px]">{result.claim_link}</code>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Audit log peek */}
      <section>
        <SectionLabel>Recent activity</SectionLabel>
        {auditError && <div className="text-tea-text-sec italic text-[13px]">{auditError}</div>}
        {auditEntries === null && !auditError && (
          <div className="text-tea-text-sec italic text-[13px]">Loading…</div>
        )}
        {auditEntries && auditEntries.length === 0 && (
          <div className="text-tea-text-sec italic text-[13px]">No activity yet.</div>
        )}
        {auditEntries && auditEntries.length > 0 && (
          <div className="space-y-3">
            {auditEntries.map(entry => (
              <div key={entry.id} className="text-tea-text text-[14px] leading-[1.6]">
                <span className="text-tea-text-sec font-mono text-[12px]">{formatDate(entry.created_at)}</span>
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
