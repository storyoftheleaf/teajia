import React, { useState, useRef } from 'react';
import { Save, Upload, Trash2, Loader2, Music, FileText, Image as ImageIcon, Leaf, X } from 'lucide-react';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { useTastingNotes } from '../hooks/useEventData';
import { useToast } from './Toast';
import { TastingNote } from '../../types/events';
import { createPostSessionLoadCoordinator, createPostSessionUploadGuard, postSessionUploadErrorMessage, runPostSessionUpload, savePostSession } from './PostSessionEditorContract';

interface PostSessionEditorProps {
  eventId: string;
}

export const PostSessionEditor: React.FC<PostSessionEditorProps> = ({ eventId }) => {
  const { showToast } = useToast();
  const { data: tastingNotes = [] } = useTastingNotes(eventId);

  const [teaLedger, setTeaLedger] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [energy, setEnergy] = useState('');
  const [sharedTastingNotes, setSharedTastingNotes] = useState('');
  const [hostNotes, setHostNotes] = useState('');
  const [hostChanges, setHostChanges] = useState('');
  const [saving, setSaving] = useState(false);
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
      showToast('Post-session data saved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
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

  // Render leaf rating
  const renderLeaves = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Leaf
        key={i}
        size={10}
        className={i < rating ? 'text-tea-gold' : 'text-tea-text-sec/30'}
        fill={i < rating ? 'currentColor' : 'none'}
      />
    ));
  };

  return (
    <div className="space-y-6">
      {/* Tea Ledger */}
      <div>
        <label className="label-caps text-tea-text-sec block mb-2 flex items-center gap-1.5">
          <FileText size={10} /> Tea Ledger (JSON)
        </label>
        <textarea
          value={teaLedger}
          onChange={(e) => setTeaLedger(e.target.value)}
          className="w-full border border-tea-border bg-tea-bg rounded-md p-3 text-xs text-tea-text font-mono outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold min-h-[120px] resize-y"
          placeholder='{"teas": [{"name": "Dancong", "grams": 5, "steeps": 8}]}'
          spellCheck={false}
        />
      </div>

      {/* Playlist URL */}
      <div>
        <label className="label-caps text-tea-text-sec block mb-2 flex items-center gap-1.5">
          <Music size={10} /> Playlist URL
        </label>
        <input
          type="text"
          value={playlistUrl}
          onChange={(e) => setPlaylistUrl(e.target.value)}
          className="w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-sm text-tea-text py-2 placeholder:text-tea-text-sec/50"
          placeholder="https://open.spotify.com/playlist/..."
        />
        {embedUrl && (
          <div className="mt-3 rounded-md overflow-hidden border border-tea-border">
            <iframe
              src={embedUrl}
              width="100%"
              height={isSpotify ? 152 : 200}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              className="border-0"
              title="Playlist embed"
            />
          </div>
        )}
      </div>

      {/* Gallery */}
      <div>
        <label className="label-caps text-tea-text-sec block mb-2 flex items-center gap-1.5">
          <ImageIcon size={10} /> Gallery
        </label>

        {gallery.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-3">
            {gallery.map((url, idx) => (
              <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-tea-border group">
                <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                <button
                  onClick={() => removeGalleryImage(idx)}
                  className="absolute top-1 right-1 bg-tea-bg/80 text-tea-text p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
                <div className="absolute bottom-1 left-1 bg-tea-bg/60 text-tea-text-sec text-ui-9 px-1 rounded">
                  {idx + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text px-3 py-2 border border-dashed border-tea-border rounded-md hover:border-tea-gold/30 transition-colors"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? 'Uploading...' : 'Add Images'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Session Notes */}
      <div>
        <label className="label-caps text-tea-text-sec block mb-2">Session Notes</label>
        <textarea
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          className="w-full border border-tea-border bg-transparent rounded-md p-3 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold min-h-[100px] resize-y placeholder:text-tea-text-sec/50"
          placeholder="Notes about the session, observations, highlights..."
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="label-caps text-tea-text-sec block mb-2">Host Notes</label>
          <textarea
            value={hostNotes}
            onChange={(e) => setHostNotes(e.target.value)}
            className="w-full border border-tea-border bg-transparent rounded-md p-3 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold min-h-[100px] resize-y placeholder:text-tea-text-sec/50"
            placeholder="Your observations as host"
          />
        </div>
        <div>
          <label className="label-caps text-tea-text-sec block mb-2">Host Changes</label>
          <textarea
            value={hostChanges}
            onChange={(e) => setHostChanges(e.target.value)}
            className="w-full border border-tea-border bg-transparent rounded-md p-3 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold min-h-[100px] resize-y placeholder:text-tea-text-sec/50"
            placeholder="What you would change next time"
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="label-caps text-tea-text-sec block mb-2">Session Energy</label>
          <select
            value={energy}
            onChange={(e) => setEnergy(e.target.value)}
            className="w-full border border-tea-border bg-tea-bg rounded-md px-3 py-2.5 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold"
          >
            <option value="">Not recorded</option>
            <option value="intimate_warm">Intimate and warm</option>
            <option value="lively">Lively</option>
            <option value="contemplative">Contemplative</option>
            <option value="exploratory">Exploratory</option>
            <option value="meditative">Meditative</option>
          </select>
        </div>
        <div>
          <label className="label-caps text-tea-text-sec block mb-2">Shared Tasting Notes</label>
          <textarea
            value={sharedTastingNotes}
            onChange={(e) => setSharedTastingNotes(e.target.value)}
            className="w-full border border-tea-border bg-transparent rounded-md p-3 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold min-h-[100px] resize-y placeholder:text-tea-text-sec/50"
            placeholder="One note per line"
          />
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2 border-t border-tea-border">
        {loadError && (
          <p className="mr-auto self-center text-xs text-tea-text-sec">Post-session data could not be loaded.</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !ledgerLoaded || loadError}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-tea-gold/10"
        >
          {saving || !ledgerLoaded ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {!ledgerLoaded ? 'Loading Post-Session' : 'Save Post-Session'}
        </button>
      </div>

      {/* Tasting Notes (read-only) */}
      {tastingNotes.length > 0 && (
        <div className="pt-4 border-t border-tea-border">
          <h3 className="label-caps text-tea-text-sec mb-3 flex items-center gap-1.5">
            <Leaf size={10} /> Submitted Tasting Notes
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tea-border">
                  <th className="text-left label-caps text-tea-text-dim py-2 px-2">Guest</th>
                  <th className="text-left label-caps text-tea-text-dim py-2 px-2">Tea</th>
                  <th className="text-left label-caps text-tea-text-dim py-2 px-2">Rating</th>
                  <th className="text-left label-caps text-tea-text-dim py-2 px-2">Impression</th>
                </tr>
              </thead>
              <tbody>
                {tastingNotes.map(note => (
                  <tr key={note.id} className="border-b border-tea-border">
                    <td className="py-2 px-2 text-tea-text-sec text-xs">Anonymous</td>
                    <td className="py-2 px-2 text-tea-text text-xs">{note.teaName || '—'}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-0.5">
                        {renderLeaves(note.rating ?? 0)}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-tea-text-sec text-xs max-w-[200px] truncate" title={note.impression}>
                      {note.impression || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
