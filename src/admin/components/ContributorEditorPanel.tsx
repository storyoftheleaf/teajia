import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import {
  CONTRIBUTOR_LINK_PLATFORMS,
  type AdminContributor,
  type AdminContributorLink,
  type ContributorAccountRef,
  type ContributorGalleryImage,
  type ContributorLinkPlatform,
  type ContributorWrite,
} from '../../types';
import { ACTION, Count, LABEL, LINE_SANS, Line, Prose, QUIET, Section } from './contributorEditor/parts';
import { PhotoPlace, type Crop } from './contributorEditor/PhotoPlace';
import { GalleryPlace, GALLERY_IMAGE_LIMIT } from './contributorEditor/GalleryPlace';
import { PageProof } from './contributorEditor/PageProof';
import { imagesFrom } from './contributorEditor/photoUpload';

// The contributor editor. It is a proof of /people/:slug rather than a form
// about it: the name is typed in the cover's serif, the prose in the page's
// Lora, photos are placed and given a focal point, and the cover beside the
// fields (above them on a phone) redraws as you type. Style rules, and the
// list of what this screen deliberately does not use: docs/CONTRIBUTOR_EDITOR.md.

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

/** The crops the page makes of the portrait: the cover at phone and desktop width, and the directory card. */
const PORTRAIT_CROPS: Crop[] = [
  { label: 'Phone', width: 342, height: 420 },
  { label: 'Desktop', width: 576, height: 420 },
  { label: 'Directory', width: 140, height: 180 },
];
const AVATAR_CROPS: Crop[] = [
  { label: 'Round', width: 96, height: 96, round: true },
  { label: 'Small', width: 40, height: 40, round: true },
];

/** "Mei Lin" becomes "mei-lin": the page address offered while the name is typed. */
export function slugFromName(name: string): string {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

type Props = {
  contributor: AdminContributor | null;
  onClose: () => void;
  onSaved: () => void;
};

const emptyWrite = (): ContributorWrite => ({
  id: '', display_name: '', business_name: '', chinese_name: '', role: '', pronouns: '', location_line: '', active_since: '',
  beginnings: '', now_text: '', now_stamp: '', now_updated_at: '', inspirations: '', closing: '', avatar_url: '', portrait_url: '',
  portrait_caption: '', portrait_focus: null, avatar_focus: null, voice_clip_url: '', voice_clip_caption: '', pouring_today_product_id: '', pouring_today_note: '',
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

function statusWord(contributor: AdminContributor | null): string {
  if (!contributor) return 'Not saved';
  if (contributor.has_pending_draft) return 'In review';
  return contributor.is_published === 1 ? 'Published' : 'Draft';
}

export const ContributorEditorPanel: React.FC<Props> = ({ contributor, onClose, onSaved }) => {
  const memberships = useAppStore(state => state.memberships);
  const activeAccountId = useAppStore(state => state.activeAccountId);
  const platformRole = useAppStore(state => state.platformRole);
  const [persistedContributor, setPersistedContributor] = useState<AdminContributor | null>(contributor);
  const [form, setForm] = useState<ContributorWrite>(() => contributor ? contributorWrite(liveContributor(contributor)) : emptyWrite());
  const [slugTouched, setSlugTouched] = useState(Boolean(contributor));
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
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const takePortrait = useRef<((files: File[]) => void) | null>(null);
  const takeGallery = useRef<((files: File[]) => void) | null>(null);
  const isNew = !persistedContributor;
  const uploading = Object.values(busy).some(Boolean);

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
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
        .filter(node => node.offsetParent !== null || node === document.activeElement);
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
  const setName = (name: string) => setForm(current => ({ ...current, display_name: name, ...(isNew && !slugTouched ? { id: slugFromName(name) } : {}) }));
  const markBusy = useCallback((key: string) => (value: boolean) => setBusy(current => current[key] === value ? current : { ...current, [key]: value }), []);
  const portraitBusy = useMemo(() => markBusy('portrait'), [markBusy]);
  const avatarBusy = useMemo(() => markBusy('avatar'), [markBusy]);
  const galleryBusy = useMemo(() => markBusy('gallery'), [markBusy]);
  const setPortrait = useCallback((next: { url: string | null; focus: string | null }) => setForm(current => ({ ...current, portrait_url: next.url ?? '', portrait_focus: next.focus })), []);
  const setAvatar = useCallback((next: { url: string | null; focus: string | null }) => setForm(current => ({ ...current, avatar_url: next.url ?? '', avatar_focus: next.focus })), []);
  const updateGallery = useCallback((change: (images: ContributorGalleryImage[]) => ContributorGalleryImage[]) => setForm(current => ({ ...current, gallery_images: change(current.gallery_images ?? []) })), []);

  const loadCustomers = async () => {
    if (customersLoaded) return;
    setCustomersLoaded(true);
    try {
      const result = await api.customers.list();
      setCustomers(Array.isArray(result) ? result : result?.customers ?? []);
    } catch { setCustomers([]); }
  };

  const validate = (publishing: boolean) => {
    if (uploading) return 'A photo is still arriving. Save once it has landed.';
    if (isNew && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.id?.trim() ?? '')) return 'The page address takes lowercase letters, numbers and hyphens.';
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
      if (!image.image_url?.trim()) return 'Every gallery photo needs an image.';
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
        id: image.id, image_url: image.image_url, caption: image.caption, focus: image.focus ?? null,
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

  // A photo pasted anywhere that is not a text field goes where a photo is
  // wanted next: the portrait while there is none, the gallery after that.
  const onPanelPaste = (event: React.ClipboardEvent) => {
    if (event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const files = imagesFrom(event.clipboardData.items, true);
    if (!files.length) return;
    const take = form.portrait_url ? takeGallery.current : takePortrait.current;
    if (!take) return;
    event.preventDefault();
    take(files);
  };

  const pending = persistedContributor?.has_pending_draft === true;
  const published = persistedContributor?.is_published === 1;
  const slug = persistedContributor?.id ?? form.id ?? '';

  return (
    <>
      <div className="fixed inset-0 z-drawer bg-tea-bg/80" aria-hidden onClick={saving ? undefined : onClose} />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'Create contributor' : 'Edit contributor'}
        onPaste={onPanelPaste}
        className="sidebar-inset fixed inset-0 z-modal flex flex-col bg-tea-bg"
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-tea-border px-3 sm:px-6">
          <button ref={closeButtonRef} type="button" onClick={onClose} disabled={saving} aria-label="Close" className="tap-target rounded-md p-2 text-tea-text-sec hover:text-tea-text disabled:opacity-50"><X size={18} strokeWidth={1.5} /></button>
          <p className="min-w-0 truncate font-display text-ui-20 text-tea-text">{form.display_name?.trim() || (isNew ? 'A new person' : persistedContributor?.display_name)}</p>
          <p className="ml-auto shrink-0 font-sans text-ui-10 uppercase tracking-caps text-tea-text-sec">{statusWord(persistedContributor)}</p>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto grid w-full max-w-[1120px] gap-x-16 px-6 sm:px-10 lg:grid-cols-[minmax(0,1fr)_342px]">
            <div className="pt-6 lg:order-2 lg:pt-10">
              <div className="lg:sticky lg:top-10">
                <PageProof form={form} galleryCount={galleryImages.length} linkCount={links.length} slug={slug} published={published} />
              </div>
            </div>

            <div className="min-w-0 max-w-[640px] pb-nav-gap-lg pt-10 lg:order-1 lg:pb-16">
              <h2 className="font-display text-[40px] font-light leading-[1.05] text-tea-text sm:text-[48px]">{isNew ? 'Create contributor' : 'Edit contributor'}</h2>
              <p className="mt-3 max-w-[52ch] font-body text-ui-15 italic leading-relaxed text-tea-text-sec">
                {isNew
                  ? 'A person’s page, set in the type it will be read in. Nothing is public until you publish it.'
                  : published ? 'Changes show on the public page once saved.' : 'This page is a draft. Nobody can read it until it is published.'}
              </p>

              {pending && persistedContributor && (
                <div className="mt-8 border-l border-tea-gold/40 pl-5">
                  <p className="font-display text-ui-20 text-tea-text">Submitted changes awaiting review</p>
                  <p className="mt-1 max-w-[52ch] font-body text-ui-14 leading-relaxed text-tea-text-sec">The editor below holds the live profile only. Approving publishes this exact draft; editorial saving is unavailable during review.</p>
                  {persistedContributor.draft_diff && (
                    <dl className="mt-4">
                      <div className="grid grid-cols-2 gap-4 border-b border-tea-border pb-2">
                        <dt className={LABEL}>Live profile</dt>
                        <dd className={LABEL}>Submitted draft</dd>
                      </div>
                      {persistedContributor.draft_diff.changed_fields.map(field => (
                        <div key={field} className="border-b border-tea-border py-3">
                          <p className="font-sans text-ui-11 text-tea-text-dim">{field.replace(/_/g, ' ')}</p>
                          <div className="mt-1 grid grid-cols-2 gap-4 font-body text-ui-14 leading-relaxed">
                            <p className="break-words text-tea-text-sec">{reviewValue(persistedContributor.draft_diff?.live[field])}</p>
                            <p className="break-words text-tea-text">{reviewValue(persistedContributor.draft_diff?.pending[field])}</p>
                          </div>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )}

              {error && <p role="alert" className="mt-6 border-l-2 border-tea-error pl-4 font-body text-ui-15 leading-relaxed text-tea-text">{error}</p>}

              <div className="mt-10">
                <Section id="c-name" title="The name" note="How the cover introduces them.">
                  <Line
                    label="Display name"
                    value={form.display_name ?? ''}
                    onChange={event => setName(event.target.value)}
                    placeholder="Their name"
                    autoComplete="off"
                    inputClassName="w-full rounded-none border-0 border-b border-tea-border bg-transparent px-0 py-1 font-display text-[34px] font-light leading-tight text-tea-text placeholder:text-tea-text-dim/60 focus:border-tea-gold focus:outline-none focus:ring-0 sm:text-[40px]"
                  />
                  {isNew ? (
                    <div className="mt-5">
                      <label htmlFor="f-page-address" className={LABEL}>Page address</label>
                      <div className="mt-1 flex min-w-0 items-baseline border-b border-tea-border focus-within:border-tea-gold">
                        <span className="shrink-0 font-sans text-ui-14 text-tea-text-dim">teajia.com/people/</span>
                        <input
                          id="f-page-address"
                          className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-0 py-2 font-sans text-ui-15 text-tea-text placeholder:text-tea-text-dim/60 focus:outline-none focus:ring-0"
                          value={form.id ?? ''}
                          placeholder="mei-lin"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          onChange={event => { setSlugTouched(true); setField('id', event.target.value.toLowerCase()); }}
                        />
                      </div>
                      <p className="mt-1.5 font-sans text-ui-12 text-tea-text-dim">Fixed once saved. Lowercase words joined by hyphens.</p>
                    </div>
                  ) : (
                    <p className="mt-3 font-sans text-ui-13 text-tea-text-sec">teajia.com/people/<span className="text-tea-text">{slug}</span></p>
                  )}
                  <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                    <Line label="Name, own script" value={form.chinese_name ?? ''} onChange={event => setField('chinese_name', event.target.value)} inputClassName={`${LINE_SANS} font-body text-ui-17`} />
                    <Line label="Business name" value={form.business_name ?? ''} onChange={event => setField('business_name', event.target.value)} placeholder="If they trade under another" />
                    <Line label="Role" value={form.role ?? ''} onChange={event => setField('role', event.target.value)} placeholder="Tea master, writer, host" />
                    <Line label="Location" value={form.location_line ?? ''} onChange={event => setField('location_line', event.target.value)} placeholder="City, country" />
                    <Line label="Pronouns" value={form.pronouns ?? ''} onChange={event => setField('pronouns', event.target.value)} />
                    <Line label="Active since" value={form.active_since ?? ''} onChange={event => setField('active_since', event.target.value)} placeholder="The year they began" inputMode="numeric" />
                  </div>
                </Section>

                <div>
                  <Section id="c-portrait" title="The portrait" note="The cover of their page. Set the focal point on the face and every crop keeps it." testId="section-portrait">
                    <PhotoPlace
                      name="Portrait"
                      testId="photo-portrait"
                      url={form.portrait_url}
                      focus={form.portrait_focus}
                      onChange={setPortrait}
                      crops={PORTRAIT_CROPS}
                      purpose="A photo of them at work fills the cover best. Tall or wide both work."
                      emptyHeight={300}
                      onBusy={portraitBusy}
                      takeRef={takePortrait}
                    />
                    <Line className="mt-6" label="Portrait caption" value={form.portrait_caption ?? ''} onChange={event => setField('portrait_caption', event.target.value)} placeholder="Optional. Where and when it was taken." />

                    <div className="mt-10">
                      <p className="font-display text-ui-20 text-tea-text">The small photo</p>
                      <p className="mt-1 max-w-[52ch] font-body text-ui-14 italic leading-relaxed text-tea-text-sec">Stands in for the portrait when there is none, and anywhere a small round face is shown.</p>
                      <div className="mt-4">
                        <PhotoPlace
                          name="Avatar"
                          testId="photo-avatar"
                          url={form.avatar_url}
                          focus={form.avatar_focus}
                          onChange={setAvatar}
                          crops={AVATAR_CROPS}
                          purpose="A face, close. It is shown round."
                          emptyHeight={180}
                          onBusy={avatarBusy}
                          extraActions={form.portrait_url && form.avatar_url !== form.portrait_url
                            ? <button type="button" onClick={() => setAvatar({ url: form.portrait_url || null, focus: form.portrait_focus ?? null })} className={ACTION}>Use the portrait</button>
                            : null}
                        />
                      </div>
                    </div>
                  </Section>
                </div>

                <Section id="c-words" title="In my words" note="Written in the first person. The cover takes its one line from the first sentence of what they are doing now.">
                  <div className="space-y-7">
                    <Prose label="Beginnings" value={form.beginnings ?? ''} onChange={event => setField('beginnings', event.target.value)} placeholder="Where it began for them." minRows={4} hint="Needed before the page can be published." />
                    <Prose label="Current practice" value={form.now_text ?? ''} onChange={event => setField('now_text', event.target.value)} placeholder="What they are doing now." />
                    <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                      <Line label="Current stamp" value={form.now_stamp ?? ''} onChange={event => setField('now_stamp', event.target.value)} placeholder="A season or a month" />
                      <Line label="Current practice updated" type="datetime-local" value={form.now_updated_at?.slice(0, 16) ?? ''} onChange={event => setField('now_updated_at', event.target.value)} />
                    </div>
                    <Prose label="Inspirations" value={form.inspirations ?? ''} onChange={event => setField('inspirations', event.target.value)} placeholder="Who and what taught them." />
                    <Prose label="Closing" value={form.closing ?? ''} maxLength={200} minRows={2} onChange={event => setField('closing', event.target.value)} placeholder="The last line of the page." aside={<Count value={form.closing?.length ?? 0} max={200} />} />
                    <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                      <Line label="Voice clip URL" type="url" value={form.voice_clip_url ?? ''} onChange={event => setField('voice_clip_url', event.target.value)} placeholder="https://" hint="A recording in their own voice. Not on the page yet." />
                      <Line label="Voice clip caption" value={form.voice_clip_caption ?? ''} onChange={event => setField('voice_clip_caption', event.target.value)} />
                    </div>
                  </div>
                </Section>

                <div>
                  <Section id="c-gallery" title="Hands on" note={`Photos of them at work, laid out as the page lays them out. Up to ${GALLERY_IMAGE_LIMIT}.`} testId="section-gallery">
                    <GalleryPlace images={galleryImages} update={updateGallery} onBusy={galleryBusy} takeRef={takeGallery} />
                  </Section>
                </div>

                <Section id="c-reach" title="Reach me" note="Where a reader can find them. Each becomes a row at the foot of the page.">
                  <div>
                    {links.length === 0 && <p className="font-body text-ui-15 italic text-tea-text-dim">No ways to reach them yet.</p>}
                    {links.map((link, index) => (
                      <div key={index} className="border-b border-tea-border py-5 first:pt-0">
                        <div role="radiogroup" aria-label={`Link ${index + 1} platform`} className="flex flex-wrap items-baseline gap-x-5">
                          {CONTRIBUTOR_LINK_PLATFORMS.map(platform => {
                            const on = link.platform === platform;
                            return (
                              <label key={platform} className={`tap-target inline-flex min-h-11 cursor-pointer items-center border-b font-display text-ui-17 transition-colors ${on ? 'border-tea-gold text-tea-text' : 'border-transparent text-tea-text-sec hover:text-tea-text'}`}>
                                <input type="radio" className="sr-only" name={`link-${index}-platform`} value={platform} checked={on} onChange={() => updateLink(index, { platform })} />
                                {linkPlatformLabel(platform)}
                              </label>
                            );
                          })}
                          <button type="button" aria-label={`Remove link ${index + 1}`} onClick={() => setField('links', links.filter((_, position) => position !== index))} className={`${QUIET} ml-auto`}>Remove</button>
                        </div>
                        <Line
                          className="mt-2"
                          id={`f-link-${index}-value`}
                          label={linkValueLabel(link.platform)}
                          aria-label={`Link ${index + 1} value`}
                          value={link.value}
                          onChange={event => updateLink(index, { value: event.target.value })}
                          placeholder={link.platform === 'website' ? 'https://' : link.platform === 'instagram' ? '@handle' : ''}
                          inputMode={link.platform === 'website' ? 'url' : undefined}
                          autoCapitalize="none"
                        />
                        {link.platform === 'wechat' && (
                          <div className="mt-5">
                            <p className={LABEL}>QR code, optional</p>
                            <div className="mt-2 max-w-[320px]">
                              <PhotoPlace
                                name="QR image"
                                testId={`photo-qr-${index}`}
                                url={link.qr_image_url}
                                focus={null}
                                onChange={next => updateLink(index, { qr_image_url: next.url })}
                                crops={[]}
                                purpose="A screenshot of their WeChat QR, so a reader can scan it."
                                emptyHeight={160}
                                onBusy={markBusy(`qr-${index}`)}
                              />
                            </div>
                          </div>
                        )}
                        {link.platform === 'other' && (
                          <Line className="mt-4" id={`f-link-${index}-label`} label="Label, optional" value={link.label ?? ''} onChange={event => updateLink(index, { label: event.target.value })} placeholder="How this link is described" />
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setField('links', [...links, { platform: 'website', value: '', qr_image_url: null }])} className={`${ACTION} mt-4`}>Add link</button>
                  </div>
                </Section>

                <Section id="c-pouring" title="Pouring today" note="Which tea they are pouring now. Kept here, not yet shown on the public page.">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                    <Line label="Product ID" value={form.pouring_today_product_id ?? ''} onChange={event => setField('pouring_today_product_id', event.target.value)} autoCapitalize="none" />
                    <Line label="Pouring note" value={form.pouring_today_note ?? ''} onChange={event => setField('pouring_today_note', event.target.value)} />
                  </div>
                </Section>

                <Section id="c-belong" title="Where they belong" note="A tea master is one person across Teajia. Their master account is their home for stock and selection; other shops are guest or collaborating places.">
                  <div className="space-y-7">
                    {associations.length > 0 && (
                      <ul>
                        {associations.map((association, index) => {
                          const editable = canEditContributorAssociation(association.account_id, activeAccountId, platformRole);
                          return (
                            <li key={association.account_id} className="border-b border-tea-border py-4 first:pt-0">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                                <div className="min-w-0">
                                  <p className="font-display text-ui-20 text-tea-text">{association.account_name}</p>
                                  <p className="font-body text-ui-13 italic text-tea-text-sec">{availableAccounts.find(item => item.id === association.account_id)?.account_kind === 'master' ? 'Tea Master operational home' : 'Guest or collaborating practice'}</p>
                                </div>
                                <div className="flex flex-wrap gap-x-5">
                                  <button type="button" aria-label={`Move ${association.account_name} up`} disabled={!editable || index === 0} onClick={() => moveAssociation(index, index - 1)} className={QUIET}>Earlier</button>
                                  <button type="button" aria-label={`Move ${association.account_name} down`} disabled={!editable || index === associations.length - 1} onClick={() => moveAssociation(index, index + 1)} className={QUIET}>Later</button>
                                  <button type="button" aria-label={`Remove ${association.account_name}`} disabled={!editable} onClick={() => { setAssociations(current => current.filter(item => item.account_id !== association.account_id)); setAssociationsDirty(true); }} className={QUIET}>Remove</button>
                                </div>
                              </div>
                              <div className="mt-2 grid gap-x-8 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                                <Line id={`f-role-${association.account_id}`} label="Public role" disabled={!editable} value={association.public_role ?? ''} onChange={event => updateAssociation(association.account_id, { public_role: event.target.value || null })} placeholder="Tea Master, guest curator, writer" />
                                <label className="tap-target flex min-h-11 cursor-pointer items-center gap-3 font-sans text-ui-13 text-tea-text-sec"><input type="checkbox" disabled={!editable} checked={association.is_host} onChange={event => updateAssociation(association.account_id, { is_host: event.target.checked })} className="h-4 w-4 accent-tea-gold" /> Host profile</label>
                              </div>
                              {!editable && <p className="mt-2 font-sans text-ui-12 text-tea-text-dim">Read only while another account is active.</p>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <label htmlFor="f-add-account" className={LABEL}>Add an account</label>
                        <select id="f-add-account" value={newAssociationId} onChange={event => setNewAssociationId(event.target.value)} className={`mt-1 ${LINE_SANS}`}>
                          <option value="">Choose an account</option>
                          {availableAccounts.filter(item => canEditContributorAssociation(item.id, activeAccountId, platformRole) && !associations.some(association => association.account_id === item.id)).map(item => <option key={item.id} value={item.id}>{item.name}{item.account_kind === 'master' ? ' · Tea Master home' : ''}</option>)}
                        </select>
                      </div>
                      <button type="button" onClick={addAssociation} disabled={!newAssociationId} className={ACTION}>Add association</button>
                    </div>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="f-private-contact" className={LABEL}>Private contact</label>
                        <select id="f-private-contact" className={`mt-1 ${LINE_SANS}`} value={contactId} onFocus={loadCustomers} onChange={event => setContactId(event.target.value)}>
                          <option value="">No linked contact</option>
                          {contactId && !customers.some(customer => customer.id === contactId) && <option value={contactId}>{contributor?.contact_name || 'Linked contact'}</option>}
                          {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                        </select>
                      </div>
                      <Line label="Linked user ID" value={form.user_id ?? ''} onChange={event => setField('user_id', event.target.value)} autoCapitalize="none" hint="The sign-in that may edit this page themselves." />
                    </div>
                    <Prose label="Where to find" value={form.where_to_find_text ?? ''} onChange={event => setField('where_to_find_text', event.target.value)} minRows={2} placeholder="Their shop, their table, the days they pour." hint="Kept here, not yet shown on the public page." />
                  </div>
                </Section>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-tea-border bg-tea-bg px-5 pt-2 pb-nav-gap sm:px-8 lg:pb-2">
          <button type="button" onClick={onClose} disabled={saving} className="tap-target min-h-11 px-2 font-sans text-ui-14 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Cancel</button>
          <div className="flex min-w-0 items-center justify-end gap-x-5">
            {uploading && <span className="hidden font-sans text-ui-12 text-tea-text-dim sm:inline" role="status">A photo is arriving</span>}
            {!isNew && published && !pending && <button type="button" onClick={unpublish} disabled={saving} className={QUIET}>Unpublish</button>}
            {pending && <button type="button" onClick={() => setRequestingChanges(current => !current)} disabled={saving} className={QUIET}>Request changes</button>}
            {!pending && (isNew || !published) && <button type="button" onClick={() => persist(true)} disabled={saving || uploading} className={ACTION} aria-label="Publish contributor"><span className="sm:hidden">Publish</span><span className="hidden sm:inline">Publish contributor</span></button>}
            {pending && <button type="button" aria-label="Approve submitted changes" onClick={() => persist(true)} disabled={saving} className="tap-target min-h-11 rounded-md cta-solid px-5 font-sans text-ui-14 disabled:opacity-50">{saving ? 'Approving…' : <><span className="sm:hidden">Approve</span><span className="hidden sm:inline">Approve submitted changes</span></>}</button>}
            {!pending && <button type="button" aria-label={isNew ? 'Save draft' : 'Save changes'} onClick={() => persist(false)} disabled={saving || uploading} className="tap-target min-h-11 rounded-md cta-solid px-5 font-sans text-ui-14 disabled:opacity-50">{saving ? 'Saving…' : isNew ? 'Save draft' : <><span className="sm:hidden">Save</span><span className="hidden sm:inline">Save changes</span></>}</button>}
          </div>
        </footer>
        {requestingChanges && pending && (
          <div className="absolute inset-x-0 bottom-0 z-modal border-t border-tea-border bg-tea-elevated px-6 pt-5 pb-nav-gap sm:px-8 lg:pb-5">
            <Prose label="What should the Tea Master revise?" id="f-revise" autoFocus minRows={3} maxLength={800} value={reviewerNote} onChange={event => setReviewerNote(event.target.value)} />
            <div className="mt-3 flex justify-between gap-3">
              <button type="button" onClick={() => { setRequestingChanges(false); setReviewerNote(''); }} className="tap-target min-h-11 font-sans text-ui-14 text-tea-text-sec hover:text-tea-text">Cancel</button>
              <button type="button" onClick={requestChanges} disabled={saving || !reviewerNote.trim()} className="tap-target min-h-11 rounded-md cta-solid px-5 font-sans text-ui-14 disabled:opacity-50">Send revision request</button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
