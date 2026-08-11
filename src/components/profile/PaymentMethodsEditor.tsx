import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { PaymentMethod, PaymentMethodType, PaymentMethodWrite, ProfileAssociation } from './types';

interface PaymentMethodsEditorProps {
  contributorName: string;
  associations: ProfileAssociation[];
  methods: PaymentMethod[];
  onCreate: (method: PaymentMethodWrite) => Promise<void>;
  onUpdate: (id: string, method: PaymentMethodWrite) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const fieldClass = 'w-full rounded-md border border-tea-border bg-tea-surface px-3 py-2.5 text-ui-13 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none focus:ring-2 focus:ring-tea-gold/30';
const emptyMethod = (name: string): PaymentMethodWrite => ({ account_id: null, method_type: 'bank_transfer', label: '', recipient_name: name, account_identifier: null, instructions: null, external_url: null, qr_image_url: null, is_published: false });

export function PaymentMethodsEditor({ contributorName, associations, methods, onCreate, onUpdate, onDelete }: PaymentMethodsEditorProps) {
  const [rows, setRows] = useState([...methods].sort((a, b) => a.position - b.position));
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<PaymentMethodWrite>(emptyMethod(contributorName));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setRows([...methods].sort((a, b) => a.position - b.position)), [methods]);

  const patchRow = (id: string, patch: Partial<PaymentMethod>) => setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  const write = (row: PaymentMethod): PaymentMethodWrite => ({
    account_id: row.account_id,
    method_type: row.method_type,
    label: row.label,
    recipient_name: row.recipient_name,
    account_identifier: row.account_identifier,
    instructions: row.instructions,
    external_url: row.external_url,
    qr_image_url: row.qr_image_url,
    position: row.position,
    is_published: row.is_published,
  });

  const save = async (row: PaymentMethod) => {
    setBusy(row.id); setError(null);
    try { await onUpdate(row.id, write(row)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The payment method could not be saved.'); }
    finally { setBusy(null); }
  };

  const move = async (index: number, next: number) => {
    if (next < 0 || next >= rows.length) return;
    const reordered = [...rows];
    const [row] = reordered.splice(index, 1);
    reordered.splice(next, 0, row);
    const positioned = reordered.map((item, position) => ({ ...item, position }));
    setRows(positioned);
    setBusy('order');
    try { await Promise.all(positioned.map(item => onUpdate(item.id, write(item)))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The payment method order could not be saved.'); }
    finally { setBusy(null); }
  };

  const create = async () => {
    if (!draft.label.trim() || !draft.recipient_name.trim()) return;
    setBusy('new'); setError(null);
    try { await onCreate(draft); setDraft(emptyMethod(contributorName)); setCreating(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The payment method could not be created.'); }
    finally { setBusy(null); }
  };

  const remove = async (row: PaymentMethod) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${row.label}? Unpublishing is the reversible option.`)) return;
    setBusy(row.id); setError(null);
    try { await onDelete(row.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The payment method could not be deleted.'); }
    finally { setBusy(null); }
  };

  return (
    <section aria-labelledby="payment-editor-heading" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="payment-editor-heading" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Payment methods</h2>
          <p className="mt-1 max-w-[62ch] text-ui-12 text-tea-text-dim">Published fields are intentionally public. Do not enter passwords, tokens, private keys, or provider secrets.</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="tap-target inline-flex items-center gap-2 text-ui-13 text-tea-gold transition-colors hover:text-tea-gold-lt"><Plus size={17} /> Add method</button>
      </div>

      {rows.length === 0 && !creating && <p className={`${TYPOGRAPHY_CLASSES.subtitle} border-y border-tea-border py-10 text-tea-text-sec`}>No payment destinations configured.</p>}

      <div className="space-y-8">
        {rows.map((row, index) => (
          <PaymentMethodForm
            key={row.id}
            value={row}
            associations={associations}
            busy={busy === row.id}
            onChange={patch => patchRow(row.id, patch)}
            onSave={() => save(row)}
            onDelete={() => remove(row)}
            onMoveUp={() => move(index, index - 1)}
            onMoveDown={() => move(index, index + 1)}
            canMoveUp={index > 0 && busy !== 'order'}
            canMoveDown={index < rows.length - 1 && busy !== 'order'}
          />
        ))}
      </div>

      {creating && (
        <div className="border-y border-tea-border py-5">
          <h3 className={`${TYPOGRAPHY_CLASSES.h3} mb-5 text-tea-text`}>New payment method</h3>
          <PaymentFields value={draft} associations={associations} onChange={patch => setDraft(current => ({ ...current, ...patch }))} />
          <div className="mt-5 flex justify-between">
            <button type="button" onClick={() => { setCreating(false); setDraft(emptyMethod(contributorName)); }} className="tap-target text-ui-13 text-tea-text-sec hover:text-tea-text">Cancel</button>
            <button type="button" onClick={create} disabled={busy === 'new' || !draft.label.trim() || !draft.recipient_name.trim()} className="cta-solid tap-target rounded-md px-5 py-2.5 text-ui-13 font-medium active:scale-[0.98] disabled:opacity-50">Create method</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-ui-13 text-tea-text">{error}</p>}
    </section>
  );
}

function PaymentMethodForm({ value, associations, busy, onChange, onSave, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: {
  value: PaymentMethod;
  associations: ProfileAssociation[];
  busy: boolean;
  onChange: (patch: Partial<PaymentMethod>) => void;
  onSave: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <article className="border-t border-tea-border pt-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>{value.account_id ? 'Store-specific' : 'Personal default'}</p>
          <h3 className={`${TYPOGRAPHY_CLASSES.h3} mt-1 text-tea-text`}>{value.label || 'Untitled method'}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!canMoveUp} onClick={onMoveUp} aria-label={`Move ${value.label} up`} className="tap-target text-tea-text-sec hover:text-tea-text disabled:opacity-30"><ArrowUp size={18} /></button>
          <button type="button" disabled={!canMoveDown} onClick={onMoveDown} aria-label={`Move ${value.label} down`} className="tap-target text-tea-text-sec hover:text-tea-text disabled:opacity-30"><ArrowDown size={18} /></button>
          <button type="button" onClick={onDelete} aria-label={`Delete ${value.label}`} className="tap-target text-tea-text-sec hover:text-tea-text"><Trash size={18} /></button>
        </div>
      </div>
      <PaymentFields value={value} associations={associations} onChange={onChange} />
      <div className="mt-5 flex justify-between">
        <span className="text-ui-12 text-tea-text-dim">{value.is_published ? 'Visible on the public payment page' : 'Private draft'}</span>
        <button type="button" onClick={onSave} disabled={busy} className="cta-solid tap-target rounded-md px-5 py-2.5 text-ui-13 font-medium active:scale-[0.98] disabled:opacity-50">{busy ? 'Saving…' : 'Save method'}</button>
      </div>
    </article>
  );
}

function PaymentFields({ value, associations, onChange }: { value: PaymentMethodWrite; associations: ProfileAssociation[]; onChange: (patch: Partial<PaymentMethodWrite>) => void }) {
  const label = `${TYPOGRAPHY_CLASSES.label} mb-2 block text-tea-text-sec`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label><span className={label}>Label</span><input required value={value.label} onChange={event => onChange({ label: event.target.value })} className={fieldClass} placeholder="QRIS or bank transfer" /></label>
      <label><span className={label}>Recipient name</span><input required value={value.recipient_name} onChange={event => onChange({ recipient_name: event.target.value })} className={fieldClass} /></label>
      <label><span className={label}>Method type</span><select value={value.method_type} onChange={event => onChange({ method_type: event.target.value as PaymentMethodType })} className={fieldClass}><option value="bank_transfer">Bank transfer</option><option value="payment_link">Payment link</option><option value="provider_qr">Provider QR</option><option value="other">Other</option></select></label>
      <label><span className={label}>Applies to</span><select value={value.account_id ?? ''} onChange={event => onChange({ account_id: event.target.value || null })} className={fieldClass}><option value="">Personal default</option>{associations.map(association => <option key={association.account_id} value={association.account_id}>{association.account_name}</option>)}</select></label>
      <label className="sm:col-span-2"><span className={label}>Account identifier</span><input value={value.account_identifier ?? ''} onChange={event => onChange({ account_identifier: event.target.value || null })} className={fieldClass} placeholder="Account number, handle, or public transfer detail" /></label>
      <label className="sm:col-span-2"><span className={label}>Instructions</span><textarea rows={3} value={value.instructions ?? ''} onChange={event => onChange({ instructions: event.target.value || null })} className={fieldClass} /></label>
      <label><span className={label}>External payment URL</span><input type="url" value={value.external_url ?? ''} onChange={event => onChange({ external_url: event.target.value || null })} className={fieldClass} /></label>
      <label><span className={label}>Provider QR image URL</span><input type="url" value={value.qr_image_url ?? ''} onChange={event => onChange({ qr_image_url: event.target.value || null })} className={fieldClass} /></label>
      <label className="tap-target flex items-center gap-3 text-ui-13 text-tea-text-sec sm:col-span-2"><input type="checkbox" checked={value.is_published} onChange={event => onChange({ is_published: event.target.checked })} className="h-4 w-4 accent-tea-gold" /> Publish this method</label>
    </div>
  );
}
