import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ShieldCheck, Store, Users, Check, Loader2,
  ChevronDown, ChevronUp, Plus, Copy,
  AlertTriangle, RefreshCw, ClipboardList, X, Boxes,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { PlatformUser, PlatformAccount, AuditLogEntry } from '../../lib/api';
import { useAppStore } from '../store';
import { useToast } from '../components/Toast';
import { Button } from '../../components/shared/Button';
import type { PlatformRole } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const KNOWN_FEATURES: { id: string; label: string; description: string; planDefault: string[] }[] = [
  { id: 'compass',             label: 'Curate',               description: 'Tea sourcing, tasting & tracking tool',          planDefault: ['verified', 'partner', 'platform'] },
  { id: 'catalog_sharing',     label: 'Catalog Access',       description: 'Source teas from the Teajia catalog',            planDefault: ['partner', 'platform'] },
  { id: 'ai_wisdom_generation',label: 'AI Wisdom Generation', description: 'Generate lore, terroir & experience copy via Claude', planDefault: ['platform'] },
];

const TRUST_TIERS: { value: 'basic' | 'verified' | 'partner'; label: string; description: string }[] = [
  { value: 'basic',    label: 'Basic',    description: 'New account, default access' },
  { value: 'verified', label: 'Verified', description: 'Identity confirmed — Curate enabled' },
  { value: 'partner',  label: 'Partner',  description: 'Full partner — all features available' },
];

const CURRENCIES = ['USD', 'AUD', 'NT', 'Yuan', 'MYR', 'IDR', 'JPY', 'HKD'];
const TIMEZONES  = ['UTC','Asia/Taipei','Asia/Singapore','Asia/Jakarta','Australia/Sydney','America/New_York','America/Los_Angeles','Europe/London','Asia/Tokyo','Asia/Kuala_Lumpur'];

// ── Shared primitives ─────────────────────────────────────────────────────────

/** Eyebrow: the ONE uppercase micro-label role. Use it for section headers only. */
const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim ${className}`}>{children}</p>
);

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; hint?: string; type?: string }> =
  ({ label, value, onChange, placeholder, required, hint, type = 'text' }) => (
    <label className="block space-y-1">
      <span className="text-ui-12 text-tea-text-sec">{label}{required && <span className="text-tea-gold ml-0.5">*</span>}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-tea-text text-sm outline-none focus:ring-2 focus:ring-tea-gold/40" />
      {hint && <p className="text-ui-11 text-tea-text-dim">{hint}</p>}
    </label>
  );

const SelectField: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: string[] }> =
  ({ label, value, onChange, options }) => (
    <label className="block space-y-1">
      <span className="text-ui-12 text-tea-text-sec">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-tea-text text-sm outline-none focus:ring-2 focus:ring-tea-gold/40">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

const Toggle: React.FC<{ enabled: boolean; onChange: (v: boolean) => void; busy?: boolean; disabled?: boolean }> = ({ enabled, onChange, busy, disabled }) => (
  <button type="button" onClick={() => onChange(!enabled)} disabled={busy || disabled}
    className={`relative w-10 h-5 rounded-full transition-colors shrink-0 disabled:opacity-40 ${enabled ? 'bg-tea-gold' : 'bg-tea-surface'}`}>
    {busy
      ? <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-tea-text-dim" />
      : <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-tea-bg  transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />}
  </button>
);

const PlatformRoleBadge: React.FC<{ role: PlatformRole }> = ({ role }) => {
  if (!role) return null;
  return (
    <span className={`badge-status ${role === 'platform_owner' ? 'badge-status-gold' : 'badge-status-default'} flex items-center gap-1`}>
      {role === 'platform_owner' ? <ShieldCheck size={10} /> : <Shield size={10} />}
      {role === 'platform_owner' ? 'Super Owner' : 'Platform Admin'}
    </span>
  );
};

/**
 * ConfirmButton — two-stage inline confirm.
 * First click arms the button; second click (within timeout) fires.
 * Prevents one-click suspension/grant mistakes without interrupting flow.
 */
const ConfirmButton: React.FC<{
  onConfirm: () => void;
  busy?: boolean;
  idleLabel: React.ReactNode;
  confirmLabel: React.ReactNode;
  idleVariant?: 'primary' | 'secondary' | 'danger';
  confirmVariant?: 'primary' | 'danger';
  timeoutMs?: number;
  title?: string;
  disabled?: boolean;
}> = ({ onConfirm, busy, idleLabel, confirmLabel, idleVariant = 'secondary', confirmVariant = 'danger', timeoutMs = 3500, title, disabled }) => {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const handleClick = () => {
    if (busy || disabled) return;
    if (!armed) {
      setArmed(true);
      timer.current = window.setTimeout(() => setArmed(false), timeoutMs);
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    setArmed(false);
    onConfirm();
  };

  return (
    <Button type="button" onClick={handleClick} disabled={disabled} loading={busy} title={title}
      variant={armed ? confirmVariant : idleVariant} size="sm">
      {!busy && armed ? <AlertTriangle size={10} /> : null}
      {armed ? confirmLabel : idleLabel}
    </Button>
  );
};

// ── Users panel ───────────────────────────────────────────────────────────────

const UsersPanel: React.FC<{ isPlatformOwner: boolean }> = ({ isPlatformOwner }) => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{ userId: string; link: string; copied: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.platform.listUsers();
      setUsers(d.users);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load users', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleToggleAdmin = async (user: PlatformUser) => {
    setBusy(user.id);
    const next: PlatformRole = user.platform_role === 'platform_admin' ? null : 'platform_admin';
    try {
      await api.platform.setUserPlatformRole(user.id, next);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, platform_role: next } : u));
      showToast(next ? `Platform admin granted to ${user.email}` : `Platform admin revoked from ${user.email}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update admin role', 'error');
    } finally { setBusy(null); }
  };

  // Stock spine step 5 — grant or revoke a user's public shelf.
  const handleToggleShelf = async (user: PlatformUser) => {
    setBusy(`shelf-${user.id}`);
    try {
      if (user.shelf_enabled) {
        await api.platform.grantShelf(user.id, { enabled: false });
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, shelf_enabled: false } : u));
        showToast(`Shelf revoked from ${user.email}`, 'success');
      } else {
        const suggested = user.username || (user.email.split('@')[0] ?? '');
        const slug = window.prompt('Shelf link — /u/<slug>', suggested);
        if (!slug) { setBusy(null); return; }
        const res = await api.platform.grantShelf(user.id, { enabled: true, slug });
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, shelf_enabled: true, shelf_slug: res.slug } : u));
        showToast(`Shelf granted — /u/${res.slug}`, 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to update shelf', 'error');
    } finally { setBusy(null); }
  };

  const handleResendInvite = async (user: PlatformUser) => {
    setBusy(`invite-${user.id}`);
    try {
      const res = await api.platform.resendInvite(user.id);
      if (res.email_sent) {
        showToast(`Invite email sent to ${user.email}`, 'success');
      } else {
        setInviteResult({ userId: user.id, link: `${window.location.origin}${res.invite_link}`, copied: false });
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to resend invite', 'error');
    } finally { setBusy(null); }
  };

  const copyInvite = () => {
    if (!inviteResult) return;
    navigator.clipboard.writeText(inviteResult.link);
    setInviteResult(r => r ? { ...r, copied: true } : null);
    setTimeout(() => setInviteResult(r => r ? { ...r, copied: false } : null), 2000);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-tea-text-dim" /></div>;

  return (
    <div className="space-y-2">
      {inviteResult && (
        <div className="inset-panel p-3 space-y-2">
          <p className="text-ui-12 text-tea-text-sec">Invite link — email not configured, copy manually:</p>
          <div className="flex gap-2">
            <code className="flex-1 text-ui-11 font-mono bg-tea-bg border border-tea-border rounded px-2 py-1.5 text-tea-text-sec truncate">{inviteResult.link}</code>
            <button type="button" onClick={copyInvite} className="pill flex items-center gap-1 shrink-0">
              {inviteResult.copied ? <Check size={10} /> : <Copy size={10} />}
              {inviteResult.copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button type="button" onClick={() => setInviteResult(null)} className="text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors">Dismiss</button>
        </div>
      )}

      {users.map(user => {
        const isPO = user.platform_role === 'platform_owner';
        const isPA = user.platform_role === 'platform_admin';
        return (
          <div key={user.id} className="inset-panel px-3 py-2.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-tea-gold/10 flex items-center justify-center shrink-0">
              <span className="text-tea-gold text-ui-11 font-semibold uppercase">{(user.name || user.email).slice(0, 2)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-tea-text text-sm font-medium truncate">{user.name || '—'}</p>
                <PlatformRoleBadge role={user.platform_role} />
              </div>
              <p className="text-tea-text-sec text-ui-12 truncate">{user.email}</p>
              {user.memberships.length > 0 && (
                <p className="text-tea-text-dim text-ui-11 mt-0.5 truncate">
                  {user.memberships.map(m => `${m.account_id} · ${m.role}`).join('  ·  ')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isPlatformOwner && !isPO && (
                isPA ? (
                  <ConfirmButton
                    onConfirm={() => handleToggleAdmin(user)}
                    busy={busy === user.id}
                    idleLabel={<><Check size={10} />Admin</>}
                    confirmLabel={<>Revoke?</>}
                    title="Revoke platform admin role"
                  />
                ) : (
                  <ConfirmButton
                    onConfirm={() => handleToggleAdmin(user)}
                    busy={busy === user.id}
                    idleLabel={<><Shield size={10} />Make Admin</>}
                    confirmLabel={<>Grant platform-wide access?</>}
                    confirmVariant="primary"
                    title="Grants platform-wide admin access — not account-level"
                  />
                )
              )}
              {isPlatformOwner && (
                <button type="button" onClick={() => handleToggleShelf(user)} disabled={busy === `shelf-${user.id}`}
                  className={`${user.shelf_enabled ? 'pill pill-active' : 'pill'} flex items-center gap-1`}
                  title={user.shelf_enabled ? `Public shelf at /u/${user.shelf_slug} — click to revoke` : 'Grant a public shelf'}>
                  {busy === `shelf-${user.id}` ? <Loader2 size={10} className="animate-spin" /> : <Store size={10} />}
                  Shelf
                </button>
              )}
              <button type="button" onClick={() => handleResendInvite(user)} disabled={busy === `invite-${user.id}`}
                className="pill flex items-center gap-1" title="Resend invite">
                {busy === `invite-${user.id}` ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                Invite
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Accounts panel ────────────────────────────────────────────────────────────

const AccountsPanel: React.FC = () => {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, any>>({});
  const [busyFeature, setBusyFeature] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState<string | null>(null);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.platform.listAccounts();
      setAccounts(d.accounts);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load accounts', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleToggleFeature = async (accountId: string, feature: string, current: boolean) => {
    const key = `${accountId}:${feature}`;
    setBusyFeature(key);
    try {
      await api.platform.toggleFeature(accountId, feature, !current);
      setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, features: { ...a.features, [feature]: !current } } : a));
    } catch (err: any) {
      showToast(err?.message || `Failed to toggle ${feature}`, 'error');
    } finally { setBusyFeature(null); }
  };

  const handleToggleSuspend = async (account: PlatformAccount) => {
    const next = account.status === 'suspended' ? 'active' : 'suspended';
    setBusyStatus(account.id);
    try {
      await api.platform.setAccountStatus(account.id, next);
      setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, status: next } : a));
      showToast(next === 'suspended' ? `${account.name} suspended` : `${account.name} reactivated`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status', 'error');
    } finally { setBusyStatus(null); }
  };

  const handleSetTrustTier = async (accountId: string, tier: 'basic' | 'verified' | 'partner') => {
    setBusyTier(accountId);
    try {
      await api.platform.setTrustTier(accountId, tier);
      setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, trust_tier: tier } : a));
    } catch (err: any) {
      showToast(err?.message || 'Failed to update trust tier', 'error');
    } finally { setBusyTier(null); }
  };

  const startEdit = (a: PlatformAccount) => { setEditing(a.id); setEditDraft({ name: a.name, location_city: a.location_city || '', location_country: a.location_country || '' }); };

  const handleSaveEdit = async (accountId: string) => {
    setSaveBusy(true);
    try {
      await api.accounts.update(accountId, editDraft as any);
      setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, ...editDraft } : a));
      setEditing(null);
      showToast('Profile updated', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save profile', 'error');
    } finally { setSaveBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-tea-text-dim" /></div>;

  const q = query.trim().toLowerCase();
  const visible = q
    ? accounts.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        (a.location_city || '').toLowerCase().includes(q) ||
        (a.location_country || '').toLowerCase().includes(q))
    : accounts;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search accounts…"
          className="flex-1 bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-tea-text text-sm outline-none focus:ring-2 focus:ring-tea-gold/40"
        />
        <span className="text-ui-11 text-tea-text-dim tabular-nums shrink-0">{visible.length}/{accounts.length}</span>
      </div>

      <div className="space-y-1.5">
      {visible.map(account => {
        const isOpen = expanded.has(account.id);
        const isSuspended = account.status === 'suspended';
        const enabledCount = Object.values(account.features).filter(Boolean).length;
        const currentTier = account.trust_tier || 'basic';
        const tierInfo = TRUST_TIERS.find(t => t.value === currentTier);

        return (
          <div key={account.id} className={`inset-panel overflow-hidden ${isSuspended ? 'opacity-60' : ''}`}>
            <button type="button" onClick={() => toggleExpand(account.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-tea-elevated transition-colors">
              <Store size={14} className={account.is_platform_owner ? 'text-tea-gold' : isSuspended ? 'text-tea-text-dim' : 'text-tea-text-sec'} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-tea-text text-sm font-medium truncate">{account.name}</p>
                  {account.is_platform_owner && <span className="badge-status badge-status-gold">Primary</span>}
                  {isSuspended && <span className="badge-status badge-status-default flex items-center gap-0.5"><AlertTriangle size={9} />Suspended</span>}
                </div>
                <p className="text-tea-text-sec text-ui-12">
                  /{account.slug} · {account.member_count} {account.member_count === 1 ? 'member' : 'members'}
                  {account.location_city ? ` · ${account.location_city}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Always show tier and feature count so scanning finds anomalies without expanding */}
                <span className={`badge-status ${currentTier === 'basic' ? 'badge-status-muted' : 'badge-status-gold'}`}>{tierInfo?.label}</span>
                <span className={`badge-status ${enabledCount > 0 ? 'badge-status-gold' : 'badge-status-muted'} tabular-nums`} title={`${enabledCount} feature${enabledCount !== 1 ? 's' : ''} enabled`}>
                  {enabledCount} feat
                </span>
                {isOpen ? <ChevronUp size={13} className="text-tea-text-dim" /> : <ChevronDown size={13} className="text-tea-text-dim" />}
              </div>
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-2 border-t border-tea-border space-y-4">

                {/* Profile edit */}
                {editing === account.id ? (
                  <div className="space-y-3">
                    <Eyebrow>Edit Profile</Eyebrow>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Name" value={editDraft.name || ''} onChange={v => setEditDraft(d => ({ ...d, name: v }))} required />
                      <Field label="City" value={editDraft.location_city || ''} onChange={v => setEditDraft(d => ({ ...d, location_city: v }))} />
                      <Field label="Country" value={editDraft.location_country || ''} onChange={v => setEditDraft(d => ({ ...d, location_country: v }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => setEditing(null)} className="text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors">Cancel</button>
                      <Button type="button" onClick={() => handleSaveEdit(account.id)} disabled={saveBusy} loading={saveBusy} variant="primary" size="sm" icon={<Check size={10} />}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="text-ui-12 text-tea-text-sec space-y-0.5">
                      <p>ID <span className="font-mono text-ui-11 text-tea-text-dim">{account.id}</span></p>
                      {account.location_city && <p>{account.location_city}{account.location_country ? `, ${account.location_country}` : ''}</p>}
                    </div>
                    <button type="button" onClick={() => startEdit(account)} className="pill text-ui-11">Edit profile</button>
                  </div>
                )}

                {/* Trust tier */}
                <div className="space-y-2">
                  <Eyebrow>Trust Tier</Eyebrow>
                  <div className="flex gap-1.5 flex-wrap">
                    {TRUST_TIERS.map(tier => (
                      <button key={tier.value} type="button"
                        onClick={() => handleSetTrustTier(account.id, tier.value)}
                        disabled={busyTier === account.id || account.is_platform_owner}
                        title={tier.description}
                        className={`pill flex items-center gap-1 ${currentTier === tier.value ? 'pill-active' : ''}`}>
                        {busyTier === account.id && currentTier !== tier.value ? <Loader2 size={10} className="animate-spin" /> : null}
                        {tier.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-ui-12 text-tea-text-sec">{tierInfo?.description}</p>
                </div>

                {/* Features */}
                <div className="space-y-2">
                  <Eyebrow>Features</Eyebrow>
                  {KNOWN_FEATURES.map(feat => {
                    const enabled = account.features[feat.id] ?? false;
                    const tier = account.trust_tier ?? 'basic';
                    const isPlanDefault = account.is_platform_owner
                      ? feat.planDefault.includes('platform')
                      : feat.planDefault.includes(tier);
                    return (
                      <div key={feat.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-tea-text text-ui-13 font-medium">{feat.label}</p>
                            {isPlanDefault && (
                              <span className="text-ui-10 text-tea-gold/70" title={`Included by default on ${feat.planDefault.join(' / ')} tier`}>included</span>
                            )}
                          </div>
                          <p className="text-tea-text-sec text-ui-12">{feat.description}</p>
                        </div>
                        <Toggle enabled={enabled} busy={busyFeature === `${account.id}:${feat.id}`}
                          onChange={() => handleToggleFeature(account.id, feat.id, enabled)} />
                      </div>
                    );
                  })}
                </div>

                {/* Suspend / reactivate — with confirm step */}
                {!account.is_platform_owner && (
                  <div className="pt-3 border-t border-tea-border">
                    {isSuspended ? (
                      <ConfirmButton
                        onConfirm={() => handleToggleSuspend(account)}
                        busy={busyStatus === account.id}
                        idleLabel={<><Check size={10} />Reactivate account</>}
                        confirmLabel={<>Reactivate {account.name}?</>}
                        confirmVariant="primary"
                      />
                    ) : (
                      <ConfirmButton
                        onConfirm={() => handleToggleSuspend(account)}
                        busy={busyStatus === account.id}
                        idleLabel={<><AlertTriangle size={10} />Suspend account</>}
                        confirmLabel={<>Suspend {account.name}?</>}
                        idleVariant="danger"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {visible.length === 0 && (
        <p className="text-center py-8 text-ui-12 text-tea-text-sec">No accounts match "{query}".</p>
      )}
      </div>
    </div>
  );
};

// ── Audit log panel ───────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  'account.created':           'Account created',
  'account.active':            'Account reactivated',
  'account.suspended':         'Account suspended',
  'account.trust_tier_changed':'Trust tier changed',
  'feature.toggled':           'Feature toggled',
  'platform_role.changed':     'Platform role changed',
  'user.invite_resent':        'Invite resent',
};

const AuditPanel: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;

  const load = useCallback(async (off: number) => {
    setLoading(true);
    try {
      const d = await api.platform.getAuditLog({ limit: LIMIT, offset: off });
      setEntries(prev => off === 0 ? d.entries : [...prev, ...d.entries]);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load audit log', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(0); }, [load]);

  const handleLoadMore = () => {
    const next = offset + LIMIT;
    setOffset(next);
    load(next);
  };

  if (loading && entries.length === 0) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-tea-text-dim" /></div>;

  if (entries.length === 0) return (
    <div className="text-center py-10 text-tea-text-sec text-sm font-serif">No audit log entries yet.</div>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-ui-12 text-tea-text-sec">Recent platform actions</p>
        <button
          type="button"
          onClick={() => navigate('/admin/platform/audit-log')}
          className="text-ui-11 text-tea-gold hover:text-tea-gold-lt transition-colors"
        >
          Full log with filters →
        </button>
      </div>
      {entries.map(entry => {
        let details: Record<string, any> = {};
        try { details = JSON.parse(entry.details); } catch {}

        return (
          <div key={entry.id} className="inset-panel px-3 py-2.5">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-tea-text text-ui-13 font-medium">
                  {ACTION_LABELS[entry.action] || entry.action}
                </p>
                <p className="text-tea-text-sec text-ui-12 truncate">
                  {entry.actor_email}
                  {details.name ? ` → ${details.name}` : details.email ? ` → ${details.email}` : ''}
                  {details.from != null && details.to != null ? ` · ${details.from || 'none'} → ${details.to || 'none'}` : ''}
                  {details.feature ? ` · ${details.feature} ${details.enabled ? 'on' : 'off'}` : ''}
                </p>
              </div>
              <span className="text-ui-11 text-tea-text-dim shrink-0 tabular-nums">
                {new Date(entry.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        );
      })}
      {entries.length >= offset + LIMIT && (
        <button type="button" onClick={handleLoadMore} disabled={loading} className="pill w-full justify-center flex items-center gap-1.5">
          {loading ? <Loader2 size={10} className="animate-spin" /> : null}
          Load more
        </button>
      )}
    </div>
  );
};

// ── New Account form ──────────────────────────────────────────────────────────

const EMPTY_FORM = { name: '', slug: '', invoice_prefix: '', location_city: '', location_country: '', currency_default: 'USD', timezone: 'UTC', whatsapp_number: '', contact_email: '', owner_email: '', public_enabled: true };

const NewAccountPanel: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ account_id: string; slug: string; invite_link: string | null; email_sent: boolean; invite_expires_at?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (key: keyof typeof EMPTY_FORM) => (v: string) => setForm(p => ({ ...p, [key]: v }));

  const handleNameChange = (v: string) => setForm(p => ({
    ...p, name: v,
    slug: p.slug || v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  }));

  const handleSlugChange = (v: string) => {
    const clean = v.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    setForm(p => ({
      ...p, slug: clean,
      invoice_prefix: p.invoice_prefix || clean.split('-').map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 4),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.platform.createAccount({ ...form, owner_email: form.owner_email || undefined });
      setResult(res as any);
      showToast(`Account /${res.slug} created`, 'success');
      onCreated();
    } catch (err: any) {
      const msg = err?.message || 'Failed to create account';
      setError(msg);
      showToast(msg, 'error');
    } finally { setBusy(false); }
  };

  const copyLink = () => {
    if (!result?.invite_link) return;
    navigator.clipboard.writeText(`${window.location.origin}${result.invite_link}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result) {
    const expiry = result.invite_expires_at
      ? new Date(result.invite_expires_at)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return (
      <div className="inset-panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-tea-gold/10 flex items-center justify-center">
            <Check size={16} className="text-tea-gold" />
          </div>
          <div>
            <p className="text-tea-text font-medium text-sm">Account created</p>
            <p className="text-tea-text-sec text-ui-12 font-mono">/{result.slug}</p>
          </div>
        </div>
        {result.invite_link && !result.email_sent && (
          <div className="space-y-2">
            <Eyebrow>Owner invite link</Eyebrow>
            <div className="flex gap-2">
              <code className="flex-1 text-ui-11 bg-tea-bg border border-tea-border rounded px-2 py-1.5 text-tea-text-sec truncate font-mono">
                {window.location.origin}{result.invite_link}
              </code>
              <button type="button" onClick={copyLink} className="pill flex items-center gap-1 shrink-0">
                {copied ? <Check size={10} /> : <Copy size={10} />}{copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-ui-12 text-tea-text-sec">
              Send this to the owner. Expires {expiry.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}.
            </p>
          </div>
        )}
        {result.email_sent && <p className="text-ui-12 text-tea-text-sec">Invite email sent to the owner.</p>}
        <button type="button" onClick={() => { setResult(null); setForm({ ...EMPTY_FORM }); }} className="pill flex items-center gap-1">
          <Plus size={10} />Create another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="px-3 py-2.5 rounded-xl bg-tea-error/10 border border-tea-error/30 flex items-start gap-2">
          <AlertTriangle size={14} className="text-tea-error shrink-0 mt-0.5" />
          <p className="text-ui-12 text-tea-error flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} className="text-tea-error hover:text-tea-error"><X size={12} /></button>
        </div>
      )}

      <div className="inset-panel p-4 space-y-3">
        <Eyebrow>Identity</Eyebrow>
        <Field label="Store name" value={form.name} onChange={handleNameChange} placeholder="Teajia Melbourne" required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="URL slug" value={form.slug} onChange={handleSlugChange} placeholder="teajia-melbourne" required hint="teajia.app/store/[slug]" />
          <Field label="Invoice prefix" value={form.invoice_prefix} onChange={set('invoice_prefix')} placeholder="TJM" required hint="e.g. TJM-00042" />
        </div>
      </div>

      <div className="inset-panel p-4 space-y-3">
        <Eyebrow>Location & Currency</Eyebrow>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" value={form.location_city} onChange={set('location_city')} placeholder="Melbourne" />
          <Field label="Country" value={form.location_country} onChange={set('location_country')} placeholder="Australia" />
          <SelectField label="Currency" value={form.currency_default} onChange={set('currency_default')} options={CURRENCIES} />
          <SelectField label="Timezone" value={form.timezone} onChange={set('timezone')} options={TIMEZONES} />
        </div>
      </div>

      <div className="inset-panel p-4 space-y-3">
        <Eyebrow>Contact</Eyebrow>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="WhatsApp" value={form.whatsapp_number} onChange={set('whatsapp_number')} placeholder="+61 4XX XXX XXX" />
          <Field label="Contact email" value={form.contact_email} onChange={set('contact_email')} type="email" />
        </div>
      </div>

      <div className="inset-panel p-4 space-y-3">
        <Eyebrow>First Owner</Eyebrow>
        <Field label="Owner email" value={form.owner_email} onChange={set('owner_email')} placeholder="owner@example.com" type="email"
          hint="A new user is created if this email doesn't exist. An invite link will be generated." />
      </div>

      <label className="flex items-center gap-3 px-1 cursor-pointer">
        <input type="checkbox" checked={form.public_enabled} onChange={e => setForm(p => ({ ...p, public_enabled: e.target.checked }))}
          className="w-4 h-4 rounded accent-[var(--tea-gold)]" />
        <div>
          <p className="text-tea-text text-sm">Public storefront enabled</p>
          <p className="text-tea-text-sec text-ui-12">Visible at /find-a-table and in the network directory</p>
        </div>
      </label>

      <button type="submit" disabled={busy || !form.name || !form.slug || !form.invoice_prefix}
        className="w-full py-3 bg-tea-gold text-tea-bg text-ui-11 font-semibold uppercase tracking-[0.08em] rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-tea-gold-lt transition-colors">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        Create Account
      </button>
    </form>
  );
};

// ── Main view ─────────────────────────────────────────────────────────────────

interface PlatformAdminViewProps {
  embedded?: boolean;
}

export const PlatformAdminView: React.FC<PlatformAdminViewProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { platformRole } = useAppStore();
  const [tab, setTab] = useState<'accounts' | 'users' | 'audit' | 'new'>('accounts');
  const [accountsKey, setAccountsKey] = useState(0);
  const isPlatformOwner = platformRole === 'platform_owner';

  if (!platformRole) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <Shield size={32} className="text-tea-text-dim mb-3" />
      <p className="text-tea-text font-serif text-base">Platform access required</p>
      <p className="text-tea-text-sec text-sm mt-1">You don't have platform admin permissions. If you think this is a mistake, ask a Super Owner to grant you the Platform Admin role.</p>
    </div>
  );

  return (
    <div className="px-4 md:px-6 pt-4 pb-10 max-w-5xl mx-auto space-y-5">
      {!embedded && (
        <div className="flex items-center gap-3">
          <ShieldCheck size={18} className="text-tea-gold shrink-0" />
          <div>
            <h1 className="text-tea-text font-serif text-lg">Platform Admin</h1>
            <p className="text-tea-text-sec text-ui-12">
              {isPlatformOwner ? 'Super Owner' : 'Platform Admin'} · Full network access
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {([
          { id: 'accounts', label: 'Accounts', icon: <Store size={11} /> },
          { id: 'users',    label: 'Users',    icon: <Users size={11} /> },
          { id: 'audit',    label: 'Audit Log', icon: <ClipboardList size={11} /> },
          { id: 'new',      label: 'New Account', icon: <Plus size={11} /> },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`${tab === t.id ? 'pill pill-active' : 'pill'} flex items-center gap-1.5`}>
            {t.icon}{t.label}
          </button>
        ))}
        {/* Stock spine step 3: the movement's all-locations master lens lives on
            its own full page (read-only, can span hundreds of rows). */}
        <button onClick={() => navigate('/admin/platform/all-stock')}
          className="pill flex items-center gap-1.5">
          <Boxes size={11} /> All Stock
        </button>
      </div>

      {tab === 'accounts'  && <AccountsPanel key={accountsKey} />}
      {tab === 'users'     && <UsersPanel isPlatformOwner={isPlatformOwner} />}
      {tab === 'audit'     && <AuditPanel />}
      {tab === 'new'       && <NewAccountPanel onCreated={() => { setAccountsKey(k => k + 1); setTab('accounts'); }} />}
    </div>
  );
};

export default PlatformAdminView;
