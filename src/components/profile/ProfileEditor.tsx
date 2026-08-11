import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Link as LinkIcon, Plus, Trash, UserCircle } from '@phosphor-icons/react';
import { SquareCropModal } from '../shared/SquareCropModal';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { profileStatus } from './profileDomain';
import type { ProfileLink, SelfProfile, SelfProfileUpdate } from './types';

interface ProfileEditorProps {
  profile: SelfProfile;
  onSave: (value: SelfProfileUpdate) => Promise<void>;
  onUnpublish: () => Promise<void>;
  onUploadPortrait?: (image: Blob) => Promise<string>;
}

const inputClass = 'w-full rounded-md border border-tea-border bg-tea-surface px-3 py-2.5 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none focus:ring-2 focus:ring-tea-gold/30';
const labelClass = `${TYPOGRAPHY_CLASSES.label} mb-2 block text-tea-text-sec`;

function toUpdate(profile: SelfProfile): SelfProfileUpdate {
  return {
    display_name: profile.display_name,
    chinese_name: profile.chinese_name,
    beginnings: profile.beginnings,
    now_text: profile.now_text,
    location_line: profile.location_line,
    languages: profile.languages,
    avatar_url: profile.avatar_url,
    portrait_url: profile.portrait_url,
    links: profile.links,
  };
}

export function ProfileEditor({ profile, onSave, onUnpublish, onUploadPortrait }: ProfileEditorProps) {
  const [draft, setDraft] = useState(profile);
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setDraft(profile), [profile]);

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
      ? 'Changes sent for review'
      : isPendingDraft
        ? 'Draft saved'
        : 'Profile saved'
    : profile.is_published
      ? hasPendingDraft
        ? 'A draft is awaiting approval. Your live profile is unchanged.'
        : 'Saving sends these changes for owner review before they replace your live profile.'
      : isPendingDraft
        ? 'Changes remain private until approved.'
        : 'This profile is currently private.';
  const setField = <K extends keyof SelfProfile>(key: K, value: SelfProfile[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(toUpdate(draft));
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The profile could not be saved.');
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
      setError(cause instanceof Error ? cause.message : 'The profile could not be unpublished.');
    } finally {
      setSaving(false);
    }
  };

  const updateLink = (index: number, patch: Partial<ProfileLink>) => {
    setField('links', draft.links.map((link, position) => position === index ? { ...link, ...patch } : link));
  };

  const confirmCrop = async (image: Blob) => {
    if (!onUploadPortrait) return;
    setUploading(true);
    setError(null);
    try {
      const url = await onUploadPortrait(image);
      setDraft(current => ({ ...current, portrait_url: url, avatar_url: url }));
      setCropSource(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The portrait could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section aria-labelledby="profile-editor-title" className="space-y-8">
      <div className="border-y border-tea-border py-5 md:flex md:items-start md:justify-between md:gap-8">
        <div>
          <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>{status.label} · public identity</p>
          <h2 id="profile-editor-title" className={`${TYPOGRAPHY_CLASSES.h3} mt-2 text-tea-text`}>{status.label}</h2>
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 max-w-[56ch] text-tea-text-sec`}>{status.detail}</p>
        </div>
        {profile.is_published && (
          <button
            type="button"
            onClick={unpublish}
            disabled={saving}
            className="tap-target mt-4 text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text md:mt-0"
          >
            Unpublish now
          </button>
        )}
      </div>

      <form onSubmit={save} className="space-y-10">
        {profile.approval_state === 'changes_requested' && profile.reviewer_note && (
          <aside className="rounded-md border border-tea-border bg-tea-accent-sub px-4 py-4">
            <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Reviewer note</p>
            <p className="mt-2 whitespace-pre-line text-ui-13 text-tea-text-sec">{profile.reviewer_note}</p>
          </aside>
        )}
        <fieldset className="grid gap-6 border-0 p-0 md:grid-cols-[176px_minmax(0,1fr)]">
          <legend className="sr-only">Portrait and basic identity</legend>
          <div>
            <div className="aspect-square w-40 overflow-hidden rounded-full border border-tea-border bg-tea-surface">
              {draft.portrait_url || draft.avatar_url ? (
                <img src={draft.portrait_url || draft.avatar_url || ''} alt="Current profile portrait" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-tea-text-dim">
                  <UserCircle size={56} weight="thin" aria-hidden="true" />
                </div>
              )}
            </div>
            {onUploadPortrait && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={event => setCropSource(event.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="tap-target mt-3 inline-flex items-center gap-2 text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text"
                >
                  <Camera size={18} aria-hidden="true" />
                  {uploading ? 'Uploading portrait…' : 'Choose portrait'}
                </button>
              </>
            )}
          </div>

          <div className="grid min-w-0 gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={labelClass}>Display name</span>
              <input required value={draft.display_name} onChange={event => setField('display_name', event.target.value)} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Chinese name</span>
              <input value={draft.chinese_name ?? ''} onChange={event => setField('chinese_name', event.target.value || null)} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Location</span>
              <input value={draft.location_line ?? ''} onChange={event => setField('location_line', event.target.value || null)} className={inputClass} placeholder="City, country" />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>Languages</span>
              <input
                value={draft.languages.join(', ')}
                onChange={event => setField('languages', event.target.value.split(',').map(value => value.trim()).filter(Boolean))}
                className={inputClass}
                placeholder="English, Bahasa Indonesia"
              />
              <span className="mt-2 block text-ui-12 text-tea-text-dim">Separate language names with commas.</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-5 border-0 p-0">
          <legend className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Your practice</legend>
          <label className="block">
            <span className={labelClass}>Beginnings and short biography</span>
            <textarea required rows={5} value={draft.beginnings ?? ''} onChange={event => setField('beginnings', event.target.value || null)} className={inputClass} />
            <span className="mt-2 block text-ui-12 text-tea-text-dim">Display name and biography are required before an owner can publish.</span>
          </label>
          <label className="block">
            <span className={labelClass}>Current practice</span>
            <textarea rows={4} value={draft.now_text ?? ''} onChange={event => setField('now_text', event.target.value || null)} className={inputClass} />
          </label>
        </fieldset>

        <fieldset className="space-y-4 border-0 p-0">
          <legend className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Links</legend>
          {draft.links.map((link, index) => (
            <div key={`${index}-${link.url}`} className="grid gap-3 border-t border-tea-border pt-4 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_44px]">
              <label>
                <span className={labelClass}>Label</span>
                <input value={link.label} onChange={event => updateLink(index, { label: event.target.value })} className={inputClass} />
              </label>
              <label>
                <span className={labelClass}>URL</span>
                <input type="url" value={link.url} onChange={event => updateLink(index, { url: event.target.value })} className={inputClass} />
              </label>
              <button type="button" aria-label={`Remove ${link.label || 'link'}`} onClick={() => setField('links', draft.links.filter((_, position) => position !== index))} className="tap-target self-end text-tea-text-sec transition-colors hover:text-tea-text">
                <Trash size={18} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setField('links', [...draft.links, { label: '', url: '' }])} className="tap-target inline-flex items-center gap-2 text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text">
            <Plus size={17} aria-hidden="true" /> Add link
          </button>
        </fieldset>

        <section aria-labelledby="associations-heading" className="border-t border-tea-border pt-6">
          <div className="flex items-center gap-2">
            <LinkIcon size={18} className="text-tea-gold" aria-hidden="true" />
            <h3 id="associations-heading" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Store associations</h3>
          </div>
          <p className="mt-2 text-ui-12 text-tea-text-dim">Store associations are managed by an owner. They describe where you practise and do not grant account access.</p>
          <ul className="mt-4 divide-y divide-tea-border border-y border-tea-border">
            {draft.associations.map(association => (
              <li key={association.account_id} className="flex min-h-[52px] flex-wrap items-center justify-between gap-2 py-3">
                <span className="text-ui-14 text-tea-text">{association.account_name}</span>
                <span className="text-ui-12 text-tea-text-sec">{association.public_role || 'Associated'}{association.is_host ? ' · Host' : ''}</span>
              </li>
            ))}
            {draft.associations.length === 0 && <li className="py-4 text-ui-13 text-tea-text-sec">No public stores are associated yet.</li>}
          </ul>
        </section>

        {error && <p role="alert" className="text-ui-13 text-tea-text">{error}</p>}
        <div className="flex items-center justify-between border-t border-tea-border pt-5">
          <span className="text-ui-12 text-tea-text-sec">{saved ? <span className="inline-flex items-center gap-1.5"><Check size={15} aria-hidden="true" /> {saveStateCopy}</span> : saveStateCopy}</span>
          <button type="submit" disabled={saving} className="cta-solid tap-target rounded-md px-5 py-2.5 text-ui-13 font-medium transition-transform active:scale-[0.98] disabled:opacity-50">
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </form>

      <SquareCropModal
        isOpen={Boolean(cropSource)}
        source={cropSource}
        title="Crop profile portrait"
        confirmLabel="Use portrait"
        outputSize={1200}
        onClose={() => setCropSource(null)}
        onConfirm={confirmCrop}
      />
    </section>
  );
}
