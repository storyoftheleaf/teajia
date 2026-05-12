import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Leaf, ExternalLink, Send } from 'lucide-react';
import { api } from '../lib/api';
import { hasToken } from '../lib/api';
import { useAppStore as useStore } from '../lib/store';
import type { JourneySeal, JourneyImpression } from '../types/events';

// ── Types ────────────────────────────────────────────────────────────────────

interface SampleEntry {
  id: string;
  sampleId: string;
  name: string;
  chineseName?: string | null;
  type?: string | null;
  region?: string | null;
  verdict: 'love' | 'like' | 'neutral' | 'pass';
  wouldBuy: boolean;
  note?: string | null;
  tastingDate: string;
}

interface CompassEntry {
  id: string;
  name: string;
  chineseName?: string | null;
  type?: string | null;
  region?: string | null;
  form?: string | null;
  year?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
}

interface MyJourneyData {
  hasLinkedCustomer: boolean;
  customerName?: string;
  sessionsAttended: number;
  totalTeas: number;
  memberSince?: string;
  teaTypeMap: Record<string, number>;
  regionMap: Record<string, number>;
  favorites: string[];
  impressions: JourneyImpression[];
  milestones: string[];
  seals: JourneySeal[];
  samples: SampleEntry[];
  compass: CompassEntry[];
  portrait: string;
}

// ── At the Table components ──────────────────────────────────────────────────

const SealGrid: React.FC<{ seals: JourneySeal[]; onSealClick: (s: JourneySeal) => void }> = ({ seals, onSealClick }) => {
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
        >
          <div className="w-14 h-14 rounded-full border border-tea-border bg-tea-surface flex items-center justify-center group-hover:border-tea-gold/70 transition-colors overflow-hidden">
            {seal.flyerUrl ? (
              <img src={seal.flyerUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            ) : (
              <span className="text-lg font-serif text-tea-gold/40 group-hover:text-tea-gold/70 transition-colors">茶</span>
            )}
          </div>
          <p className="text-ui-9 text-tea-text-dim text-center leading-tight max-w-[3.5rem] line-clamp-2">{seal.title}</p>
          <p className="text-ui-9 text-tea-text-dim/60">
            {new Date(seal.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        </motion.button>
      ))}
      {Array.from({ length: fillerCount }).map((_, i) => (
        <div key={`filler-${i}`} className="flex flex-col items-center gap-1.5" aria-hidden>
          <div className="w-14 h-14 rounded-full border border-tea-border bg-tea-surface/40" />
        </div>
      ))}
    </div>
  );
};

const BarMap: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;
  const max = entries[0][1];
  return (
    <div className="space-y-3">
      {entries.map(([label, count], i) => (
        <motion.div key={label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }} className="flex items-center gap-3">
          <span className="text-ui-12 text-tea-text-sec w-24 shrink-0 truncate">{label}</span>
          <div className="flex-1 h-1.5 bg-tea-surface rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(count / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.05 + 0.2, ease: 'easeOut' }}
              className="h-full bg-tea-gold rounded-full"
            />
          </div>
          <span className="text-ui-12 text-tea-text-dim w-5 text-right font-mono tabular-nums">{count}</span>
        </motion.div>
      ))}
    </div>
  );
};

const FavoritesRow: React.FC<{ favorites: string[] }> = ({ favorites }) => {
  if (favorites.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {favorites.map((name, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="font-display text-ui-14 text-tea-text border border-tea-border rounded-full px-3 py-1 bg-tea-gold/10 ring-1 ring-inset ring-tea-gold/40"
        >
          {name}
        </motion.span>
      ))}
    </div>
  );
};

const ImpressionFeed: React.FC<{ impressions: JourneyImpression[] }> = ({ impressions }) => {
  if (impressions.length === 0) return <p className="body-light italic">Your tasting notes will appear here after sessions.</p>;
  return (
    <div className="space-y-6">
      {impressions.map((imp, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.04 }} className="border-l border-tea-border pl-5">
          <p className="subtitle mb-2">"{imp.text}"</p>
          <p className="text-ui-12 text-tea-text-sec">
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
  const meta: Record<string, { hint: string }> = {
    '初': { hint: 'First gathering' }, '三': { hint: 'Third session' }, '五': { hint: 'Fifth session' },
    '七': { hint: 'All seven tea types' }, '十': { hint: 'Ten sessions' }, '廿': { hint: 'Twenty sessions' }, '半百': { hint: 'Fifty sessions' },
  };
  if (milestones.length === 0) return null;
  return (
    <div className="flex gap-6 flex-wrap">
      {milestones.map(mark => (
        <motion.div key={mark} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="group flex flex-col items-center gap-1.5" title={meta[mark]?.hint}>
          <div className="w-10 h-10 rounded-full border border-tea-border flex items-center justify-center">
            <span className="font-serif text-lg text-tea-gold/70 group-hover:text-tea-gold transition-colors">{mark}</span>
          </div>
          {meta[mark]?.hint && <p className="text-ui-9 text-tea-text-dim text-center max-w-[3rem] leading-tight">{meta[mark].hint}</p>}
        </motion.div>
      ))}
    </div>
  );
};

// ── At Home — Sample thread ───────────────────────────────────────────────────

const VERDICT_STYLES: Record<string, string> = {
  love: 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40',
  like: 'bg-tea-elevated text-tea-text-sec',
  neutral: 'bg-tea-elevated text-tea-text-dim',
  pass: 'bg-tea-elevated text-tea-text-dim',
};

const SampleCard: React.FC<{ sample: SampleEntry; index: number }> = ({ sample, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: index * 0.06 }}
    className="py-5 border-b border-tea-border last:border-0"
  >
    <div className="flex items-start justify-between mb-3">
      <div>
        <p className="font-display text-ui-15 text-tea-text">{sample.name}</p>
        {sample.chineseName && <p className="text-ui-12 text-tea-text-dim mt-0.5">{sample.chineseName}</p>}
        <p className="text-ui-12 text-tea-text-sec mt-1">
          {[sample.type, sample.region].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5 ml-4 shrink-0">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-ui-9 uppercase tracking-caps ${VERDICT_STYLES[sample.verdict] || VERDICT_STYLES.neutral}`}>
          {sample.verdict}
        </span>
        {sample.wouldBuy && (
          <span className="text-ui-9 text-tea-text-dim uppercase tracking-caps">Would Buy</span>
        )}
      </div>
    </div>
    {sample.note && (
      <p className="subtitle text-tea-text-sec border-l border-tea-border pl-4">
        "{sample.note}"
      </p>
    )}
  </motion.div>
);

const SampleThread: React.FC<{ samples: SampleEntry[] }> = ({ samples }) => {
  if (samples.length === 0) return (
    <p className="body-light italic">Samples you taste at home will appear here.</p>
  );
  const loved = samples.filter(s => s.verdict === 'love').length;
  return (
    <div>
      {loved > 0 && (
        <p className="text-ui-12 text-tea-text-sec mb-5">
          {loved} of {samples.length} earned a love
        </p>
      )}
      <div>
        {samples.map((s, i) => <SampleCard key={s.id} sample={s} index={i} />)}
      </div>
    </div>
  );
};

// ── Your Collection — Compass thread ─────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  logged: 'in collection',
  available_to_taste: 'ready to taste',
  want: 'on wishlist',
  tasted: 'tasted',
  archived: 'archived',
};

const CompassThread: React.FC<{ entries: CompassEntry[] }> = ({ entries }) => {
  if (entries.length === 0) return (
    <p className="body-light italic">Teas you add to your compass will appear here.</p>
  );
  return (
    <div className="space-y-0">
      {entries.map((entry, i) => (
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="py-4 border-b border-tea-border last:border-0"
        >
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <span className="font-display text-ui-15 text-tea-text">{entry.name}</span>
              {entry.chineseName && (
                <span className="text-ui-12 text-tea-text-dim ml-2">{entry.chineseName}</span>
              )}
            </div>
            <span className="text-ui-10 text-tea-text-dim shrink-0 uppercase tracking-caps">
              {STATUS_LABEL[entry.status] || entry.status}
            </span>
          </div>
          <p className="text-ui-12 text-tea-text-sec mt-0.5">
            {[entry.type, entry.year, entry.region].filter(Boolean).join(' · ')}
          </p>
          {entry.notes && (
            <p className="text-ui-12 text-tea-text-dim mt-1.5 line-clamp-2 leading-relaxed italic">
              {entry.notes}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
};

// ── Shared ────────────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-6">
    <h2 className="h2 mb-1">{title}</h2>
    {subtitle && <p className="text-ui-13 text-tea-text-sec">{subtitle}</p>}
  </div>
);

const SealModal: React.FC<{ seal: JourneySeal; onClose: () => void }> = ({ seal, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-modal flex items-center justify-center bg-black/70 px-6"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-tea-surface border border-tea-border rounded-xl shadow-2xl p-6 max-w-xs w-full text-center"
      onClick={e => e.stopPropagation()}
    >
      <div className="w-20 h-20 rounded-full border border-tea-border mx-auto mb-4 overflow-hidden flex items-center justify-center">
        {seal.flyerUrl
          ? <img src={seal.flyerUrl} alt="" className="w-full h-full object-cover" />
          : <span className="font-display text-ui-28 text-tea-gold/50">茶</span>}
      </div>
      <p className="h3 mb-1">{seal.title}</p>
      <p className="text-ui-13 text-tea-text-sec">
        {new Date(seal.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
      {/* Cancel-left, confirm/link-right — matches Cancel/Back/Close rules */}
      <div className="mt-5 flex items-center justify-between gap-4">
        <button onClick={onClose} className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors">Close</button>
        {seal.slug ? (
          <Link
            to={`/event/${seal.slug}`}
            onClick={onClose}
            className="inline-flex items-center gap-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <ExternalLink size={11} />
            View event
          </Link>
        ) : <span />}
      </div>
    </motion.div>
  </motion.div>
);

// ── Sample request ────────────────────────────────────────────────────────────

const SampleRequestPrompt: React.FC<{ waNumber: string }> = ({ waNumber }) => {
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    const text = `Hi! I'd love to try a sample.\n\n${note.trim() ? `What I'm curious about: ${note.trim()}` : 'Could you suggest something based on my journey?'}`;
    const url = waNumber
      ? `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
      <p className="text-ui-12 text-tea-text-sec mb-3">What are you curious to try?</p>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="A tea type, region, or just a mood…"
        rows={2}
        className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim resize-none focus:outline-none focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 transition-colors"
      />
      {waNumber ? (
        <button
          onClick={handleSend}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
        >
          <Send size={13} />
          {sent ? 'Sent via WhatsApp' : 'Request via WhatsApp'}
        </button>
      ) : (
        <p className="mt-3 text-ui-12 text-tea-text-dim">WhatsApp not configured for this account.</p>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const AccountJourneyPage: React.FC = () => {
  const navigate = useNavigate();
  const [expandedSeal, setExpandedSeal] = useState<JourneySeal | null>(null);
  const activeAccount = useStore(s => s.activeAccount) as { whatsapp_number?: string } | null;

  const isLoggedIn = hasToken();

  const { data: journey, isLoading } = useQuery<MyJourneyData>({
    queryKey: ['me-journey'],
    queryFn: () => api.me.journey(),
    enabled: isLoggedIn,
    staleTime: 60_000,
  });

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="h2 mb-3">Your journey awaits</p>
          <p className="text-ui-13 text-tea-text-sec mb-6">Sign in to see your sessions, teas, and tasting notes.</p>
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors">
            <ArrowLeft size={14} /> Go home
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 mx-auto mb-4" />
          <div className="h-3 w-32 bg-tea-text-sec/10 rounded-sm mx-auto" />
        </div>
      </div>
    );
  }

  if (!journey?.hasLinkedCustomer) {
    const hasSomething = (journey?.samples?.length ?? 0) > 0 || (journey?.compass?.length ?? 0) > 0;
    return (
      <div className="min-h-screen bg-tea-bg">
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors mb-6" aria-label="Back">
            <ArrowLeft size={14} />
            <span className="text-ui-13">Back</span>
          </button>
          <p className="label-caps text-tea-text-dim mb-2">Your Journey</p>
          <h1 className="h1 mb-4">It begins at the table.</h1>
          <div className="w-10 h-[1px] bg-tea-gold mb-8" />
          <p className="body-prose mb-4">
            Your session record lives here once your first gathering is complete and your account is linked.
          </p>

          {hasSomething && (
            <>
              {(journey?.samples?.length ?? 0) > 0 && (
                <section className="mt-12 mb-12">
                  <SectionHeader title="What You've Explored" subtitle="Samples tasted at home." />
                  <SampleThread samples={journey!.samples} />
                </section>
              )}
              {(journey?.compass?.length ?? 0) > 0 && (
                <section className="mb-12">
                  <SectionHeader title="Your Collection" subtitle="Teas in your compass." />
                  <CompassThread entries={journey!.compass} />
                </section>
              )}
            </>
          )}

          {!hasSomething && (
            <div className="mt-10 flex gap-3">
              <button onClick={() => navigate('/events')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors">
                <Leaf size={13} />
                Browse sessions
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const firstName = journey.customerName?.split(' ')[0] || 'Your';
  const hasRegions = Object.keys(journey.regionMap ?? {}).length > 0;
  const hasFavorites = journey.favorites.length > 0;
  const hasSamples = journey.samples.length > 0;
  const hasCompass = journey.compass.length > 0;
  const hasPortrait = !!journey.portrait;

  // Build header stat line
  const statParts: string[] = [];
  if (journey.totalTeas > 0) statParts.push(`${journey.totalTeas} teas at the table`);
  if (hasSamples) statParts.push(`${journey.samples.length} sampled at home`);
  if (hasCompass) statParts.push(`${journey.compass.length} in collection`);

  return (
    <>
      <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.4s_ease-out]">
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap">

          {/* Back */}
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors mb-6" aria-label="Back">
            <ArrowLeft size={14} />
            <span className="text-ui-13">Back</span>
          </button>

          {/* Header */}
          <div className="mb-12">
            <p className="label-caps text-tea-text-dim mb-2">Your Journey</p>
            <h1 className="h1 mb-2">
              {journey.sessionsAttended} gathering{journey.sessionsAttended !== 1 ? 's' : ''}
            </h1>
            {statParts.length > 0 && (
              <p className="text-ui-13 text-tea-text-sec">
                {statParts.join(' · ')}
                {journey.memberSince && (
                  <span className="ml-1">
                    <span className="mx-1.5 text-tea-text-dim">·</span>
                    since {new Date(journey.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* ── AT THE TABLE ── */}

          {journey.milestones.length > 0 && (
            <section className="mb-16">
              <SectionHeader title="Marks" subtitle="Earned through practice." />
              <MilestoneMarks milestones={journey.milestones} />
            </section>
          )}

          {journey.seals.length > 0 && (
            <section className="mb-16">
              <SectionHeader title="Sessions" subtitle="Each gathering, a mark." />
              <SealGrid seals={journey.seals} onSealClick={setExpandedSeal} />
            </section>
          )}

          {Object.keys(journey.teaTypeMap).length > 0 && (
            <section className="mb-10">
              <SectionHeader title="Tea Map" subtitle="Types you've experienced." />
              <BarMap data={journey.teaTypeMap} />
            </section>
          )}

          {hasRegions && (
            <section className="mb-16">
              <SectionHeader title="Regions" subtitle="Origins across sessions, samples, and collection." />
              <BarMap data={journey.regionMap} />
            </section>
          )}

          {hasFavorites && (
            <section className="mb-16">
              <SectionHeader title="Marked" subtitle="Teas you singled out at the table." />
              <FavoritesRow favorites={journey.favorites} />
            </section>
          )}

          <section className="mb-16">
            <SectionHeader title="Your Words" subtitle="What the teas said back." />
            <ImpressionFeed impressions={journey.impressions} />
          </section>

          {/* ── AT HOME ── */}

          <section className="mb-16">
            <div className="mb-6">
              <p className="label-caps text-tea-text-dim mb-2">At Home</p>
              <h2 className="h2 mb-1">What you've explored</h2>
              <p className="text-ui-13 text-tea-text-sec">Samples tasted outside the session.</p>
            </div>
            {hasSamples
              ? <SampleThread samples={journey.samples} />
              : <p className="body-light italic mb-6">Samples you taste at home will appear here.</p>
            }
            <div className="mt-8">
              <SampleRequestPrompt waNumber={activeAccount?.whatsapp_number?.replace(/\D/g, '') ?? ''} />
            </div>
          </section>

          {/* ── COLLECTION ── */}

          {hasCompass && (
            <section className="mb-16">
              <div className="flex items-baseline justify-between mb-6 gap-3">
                <div className="min-w-0">
                  <p className="label-caps text-tea-text-dim mb-2">Your Collection</p>
                  <h2 className="h2 mb-1">The journal</h2>
                  <p className="text-ui-13 text-tea-text-sec">Teas you've chosen to keep.</p>
                </div>
                <Link
                  to="/account/journal"
                  className="inline-flex items-center gap-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors shrink-0"
                >
                  Open journal
                  <ExternalLink size={11} />
                </Link>
              </div>
              <CompassThread entries={journey.compass} />
            </section>
          )}

          {/* ── PORTRAIT ── */}

          {hasPortrait ? (
            <div className="border-t border-tea-border pt-10 pb-4">
              <p className="subtitle text-center max-w-sm mx-auto">
                {journey.portrait}
              </p>
            </div>
          ) : (
            <div className="border-t border-tea-border pt-8 text-center">
              <p className="text-ui-12 text-tea-text-dim">
                This is {firstName}'s record with TeaJiA. It grows with every session.
              </p>
            </div>
          )}

        </div>
      </div>

      {expandedSeal && (
        <SealModal seal={expandedSeal} onClose={() => setExpandedSeal(null)} />
      )}
    </>
  );
};

export default AccountJourneyPage;
