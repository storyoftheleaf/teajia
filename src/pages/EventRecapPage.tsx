import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, MessageCircle, Music } from 'lucide-react';
import { api } from '../lib/api';
import { usePublicSitRecap } from '../lib/publicSitRecap';
import { SitRecap } from '../components/sessions/SitRecap';

// /event/:slug/recap. The recap is ordered by tea (components/sessions/SitRecap.tsx).
// The older public recap payload still carries the playlist and the notes the
// host chose to share, which keep their sections below.

interface PublicEventRecap {
  event: { slug: string; title: string };
  post_session: { playlist_url?: string; shared_tasting_notes?: string[] };
}

interface SharedNotesSectionProps {
  notes: string[];
}

const SharedNotesSection: React.FC<SharedNotesSectionProps> = ({ notes }) => (
  <section className="mb-12">
    <div className="flex items-center gap-2 mb-5">
      <MessageCircle className="w-4 h-4 text-tea-gold" aria-hidden="true" />
      <h2 className="h2">Guests said</h2>
    </div>
    <div className="space-y-5">
      {notes.map((note, idx) => (
        <blockquote
          key={idx}
          className="subtitle italic relative pl-7"
        >
          <span aria-hidden="true" className="absolute left-0 top-0 text-tea-gold/40 font-display text-ui-28 leading-none">
            &ldquo;
          </span>
          {note}
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
      <Music className="w-4 h-4 text-tea-gold" aria-hidden="true" />
      <h2 className="h2">Session playlist</h2>
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
        className="inline-flex items-center gap-3 px-4 py-3 bg-tea-surface border border-tea-border rounded-md text-ui-12 font-semibold text-tea-text-sec hover:border-tea-gold/40 hover:text-tea-text transition-colors group"
      >
        <Music className="w-3.5 h-3.5 text-tea-text-sec group-hover:text-tea-gold transition-colors" />
        <span>Listen to the session playlist</span>
        <ExternalLink className="w-3 h-3 text-tea-text-sec ml-auto" />
      </a>
    )}
  </section>
);

const EventRecapPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const legacy = useQuery<PublicEventRecap>({
    queryKey: ['event-recap-public', slug],
    queryFn: () => api.events.getPublicRecap(slug),
    enabled: !!slug,
    retry: false,
  });
  const recap = usePublicSitRecap(slug);

  useEffect(() => {
    if (!recap.data) return;
    document.title = `${recap.data.title}: Recap · Teajia`;
    return () => { document.title = 'Teajia · A Home for Tea'; };
  }, [recap.data]);

  if (recap.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tea-bg">
        <div className="h-3 w-32 animate-pulse rounded-xl bg-tea-surface" role="status" aria-label="Opening the recap" />
      </div>
    );
  }

  if (recap.isError || !recap.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tea-bg px-6">
        <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-20 text-center">
          <p className="label-caps mb-4 text-tea-readgold">Session Archive</p>
          <h1 className="h1 mb-3">Recap not available</h1>
          <p className="body-light mb-8">
            The host hasn't published a recap for this session yet, or this session is still upcoming.
          </p>
          <button onClick={() => navigate(`/event/${slug}`)}
            className="inline-flex items-center gap-2 text-ui-14 text-tea-text-sec transition-colors hover:text-tea-text">
            <ArrowLeft className="h-4 w-4" />
            Back to event
          </button>
        </div>
      </div>
    );
  }

  const extra = legacy.data?.post_session;
  const sharedNotes = Array.isArray(extra?.shared_tasting_notes) ? extra.shared_tasting_notes : [];
  return (
    <div className="min-h-screen bg-tea-bg pb-nav-gap-lg lg:pb-12">
      {/* Phone: reach past the page frame so each block runs edge to edge. */}
      <div className="-mx-4 max-w-2xl px-6 pt-6 pb-nav-gap sm:mx-auto">
        <SitRecap recap={recap.data} />
        {(sharedNotes.length > 0 || extra?.playlist_url) && <div className="mt-12">
          {sharedNotes.length > 0 && <SharedNotesSection notes={sharedNotes} />}
          {extra?.playlist_url && <PlaylistSection playlistUrl={extra.playlist_url} />}
        </div>}
      </div>
    </div>
  );
};

export default EventRecapPage;
