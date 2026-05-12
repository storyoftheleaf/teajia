import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Music, Image, MessageCircle, BookOpen, ShoppingBag, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { TeaLeafIcon } from '../components/Icons';
import type { TeaMenuItem } from '../types/events';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicPostSessionData {
  id: string;
  event_id: string;
  session_notes?: string;
  playlist_url?: string;
  gallery_images?: string[];
  // tea_ledger may hold serialized tea menu items or a free-form object
  tea_ledger?: unknown;
  // tasting notes surfaced only if host chose to share them
  shared_tasting_notes?: string[];
  created_at: string;
}

interface PublicEventRecap {
  event: {
    id: string;
    slug: string;
    title: string;
    subtitle?: string;
    event_date: string;
    flyer_image_url?: string;
  };
  post_session: PublicPostSessionData;
  tea_menu: TeaMenuItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

const STORAGE_KEY_PREFIX = 'teajia_recap_note_';

// ── Sub-components ────────────────────────────────────────────────────────────

interface TeaLedgerSectionProps {
  items: TeaMenuItem[];
}

const TeaLedgerSection: React.FC<TeaLedgerSectionProps> = ({ items }) => {
  const sorted = [...items].sort((a, b) => (a.brewOrder ?? 0) - (b.brewOrder ?? 0));
  return (
    <section className="mb-12">
      <div className="flex items-center gap-2 mb-5">
        <TeaLeafIcon className="w-4 h-4 text-tea-gold" />
        <h2 className="h2">Teas served</h2>
      </div>
      <div className="space-y-3">
        {sorted.map((item, idx) => (
          <div
            key={item.id}
            className="p-4 bg-tea-surface border border-tea-border rounded-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span
                    className="text-ui-20 text-tea-gold/30 leading-none shrink-0"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {idx + 1}
                  </span>
                  {item.productType && (
                    <span className="label-caps text-tea-readgold">
                      {item.productType}
                    </span>
                  )}
                </div>
                <h3 className="h3 mt-0.5">
                  {item.customName || item.productName || 'Unknown tea'}
                </h3>
                {item.customDescription && (
                  <p className="body-light mt-2">
                    {item.customDescription}
                  </p>
                )}
              </div>
              {item.productId && (
                <a
                  href={`/shop?product=${encodeURIComponent(item.productId)}`}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-xs font-semibold text-tea-text-sec hover:border-tea-gold/40 hover:text-tea-text transition-colors group"
                  aria-label={`Buy ${item.customName || item.productName}`}
                >
                  <ShoppingBag className="w-3.5 h-3.5 group-hover:text-tea-gold transition-colors" />
                  <span className="hidden sm:inline">Buy this tea</span>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

interface HostNotesSectionProps {
  notes: string;
}

const HostNotesSection: React.FC<HostNotesSectionProps> = ({ notes }) => (
  <section className="mb-12">
    <div className="flex items-center gap-2 mb-5">
      <BookOpen className="w-4 h-4 text-tea-gold" />
      <h2 className="h2">From the host</h2>
    </div>
    <p className="body-prose whitespace-pre-line">{notes}</p>
  </section>
);

interface SharedNotesSectionProps {
  notes: string[];
}

const SharedNotesSection: React.FC<SharedNotesSectionProps> = ({ notes }) => (
  <section className="mb-12">
    <div className="flex items-center gap-2 mb-5">
      <MessageCircle className="w-4 h-4 text-tea-gold" />
      <h2 className="h2">Guests said</h2>
    </div>
    <div className="space-y-5">
      {notes.map((note, idx) => (
        <blockquote
          key={idx}
          className="subtitle border-l-2 border-tea-gold/30 pl-4"
        >
          "{note}"
        </blockquote>
      ))}
    </div>
  </section>
);

interface PlaylistSectionProps {
  playlistUrl: string;
}

const PlaylistSection: React.FC<PlaylistSectionProps> = ({ playlistUrl }) => (
  <section className="mb-12">
    <div className="flex items-center gap-2 mb-5">
      <Music className="w-4 h-4 text-tea-gold" />
      <h2 className="h3">Session playlist</h2>
    </div>
    {playlistUrl.includes('spotify.com') ? (
      <div className="rounded-xl overflow-hidden border border-tea-border">
        <iframe
          src={playlistUrl.replace('/playlist/', '/embed/playlist/')}
          width="100%"
          height="152"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="border-0"
          title="Session playlist"
        />
      </div>
    ) : playlistUrl.includes('youtube.com') || playlistUrl.includes('youtu.be') ? (
      <div className="rounded-xl overflow-hidden border border-tea-border aspect-video">
        <iframe
          src={playlistUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
          width="100%"
          height="100%"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="border-0"
          title="Session playlist"
        />
      </div>
    ) : (
      <a
        href={playlistUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 px-4 py-3 bg-tea-surface border border-tea-border rounded-md text-xs font-semibold text-tea-text-sec hover:border-tea-gold/40 hover:text-tea-text transition-colors group"
      >
        <Music className="w-3.5 h-3.5 text-tea-text-sec group-hover:text-tea-gold transition-colors" />
        <span>Listen to the session playlist</span>
        <ExternalLink className="w-3 h-3 text-tea-text-sec ml-auto" />
      </a>
    )}
  </section>
);

interface GallerySectionProps {
  images: string[];
}

const GallerySection: React.FC<GallerySectionProps> = ({ images }) => {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  return (
    <section className="mb-12">
      <div className="flex items-center gap-2 mb-5">
        <Image className="w-4 h-4 text-tea-gold" />
        <h2 className="h2">Gallery</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {images.map((url, idx) => (
          <button
            key={idx}
            onClick={() => setLightboxImage(url)}
            className="aspect-square overflow-hidden rounded-md border border-tea-border hover:border-tea-gold/30 transition-colors group"
            aria-label={`View photo ${idx + 1}`}
          >
            <img
              src={url}
              alt={`Session photo ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-toast bg-black/85 flex items-center justify-center p-4 cursor-pointer animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain animate-[scaleIn_0.3s_ease-out]"
          />
        </div>
      )}
    </section>
  );
};

interface PersonalNoteProps {
  eventSlug: string;
}

const PersonalNoteSection: React.FC<PersonalNoteProps> = ({ eventSlug }) => {
  const storageKey = `${STORAGE_KEY_PREFIX}${eventSlug}`;
  const [note, setNote] = useState<string>(() => {
    try { return localStorage.getItem(storageKey) ?? ''; } catch { return ''; }
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    try {
      localStorage.setItem(storageKey, note);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // localStorage may be unavailable (private browsing)
    }
  };

  return (
    <section className="mb-12">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-ui-10 text-tea-gold">✦</span>
        <h2 className="h3">What stayed with you?</h2>
      </div>
      <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
        <textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); setSaved(false); }}
          placeholder="A quiet thought, a memory, a taste that lingered..."
          rows={4}
          className="w-full bg-transparent text-ui-14 text-tea-text placeholder-tea-text-dim resize-none focus:outline-none leading-relaxed"
          aria-label="Personal note about this session"
        />
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-tea-border">
          <p className="text-ui-10 text-tea-text-dim">Saved only on this device</p>
          <button
            onClick={handleSave}
            disabled={!note.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-xs font-semibold text-tea-text-sec hover:border-tea-gold/40 hover:text-tea-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saved ? 'Saved' : 'Keep this'}
          </button>
        </div>
      </div>
    </section>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const EventRecapPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // Public recap endpoint: GET /api/events/:slug/recap (no auth required)
  // Returns { event, post_session, tea_menu } — see worker/src/index.ts handleGetPublicEventRecap.
  const { data, isLoading, isError } = useQuery<PublicEventRecap>({
    queryKey: ['event-recap-public', slug],
    queryFn: () => api.events.getPublicRecap(slug!),
    enabled: !!slug,
    retry: false,
  });

  // OG meta
  useEffect(() => {
    if (!data?.event) return;
    document.title = `${data.event.title} — Recap · Teajia`;
    return () => { document.title = 'Teajia | Tea Journal'; };
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 mx-auto mb-4" />
          <div className="h-3 w-32 bg-tea-text-sec/10 rounded-xl mx-auto" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <p className="label-caps text-tea-readgold mb-4">Session Archive</p>
          <h1 className="h2 mb-3">Recap not available</h1>
          <p className="text-ui-12 text-tea-text-dim leading-relaxed mb-8">
            The host hasn't published a recap for this session yet, or this session is still upcoming.
          </p>
          <button
            onClick={() => navigate(`/event/${slug}`)}
            className="inline-flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors text-ui-14"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to event
          </button>
        </div>
      </div>
    );
  }

  const { event, post_session, tea_menu } = data;

  const hasTeaMenu = tea_menu && tea_menu.length > 0;
  const hasHostNotes = !!post_session.session_notes?.trim();
  const hasSharedNotes = Array.isArray(post_session.shared_tasting_notes) && post_session.shared_tasting_notes.length > 0;
  const hasPlaylist = !!post_session.playlist_url;
  const hasGallery = Array.isArray(post_session.gallery_images) && post_session.gallery_images.length > 0;

  return (
    <div
      className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out] pb-[calc(52px+env(safe-area-inset-bottom,0px)+2rem)] lg:pb-12"
    >
      {/* Hero strip */}
      {event.flyer_image_url && (
        <div className="relative w-full overflow-hidden" style={{ maxHeight: '45vh' }}>
          <img
            src={event.flyer_image_url}
            alt={event.title}
            className="w-full h-auto object-cover"
            style={{ minHeight: '30vh', maxHeight: '45vh', objectFit: 'cover', filter: 'brightness(0.7)' }}
          />
          <div className="absolute inset-x-0 inset-y-0 bg-gradient-to-t from-tea-bg via-tea-bg/30 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Back button — fixed over hero if image present, otherwise regular flow */}
      <div className={event.flyer_image_url ? 'absolute top-3 left-4 z-10' : 'pt-4 px-6'}>
        <button
          onClick={() => navigate(`/event/${slug}`)}
          className={
            event.flyer_image_url
              ? 'flex items-center justify-center w-9 h-9 rounded-full'
              : 'flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors text-sm'
          }
          style={event.flyer_image_url ? { background: 'rgba(24,19,14,0.6)', backdropFilter: 'blur(8px)' } : undefined}
          aria-label="Back to event"
        >
          {event.flyer_image_url ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M19 12H5m7-7l-7 7 7 7" />
            </svg>
          ) : (
            <>
              <ArrowLeft className="w-4 h-4" />
              Back to event
            </>
          )}
        </button>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-12 pb-24">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="label-caps text-tea-readgold mb-3">Session Recap</p>
          <h1 className="h2 mb-2">
            {event.title}
          </h1>
          {event.subtitle && (
            <p className="subtitle mt-1 mb-4">
              {event.subtitle}
            </p>
          )}
          <p className="text-ui-12 text-tea-text-dim mt-3">
            {formatEventDate(event.event_date)}
          </p>
        </div>

        <div className="w-8 h-px bg-tea-border mx-auto mb-10" />

        {/* Tea Ledger */}
        {hasTeaMenu && <TeaLedgerSection items={tea_menu} />}

        {/* Host Notes */}
        {hasHostNotes && <HostNotesSection notes={post_session.session_notes!} />}

        {/* Shared tasting notes */}
        {hasSharedNotes && <SharedNotesSection notes={post_session.shared_tasting_notes!} />}

        {/* Playlist */}
        {hasPlaylist && <PlaylistSection playlistUrl={post_session.playlist_url!} />}

        {/* Gallery */}
        {hasGallery && <GallerySection images={post_session.gallery_images!} />}

        {/* Personal note prompt — always shown */}
        {slug && <PersonalNoteSection eventSlug={slug} />}

        {/* Footer */}
        <div className="text-center pt-4 pb-4 border-t border-tea-border mt-4">
          <p className="label-caps text-tea-text-dim mb-4">
            Hosted by Teajia
          </p>
          <button
            onClick={() => navigate(`/event/${slug}`)}
            className="inline-flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors text-ui-12"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to event page
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default EventRecapPage;
