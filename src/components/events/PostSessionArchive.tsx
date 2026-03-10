import React, { useState } from 'react';
import { Music, Image, MessageCircle, ExternalLink } from 'lucide-react';
import { TeaLeafIcon } from '../Icons';
import type { TeaMenuItem } from '../../types/events';

interface PostSessionArchiveProps {
  teaMenu?: TeaMenuItem[];
  playlistUrl?: string;
  galleryImages?: string[];
  aggregatedNotes?: string[];
  className?: string;
}

const PostSessionArchive: React.FC<PostSessionArchiveProps> = ({
  teaMenu,
  playlistUrl,
  galleryImages,
  aggregatedNotes,
  className = '',
}) => {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const hasMenu = teaMenu && teaMenu.length > 0;
  const hasPlaylist = !!playlistUrl;
  const hasGallery = galleryImages && galleryImages.length > 0;
  const hasNotes = aggregatedNotes && aggregatedNotes.length > 0;

  if (!hasMenu && !hasPlaylist && !hasGallery && !hasNotes) return null;

  return (
    <div className={`${className}`}>
      <div className="text-center mb-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-tea-gold mb-2">Archive</p>
        <h3 className="font-serif text-2xl text-tea-text">Session Complete</h3>
      </div>

      {/* Tea Ledger */}
      {hasMenu && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <TeaLeafIcon className="w-4 h-4 text-tea-gold" />
            <h4 className="text-[11px] uppercase tracking-[0.2em] text-tea-text-dim">Tea Ledger</h4>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[...teaMenu!].sort((a, b) => (a.brewOrder ?? 0) - (b.brewOrder ?? 0)).map((item) => (
              <div
                key={item.id}
                className="p-4 bg-tea-surface border border-tea-border rounded-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {item.productType && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-tea-gold">
                        {item.productType}
                      </span>
                    )}
                    <h5 className="font-serif text-base text-tea-text mt-0.5">{item.customName || item.productName}</h5>
                  </div>
                </div>
                {item.customDescription && (
                  <p className="text-sm text-tea-text-sec leading-relaxed mt-3 pt-3 border-t border-tea-border/50">
                    {item.customDescription}
                  </p>
                )}
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
            <h4 className="text-[11px] uppercase tracking-[0.2em] text-tea-text-dim">Guests Said</h4>
          </div>
          <div className="bg-tea-surface border border-tea-border rounded-md p-5">
            <div className="space-y-3">
              {aggregatedNotes!.map((note, idx) => (
                <p key={idx} className="text-sm text-tea-text-sec italic leading-relaxed">
                  "{note}"
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Playlist */}
      {hasPlaylist && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Music className="w-4 h-4 text-tea-gold" />
            <h4 className="text-[11px] uppercase tracking-[0.2em] text-tea-text-dim">Session Playlist</h4>
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
              className="inline-flex items-center gap-3 px-5 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text hover:border-tea-gold/40 hover:text-tea-gold transition-all duration-300 group"
            >
              <Music className="w-4 h-4 text-tea-text-dim group-hover:text-tea-gold transition-colors" />
              <span className="text-sm">Listen to the session playlist</span>
              <ExternalLink className="w-3 h-3 text-tea-text-dim ml-auto" />
            </a>
          )}
        </div>
      )}

      {/* Gallery */}
      {hasGallery && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Image className="w-4 h-4 text-tea-gold" />
            <h4 className="text-[11px] uppercase tracking-[0.2em] text-tea-text-dim">Gallery</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {galleryImages!.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setLightboxImage(url)}
                className="aspect-square overflow-hidden rounded-md border border-tea-border hover:border-tea-gold/30 transition-all duration-300 group"
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
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out] cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain animate-[scaleIn_0.3s_ease-out]"
          />
        </div>
      )}

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default PostSessionArchive;
