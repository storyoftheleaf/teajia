import React, { useState } from 'react';
import { Music, Image, MessageCircle, ExternalLink, BookOpen } from 'lucide-react';
import { TeaLeafIcon } from '../Icons';
import { Modal } from '../shared/Modal';
import type { TeaMenuItem } from '../../types/events';

interface PostSessionArchiveProps {
  teaMenu?: TeaMenuItem[];
  playlistUrl?: string;
  galleryImages?: string[];
  aggregatedNotes?: string[];
  sessionNotes?: string;
  className?: string;
}

const PostSessionArchive: React.FC<PostSessionArchiveProps> = ({
  teaMenu,
  playlistUrl,
  galleryImages,
  aggregatedNotes,
  sessionNotes,
  className = '',
}) => {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const hasMenu = teaMenu && teaMenu.length > 0;
  const hasPlaylist = !!playlistUrl;
  const hasGallery = galleryImages && galleryImages.length > 0;
  const hasNotes = aggregatedNotes && aggregatedNotes.length > 0;
  const hasSessionNotes = !!sessionNotes && sessionNotes.trim().length > 0;

  if (!hasMenu && !hasPlaylist && !hasGallery && !hasNotes && !hasSessionNotes) return null;

  return (
    <div className={`${className}`}>
      <div className="text-center mb-8">
        <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-gold mb-2">Archive</p>
        <h3 className="font-serif text-2xl text-tea-text">Session Complete</h3>
      </div>

      {/* Tea Ledger */}
      {hasMenu && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <TeaLeafIcon className="w-4 h-4 text-tea-gold" />
            <h4 className="text-ui-11 uppercase tracking-[0.2em] text-tea-text-sec">Tea Ledger</h4>
          </div>
          <div className="space-y-5">
            {[...teaMenu!].sort((a, b) => (a.brewOrder ?? 0) - (b.brewOrder ?? 0)).map((item, idx) => (
              <div
                key={item.id}
                className="flex items-baseline gap-3 pb-5 border-b border-tea-border last:border-b-0 last:pb-0"
              >
                <span
                  className="text-ui-20 text-tea-gold/30 leading-none shrink-0"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  {item.productType && (
                    <span className="text-ui-10 uppercase tracking-[0.2em] text-tea-gold">
                      {item.productType}
                    </span>
                  )}
                  {item.productId ? (
                    <a href={`/shop/product/${encodeURIComponent(item.productId)}`} className="font-serif text-base text-tea-text hover:text-tea-gold mt-0.5 block transition-colors">
                      {item.customName || item.productName}
                    </a>
                  ) : (
                    <h5 className="font-serif text-base text-tea-text mt-0.5">{item.customName || item.productName}</h5>
                  )}
                  {item.customDescription && (
                    <p className="text-ui-14 text-tea-text-sec leading-relaxed mt-2">
                      {item.customDescription}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aggregated Notes */}
      {hasNotes && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <MessageCircle className="w-4 h-4 text-tea-gold" />
            <h4 className="text-ui-11 uppercase tracking-[0.2em] text-tea-text-sec">Guests Said</h4>
          </div>
          <div className="bg-tea-surface border border-tea-border rounded-md p-5">
            <div className="space-y-3">
              {aggregatedNotes!.map((note, idx) => (
                <p key={idx} className="text-ui-14 text-tea-text-sec italic leading-relaxed">
                  "{note}"
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Host Session Notes */}
      {hasSessionNotes && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <BookOpen className="w-4 h-4 text-tea-gold" />
            <h4 className="text-ui-11 uppercase tracking-[0.2em] text-tea-text-sec">From the Host</h4>
          </div>
          <div className="bg-tea-surface border border-tea-border rounded-md p-5">
            <p className="text-ui-14 text-tea-text leading-relaxed whitespace-pre-line">{sessionNotes}</p>
          </div>
        </div>
      )}

      {/* Playlist */}
      {hasPlaylist && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Music className="w-4 h-4 text-tea-gold" />
            <h4 className="text-ui-11 uppercase tracking-[0.2em] text-tea-text-sec">Session Playlist</h4>
          </div>
          {playlistUrl!.includes('spotify.com') ? (
            <div className="rounded-md overflow-hidden border border-tea-border">
              <iframe
                src={playlistUrl!.replace('/playlist/', '/embed/playlist/')}
                width="100%"
                height="152"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="border-0"
                title="Session playlist"
              />
            </div>
          ) : playlistUrl!.includes('youtube.com') || playlistUrl!.includes('youtu.be') ? (
            <div className="rounded-md overflow-hidden border border-tea-border aspect-video">
              <iframe
                src={playlistUrl!.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
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
              className="inline-flex items-center gap-3 px-5 py-3 bg-tea-surface border border-tea-border rounded-md text-tea-text hover:border-tea-gold/40 hover:text-tea-gold transition-colors duration-300 group"
            >
              <Music className="w-4 h-4 text-tea-text-sec group-hover:text-tea-gold transition-colors" />
              <span className="text-ui-14">Listen to the session playlist</span>
              <ExternalLink className="w-3 h-3 text-tea-text-sec ml-auto" />
            </a>
          )}
        </div>
      )}

      {/* Gallery */}
      {hasGallery && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Image className="w-4 h-4 text-tea-gold" />
            <h4 className="text-ui-11 uppercase tracking-[0.2em] text-tea-text-sec">Gallery</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {galleryImages!.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setLightboxImage(url)}
                className="aspect-square overflow-hidden rounded-md border border-tea-border hover:border-tea-gold/30 transition-colors duration-300 group"
                aria-label={`View photo ${idx + 1}`}
              >
                <img
                  src={url}
                  alt={`Session photo ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      <Modal
        isOpen={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        ariaLabel="Photo viewer"
        variant="center"
        hideClose
        className="!max-w-none !w-auto !bg-transparent !border-0 !shadow-none !overflow-visible"
      >
        {lightboxImage && (
          <img
            src={lightboxImage}
            alt="Full size session photo"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-md"
          />
        )}
      </Modal>
    </div>
  );
};

export default PostSessionArchive;
