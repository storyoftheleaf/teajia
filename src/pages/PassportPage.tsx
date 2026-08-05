/**
 * PassportPage, guest-facing tea journey via RSVP token
 * Route: /passport/:token
 *
 * Fetches the guest's RSVP record and post-session data, then renders
 * a chronological travel-journal view of every event attended, the teas
 * tasted, verdicts left, and a derived flavor profile.
 */

import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import type { EventAttendee, TastingNote, TeaMenuItem } from '../types/events';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

interface PostSessionData {
  teaLedger?: unknown;
  hostNotes?: string;
  sessionNotes?: string;
}

interface RSVPData {
  attendee: EventAttendee;
  event: {
    id: string;
    slug: string;
    title: string;
    eventDate: string;
    locationName?: string;
    flyerImageUrl?: string;
  };
  postSession?: PostSessionData;
  tastingNotes?: TastingNote[];
  teaMenu?: TeaMenuItem[];
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/** Extract unique flavor/impression words from tasting notes */
function buildFlavorProfile(notes: TastingNote[]): string[] {
  const wordFreq: Record<string, number> = {};
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'it', 'is', 'was', 'very', 'quite', 'this', 'that', 'i',
    'me', 'my', 'tea', 'really', 'bit', 'slightly', 'good', 'great', 'nice',
  ]);

  for (const note of notes) {
    if (!note.impression) continue;
    const words = note.impression
      .toLowerCase()
      .replace(/[^a-z\s'-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
    for (const w of words) {
      wordFreq[w] = (wordFreq[w] ?? 0) + 1;
    }
  }

  return Object.entries(wordFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([w]) => w);
}

// ────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────

const LoadingState: React.FC = () => (
  <div className="min-h-screen bg-tea-bg flex items-center justify-center">
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-tea-gold/10 mx-auto mb-4 animate-pulse" />
      <p className="label-caps animate-pulse">Opening your passport</p>
    </div>
  </div>
);

const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap">
    <div className="text-center mb-8">
      <p className="label-caps text-tea-text-dim mb-4">Tea Passport</p>
      <h1 className="h2">Passport not found</h1>
      <p className="subtitle mt-2">{message}</p>
    </div>
    <div className="text-center">
      <Link to="/" className="link-text hover:opacity-80 transition-opacity">
        Return home
      </Link>
    </div>
  </div>
);

const TeaChapter: React.FC<{
  menuItems: TeaMenuItem[];
  tastingNotes: TastingNote[];
  index: number;
}> = ({ menuItems, tastingNotes, index }) => {
  if (menuItems.length === 0 && tastingNotes.length === 0) return null;

  const guestNotes = tastingNotes.filter(n => n.impression);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="space-y-4"
    >
      {menuItems.length > 0 && (
        <div className="space-y-3">
          {menuItems.map((item, i) => (
            <div
              key={item.id}
              className="flex items-start gap-4 py-3 border-b border-tea-border last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-tea-surface border border-tea-border flex items-center justify-center shrink-0 mt-0.5">
                {item.productImageUrl ? (
                  <img
                    src={item.productImageUrl}
                    alt=""
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="text-xs text-tea-text-dim font-serif">{i + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-serif text-tea-text">
                  {item.customName || item.productName || 'Tea'}
                </p>
                {item.customDescription && (
                  <p className="text-xs text-tea-text-sec mt-0.5 leading-relaxed">
                    {item.customDescription}
                  </p>
                )}
                {item.productType && (
                  <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim mt-1">
                    {item.productType}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {guestNotes.length > 0 && (
        <div className="mt-5 space-y-4">
          <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim">Your notes</p>
          {guestNotes.map((note, i) => (
            <div key={i} className="border-l-2 border-tea-gold/30 pl-4">
              {note.teaName && (
                <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec mb-1">
                  {note.teaName}
                </p>
              )}
              <p className="font-serif italic text-sm text-tea-text leading-relaxed">
                "{note.impression}"
              </p>
              {note.rating !== undefined && note.rating !== null && (
                <div className="flex gap-1 mt-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <span
                      key={j}
                      className={`text-ui-10 ${j < note.rating! ? 'text-tea-gold' : 'text-tea-border'}`}
                    >
                      ●
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

const FlavorProfile: React.FC<{ words: string[] }> = ({ words }) => {
  if (words.length === 0) return null;
  return (
    <section className="mb-16">
      <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec mb-2">
        Your flavor profile
      </p>
      <p className="font-serif text-sm text-tea-text-sec mb-6 leading-relaxed">
        Words that appear most often across your tasting notes.
      </p>
      <div className="flex flex-wrap gap-2">
        {words.map((word, i) => (
          <motion.span
            key={word}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className={`px-3 py-1.5 text-xs font-serif italic rounded-md ${
              i === 0
                ? 'bg-tea-gold/15 text-tea-gold'
                : i < 3
                ? 'bg-tea-surface text-tea-text'
                : 'bg-tea-bg text-tea-text-sec'
            }`}
          >
            {word}
          </motion.span>
        ))}
      </div>
    </section>
  );
};

// ────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────

const PassportPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery<RSVPData>({
    queryKey: ['passport', token],
    queryFn: () => api.rsvp.get(token!),
    enabled: !!token,
    retry: 1,
    staleTime: 60_000,
  });

  const { data: postSession } = useQuery({
    queryKey: ['passport-postsession', token],
    queryFn: () => api.rsvp.getPostSession(token!),
    enabled: !!token && !!data,
    staleTime: 60_000,
  });

  // Derive flavor profile from all tasting notes
  const flavorWords = useMemo(() => {
    const notes = data?.tastingNotes ?? [];
    return buildFlavorProfile(notes);
  }, [data?.tastingNotes]);

  if (isLoading) return <LoadingState />;

  if (isError || !data) {
    return (
      <ErrorState message="This passport link may have expired or doesn't exist. Check with your host for a fresh link." />
    );
  }

  const { attendee, event, tastingNotes = [], teaMenu = [] } = data;
  const attended = attendee.attended || attendee.status === 'confirmed';

  return (
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.4s_ease-out]">
      <div className="max-w-xl mx-auto px-6 py-12 md:py-20">

        {/* Passport header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="label-caps text-tea-text-dim mb-5">Tea Passport</p>
          <h1 className="h1 mb-4">{attendee.fullName}</h1>
          <div className="w-8 h-[1px] bg-tea-gold mb-6" />
          <p className="subtitle">
            A record of gatherings attended, teas tasted, and impressions noted.
          </p>
        </motion.div>

        {/* Flavor profile, shown before the event chapters if data exists */}
        <FlavorProfile words={flavorWords} />

        {/* Event chapter */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mb-16"
        >
          {/* Chapter heading */}
          <div className="flex items-start gap-4 mb-8">
            <div className="flex flex-col items-center mt-1">
              <div
                className={`w-3 h-3 rounded-full border ${
                  attended
                    ? 'bg-tea-gold border-tea-gold'
                    : 'bg-tea-surface border-tea-border'
                }`}
              />
              <div className="w-[1px] h-8 bg-tea-border mt-1" />
            </div>
            <div className="flex-1 min-w-0">
              {event.flyerImageUrl && (
                <div className="w-16 h-16 rounded-full overflow-hidden border border-tea-border mb-4">
                  <img
                    src={event.flyerImageUrl}
                    alt=""
                    className="w-full h-full object-cover opacity-90"
                  />
                </div>
              )}
              <p className="text-ui-10 uppercase tracking-[0.25em] text-tea-text-sec mb-1">
                {formatLongDate(event.eventDate)}
              </p>
              <h2 className="font-serif text-2xl text-tea-text mb-1">
                {event.title}
              </h2>
              {event.locationName && (
                <p className="text-sm text-tea-text-sec">
                  {event.locationName}
                </p>
              )}
              {!attended && (
                <p className="text-xs text-tea-text-dim mt-2 italic">
                  {attendee.status === 'cancelled'
                    ? 'Cancelled'
                    : 'Not yet attended'}
                </p>
              )}
            </div>
          </div>

          {/* Teas tasted at this event */}
          {(teaMenu.length > 0 || tastingNotes.length > 0) ? (
            <div className="ml-7 pl-4 border-l border-tea-border">
              <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-5">
                Teas at this gathering
              </p>
              <TeaChapter
                menuItems={teaMenu}
                tastingNotes={tastingNotes}
                index={0}
              />
            </div>
          ) : (
            <div className="ml-7 pl-4 border-l border-tea-border">
              <p className="text-sm text-tea-text-sec italic">
                {attended
                  ? 'No tea menu recorded for this gathering.'
                  : 'Tea menu will appear after the session.'}
              </p>
            </div>
          )}
        </motion.section>

        {/* Host notes from post-session (if shared) */}
        {postSession?.sessionNotes && (
          <section className="mb-16 border-t border-tea-border pt-10">
            <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec mb-4">
              Host notes
            </p>
            <p className="font-serif italic text-tea-text-sec leading-relaxed text-sm">
              "{postSession.sessionNotes}"
            </p>
          </section>
        )}

        {/* Footer mark */}
        <div className="border-t border-tea-border pt-10 text-center">
          <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec/30">
            Teajia
          </p>
          <p className="text-ui-10 text-tea-text-dim/40 mt-2">
            {formatShortDate(new Date().toISOString())}
          </p>
        </div>

      </div>
    </div>
  );
};

export default PassportPage;
