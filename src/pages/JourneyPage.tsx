/**
 * JourneyPage, guest's personal tea history
 * Route: /journey (accessed via verify flow or direct link with verified session)
 *
 * Sections:
 *   1. Seal Collection, circular stamps per event attended
 *   2. Tea Map, horizontal fill bars by type
 *   3. Your Words, tasting impressions in serif italic
 *   4. Milestones, quiet Chinese character marks
 *   5. Preferences, contact preference, notification opt-in, delete data
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import type { JourneyData, JourneySeal, JourneyImpression } from '../types/events';

const VerifySheet = lazy(() => import('../components/events/VerifySheet'));

// ----------------------------------------------------------------
// Milestone metadata
// ----------------------------------------------------------------
const MILESTONE_META: Record<string, { label: string; hint: string }> = {
  '初': { label: '初', hint: 'First gathering' },
  '七': { label: '七', hint: 'All seven tea types' },
  '筆': { label: '筆', hint: 'Notes for every tea in a session' },
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function formatSealDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

const SealGrid: React.FC<{ seals: JourneySeal[]; onSealClick: (seal: JourneySeal) => void }> = ({
  seals,
  onSealClick,
}) => {
  // Add empty circles to fill out visual rhythm (min 8 slots)
  const fillerCount = Math.max(0, 8 - seals.length);

  return (
    <div className="grid grid-cols-4 gap-4">
      {seals.map((seal, i) => (
        <motion.button
          key={seal.eventId}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: i * 0.06, ease: 'easeOut' }}
          onClick={() => onSealClick(seal)}
          className="flex flex-col items-center gap-1.5 group"
          aria-label={`${seal.title}, ${formatSealDate(seal.date)}`}
        >
          <div className="w-14 h-14 rounded-full border border-tea-border bg-tea-surface flex items-center justify-center group-hover:border-tea-gold/70 transition-colors duration-300 overflow-hidden">
            {seal.flyerUrl ? (
              <img
                src={seal.flyerUrl}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
            ) : (
              <span className="text-lg font-serif text-tea-gold/40 group-hover:text-tea-gold/70 transition-colors">
                茶
              </span>
            )}
          </div>
          <p className="text-ui-9 text-tea-text-dim text-center leading-tight max-w-[3.5rem] line-clamp-2">
            {seal.title}
          </p>
          <p className="text-ui-9 text-tea-text-dim/60">{formatSealDate(seal.date)}</p>
        </motion.button>
      ))}

      {/* Empty filler circles */}
      {Array.from({ length: fillerCount }).map((_, i) => (
        <div
          key={`filler-${i}`}
          className="flex flex-col items-center gap-1.5"
          aria-hidden="true"
        >
          <div className="w-14 h-14 rounded-full border border-tea-border bg-tea-surface/40" />
        </div>
      ))}
    </div>
  );
};

const TeaMap: React.FC<{ teaTypeMap: Record<string, number> }> = ({ teaTypeMap }) => {
  const entries = Object.entries(teaTypeMap).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;
  const max = entries[0][1];

  return (
    <div className="space-y-3">
      {entries.map(([type, count], i) => (
        <motion.div
          key={type}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="flex items-center gap-3"
        >
          <span className="text-xs text-tea-text-sec w-20 shrink-0">{type}</span>
          <div className="flex-1 h-1.5 bg-tea-surface rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(count / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.05 + 0.2, ease: 'easeOut' }}
              className="h-full bg-tea-gold rounded-full"
            />
          </div>
          <span className="text-xs text-tea-text-dim w-5 text-right num">{count}</span>
        </motion.div>
      ))}
    </div>
  );
};

const ImpressionFeed: React.FC<{ impressions: JourneyImpression[] }> = ({ impressions }) => {
  if (impressions.length === 0) {
    return (
      <p className="text-sm text-tea-text-dim italic">Your tasting notes will appear here after sessions.</p>
    );
  }
  return (
    <div className="space-y-6">
      {impressions.map((imp, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.04 }}
          className="border-l border-tea-border pl-5"
        >
          <p className="font-serif italic text-base text-tea-text leading-relaxed mb-2">
            "{imp.text}"
          </p>
          <p className="text-xs text-tea-text-sec">
            {imp.teaName}
            <span className="mx-1.5 text-tea-text-dim">·</span>
            {imp.eventTitle}
            <span className="mx-1.5 text-tea-text-dim">·</span>
            {new Date(imp.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        </motion.div>
      ))}
    </div>
  );
};

const MilestoneMarks: React.FC<{ milestones: string[] }> = ({ milestones }) => {
  if (milestones.length === 0) return null;
  return (
    <div className="flex gap-6 flex-wrap">
      {milestones.map((mark) => {
        const meta = MILESTONE_META[mark];
        return (
          <motion.div
            key={mark}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="group flex flex-col items-center gap-1.5"
            title={meta?.hint}
          >
            <div className="w-10 h-10 rounded-full border border-tea-border flex items-center justify-center">
              <span className="font-serif text-lg text-tea-gold/70 group-hover:text-tea-gold transition-colors">
                {mark}
              </span>
            </div>
            {meta?.hint && (
              <p className="text-ui-9 text-tea-text-dim text-center max-w-[3rem] leading-tight">
                {meta.hint}
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

// ----------------------------------------------------------------
// Section header
// ----------------------------------------------------------------
const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-6">
    <h2 className="h3 mb-1">{title}</h2>
    {subtitle && <p className="label-caps text-tea-text-dim">{subtitle}</p>}
  </div>
);

// ----------------------------------------------------------------
// Editorial brand story, shown on /journey before verification
// ----------------------------------------------------------------
const JourneyEditorial: React.FC<{ onVerify: () => void }> = ({ onVerify }) => (
  <div className="max-w-3xl mx-auto px-4 md:px-6 pt-12 pb-nav-gap">

    {/* Eyebrow */}
    <p className="label-caps text-tea-text-dim mb-4">
      The Journey
    </p>

    {/* Page title */}
    <h1 className="h1 mb-6">
      How a practice becomes a collection
    </h1>
    <p className="subtitle mb-12">
      Twenty years on the tea road, in one quiet record.
    </p>

    {/* Section 1: Origins */}
    <section className="mb-14">
      <h2 className="h3 mb-4">
        It began with a single session in Taipei
      </h2>
      <p className="body-prose mb-4">
        Twenty years ago, a pot of Dong Ding oolong changed the direction of everything. Not because it was extraordinary in the way luxury goods announce themselves, but because it was quiet, specific, and alive in ways that nothing from a bag or a café had prepared us for. The person pouring it knew the farmer by name. They knew the elevation of the garden, the year the trees were planted, the particular soil that gave the tea its lingering sweetness. That knowledge was inseparable from the cup.
      </p>
      <p className="body-prose mb-4">
        What followed was not a business plan. It was years of learning, studying under traditional masters in Taiwan, making sourcing trips through Fujian and Yunnan, sitting at tables where the conversation went on for hours because the tea demanded it. A practice that deepened the longer it ran, accumulating knowledge the way old trees accumulate rings.
      </p>
      <p className="body-prose">
        TeajiA grew out of that practice. Not to scale it, but to share it, carefully, and only with people who want to drink tea the way it deserves to be drunk.
      </p>
    </section>

    {/* Divider */}
    <div className="border-t border-tea-border mb-14" />

    {/* Section 2: Sourcing */}
    <section className="mb-14">
      <h2 className="h3 mb-4">
        Sourcing means going to origin, every time
      </h2>
      <p className="body-prose mb-4">
        Every tea in this collection was chosen in person. Not from a catalogue, not through a broker, not by reading tasting notes written by someone else. We travel to the gardens, Alishan, Wuyi, Anxi, Menghai, Fuding, and taste widely before choosing carefully. A tea earns its place here by being interesting enough to talk about for a year.
      </p>
      <p className="body-prose mb-4">
        The relationships behind the teas matter as much as the teas themselves. We work with families who have farmed the same land for generations, with artisan producers who still process by hand, and with small workshops where the person making the teapot is also the person who designed it. These aren't romantic abstractions, they're the reason the tea tastes the way it does.
      </p>
      <p className="body-prose">
        Nothing here is anonymous. Every tea has a name, a place, a person, and a story. That is what curation means to us: not a larger selection, but a more specific one.
      </p>
    </section>

    {/* Divider */}
    <div className="border-t border-tea-border mb-14" />

    {/* Section 3: WhatsApp */}
    <section className="mb-14">
      <h2 className="h3 mb-4">
        Every order is a conversation, not a transaction
      </h2>
      <p className="body-prose mb-4">
        We checkout over WhatsApp because tea is not a product you should buy without talking to someone. When you place an order, you are in contact with the person who chose the tea. If you want to know whether a particular oolong suits your palate, or whether the 2019 or the 2022 sheng is more approachable for someone new to aged puerh, we will tell you, and mean it, before a single gram ships.
      </p>
      <p className="body-prose mb-4">
        This is not a workaround. It is the point. A checkout button optimised for conversion is the wrong tool for selling something that requires knowledge to drink well. The conversation is part of the product.
      </p>
      <p className="body-prose">
        We are reachable. That is deliberate and will not change.
      </p>
    </section>

    {/* Divider */}
    <div className="border-t border-tea-border mb-14" />

    {/* Section 4: Curation */}
    <section className="mb-14">
      <h2 className="h3 mb-4">
        What curation is, and what it isn't
      </h2>
      <p className="body-prose mb-4">
        A catalogue lists everything. A curated collection holds only what has earned its place. The teas here number in the dozens, not the hundreds, because each one requires sustained attention, to source, to understand, to describe honestly, and to match with the person who will drink it. We would rather carry thirty teas we know deeply than three hundred we have tasted once.
      </p>
      <p className="body-prose mb-4">
        Curation is not aesthetics, though we care about those too. It is an opinion backed by experience. It means saying no to teas that are technically correct but dull, and yes to teas that are difficult to explain but impossible to stop thinking about. The collection reflects a point of view, and that point of view has been twenty years in the making.
      </p>
      <p className="body-prose">
        If you have been to a session, you have already encountered this approach firsthand. What follows is your record of it.
      </p>
    </section>

    {/* Divider */}
    <div className="border-t border-tea-border mb-14" />

    {/* Section 5: The personal journey CTA */}
    <section className="mb-8">
      <h2 className="h3 mb-4">
        Your record at the table
      </h2>
      <p className="body-prose mb-4">
        If you have attended a TeajiA gathering, your sessions, tasting notes, and tea map are here, a quiet record of every tea you have shared with us. Verify your contact to see your personal journey.
      </p>
      <p className="body-prose mb-8">
        The record grows with each session. Over time, it becomes something worth keeping.
      </p>
      <button
        onClick={onVerify}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
      >
        View your journey
      </button>
    </section>

    {/* Footer mark */}
    <div className="pt-12 text-center">
      <p className="label-caps text-tea-text-dim">TeajiA</p>
    </div>
  </div>
);

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------
const JourneyPage: React.FC = () => {
  const navigate = useNavigate();
  const [verifiedContact, setVerifiedContact] = useState<string | null>(() => {
    return sessionStorage.getItem('journey_contact');
  });
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    return sessionStorage.getItem('journey_token');
  });
  const [showVerify, setShowVerify] = useState(!verifiedContact || !sessionToken);
  const [expandedSeal, setExpandedSeal] = useState<JourneySeal | null>(null);

  const { data: journey, isLoading } = useQuery<JourneyData>({
    queryKey: ['journey', verifiedContact, sessionToken],
    queryFn: () => api.journey.get(verifiedContact!, sessionToken!),
    enabled: !!verifiedContact && !!sessionToken,
    staleTime: 60_000,
  });

  const handleVerified = (contact: string, token: string) => {
    if (!token) {
      setShowVerify(true);
      return;
    }
    sessionStorage.setItem('journey_contact', contact);
    sessionStorage.setItem('journey_token', token);
    setVerifiedContact(contact);
    setSessionToken(token);
    setShowVerify(false);
  };

  // If no verification and sheet is dismissed, go home
  const handleVerifyClose = () => {
    if (!verifiedContact) navigate('/');
    else setShowVerify(false);
  };

  if (showVerify || !verifiedContact) {
    return (
      <div className="min-h-screen bg-tea-bg">
        {/* Brand story, visible before verification */}
        <JourneyEditorial onVerify={() => setShowVerify(true)} />
        <Suspense fallback={null}>
          <VerifySheet
            onClose={handleVerifyClose}
            onVerified={handleVerified}
            purpose="journey"
          />
        </Suspense>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 mx-auto mb-4" />
          <div className="h-3 w-40 bg-tea-text-sec/10 rounded-xl mx-auto" />
        </div>
      </div>
    );
  }

  if (!journey) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <p className="h3 mb-2">No journey found</p>
          <p className="text-ui-12 text-tea-text-dim leading-relaxed">
            Your journey begins at your first session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.4s_ease-out]">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-12 pb-nav-gap">

        {/* Header */}
        <div className="mb-12">
          <p className="label-caps text-tea-text-dim mb-3">
            Your Journey
          </p>
          <h1 className="h2 mb-2">
            {journey.sessionsAttended} gathering{journey.sessionsAttended !== 1 ? 's' : ''}
          </h1>
          <p className="body-light">
            {journey.totalTeas} teas experienced
            {journey.memberSince && (
              <span>
                <span className="mx-1.5 text-tea-text-dim">·</span>
                since{' '}
                {new Date(journey.memberSince).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            )}
          </p>
        </div>

        {/* 1. Seal Collection */}
        {journey.seals.length > 0 && (
          <section className="mb-16">
            <SectionHeader
              title="Sessions"
              subtitle="Each gathering, a mark."
            />
            <SealGrid seals={journey.seals} onSealClick={setExpandedSeal} />
          </section>
        )}

        {/* 2. Tea Map */}
        {Object.keys(journey.teaTypeMap).length > 0 && (
          <section className="mb-16">
            <SectionHeader
              title="Tea Map"
              subtitle="Types you've experienced."
            />
            <TeaMap teaTypeMap={journey.teaTypeMap} />
          </section>
        )}

        {/* 3. Your Words */}
        <section className="mb-16">
          <SectionHeader
            title="Your Words"
            subtitle="Impressions from the table."
          />
          <ImpressionFeed impressions={journey.impressions} />
        </section>

        {/* 4. Milestones */}
        {journey.milestones.length > 0 && (
          <section className="mb-16">
            <SectionHeader title="Marks" />
            <MilestoneMarks milestones={journey.milestones} />
          </section>
        )}

        {/* 5. Preferences */}
        <section className="mb-8 border-t border-tea-border pt-10">
          <SectionHeader title="Preferences" />
          <PreferencesPanel
            contact={verifiedContact}
            token={sessionToken ?? ''}
          />
        </section>

        {/* Footer */}
        <div className="text-center pb-16">
          <p className="label-caps text-tea-text-dim">
            Teajia
          </p>
        </div>
      </div>

      {/* Seal expand overlay */}
      <AnimatePresence>
        {expandedSeal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setExpandedSeal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-tea-surface border border-tea-border rounded-xl p-6 max-w-xs w-full text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {expandedSeal.flyerUrl && (
                <img
                  src={expandedSeal.flyerUrl}
                  alt=""
                  className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border border-tea-border"
                />
              )}
              <p className="h3 mb-1">{expandedSeal.title}</p>
              <p className="text-ui-13 text-tea-text-sec">
                {new Date(expandedSeal.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ----------------------------------------------------------------
// Preferences panel (contact, notifications, delete)
// ----------------------------------------------------------------
const PreferencesPanel: React.FC<{ contact: string; token: string }> = ({ contact }) => {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const navigate = useNavigate();

  const handleDelete = () => {
    // In a real implementation: call api.journey.deleteData(token)
    sessionStorage.removeItem('journey_contact');
    sessionStorage.removeItem('journey_token');
    setDeleted(true);
    setTimeout(() => navigate('/'), 2000);
  };

  if (deleted) {
    return (
      <p className="body-light">Your data has been removed. Redirecting…</p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="p-4 bg-tea-surface border border-tea-border rounded-xl">
        <p className="label-caps text-tea-text-dim mb-1">Verified as</p>
        <p className="text-ui-14 text-tea-text">{contact}</p>
      </div>

      {!deleteConfirm ? (
        <button
          onClick={() => setDeleteConfirm(true)}
          className="text-ui-12 text-tea-text-sec hover:text-tea-error transition-colors"
        >
          Delete my data
        </button>
      ) : (
        <div className="p-4 bg-tea-surface border border-tea-error/30 rounded-xl space-y-3">
          <p className="text-ui-14 text-tea-text-sec">
            This will permanently remove your journey data. This cannot be undone.
          </p>
          <div className="flex justify-between gap-3">
            <button
              onClick={() => setDeleteConfirm(false)}
              className="px-3 py-2 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error text-tea-bg text-xs font-semibold hover:bg-tea-error/90 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JourneyPage;
