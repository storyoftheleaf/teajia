import { ExternalLink, Music } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

export function PlaylistSection({ playlistUrl }: { playlistUrl: string }) {
  return (
    <section className="mb-12">
      <div className="mb-5 flex items-center gap-2">
        <Music className="h-4 w-4 text-tea-gold" aria-hidden="true" />
        <h2 className={TYPOGRAPHY_CLASSES.h2}>Session playlist</h2>
      </div>
      {playlistUrl.includes('spotify.com') ? (
        <div className="overflow-hidden rounded-xl border border-tea-border">
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
        <div className="aspect-video overflow-hidden rounded-xl border border-tea-border">
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
          className="tap-target group inline-flex items-center gap-3 rounded-md border border-tea-border bg-tea-surface px-4 py-3 text-ui-12 font-semibold text-tea-text-sec transition-colors hover:border-tea-gold/40 hover:text-tea-text"
        >
          <Music className="h-3.5 w-3.5 text-tea-text-sec transition-colors group-hover:text-tea-gold" />
          <span>Listen to the session playlist</span>
          <ExternalLink className="ml-auto h-3 w-3 text-tea-text-sec" />
        </a>
      )}
    </section>
  );
}
