import React, { useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { api, getTokenClaims } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { AdminContributor, ContributorLink, ContributorWrite } from '../../types';

type Props = {
  contributor: AdminContributor | null;
  onClose: () => void;
  onSaved: () => void;
};

const inputClass = 'min-h-11 w-full rounded-md border border-tea-border bg-tea-bg px-3 py-2.5 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none';
const labelClass = 'block text-ui-11 font-medium text-tea-text-sec mb-1.5';

const emptyWrite = (): ContributorWrite => ({
  id: '', display_name: '', chinese_name: '', role: '', pronouns: '', location_line: '', active_since: '',
  beginnings: '', now_text: '', now_stamp: '', inspirations: '', closing: '', avatar_url: '', portrait_url: '',
  portrait_caption: '', voice_clip_url: '', voice_clip_caption: '', pouring_today_product_id: '', pouring_today_note: '',
  where_to_find_text: '', user_id: '', face_of_account_id: null, links: [],
});

function contributorWrite(contributor: AdminContributor): ContributorWrite {
  const result = emptyWrite();
  for (const key of Object.keys(result) as Array<keyof ContributorWrite>) {
    if (key in contributor) (result as Record<string, unknown>)[key] = contributor[key as keyof AdminContributor];
  }
  return result;
}

function accountContext() {
  const claims = getTokenClaims() as any;
  const accountId = claims?.active_account_id ?? '';
  const membership = claims?.memberships?.find((item: any) => item.account_id === accountId);
  return { accountId, accountName: membership?.account_name || 'this account' };
}

export const ContributorEditorPanel: React.FC<Props> = ({ contributor, onClose, onSaved }) => {
  const { accountId, accountName } = useMemo(accountContext, []);
  const [form, setForm] = useState<ContributorWrite>(() => contributor ? contributorWrite(contributor) : emptyWrite());
  const [contactId, setContactId] = useState(contributor?.contact_customer_id ?? '');
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = !contributor;

  const setField = (field: keyof ContributorWrite, value: any) => setForm(current => ({ ...current, [field]: value }));
  const loadCustomers = async () => {
    if (customersLoaded) return;
    setCustomersLoaded(true);
    try {
      const result = await api.customers.list();
      setCustomers(Array.isArray(result) ? result : result?.customers ?? []);
    } catch { setCustomers([]); }
  };

  const validate = (publishing: boolean) => {
    if (isNew && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.id?.trim() ?? '')) return 'Use a lowercase, hyphenated slug.';
    if (!form.display_name?.trim()) return 'Display name is required.';
    if ((form.closing?.length ?? 0) > 200) return 'Closing must be 200 characters or fewer.';
    for (const link of form.links ?? []) {
      if (!link.label.trim()) return 'Every link needs a label.';
      try { if (new URL(link.url).protocol !== 'https:') return 'Every link must use https.'; }
      catch { return 'Every link needs a valid https URL.'; }
    }
    if (publishing && !form.beginnings?.trim()) return 'Beginnings is required before publication.';
    return null;
  };

  const persist = async (publishing = false) => {
    const validation = validate(publishing);
    if (validation) { setError(validation); return; }
    setSaving(true); setError(null);
    try {
      const payload = { ...form, face_of_account_id: form.face_of_account_id ? accountId : null };
      const result = isNew
        ? await api.people.createContributor(payload)
        : await api.people.updateContributor(contributor.id, payload);
      const id = result.contributor.id;
      if (contactId !== (contributor?.contact_customer_id ?? '')) await api.people.updateContributorContact(id, contactId || null);
      if (publishing) await api.people.publishContributor(id);
      onSaved();
    } catch (caught: any) {
      setError(caught?.message || 'Could not save this contributor. Try again.');
    } finally { setSaving(false); }
  };

  const unpublish = async () => {
    if (!contributor || saving) return;
    setSaving(true); setError(null);
    try { await api.people.unpublishContributor(contributor.id); onSaved(); }
    catch (caught: any) { setError(caught?.message || 'Could not unpublish this contributor.'); }
    finally { setSaving(false); }
  };

  const links = form.links ?? [];
  const updateLink = (index: number, next: Partial<ContributorLink>) => setField('links', links.map((link, position) => position === index ? { ...link, ...next } : link));

  return (
    <>
      <div className="fixed inset-0 z-drawer bg-tea-bg/80" aria-hidden onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={isNew ? 'Create contributor' : 'Edit contributor'} className="fixed inset-0 z-modal flex flex-col bg-tea-surface sm:left-auto sm:w-[min(680px,100vw)] sm:border-l sm:border-tea-border">
        <header className="flex items-center justify-between border-b border-tea-border px-4 py-3 sm:px-6">
          <button type="button" onClick={onClose} aria-label="Close" className="tap-target -ml-1 rounded-md p-2 text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text"><X size={18} /></button>
          <p className="text-ui-11 text-tea-text-sec">{isNew ? 'New contributor' : contributor.display_name}</p>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-6 pb-nav-gap sm:px-6">
          <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{isNew ? 'Create contributor' : 'Edit contributor'}</h2>
          <p className="mt-1 max-w-[60ch] text-ui-13 leading-relaxed text-tea-text-sec">Editorial identity, current practice, and where this person appears across Teajia.</p>

          {error && <div role="alert" className="mt-5 rounded-md border border-tea-border bg-tea-accent-sub px-3 py-2 text-ui-13 text-tea-text">{error}</div>}

          <div className="mt-7 space-y-8">
            <section>
              <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Identity</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {isNew && <label><span className={labelClass}>Slug</span><input className={inputClass} value={form.id ?? ''} onChange={e => setField('id', e.target.value)} placeholder="publishing-fixture" /></label>}
                <label><span className={labelClass}>Display name</span><input className={inputClass} value={form.display_name ?? ''} onChange={e => setField('display_name', e.target.value)} /></label>
                <label><span className={labelClass}>Chinese name</span><input className={inputClass} value={form.chinese_name ?? ''} onChange={e => setField('chinese_name', e.target.value)} /></label>
                <label><span className={labelClass}>Role</span><input className={inputClass} value={form.role ?? ''} onChange={e => setField('role', e.target.value)} placeholder="Writer, host, maker" /></label>
                <label><span className={labelClass}>Pronouns</span><input className={inputClass} value={form.pronouns ?? ''} onChange={e => setField('pronouns', e.target.value)} /></label>
                <label><span className={labelClass}>Location</span><input className={inputClass} value={form.location_line ?? ''} onChange={e => setField('location_line', e.target.value)} /></label>
                <label><span className={labelClass}>Active since</span><input className={inputClass} value={form.active_since ?? ''} onChange={e => setField('active_since', e.target.value)} placeholder="2018" /></label>
                <label><span className={labelClass}>Linked user ID</span><input className={inputClass} value={form.user_id ?? ''} onChange={e => setField('user_id', e.target.value)} /></label>
              </div>
            </section>

            <section>
              <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Editorial body</h3>
              <div className="mt-3 space-y-4">
                <label><span className={labelClass}>Beginnings</span><textarea className={`${inputClass} min-h-28 resize-y`} value={form.beginnings ?? ''} onChange={e => setField('beginnings', e.target.value)} /></label>
                <label><span className={labelClass}>Current practice</span><textarea className={`${inputClass} min-h-24 resize-y`} value={form.now_text ?? ''} onChange={e => setField('now_text', e.target.value)} /></label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label><span className={labelClass}>Current stamp</span><input className={inputClass} value={form.now_stamp ?? ''} onChange={e => setField('now_stamp', e.target.value)} /></label>
                  <label><span className={labelClass}>Current practice updated</span><input type="datetime-local" className={inputClass} value={form.now_updated_at?.slice(0, 16) ?? ''} onChange={e => setField('now_updated_at', e.target.value)} /></label>
                </div>
                <label><span className={labelClass}>Inspirations</span><textarea className={`${inputClass} min-h-24 resize-y`} value={form.inspirations ?? ''} onChange={e => setField('inspirations', e.target.value)} /></label>
                <label><span className={`${labelClass} flex justify-between`}><span>Closing</span><span>{form.closing?.length ?? 0}/200</span></span><textarea className={`${inputClass} min-h-20 resize-y`} maxLength={200} value={form.closing ?? ''} onChange={e => setField('closing', e.target.value)} /></label>
              </div>
            </section>

            <section>
              <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Media</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label><span className={labelClass}>Avatar URL</span><input className={inputClass} value={form.avatar_url ?? ''} onChange={e => setField('avatar_url', e.target.value)} /></label>
                <label><span className={labelClass}>Portrait URL</span><input className={inputClass} value={form.portrait_url ?? ''} onChange={e => setField('portrait_url', e.target.value)} /></label>
                <label className="sm:col-span-2"><span className={labelClass}>Portrait caption</span><input className={inputClass} value={form.portrait_caption ?? ''} onChange={e => setField('portrait_caption', e.target.value)} /></label>
                <label><span className={labelClass}>Voice clip URL</span><input className={inputClass} value={form.voice_clip_url ?? ''} onChange={e => setField('voice_clip_url', e.target.value)} /></label>
                <label><span className={labelClass}>Voice clip caption</span><input className={inputClass} value={form.voice_clip_caption ?? ''} onChange={e => setField('voice_clip_caption', e.target.value)} /></label>
              </div>
            </section>

            <section>
              <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Pouring today</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label><span className={labelClass}>Product ID</span><input className={inputClass} value={form.pouring_today_product_id ?? ''} onChange={e => setField('pouring_today_product_id', e.target.value)} /></label>
                <label><span className={labelClass}>Pouring note</span><input className={inputClass} value={form.pouring_today_note ?? ''} onChange={e => setField('pouring_today_note', e.target.value)} /></label>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3"><h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Links</h3><button type="button" onClick={() => setField('links', [...links, { label: '', url: '' }])} className="tap-target inline-flex items-center gap-1 text-ui-12 text-tea-text-sec hover:text-tea-text"><Plus size={14} /> Add link</button></div>
              <div className="mt-3 space-y-3">
                {links.length === 0 && <p className="text-ui-13 text-tea-text-dim">No outbound links.</p>}
                {links.map((link, index) => <div key={index} className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[1fr_1.5fr_auto]"><input aria-label={`Link ${index + 1} label`} className={`${inputClass} min-w-0`} value={link.label} onChange={e => updateLink(index, { label: e.target.value })} placeholder="Label" /><input aria-label={`Link ${index + 1} URL`} className={`${inputClass} min-w-0`} value={link.url} onChange={e => updateLink(index, { url: e.target.value })} placeholder="https://" /><button type="button" aria-label={`Remove link ${index + 1}`} onClick={() => setField('links', links.filter((_, position) => position !== index))} className="tap-target justify-self-end p-2 text-tea-text-sec hover:text-tea-text"><Trash2 size={15} /></button></div>)}
              </div>
            </section>

            <section>
              <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Associations</h3>
              <div className="mt-3 space-y-4">
                <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={form.face_of_account_id === accountId} onChange={e => setField('face_of_account_id', e.target.checked ? accountId : null)} /><span className="text-ui-13 text-tea-text">Public host for {accountName}</span></label>
                <label><span className={labelClass}>Private contact</span><select className={inputClass} value={contactId} onFocus={loadCustomers} onChange={e => setContactId(e.target.value)}><option value="">No linked contact</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                <label><span className={labelClass}>Where to find them</span><textarea className={`${inputClass} min-h-20 resize-y`} value={form.where_to_find_text ?? ''} onChange={e => setField('where_to_find_text', e.target.value)} /></label>
              </div>
            </section>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-tea-border bg-tea-surface px-4 pt-3 pb-nav-gap sm:px-6 lg:pb-3">
          <button type="button" onClick={onClose} disabled={saving} className="tap-target px-2 py-2 text-ui-13 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Cancel</button>
          <div className="flex flex-wrap justify-end gap-2">
            {!isNew && contributor.is_published === 1 && <button type="button" onClick={unpublish} disabled={saving} className="tap-target px-3 py-2 text-ui-13 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Unpublish</button>}
            <button type="button" onClick={() => persist(false)} disabled={saving} className="tap-target rounded-md border border-tea-border px-3 py-2 text-ui-13 text-tea-text hover:bg-tea-accent-sub disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
            {(isNew || contributor.is_published !== 1) && <button type="button" onClick={() => persist(true)} disabled={saving} className="tap-target inline-flex items-center gap-2 rounded-md bg-tea-gold px-3 py-2 text-ui-13 font-medium text-tea-bg hover:bg-tea-gold-lt disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />} Publish contributor</button>}
          </div>
        </footer>
      </aside>
    </>
  );
};
