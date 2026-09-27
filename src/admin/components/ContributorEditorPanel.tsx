import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import {
  CONTRIBUTOR_LINK_PLATFORMS,
  type AdminContributor,
  type AdminContributorLink,
  type ContributorAccountRef,
  type ContributorGalleryImage,
  type ContributorLinkPlatform,
  type ContributorWrite,
} from '../../types';

const GALLERY_IMAGE_LIMIT = 8;

function linkPlatformLabel(platform: ContributorLinkPlatform): string {
  switch (platform) {
    case 'wechat': return 'WeChat';
    case 'instagram': return 'Instagram';
    case 'website': return 'Website';
    default: return 'Other';
  }
}

function linkValueLabel(platform: ContributorLinkPlatform): string {
  switch (platform) {
    case 'wechat': return 'WeChat ID';
    case 'instagram': return 'Instagram handle';
    case 'website': return 'Website URL';
    default: return 'Value';
  }
}

type Props = {
  contributor: AdminContributor | null;
  onClose: () => void;
  onSaved: () => void;
};

const inputClass = 'min-h-11 w-full rounded-md border border-tea-border bg-tea-bg px-3 py-2.5 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none';
const labelClass = 'block text-ui-11 font-medium text-tea-text-sec mb-1.5';

const emptyWrite = (): ContributorWrite => ({
  id: '', display_name: '', business_name: '', chinese_name: '', role: '', pronouns: '', location_line: '', active_since: '',
  beginnings: '', now_text: '', now_stamp: '', now_updated_at: '', inspirations: '', closing: '', avatar_url: '', portrait_url: '',
  portrait_caption: '', voice_clip_url: '', voice_clip_caption: '', pouring_today_product_id: '', pouring_today_note: '',
  where_to_find_text: '', user_id: '', face_of_account_id: null, links: [], gallery_images: [],
});

function contributorWrite(contributor: AdminContributor): ContributorWrite {
  const result = emptyWrite();
  for (const key of Object.keys(result) as Array<keyof ContributorWrite>) {
    if (key in contributor) (result as Record<string, unknown>)[key] = contributor[key as keyof AdminContributor];
  }
  return result;
}

function liveContributor(contributor: AdminContributor): AdminContributor {
  return contributor.draft_diff?.live
    ? { ...contributor, ...contributor.draft_diff.live } as AdminContributor
    : contributor;
}

type EditableAssociation = {
  account_id: string;
  account_slug: string;
  account_name: string;
  public_role: string | null;
  is_host: boolean;
  display_order: number;
};

export function shouldPersistContributorAssociations(changed: boolean): boolean {
  return changed;
}

export function canEditContributorAssociation(accountId: string, activeAccountId: string | null, platformRole: string | null): boolean {
  return Boolean(platformRole || (activeAccountId && accountId === activeAccountId));
}

function editableAssociations(rows: ContributorAccountRef[] | undefined): EditableAssociation[] {
  return (rows ?? []).map((row, index) => ({
    account_id: row.account_id || row.account_slug || row.slug,
    account_slug: row.account_slug || row.slug,
    account_name: row.account_name || row.name,
    public_role: row.public_role ?? null,
    is_host: Boolean(row.is_host),
    display_order: Number.isInteger(row.display_order) ? row.display_order : index,
  })).sort((a, b) => a.display_order - b.display_order);
}

function reviewValue(value: unknown): string {
  if (value == null || value === '') return 'Not set';
  if (Array.isArray(value)) return value.length ? value.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join(', ') : 'None';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export const ContributorEditorPanel: React.FC<Props> = ({ contributor, onClose, onSaved }) => {
  const memberships = useAppStore(state => state.memberships);
  const activeAccountId = useAppStore(state => state.activeAccountId);
  const platformRole = useAppStore(state => state.platformRole);
  const [persistedContributor, setPersistedContributor] = useState<AdminContributor | null>(contributor);
  const [form, setForm] = useState<ContributorWrite>(() => contributor ? contributorWrite(liveContributor(contributor)) : emptyWrite());
  const [associations, setAssociations] = useState<EditableAssociation[]>(() => editableAssociations(contributor?.accounts));
  const [associationsLoaded, setAssociationsLoaded] = useState(() => !contributor || Array.isArray(contributor.accounts));
  const [associationsDirty, setAssociationsDirty] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<Array<{ id: string; slug: string; name: string; account_kind?: 'platform' | 'location' | 'master' }>>(() => memberships.map(item => ({ id: item.account_id, slug: item.slug, name: item.account_name, account_kind: item.account_kind })));
  const [newAssociationId, setNewAssociationId] = useState('');
  const [contactId, setContactId] = useState(contributor?.contact_customer_id ?? '');
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [reviewerNote, setReviewerNote] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const isNew = !persistedContributor;

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => returnFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!persistedContributor) return;
    let cancelled = false;
    void api.people.getContributorAccounts(persistedContributor.id).then(result => {
      if (!cancelled) {
        setAssociations(editableAssociations(result.accounts));
        setAssociationsLoaded(true);
      }
    }).catch(() => {
      // Keep the contributor projection as a safe fallback while older workers roll out.
    });
    if (platformRole) {
      void api.platform.listAccounts().then(result => {
        if (!cancelled) setAvailableAccounts(result.accounts.map(item => ({ id: item.id, slug: item.slug, name: item.name, account_kind: item.account_kind ?? item.kind })));
      }).catch(() => {
        // Membership accounts remain available if platform discovery is unavailable.
      });
    }
    return () => { cancelled = true; };
  }, [persistedContributor?.id, platformRole]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

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
      if (!(CONTRIBUTOR_LINK_PLATFORMS as readonly string[]).includes(link.platform)) return 'Choose a platform for every link.';
      if (!link.value?.trim()) return `Every link needs its ${linkValueLabel(link.platform).toLowerCase()}.`;
      if (link.platform === 'website') {
        try { if (new URL(link.value).protocol !== 'https:') return 'A website link needs a valid https URL.'; }
        catch { return 'A website link needs a valid https URL.'; }
      }
      if (link.qr_image_url) {
        try { new URL(link.qr_image_url); } catch { return 'The QR image URL must be a valid URL.'; }
      }
    }
    if ((form.gallery_images?.length ?? 0) > GALLERY_IMAGE_LIMIT) return `The gallery holds at most ${GALLERY_IMAGE_LIMIT} photos.`;
    for (const image of form.gallery_images ?? []) {
      if (!image.image_url?.trim()) return 'Every gallery photo needs an image URL.';
      if ((image.caption?.length ?? 0) > 280) return 'A gallery caption must be 280 characters or fewer.';
    }
    if (publishing && !form.beginnings?.trim()) return 'Beginnings is required before publication.';
    return null;
  };

  const persist = async (publishing = false) => {
    const approvingPendingDraft = publishing && !isNew && persistedContributor?.has_pending_draft === true;
    const validation = approvingPendingDraft ? null : validate(publishing);
    if (validation) { setError(validation); return; }
    setSaving(true); setError(null);
    try {
      if (approvingPendingDraft) {
        await api.people.publishContributor(persistedContributor.id);
        onSaved();
        return;
      }
      // gallery_images is its own table, not a column on `contributors`, so
      // it is never part of this payload -- it saves through its own
      // endpoint below, the same reason associations save through theirs.
      const { face_of_account_id: _legacyHost, gallery_images: _gallery, ...payload } = form;
      const result = isNew
        ? await api.people.createContributor(payload)
        : await api.people.updateContributor(persistedContributor.id, payload);
      if (isNew) setPersistedContributor(result.contributor);
      const id = result.contributor.id;
      if (contactId !== (contributor?.contact_customer_id ?? '')) await api.people.updateContributorContact(id, contactId || null);
      if (associationsLoaded && shouldPersistContributorAssociations(associationsDirty)) {
        const writableAssociations = associations.filter(association => canEditContributorAssociation(association.account_id, activeAccountId, platformRole));
        await api.people.updateContributorAccounts(id, writableAssociations.map((association, index) => ({
          account_id: association.account_id,
          public_role: association.public_role,
          is_host: association.is_host,
          display_order: index,
        })));
      }
      // Sent every save, empty array included: a full-array replace is
      // idempotent, and this is the only way an emptied gallery is ever
      // recorded as empty rather than left holding its last saved rows.
      await api.people.updateContributorGalleryImages(id, (form.gallery_images ?? []).map(image => ({
        id: image.id, image_url: image.image_url, caption: image.caption,
      })));
      if (publishing) await api.people.publishContributor(id);
      onSaved();
    } catch (caught: any) {
      setError(caught?.message || 'Could not save this contributor. Try again.');
    } finally { setSaving(false); }
  };

  const requestChanges = async () => {
    if (!persistedContributor || !reviewerNote.trim()) return;
    setSaving(true); setError(null);
    try {
      await api.people.requestContributorChanges(persistedContributor.id, reviewerNote.trim());
      onSaved();
    } catch (caught: any) {
      setError(caught?.message || 'Could not request profile changes.');
    } finally { setSaving(false); }
  };

  const addAssociation = () => {
    const account = availableAccounts.find(item => item.id === newAssociationId);
    if (!account || associations.some(item => item.account_id === account.id)) return;
    setAssociations(current => [...current, {
      account_id: account.id,
      account_slug: account.slug,
      account_name: account.name,
      public_role: 'Tea Master',
      is_host: false,
      display_order: current.length,
    }]);
    setAssociationsDirty(true);
    setNewAssociationId('');
  };

  const updateAssociation = (id: string, patch: Partial<EditableAssociation>) => {
    setAssociations(current => current.map(item => item.account_id === id ? { ...item, ...patch } : item));
    setAssociationsDirty(true);
  };
  const moveAssociation = (index: number, nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= associations.length) return;
    const reordered = [...associations];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    setAssociations(reordered.map((item, position) => ({ ...item, display_order: position })));
    setAssociationsDirty(true);
  };

  const unpublish = async () => {
    if (!persistedContributor || saving) return;
    setSaving(true); setError(null);
    try { await api.people.unpublishContributor(persistedContributor.id); onSaved(); }
    catch (caught: any) { setError(caught?.message || 'Could not unpublish this contributor.'); }
    finally { setSaving(false); }
  };

  const links = form.links ?? [];
  const updateLink = (index: number, next: Partial<AdminContributorLink>) => setField('links', links.map((link, position) => position === index ? { ...link, ...next } : link));

  const galleryImages = form.gallery_images ?? [];
  const addGalleryImage = () => {
    if (galleryImages.length >= GALLERY_IMAGE_LIMIT) return;
    setField('gallery_images', [...galleryImages, { image_url: '', caption: null }]);
  };
  const updateGalleryImage = (index: number, next: Partial<ContributorGalleryImage>) =>
    setField('gallery_images', galleryImages.map((image, position) => position === index ? { ...image, ...next } : image));
  const removeGalleryImage = (index: number) => setField('gallery_images', galleryImages.filter((_, position) => position !== index));
  const moveGalleryImage = (index: number, nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= galleryImages.length) return;
    const reordered = [...galleryImages];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    setField('gallery_images', reordered);
  };

  return (
    <>
      <div className="fixed inset-0 z-drawer bg-tea-bg/80" aria-hidden onClick={saving ? undefined : onClose} />
      <aside ref={dialogRef} role="dialog" aria-modal="true" aria-label={isNew ? 'Create contributor' : 'Edit contributor'} className="fixed inset-0 z-modal flex flex-col bg-tea-surface sm:left-auto sm:w-[min(680px,100vw)] sm:border-l sm:border-tea-border">
        <header className="flex items-center justify-between border-b border-tea-border px-4 py-3 sm:px-6">
          <button ref={closeButtonRef} type="button" onClick={onClose} disabled={saving} aria-label="Close" className="tap-target -ml-1 rounded-md p-2 text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text disabled:opacity-50"><X size={18} /></button>
          <p className="text-ui-11 text-tea-text-sec">{isNew ? 'New contributor' : persistedContributor?.display_name}</p>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-6 pb-nav-gap sm:px-6">
          <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{isNew ? 'Create contributor' : 'Edit contributor'}</h2>
          <p className="mt-1 max-w-[60ch] text-ui-13 leading-relaxed text-tea-text-sec">Editorial identity, current practice, and where this person appears across Teajia.</p>

          {persistedContributor?.has_pending_draft && (
            <div className="mt-5 border-l-2 border-tea-gold pl-3">
              <p className="text-ui-13 font-medium text-tea-text">Submitted changes awaiting review</p>
              <p className="mt-1 text-ui-12 leading-relaxed text-tea-text-sec">The editor below contains the live profile only. Approving publishes this exact draft; editorial saving is unavailable during review.</p>
              {persistedContributor.draft_diff && (
                <div className="mt-4 overflow-hidden rounded-md border border-tea-border">
                  <div className="grid grid-cols-[minmax(90px,0.65fr)_minmax(0,1fr)_minmax(0,1fr)] gap-px bg-tea-border text-ui-12">
                    <div className="bg-tea-elevated px-3 py-2 text-tea-text-sec">Field</div>
                    <div className="bg-tea-elevated px-3 py-2 font-medium text-tea-text">Live profile</div>
                    <div className="bg-tea-elevated px-3 py-2 font-medium text-tea-text">Submitted draft</div>
                    {persistedContributor.draft_diff.changed_fields.map(field => (
                      <React.Fragment key={field}>
                        <div className="break-words bg-tea-surface px-3 py-2 text-tea-text-sec">{field.replace(/_/g, ' ')}</div>
                        <div className="break-words bg-tea-surface px-3 py-2 text-tea-text">{reviewValue(persistedContributor.draft_diff?.live[field])}</div>
                        <div className="break-words bg-tea-surface px-3 py-2 text-tea-text">{reviewValue(persistedContributor.draft_diff?.pending[field])}</div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <div role="alert" className="mt-5 rounded-md border border-tea-border bg-tea-accent-sub px-3 py-2 text-ui-13 text-tea-text">{error}</div>}

          <div className="mt-7 space-y-8">
            <section>
              <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Identity</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {isNew && <label><span className={labelClass}>Slug</span><input className={inputClass} value={form.id ?? ''} onChange={e => setField('id', e.target.value)} placeholder="publishing-fixture" /></label>}
                <label><span className={labelClass}>Display name</span><input className={inputClass} value={form.display_name ?? ''} onChange={e => setField('display_name', e.target.value)} /></label>
                <label><span className={labelClass}>Business name</span><input className={inputClass} value={form.business_name ?? ''} onChange={e => setField('business_name', e.target.value)} placeholder="Trades as, if different from the name above" /></label>
                <label><span className={labelClass}>Name in own script</span><input className={inputClass} value={form.chinese_name ?? ''} onChange={e => setField('chinese_name', e.target.value)} /></label>
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
              <div className="flex items-center justify-between gap-3">
                <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Links</h3>
                <button type="button" onClick={() => setField('links', [...links, { platform: 'website', value: '', qr_image_url: null }])} className="tap-target text-ui-12 text-tea-text-sec hover:text-tea-text">Add link</button>
              </div>
              <div className="mt-3 space-y-3">
                {links.length === 0 && <p className="text-ui-13 text-tea-text-dim">No outbound links.</p>}
                {links.map((link, index) => (
                  <div key={index} className="rounded-md border border-tea-border bg-tea-bg p-3">
                    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto]">
                      <label>
                        <span className={labelClass}>Platform</span>
                        <select aria-label={`Link ${index + 1} platform`} className={inputClass} value={link.platform} onChange={e => updateLink(index, { platform: e.target.value as ContributorLinkPlatform })}>
                          {CONTRIBUTOR_LINK_PLATFORMS.map(platform => <option key={platform} value={platform}>{linkPlatformLabel(platform)}</option>)}
                        </select>
                      </label>
                      <label>
                        <span className={labelClass}>{linkValueLabel(link.platform)}</span>
                        <input aria-label={`Link ${index + 1} value`} className={`${inputClass} min-w-0`} value={link.value} onChange={e => updateLink(index, { value: e.target.value })} placeholder={link.platform === 'website' ? 'https://' : linkValueLabel(link.platform)} />
                      </label>
                      <button type="button" aria-label={`Remove link ${index + 1}`} onClick={() => setField('links', links.filter((_, position) => position !== index))} className="tap-target self-end justify-self-end px-2 py-2 text-ui-12 text-tea-text-sec hover:text-tea-text">Remove</button>
                    </div>
                    {link.platform === 'wechat' && (
                      <label className="mt-2 block"><span className={labelClass}>QR image URL (optional)</span><input className={inputClass} value={link.qr_image_url ?? ''} onChange={e => updateLink(index, { qr_image_url: e.target.value || null })} placeholder="https://" /></label>
                    )}
                    {link.platform === 'other' && (
                      <label className="mt-2 block"><span className={labelClass}>Label (optional)</span><input className={inputClass} value={link.label ?? ''} onChange={e => updateLink(index, { label: e.target.value })} placeholder="How this link is described" /></label>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Gallery</h3>
                <button type="button" onClick={addGalleryImage} disabled={galleryImages.length >= GALLERY_IMAGE_LIMIT} className="tap-target text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Add photo</button>
              </div>
              <p className="mt-2 text-ui-12 leading-relaxed text-tea-text-sec">Photos of this person at work, ordered. Up to {GALLERY_IMAGE_LIMIT}.</p>
              <div className="mt-3 space-y-3">
                {galleryImages.length === 0 && <p className="text-ui-13 text-tea-text-dim">No gallery photos.</p>}
                {galleryImages.map((image, index) => (
                  <div key={image.id ?? index} className="rounded-md border border-tea-border bg-tea-bg p-3">
                    <label><span className={labelClass}>Image URL</span><input aria-label={`Gallery photo ${index + 1} URL`} className={inputClass} value={image.image_url} onChange={e => updateGalleryImage(index, { image_url: e.target.value })} placeholder="https://" /></label>
                    <label className="mt-2 block"><span className={`${labelClass} flex justify-between`}><span>Caption (optional)</span><span>{image.caption?.length ?? 0}/280</span></span><input aria-label={`Gallery photo ${index + 1} caption`} className={inputClass} maxLength={280} value={image.caption ?? ''} onChange={e => updateGalleryImage(index, { caption: e.target.value || null })} /></label>
                    <div className="mt-2 flex items-center justify-end gap-4 text-ui-12 text-tea-text-sec">
                      <button type="button" aria-label={`Move gallery photo ${index + 1} up`} disabled={index === 0} onClick={() => moveGalleryImage(index, index - 1)} className="tap-target hover:text-tea-text disabled:opacity-30">Move up</button>
                      <button type="button" aria-label={`Move gallery photo ${index + 1} down`} disabled={index === galleryImages.length - 1} onClick={() => moveGalleryImage(index, index + 1)} className="tap-target hover:text-tea-text disabled:opacity-30">Move down</button>
                      <button type="button" aria-label={`Remove gallery photo ${index + 1}`} onClick={() => removeGalleryImage(index)} className="tap-target hover:text-tea-text">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Store and account associations</h3>
              <p className="mt-2 text-ui-12 leading-relaxed text-tea-text-sec">A Tea Master is one global person. Their primary master account is their operational home for stock and selection; other accounts are guest or collaborating associations.</p>
              <div className="mt-4 space-y-4">
                {associations.map((association, index) => (
                  <div key={association.account_id} className="rounded-md border border-tea-border bg-tea-bg p-3">
                    {(() => {
                      const editable = canEditContributorAssociation(association.account_id, activeAccountId, platformRole);
                      return <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-ui-14 font-medium text-tea-text">{association.account_name}</p>
                        <p className="mt-1 text-ui-11 text-tea-text-sec">{availableAccounts.find(item => item.id === association.account_id)?.account_kind === 'master' ? 'Tea Master operational home' : 'Guest or collaborating practice'}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label={`Move ${association.account_name} up`} disabled={!editable || index === 0} onClick={() => moveAssociation(index, index - 1)} className="tap-target text-tea-text-sec hover:text-tea-text disabled:opacity-30"><ArrowUp size={16} /></button>
                        <button type="button" aria-label={`Move ${association.account_name} down`} disabled={!editable || index === associations.length - 1} onClick={() => moveAssociation(index, index + 1)} className="tap-target text-tea-text-sec hover:text-tea-text disabled:opacity-30"><ArrowDown size={16} /></button>
                        <button type="button" aria-label={`Remove ${association.account_name}`} disabled={!editable} onClick={() => { setAssociations(current => current.filter(item => item.account_id !== association.account_id)); setAssociationsDirty(true); }} className="tap-target text-tea-text-sec hover:text-tea-text disabled:opacity-30"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <label><span className={labelClass}>Public role</span><input disabled={!editable} value={association.public_role ?? ''} onChange={event => updateAssociation(association.account_id, { public_role: event.target.value || null })} className={inputClass} placeholder="Tea Master, guest curator, writer" /></label>
                      <label className="tap-target flex min-h-11 items-center gap-3 text-ui-13 text-tea-text-sec"><input type="checkbox" disabled={!editable} checked={association.is_host} onChange={event => updateAssociation(association.account_id, { is_host: event.target.checked })} className="h-4 w-4 accent-tea-gold" /> Host profile</label>
                    </div>
                    {!editable && <p className="mt-2 text-ui-11 text-tea-text-dim">Read only while another account is active.</p>}
                    </>;
                    })()}
                  </div>
                ))}
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label><span className={labelClass}>Add an account</span><select value={newAssociationId} onChange={event => setNewAssociationId(event.target.value)} className={inputClass}><option value="">Choose an account</option>{availableAccounts.filter(item => canEditContributorAssociation(item.id, activeAccountId, platformRole) && !associations.some(association => association.account_id === item.id)).map(item => <option key={item.id} value={item.id}>{item.name}{item.account_kind === 'master' ? ' · Tea Master home' : ''}</option>)}</select></label>
                  <button type="button" onClick={addAssociation} disabled={!newAssociationId} className="tap-target self-end rounded-md border border-tea-border px-4 py-2.5 text-ui-13 text-tea-text hover:bg-tea-accent-sub disabled:opacity-50">Add association</button>
                </div>
                <label><span className={labelClass}>Private contact</span><select className={inputClass} value={contactId} onFocus={loadCustomers} onChange={e => setContactId(e.target.value)}><option value="">No linked contact</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                <label><span className={labelClass}>Where to find them</span><textarea className={`${inputClass} min-h-20 resize-y`} value={form.where_to_find_text ?? ''} onChange={e => setField('where_to_find_text', e.target.value)} /></label>
              </div>
            </section>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-tea-border bg-tea-surface px-4 pt-3 pb-nav-gap sm:px-6 lg:pb-3">
          <button type="button" onClick={onClose} disabled={saving} className="tap-target px-2 py-2 text-ui-13 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Cancel</button>
          <div className="flex flex-wrap justify-end gap-2">
            {!isNew && persistedContributor?.is_published === 1 && <button type="button" onClick={unpublish} disabled={saving} className="tap-target px-3 py-2 text-ui-13 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Unpublish</button>}
            {!persistedContributor?.has_pending_draft && <button type="button" onClick={() => persist(false)} disabled={saving} className="tap-target rounded-md border border-tea-border px-3 py-2 text-ui-13 text-tea-text hover:bg-tea-accent-sub disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>}
            {persistedContributor?.has_pending_draft && <button type="button" onClick={() => setRequestingChanges(current => !current)} disabled={saving} className="tap-target px-3 py-2 text-ui-13 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Request changes</button>}
            {persistedContributor?.has_pending_draft && <button type="button" onClick={() => persist(true)} disabled={saving} className="tap-target inline-flex items-center gap-2 rounded-md cta-solid px-3 py-2 text-ui-13 font-medium disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />} Approve submitted changes</button>}
            {!persistedContributor?.has_pending_draft && (isNew || persistedContributor?.is_published !== 1) && <button type="button" onClick={() => persist(true)} disabled={saving} className="tap-target inline-flex items-center gap-2 rounded-md cta-solid px-3 py-2 text-ui-13 font-medium disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />} Publish contributor</button>}
          </div>
        </footer>
        {requestingChanges && persistedContributor?.has_pending_draft && (
          <div className="absolute inset-x-0 bottom-0 z-modal border-t border-tea-border bg-tea-elevated px-4 pt-4 pb-nav-gap sm:px-6 lg:pb-4">
            <label><span className={labelClass}>What should the Tea Master revise?</span><textarea autoFocus rows={3} maxLength={800} value={reviewerNote} onChange={event => setReviewerNote(event.target.value)} className={`${inputClass} resize-y`} /></label>
            <div className="mt-3 flex justify-between gap-3"><button type="button" onClick={() => { setRequestingChanges(false); setReviewerNote(''); }} className="tap-target text-ui-13 text-tea-text-sec hover:text-tea-text">Cancel</button><button type="button" onClick={requestChanges} disabled={saving || !reviewerNote.trim()} className="cta-solid tap-target rounded-md px-4 py-2 text-ui-13 disabled:opacity-50">Send revision request</button></div>
          </div>
        )}
      </aside>
    </>
  );
};
