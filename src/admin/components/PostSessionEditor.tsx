import React, { useState, useRef } from 'react';
import { Save, Upload, Trash2, Loader2, Music, FileText, Image as ImageIcon, Leaf, X } from 'lucide-react';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { useTastingNotes } from '../hooks/useEventData';
import { useToast } from './Toast';
import { TastingNote } from '../../types/events';

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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load post-session data on mount
  React.useEffect(() => {
    if (ledgerLoaded) return;
    const loadData = async () => {
      try {
        const events = await api.events.listAdmin();
        const data = events.find((e: any) => e.id === eventId);
        if (!data) { setLedgerLoaded(true); return; }
        const postSession = data.post_session
          ? (typeof data.post_session === 'string' ? JSON.parse(data.post_session) : data.post_session)
          : {};
        setTeaLedger(postSession.teaLedger || '');
        setPlaylistUrl(postSession.playlistUrl || (data as any).playlist_url || '');
        setGallery(postSession.gallery || []);
        setSessionNotes(postSession.sessionNotes || '');
        setLedgerLoaded(true);
      } catch {
        // Silently fail
      }
    };
    loadData();
  }, [eventId, ledgerLoaded]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.events.upsertPostSession(eventId, {
        teaLedger,
        playlistUrl,
        gallery,
        sessionNotes,
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

    setUploading(true);
    try {
      for (const file of files) {
        const compressed = await compressImage(file);
        const url = await api.uploadImage(compressed);
        setGallery(prev => [...prev, url]);
      }
      showToast(`${files.length} image${files.length > 1 ? 's' : ''} uploaded`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
        <label className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec block mb-2 flex items-center gap-1.5">
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
        <label className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec block mb-2 flex items-center gap-1.5">
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
        <label className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec block mb-2 flex items-center gap-1.5">
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
                <div className="absolute bottom-1 left-1 bg-tea-bg/60 text-tea-text-sec text-[9px] px-1 rounded">
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
        <label className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec block mb-2">Session Notes</label>
        <textarea
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          className="w-full border border-tea-border bg-transparent rounded-md p-3 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold min-h-[100px] resize-y placeholder:text-tea-text-sec/50"
          placeholder="Notes about the session, observations, highlights..."
        />
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2 border-t border-tea-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-tea-gold text-tea-bg px-4 py-2 rounded-md text-sm font-medium hover:bg-tea-gold-lt transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Post-Session
        </button>
      </div>

      {/* Tasting Notes (read-only) */}
      {tastingNotes.length > 0 && (
        <div className="pt-4 border-t border-tea-border">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-3 flex items-center gap-1.5">
            <Leaf size={10} /> Submitted Tasting Notes
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tea-border">
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-tea-text-sec font-medium py-2 px-2">Guest</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-tea-text-sec font-medium py-2 px-2">Tea</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-tea-text-sec font-medium py-2 px-2">Rating</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-tea-text-sec font-medium py-2 px-2">Impression</th>
                </tr>
              </thead>
              <tbody>
                {tastingNotes.map(note => (
                  <tr key={note.id} className="border-b border-tea-border">
                    <td className="py-2 px-2 text-tea-text-sec text-xs">Anonymous</td>
                    <td className="py-2 px-2 text-tea-text text-xs">{note.teaName || '—'}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-0.5">
                        {renderLeaves(note.rating)}
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
