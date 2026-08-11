import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { api } from '../../../lib/api';
import type { SalesGrant, SalesGrantWrite, SalesOwnerShareType } from '../../../lib/api';
import type { AccountMember } from '../../../types';

type PanelMode = 'loading' | 'error' | 'list' | 'create' | 'edit';

export function sellCapableMembers(members: AccountMember[]): AccountMember[] {
  return members.filter(member => member.status === 'active'
    && (member.role === 'owner' || member.bundles?.includes('sell')));
}

const time = (value: string | null | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function grantsOverlap(
  existing: SalesGrant,
  candidate: Pick<SalesGrantWrite, 'seller_user_id' | 'starts_at' | 'expires_at'>,
): boolean {
  if (existing.seller_user_id !== candidate.seller_user_id || existing.revoked_at) return false;
  const existingStart = time(existing.starts_at || existing.created_at, Number.NEGATIVE_INFINITY);
  const existingEnd = time(existing.expires_at, Number.POSITIVE_INFINITY);
  const candidateStart = time(candidate.starts_at, Date.now());
  const candidateEnd = time(candidate.expires_at, Number.POSITIVE_INFINITY);
  return existingStart < candidateEnd && candidateStart < existingEnd;
}

const isActive = (grant: SalesGrant) => {
  const now = Date.now();
  return !grant.revoked_at
    && time(grant.starts_at, Number.NEGATIVE_INFINITY) <= now
    && time(grant.expires_at, Number.POSITIVE_INFINITY) > now;
};

const money = (value: number) => `$${value.toFixed(2)}`;
const dateLabel = (value: string | null) => value
  ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  : null;

interface GrantFormValues {
  seller_user_id: string;
  price_floor: string;
  owner_share_type: SalesOwnerShareType;
  owner_share_value: string;
  quantity_limit: string;
  starts_at: string;
  expires_at: string;
}

const toLocalInput = (value: string | null) => value ? value.slice(0, 16) : '';
const formValues = (grant?: SalesGrant | null): GrantFormValues => ({
  seller_user_id: grant?.seller_user_id || '',
  price_floor: grant?.price_floor == null ? '' : String(grant.price_floor),
  owner_share_type: grant?.owner_share_type || 'percent',
  owner_share_value: String(grant?.owner_share_value ?? 100),
  quantity_limit: grant?.quantity_limit == null ? '' : String(grant.quantity_limit),
  starts_at: toLocalInput(grant?.starts_at ?? null),
  expires_at: toLocalInput(grant?.expires_at ?? null),
});

const toWrite = (values: GrantFormValues, productId = ''): SalesGrantWrite => ({
  product_id: productId,
  seller_user_id: values.seller_user_id,
  price_floor: values.price_floor === '' ? null : Number(values.price_floor),
  owner_share_type: values.owner_share_type,
  owner_share_value: Number(values.owner_share_value),
  quantity_limit: values.quantity_limit === '' ? null : Number(values.quantity_limit),
  starts_at: values.starts_at ? new Date(values.starts_at).toISOString() : null,
  expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null,
});

interface ViewProps {
  grants: SalesGrant[];
  members: AccountMember[];
  mode: PanelMode;
  busy: boolean;
  error: string | null;
  rosterError?: string | null;
  editingGrant?: SalesGrant | null;
  onRetry: () => void;
  onBeginCreate: () => void;
  onBeginEdit: (grant: SalesGrant) => void;
  onRevoke: (grant: SalesGrant) => void;
  onCancel: () => void;
  onSubmit: (values: GrantFormValues) => Promise<void>;
}

export const SalesPermissionsPanelView: React.FC<ViewProps> = ({
  grants, members, mode, busy, error, rosterError, editingGrant, onRetry, onBeginCreate,
  onBeginEdit, onRevoke, onCancel, onSubmit,
}) => {
  const eligible = useMemo(() => sellCapableMembers(members), [members]);
  const [values, setValues] = useState<GrantFormValues>(() => formValues(editingGrant));
  useEffect(() => setValues(formValues(editingGrant)), [editingGrant, mode]);
  const field = (key: keyof GrantFormValues, value: string) => setValues(current => ({ ...current, [key]: value }));

  if (mode === 'loading') return <div className="flex items-center gap-2 py-3 text-ui-12 text-tea-text-sec"><Loader2 size={14} className="animate-spin" />Loading sales permissions</div>;
  if (mode === 'error') return (
    <div className="rounded-md border border-tea-border bg-tea-surface p-3">
      <p className="text-ui-12 text-tea-text-sec">{error || 'Sales permissions could not be loaded.'}</p>
      <button type="button" onClick={onRetry} className="tap-target mt-2 inline-flex items-center gap-1.5 text-ui-12 text-tea-gold hover:text-tea-gold-lt"><RefreshCw size={13} />Retry</button>
    </div>
  );

  if (mode === 'create' || mode === 'edit') return (
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); void onSubmit(values); }}>
      <label className="block">
        <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Seller</span>
        <select aria-label="Seller" value={values.seller_user_id} disabled={mode === 'edit'} onChange={event => field('seller_user_id', event.target.value)} className="admin-input mt-1 w-full h-11 px-3">
          <option value="">Choose a member</option>
          {eligible.map(member => <option key={member.user_id} value={member.user_id}>{member.name || 'Unnamed member'}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label><span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Price floor USD</span><input aria-label="Price floor USD" type="number" min="0" step="0.01" value={values.price_floor} onChange={event => field('price_floor', event.target.value)} className="admin-input mt-1 w-full h-11 px-3" /></label>
        <label><span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Quantity limit</span><input aria-label="Quantity limit" type="number" min="1" step="any" value={values.quantity_limit} onChange={event => field('quantity_limit', event.target.value)} className="admin-input mt-1 w-full h-11 px-3" /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label><span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Owner share</span><input aria-label="Owner share" required type="number" min="0" step="0.01" value={values.owner_share_value} onChange={event => field('owner_share_value', event.target.value)} className="admin-input mt-1 w-full h-11 px-3" /></label>
        <label><span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Share type</span><select aria-label="Share type" value={values.owner_share_type} onChange={event => field('owner_share_type', event.target.value)} className="admin-input mt-1 w-full h-11 px-3"><option value="percent">Percent</option><option value="fixed">Fixed USD</option></select></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label><span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Starts</span><input aria-label="Starts" type="datetime-local" value={values.starts_at} onChange={event => field('starts_at', event.target.value)} className="admin-input mt-1 w-full h-11 px-2" /></label>
        <label><span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Expires</span><input aria-label="Expires" type="datetime-local" value={values.expires_at} onChange={event => field('expires_at', event.target.value)} className="admin-input mt-1 w-full h-11 px-2" /></label>
      </div>
      {error && <p role="alert" className="text-ui-12 text-tea-error">{error}</p>}
      <div className="flex justify-between gap-3 pt-1">
        <button type="button" onClick={onCancel} className="tap-target text-ui-12 text-tea-text-sec hover:text-tea-text">Cancel</button>
        <button type="submit" disabled={busy || !values.seller_user_id} className="cta-solid min-h-[44px] rounded-md px-4 text-ui-12 font-medium disabled:opacity-50">{busy ? 'Saving…' : mode === 'edit' ? 'Save terms' : 'Authorize sales'}</button>
      </div>
    </form>
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Sales permissions</h3>
          <p className={`${TYPOGRAPHY_CLASSES.body} mt-1 text-tea-text-sec`}>Authorizes sales fulfilled by this account. It does not transfer stock.</p>
        </div>
        <button type="button" onClick={onBeginCreate} disabled={Boolean(rosterError) || eligible.length === 0} className="tap-target shrink-0 inline-flex items-center gap-1.5 text-ui-12 text-tea-gold hover:text-tea-gold-lt disabled:text-tea-text-dim"><Plus size={14} />Grant</button>
      </div>
      {rosterError && <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-tea-border bg-tea-surface p-3"><p className="text-ui-12 text-tea-text-sec">Eligible sellers could not be loaded.</p><button type="button" onClick={onRetry} className="tap-target text-ui-12 text-tea-gold">Retry</button></div>}
      {grants.length === 0 ? <p className="py-5 text-ui-12 text-tea-text-sec">No active sales permissions for this product.</p> : (
        <div className="mt-3 divide-y divide-tea-border border-y border-tea-border">
          {grants.map(grant => (
            <div key={grant.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-ui-14 font-medium text-tea-text">{grant.seller_name || 'Unnamed member'}</p><p className="mt-1 text-ui-11 text-tea-text-dim">{dateLabel(grant.starts_at) || 'Effective now'} to {dateLabel(grant.expires_at) || 'no expiry'}</p></div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label={`Edit permission for ${grant.seller_name || 'seller'}`} onClick={() => onBeginEdit(grant)} className="tap-target p-1.5 text-tea-text-sec hover:text-tea-text"><Pencil size={14} /></button>
                  <button type="button" aria-label={`Revoke permission for ${grant.seller_name || 'seller'}`} onClick={() => onRevoke(grant)} className="tap-target p-1.5 text-tea-text-sec hover:text-tea-text"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-ui-12 text-tea-text-sec">
                <span>Floor {grant.price_floor == null ? 'none' : money(grant.price_floor)}</span>
                <span>Owner {grant.owner_share_type === 'percent' ? `${grant.owner_share_value}%` : money(grant.owner_share_value)}</span>
                <span>Limit {grant.quantity_limit == null ? 'none' : grant.quantity_limit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export interface SalesPermissionsPanelProps { productId: string; accountId: string }

export const SalesPermissionsPanel: React.FC<SalesPermissionsPanelProps> = ({ productId, accountId }) => {
  const [grants, setGrants] = useState<SalesGrant[]>([]);
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [mode, setMode] = useState<PanelMode>('loading');
  const [editingGrant, setEditingGrant] = useState<SalesGrant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMode('loading'); setError(null); setRosterError(null);
    const [grantResult, memberResult] = await Promise.allSettled([
      api.sales.listGrants(productId), api.accounts.getAccess(accountId),
    ]);
    if (grantResult.status === 'rejected') {
      setError(grantResult.reason instanceof Error ? grantResult.reason.message : 'Sales permissions could not be loaded.');
      setMode('error'); return;
    }
    setGrants(grantResult.value);
    if (memberResult.status === 'fulfilled') setMembers(memberResult.value.members || []);
    else { setMembers([]); setRosterError(memberResult.reason instanceof Error ? memberResult.reason.message : 'Eligible sellers could not be loaded.'); }
    setMode('list');
  }, [accountId, productId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (values: GrantFormValues) => {
    const write = toWrite(values, productId);
    if (!editingGrant && grants.some(grant => grantsOverlap(grant, write))) {
      setError('This seller already has an overlapping active permission. Edit or revoke it first.'); return;
    }
    if (write.expires_at && time(write.expires_at, 0) <= time(write.starts_at, Date.now())) {
      setError('Expiry must be after the start time.'); return;
    }
    setBusy(true); setError(null);
    try {
      if (editingGrant) await api.sales.updateGrant(editingGrant.id, write);
      else await api.sales.createGrant(write);
      setEditingGrant(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Permission could not be saved.'); }
    finally { setBusy(false); }
  };

  const revoke = async (grant: SalesGrant) => {
    if (!window.confirm(`Revoke sales permission for ${grant.seller_name || 'this seller'}?`)) return;
    setBusy(true); setError(null);
    try { await api.sales.revokeGrant(grant.id); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Permission could not be revoked.'); }
    finally { setBusy(false); }
  };

  return <SalesPermissionsPanelView grants={grants.filter(isActive)} members={members} mode={mode} busy={busy} error={error} rosterError={rosterError} editingGrant={editingGrant}
    onRetry={() => void load()} onBeginCreate={() => { setEditingGrant(null); setError(null); setMode('create'); }}
    onBeginEdit={grant => { setEditingGrant(grant); setError(null); setMode('edit'); }} onRevoke={grant => void revoke(grant)}
    onCancel={() => { setEditingGrant(null); setError(null); setMode('list'); }} onSubmit={submit} />;
};
