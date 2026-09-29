import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { profileStatus } from './profileDomain';
import type { ProfileGalleryImage, SelfProfile, SelfProfileUpdate } from './types';
import type { ContributorGalleryImage } from '../../types';
import { personPageParts, MISSING_BEGINNINGS, type PersonValue } from '../../admin/components/contributorEditor/PersonPage';
import { PhotoUploadContext, type PhotoUploader } from '../../admin/components/contributorEditor/photoUpload';
import type { SheetId } from '../../admin/components/contributorEditor/CardParts';

// The tea master's own page, filled in by the tea master. The same card and
// rows as the shop's editor, in the same words, so what they see is what the
// shop sees. Saving a live page sends the change to the shop to approve.
// Rules: docs/CONTRIBUTOR_EDITOR.md.

interface ProfileEditorProps {
  profile: SelfProfile;
  onSave: (value: SelfProfileUpdate) => Promise<void>;
  onSaveGallery: (images: ProfileGalleryImage[]) => Promise<void>;
  onUnpublish: () => Promise<void>;
  onUploadPortrait?: (image: Blob) => Promise<string>;
}

/** Everything the page reads is sent; everything else goes back exactly as it came, so nothing hidden is lost. */
function toUpdate(profile: SelfProfile): SelfProfileUpdate {
  return {
    display_name: profile.display_name,
    business_name: profile.business_name,
    chinese_name: profile.chinese_name,
    role: profile.role,
    beginnings: profile.beginnings,
    now_text: profile.now_text,
    inspirations: profile.inspirations,
    closing: profile.closing,
    location_line: profile.location_line,
    languages: profile.languages,
    avatar_url: profile.avatar_url,
    portrait_url: profile.portrait_url,
    portrait_focus: profile.portrait_focus,
    links: profile.links,
  };
}

const orNull = (value: string) => value.trim() ? value : null;

export function ProfileEditor({ profile, onSave, onSaveGallery, onUnpublish, onUploadPortrait }: ProfileEditorProps) {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const takePortrait = useRef<((files: File[]) => void) | null>(null);
  const takeGallery = useRef<((files: File[]) => void) | null>(null);

  useEffect(() => setDraft(profile), [profile]);
  const uploading = Object.values(busy).some(Boolean);

  const status = profileStatus(profile);
  const hasPendingDraft = profile.has_pending_draft === true;
  const isPendingDraft = !profile.is_published && (
    profile.publication_state === 'draft'
    || profile.publication_state === 'awaiting_approval'
    || profile.approval_state === 'pending'
    || profile.approval_state === 'changes_requested'
  );
  const saveLabel = profile.is_published
    ? hasPendingDraft ? 'Update pending draft' : 'Save for review'
    : profile.approval_state === 'changes_requested'
      ? 'Save revision'
      : isPendingDraft
        ? 'Save draft'
        : 'Save profile';
  const saveStateCopy = saved
    ? profile.is_published
      ? 'Sent. Teajia will look it over before it goes on your page.'
      : isPendingDraft
        ? 'Saved.'
        : 'Saved.'
    : profile.is_published
      ? hasPendingDraft
        ? 'Your earlier changes are waiting for approval. Your live profile is unchanged.'
        : 'Your page is live. Changes go to Teajia to approve first.'
      : isPendingDraft
        ? 'Changes remain private until approved.'
        : 'Only you can see this until it is published.';

  // Files placed here go through the tea master's own upload, not the shop's.
  const uploader = useMemo<PhotoUploader>(() => async (file, onProgress) => {
    if (!onUploadPortrait) throw new Error('Photos cannot be added here yet.');
    onProgress(0.4);
    const url = await onUploadPortrait(file);
    onProgress(1);
    return url;
  }, [onUploadPortrait]);

  const markBusy = useCallback((key: string) => (value: boolean) => setBusy(current => current[key] === value ? current : { ...current, [key]: value }), []);
  const openSheet = useCallback((id: SheetId, from: HTMLElement | null) => {
    opener.current = from;
    setSheet(id);
    window.setTimeout(() => document.getElementById(`sheet-${id}-close`)?.focus(), 0);
  }, []);
  const closeSheet = useCallback(() => {
    setSheet(null);
    const back = opener.current;
    window.setTimeout(() => back?.focus(), 0);
  }, []);
  useEffect(() => {
    if (!sheet) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); closeSheet(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet, closeSheet]);

  const person: PersonValue = {
    display_name: draft.display_name ?? '',
    chinese_name: draft.chinese_name ?? '',
    role: draft.role ?? '',
    location_line: draft.location_line ?? '',
    now_text: draft.now_text ?? '',
    beginnings: draft.beginnings ?? '',
    closing: draft.closing ?? '',
    portrait_url: draft.portrait_url ?? '',
    portrait_focus: draft.portrait_focus ?? null,
    links: draft.links,
    gallery_images: draft.gallery_images.map(image => ({ ...image, focus: null }) as ContributorGalleryImage),
  };

  const change = (patch: Partial<PersonValue>) => {
    setSaved(false);
    setDraft(current => {
      const next = { ...current };
      if (patch.display_name !== undefined) next.display_name = patch.display_name;
      if (patch.chinese_name !== undefined) next.chinese_name = orNull(patch.chinese_name);
      if (patch.role !== undefined) next.role = orNull(patch.role);
      if (patch.location_line !== undefined) next.location_line = orNull(patch.location_line);
      if (patch.now_text !== undefined) next.now_text = orNull(patch.now_text);
      if (patch.beginnings !== undefined) next.beginnings = orNull(patch.beginnings);
      if (patch.closing !== undefined) next.closing = orNull(patch.closing);
      if (patch.links !== undefined) next.links = patch.links.map(link => ({ ...link, qr_image_url: link.qr_image_url ?? null, label: link.label ?? undefined }));
      return next;
    });
  };
  const setPortrait = useCallback((next: { url: string | null; focus: string | null }) => {
    setSaved(false);
    setDraft(current => {
      const follows = !current.avatar_url || current.avatar_url === current.portrait_url;
      return { ...current, portrait_url: next.url, portrait_focus: next.focus, ...(follows ? { avatar_url: next.url } : {}) };
    });
  }, []);
  const updateGallery = useCallback((update: (images: ContributorGalleryImage[]) => ContributorGalleryImage[]) => {
    setSaved(false);
    setDraft(current => ({
      ...current,
      gallery_images: update(current.gallery_images.map(image => ({ ...image, focus: null }) as ContributorGalleryImage))
        .map(image => ({ id: image.id, image_url: image.image_url, caption: image.caption ?? null })),
    }));
  }, []);

  const { card, sheets } = personPageParts({
    value: person,
    onChange: change,
    onPortrait: setPortrait,
    onGallery: updateGallery,
    markBusy,
    sheet,
    openSheet,
    closeSheet,
    sheetMode: 'page',
    allowAddress: false,
    takePortrait,
    takeGallery,
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (uploading) { setError('A photo is still arriving. Save once it has landed.'); return; }
    if (!draft.display_name.trim()) { setError('Write your name before saving.'); return; }
    if (!draft.beginnings?.trim()) { setError(MISSING_BEGINNINGS); openSheet('words', null); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(toUpdate(draft));
      // Sent every save, empty array included: a full-array replace is
      // idempotent, and this is the only way an emptied gallery is ever
      // recorded as empty rather than left holding its last saved rows.
      await onSaveGallery(draft.gallery_images);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your page could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const unpublish = async () => {
    setSaving(true);
    setError(null);
    try {
      await onUnpublish();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your page could not be taken down. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PhotoUploadContext.Provider value={uploader}>
      <section aria-labelledby="profile-editor-title" className="space-y-8">
        <div className="border-y border-tea-border py-5 md:flex md:items-start md:justify-between md:gap-8">
          <div>
            <h2 id="profile-editor-title" className="font-display text-ui-28 font-normal leading-tight text-tea-text">{status.label}</h2>
            <p className="mt-1 max-w-[56ch] font-body text-ui-15 leading-relaxed text-tea-text-sec">{status.detail}</p>
          </div>
          {profile.is_published && (
            <button type="button" onClick={unpublish} disabled={saving} className="tap-target mt-4 font-sans text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text md:mt-0">
              Take my page down
            </button>
          )}
        </div>

        <form onSubmit={save} className="space-y-10" onPaste={event => {
          const target = event.target as HTMLElement;
          if (target.closest('input, textarea, select')) return;
          const files = Array.from(event.clipboardData.files).filter(file => file.type.startsWith('image/'));
          const take = draft.portrait_url ? takeGallery.current : takePortrait.current;
          if (!files.length || !take) return;
          event.preventDefault();
          take(files);
        }}>
          {profile.approval_state === 'changes_requested' && profile.reviewer_note && (
            <aside className="border-l border-tea-gold/40 pl-5">
              <p className="font-display text-ui-20 text-tea-text">Reviewer note</p>
              <p className="mt-2 whitespace-pre-line font-body text-ui-15 leading-relaxed text-tea-text-sec">{profile.reviewer_note}</p>
            </aside>
          )}

          <div inert={sheet ? true : undefined}>{card}</div>

          {error && <p role="alert" className="border-l-2 border-tea-error pl-4 font-body text-ui-15 leading-relaxed text-tea-text">{error}</p>}
          <div className="flex items-center justify-between gap-4 border-t border-tea-border pt-5">
            <span className="font-body text-ui-14 italic leading-snug text-tea-text-sec" role="status">{saveStateCopy}</span>
            <button type="submit" disabled={saving || uploading} className="cta-solid tap-target shrink-0 rounded-md px-5 py-2.5 font-sans text-ui-14 disabled:opacity-50">
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        </form>
        {sheets}
      </section>
    </PhotoUploadContext.Provider>
  );
}
