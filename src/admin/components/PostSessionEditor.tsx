import React, { useId, useState, useRef } from 'react';
import { Save, Upload, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { sitLinksQuery } from '../../lib/publicSitConnections';
import { RecapCreditEditor } from './RecapCreditEditor';
import { ServedTeasEditor } from './ServedTeasEditor';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { useToast } from './Toast';
import { Modal } from '../../components/shared/Modal';
import { Button } from '../../components/shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { createPostSessionLoadCoordinator, createPostSessionUploadGuard, postSessionUploadErrorMessage, runPostSessionUpload, savePostSession } from './PostSessionEditorContract';

interface PostSessionEditorProps {
  eventId: string;
  canShareAttendeeRecap: boolean;
}

export const PostSessionEditor: React.FC<PostSessionEditorProps> = ({ eventId, canShareAttendeeRecap }) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const recapId = useId();
  const [showMore, setShowMore] = useState(false);

  const [teaLedger, setTeaLedger] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [energy, setEnergy] = useState('');
  const [sharedTastingNotes, setSharedTastingNotes] = useState('');
  const [hostNotes, setHostNotes] = useState('');
  const [hostChanges, setHostChanges] = useState('');
  const [saving, setSaving] = useState(false);
  const [recapToShare, setRecapToShare] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loaderRef = useRef<ReturnType<typeof createPostSessionLoadCoordinator> | null>(null);
  const uploadGuardRef = useRef<ReturnType<typeof createPostSessionUploadGuard> | null>(null);

  if (!uploadGuardRef.current) {
    uploadGuardRef.current = createPostSessionUploadGuard(url => setGallery(prev => [...prev, url]));
  }

  // Commit event ownership before the browser can accept input. Cleanup runs
  // before the next event's layout effect and on unmount, invalidating any
  // upload completion still queued for the previous editor lifecycle.
  React.useLayoutEffect(() => {
    uploadGuardRef.current!.activate(eventId);
    return () => uploadGuardRef.current?.cancel();
  }, [eventId]);

  if (!loaderRef.current) {
    loaderRef.current = createPostSessionLoadCoordinator(
      api.events.getPostSession,
      () => {
        setShowMore(false);
        setTeaLedger('');
        setPlaylistUrl('');
        setGallery([]);
        setSessionNotes('');
        setEnergy('');
        setSharedTastingNotes('');
        setHostNotes('');
        setHostChanges('');
        setSaving(false);
        setUploading(false);
        setLedgerLoaded(false);
        setLoadError(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      loaded => {
        setTeaLedger(loaded.teaLedger);
        setPlaylistUrl(loaded.playlistUrl);
        setGallery(loaded.gallery);
        setSessionNotes(loaded.sessionNotes);
        setEnergy(loaded.energy);
        setSharedTastingNotes(loaded.sharedTastingNotes);
        setHostNotes(loaded.hostNotes);
        setHostChanges(loaded.hostChanges);
        setLedgerLoaded(true);
        setLoadError(false);
      },
      () => {
        setLedgerLoaded(true);
        setLoadError(true);
      },
    );
  }

  // Reload when the same editor instance moves between event routes. The
  // coordinator ignores any older request that resolves after the new event.
  React.useEffect(() => {
    void loaderRef.current!.load(eventId);
    return () => loaderRef.current?.cancel();
  }, [eventId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePostSession(api.events.upsertPostSession, eventId, {
        teaLedger, playlistUrl, gallery, sessionNotes, energy, sharedTastingNotes, hostNotes, hostChanges,
      });
      void queryClient.invalidateQueries({ queryKey: ['sit-photo-review'] });
      void queryClient.invalidateQueries({ queryKey: sitLinksQuery });
      void queryClient.invalidateQueries({ queryKey: ['event-recap-public'] });
      showToast('Post-session data saved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleShareRecap = async () => {
    if (recapToShare === null || sharing) return;
    setSharing(true);
    try {
      await api.events.shareAttendeeRecap(eventId, recapToShare);
      setRecapToShare(null);
      showToast('Recap shared with attendees', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not share recap', 'error');
    } finally {
      setSharing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const upload = uploadGuardRef.current!.begin(eventId);
    setUploading(true);
    await runPostSessionUpload(files, upload, compressImage, api.uploadImage, {
      onSuccess: count => showToast(`${count} image${count > 1 ? 's' : ''} uploaded`, 'success'),
      onError: error => showToast(postSessionUploadErrorMessage(error), 'error'),
      onComplete: () => {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  };

  const removeGalleryImage = (idx: number) => {
    setGallery(prev => prev.filter((_, i) => i !== idx));
  };

  const isSpotify = playlistUrl?.includes('spotify.com');
  const isYouTube = playlistUrl?.includes('youtube.com') || playlistUrl?.includes('youtu.be');

  const getEmbedUrl = (): string | null => {
    if (isSpotify) {
      const match = playlistUrl.match(/playlist\/([a-zA-Z0-9]+)/);
      if (match) return `https://open.spotify.com/embed/playlist/${match[1]}`;
    }
    if (isYouTube) {
      const match = playlistUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (match) return `https://www.youtube.com/embed/${match[1]}`;
    }
    return null;
  };

  const embedUrl = getEmbedUrl();

  const secondaryText = TYPOGRAPHY_CLASSES.bodyLight + ' text-tea-text-sec';
  const control = 'input-field w-full text-ui-16';

  return (
    <div className="space-y-3">
      <div className="grid min-w-0 items-start gap-3 xl:grid-cols-2">
        <section aria-labelledby={recapId} className="min-w-0 rounded-md border border-tea-border bg-tea-surface p-4">
          <h3 id={recapId} className={TYPOGRAPHY_CLASSES.h3}>Session recap</h3>
          <label htmlFor={recapId + '-note'} className={`mt-2 block ${secondaryText}`}>What would you like guests to remember?</label>
          <textarea
            id={recapId + '-note'}
            value={sessionNotes}
            onChange={event => setSessionNotes(event.target.value)}
            className={`mt-1 resize-y ${control}`}
            rows={3}
            placeholder="Notes about the session, observations, highlights..."
          />
          {gallery.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-4">
              {gallery.map((url, index) => (
                <div key={`${url}-${index}`} className="relative aspect-square overflow-hidden rounded-md border border-tea-border">
                  <img src={url} alt={`Recap photo ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                  <Button type="button" variant="icon" size="sm" aria-label={`Remove recap photo ${index + 1}`}
                    className="tap-target absolute right-1 top-1 bg-tea-bg"
                    icon={<X size={14} />} onClick={() => removeGalleryImage(index)} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" loading={uploading}
              icon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()}>
              Add photos
            </Button>
            <Button type="button" variant="quiet" size="sm" onClick={() => setShowMore(true)}>Optional details</Button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
        </section>

        <ServedTeasEditor eventId={eventId} value={teaLedger} onChange={setTeaLedger}
          disabled={!ledgerLoaded || loadError || saving} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-tea-border pt-2">
        {loadError && <p role="alert" className={`mr-auto ${secondaryText}`}>Post-session data could not be loaded.</p>}
        {canShareAttendeeRecap && (
          <Button type="button" variant="secondary"
            disabled={!ledgerLoaded || loadError || saving || sharing || !sessionNotes.trim() || sessionNotes.trim().length > 12000}
            onClick={() => setRecapToShare(sessionNotes.trim())}>
            Share recap with attendees
          </Button>
        )}
        <Button type="button" onClick={handleSave} icon={<Save size={14} />} loading={saving}
          disabled={!ledgerLoaded || loadError || uploading}>
          {!ledgerLoaded ? 'Loading recap' : 'Save Post-Session'}
        </Button>
      </div>

      <Modal isOpen={showMore} onClose={() => setShowMore(false)} title="Optional recap details" className="pb-nav" initialFocus="container">
        <div className="space-y-3 p-4">
          <label className={`block ${secondaryText}`}>
            Playlist URL
            <input type="url" value={playlistUrl} onChange={event => setPlaylistUrl(event.target.value)} className={control} />
          </label>
          {embedUrl && (
            <div className="overflow-hidden rounded-md border border-tea-border">
              <iframe src={embedUrl} width="100%" height={isSpotify ? 152 : 200}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                className="border-0" title="Playlist embed" />
            </div>
          )}
          <label className={`block ${secondaryText}`}>
            Host notes
            <textarea value={hostNotes} onChange={event => setHostNotes(event.target.value)} className={control} rows={2} />
          </label>
          <label className={`block ${secondaryText}`}>
            What would you change next time?
            <textarea value={hostChanges} onChange={event => setHostChanges(event.target.value)} className={control} rows={2} />
          </label>
          <label className={`block ${secondaryText}`}>
            Session energy
            <select value={energy} className={control} onChange={event => setEnergy(event.target.value)}>
              <option value="">Not recorded</option>
              <option value="intimate_warm">Intimate and warm</option>
              <option value="lively">Lively</option>
              <option value="contemplative">Contemplative</option>
              <option value="exploratory">Exploratory</option>
              <option value="meditative">Meditative</option>
            </select>
          </label>
          <label className={`block ${secondaryText}`}>
            Shared tasting notes
            <textarea value={sharedTastingNotes} onChange={event => setSharedTastingNotes(event.target.value)}
              className={control} rows={3} placeholder="One note per line" />
          </label>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowMore(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={recapToShare !== null && canShareAttendeeRecap}
        onClose={() => { if (!sharing) setRecapToShare(null); }}
        title="Share recap with attendees?"
        initialFocus="container"
      >
        <p className="px-6 pt-4 text-ui-13 text-tea-text-sec">
          Only confirmed guests marked attended can read this text from their RSVP link.
        </p>
        <p className="mx-6 mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-tea-bg p-3 text-ui-13 text-tea-text">
          {recapToShare}
        </p>
        <div className="flex flex-wrap justify-between gap-2 px-6 py-4">
          <button type="button" disabled={sharing} onClick={() => setRecapToShare(null)} className="btn-quiet tap-target">
            Cancel
          </button>
          <button type="button" disabled={sharing} onClick={handleShareRecap} className="btn-primary tap-target">
            {sharing ? 'Sharing…' : 'Share recap'}
          </button>
        </div>
      </Modal>

      <RecapCreditEditor eventId={eventId} />

    </div>
  );
};
