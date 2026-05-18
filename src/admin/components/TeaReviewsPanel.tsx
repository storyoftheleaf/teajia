import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Radio } from 'lucide-react';
import { api } from '../../lib/api';
import { resolveTermLabel, resolveTermIcon, flattenTastingNotes } from '../../data/tastingTaxonomy';
import type { TastingData } from '../../types';
import { TastingSession } from '../../components/tasting/TastingSession';

interface TeaReview {
  id: string;
  tea_key: string;
  source_sample_id?: string;
  author_name?: string;
  author_account_name?: string;
  author_account_slug?: string;
  visibility: string;
  status: 'draft' | 'submitted';
  session_date?: string;
  rating?: number;
  notes?: string;
  voice_notes?: string[];
  tasting?: TastingData;
  verdict?: string;
  would_buy?: boolean;
  created_at: string;
  updated_at: string;
}

interface TeaReviewsPanelProps {
  teaKey: string;
  productId?: string;
  productName?: string;
  productType?: string;
}

const VERDICT_COLORS: Record<string, string> = {
  love: 'text-tea-readgold',
  like: 'text-tea-leaf',
  neutral: 'text-tea-text-sec',
  pass: 'text-tea-text-dim',
};

const VISIBILITY_LABELS: Record<string, string> = {
  network: 'Network',
  account: 'My store only',
  private: 'Only me',
};

function buildSynthesisPrompt(reviews: TeaReview[], productName: string, productType: string): string {
  const submitted = reviews.filter(r => r.status === 'submitted');
  if (submitted.length === 0) return '';

  const lines: string[] = [
    `Tea: ${productName} (${productType})`,
    '',
    'Tasting panel notes:',
    '',
  ];

  for (const r of submitted) {
    const taster = [r.author_name, r.author_account_name].filter(Boolean).join(' · ');
    const date = r.session_date || r.created_at.slice(0, 10);
    lines.push(`${taster} — tasted ${date}:`);

    if (r.tasting) {
      const terms = flattenTastingNotes(r.tasting);
      if (terms.length > 0) {
        lines.push(`  Flavor: ${terms.map(id => resolveTermLabel(id)).join(', ')}`);
      }
      if (r.tasting.body?.length) lines.push(`  Body: ${r.tasting.body.join(', ')}`);
      if (r.tasting.finish?.length) lines.push(`  Finish: ${r.tasting.finish.join(', ')}`);
      if (r.tasting.feeling?.length) lines.push(`  State: ${r.tasting.feeling.map(id => resolveTermLabel(id)).join(', ')}`);
    }

    if (r.voice_notes?.length) {
      for (const note of r.voice_notes) {
        lines.push(`  "${note}"`);
      }
    }
    if (r.notes) lines.push(`  Notes: ${r.notes}`);
    if (r.rating) lines.push(`  Rating: ${r.rating}/10`);
    if (r.verdict) lines.push(`  Verdict: ${r.verdict}`);
    lines.push('');
  }

  lines.push('Write 2–3 paragraphs of lore, terroir, and tasting description for this tea. Draw directly from the panel notes above. Poetic but grounded. Return JSON with keys: lore, terroir, processingNotes, mood, experience, tastingNotes.');
  return lines.join('\n');
}

export const TeaReviewsPanel: React.FC<TeaReviewsPanelProps> = ({
  teaKey,
  productId,
  productName = '',
  productType = '',
}) => {
  const qc = useQueryClient();
  const [tastingOpen, setTastingOpen] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesis, setSynthesis] = useState<Record<string, unknown> | null>(null);

  const { data: reviews = [], isLoading } = useQuery<TeaReview[]>({
    queryKey: ['tea-reviews', teaKey],
    queryFn: () => api.teaReviews.list({ tea_key: teaKey }),
    enabled: !!teaKey,
    refetchInterval: 10_000,
  });

  const submittedCount = useMemo(() => reviews.filter(r => r.status === 'submitted').length, [reviews]);
  const draftReviews = useMemo(() => reviews.filter(r => r.status === 'draft'), [reviews]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.teaReviews.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tea-reviews', teaKey] }),
  });

  const handleSynthesize = async () => {
    const prompt = buildSynthesisPrompt(reviews, productName, productType);
    if (!prompt) return;
    setSynthesizing(true);
    setSynthesis(null);
    try {
      const data = await api.generateWisdom(prompt);
      setSynthesis(data);
    } catch {
      // error handled below
    } finally {
      setSynthesizing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* TastingSession — opens full-screen when adding a review */}
      {tastingOpen && (
        <TastingSession
          item={{
            id: productId || teaKey,
            name: productName,
            type: productType,
            teaKey,
          }}
          adminMode
          onClose={() => setTastingOpen(false)}
          onSave={() => {
            qc.invalidateQueries({ queryKey: ['tea-reviews', teaKey] });
            setTastingOpen(false);
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-tea-text-dim">
            {isLoading
              ? 'Loading…'
              : `${submittedCount} review${submittedCount !== 1 ? 's' : ''}${draftReviews.length ? ` · ${draftReviews.length} in progress` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {submittedCount >= 2 && (
            <button
              type="button"
              onClick={handleSynthesize}
              disabled={synthesizing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-tea-gold/10 text-tea-gold hover:bg-tea-gold/20 transition-colors disabled:opacity-50"
            >
              <Sparkles size={12} />
              {synthesizing ? 'Generating…' : 'Synthesize'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setTastingOpen(true)}
            className="text-xs px-3 py-1 rounded-xl bg-tea-surface text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated transition-colors"
          >
            + Add review
          </button>
        </div>
      </div>

      {/* Synthesis result */}
      <AnimatePresence>
        {synthesis && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-tea-gold/20 bg-tea-gold/5 p-4 space-y-2"
          >
            <div className="flex items-center gap-1.5 text-ui-10 uppercase tracking-[0.12em] text-tea-gold font-medium mb-2">
              <Sparkles size={10} />
              Synthesized from {submittedCount} reviews
            </div>
            {(synthesis.lore as string) && (
              <p className="text-xs text-tea-text leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
                {synthesis.lore as string}
              </p>
            )}
            {(synthesis.mood as string) && (
              <p className="text-ui-11 text-tea-gold/70 italic">{synthesis.mood as string}</p>
            )}
            <button
              type="button"
              onClick={() => setSynthesis(null)}
              className="text-ui-11 text-tea-text-dim hover:text-tea-text transition-colors"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review list */}
      {!isLoading && reviews.length === 0 && (
        <p className="text-xs text-tea-text-dim py-2">
          No reviews yet. Taste it and add the first one.
        </p>
      )}

      <div className="space-y-3">
        {reviews.map(r => (
          <ReviewCard
            key={r.id}
            review={r}
            onDelete={() => deleteMutation.mutate(r.id)}
          />
        ))}
      </div>
    </div>
  );
};

/* ─── Individual review card ─── */

const ReviewCard: React.FC<{ review: TeaReview; onDelete: () => void }> = ({ review: r, onDelete }) => {
  const termIds = r.tasting ? flattenTastingNotes(r.tasting) : [];
  const isDraft = r.status === 'draft';

  return (
    <motion.div
      layout
      className={`rounded-xl border p-3 space-y-2 transition-colors ${
        isDraft ? 'border-tea-gold/20 bg-tea-gold/3' : 'border-tea-border bg-tea-surface'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
            {r.author_name || 'Unknown'}
          </span>
          {r.author_account_name && (
            <span className="text-ui-10 text-tea-text-dim">· {r.author_account_name}</span>
          )}
          {r.rating != null && (
            <span className="text-ui-11 text-tea-gold font-mono">{r.rating}/10</span>
          )}
          {r.verdict && (
            <span className={`text-ui-10 capitalize ${VERDICT_COLORS[r.verdict] || 'text-tea-text-dim'}`}>
              {r.verdict}
            </span>
          )}
          {isDraft && (
            <span className="flex items-center gap-1 text-ui-9 uppercase tracking-[0.12em] text-tea-gold/60 font-medium">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Radio size={9} />
              </motion.span>
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="pill text-tea-text-dim text-ui-10">{VISIBILITY_LABELS[r.visibility] || r.visibility}</span>
          <button
            type="button"
            onClick={onDelete}
            className="text-ui-10 text-tea-text-dim hover:text-tea-error transition-colors"
            title="Delete review"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Structured tasting tags */}
      {termIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {termIds.map(termId => {
            const Icon = resolveTermIcon(termId);
            return (
              <span
                key={termId}
                className="inline-flex items-center gap-1 text-ui-11 px-1.5 py-0.5 rounded-full bg-tea-gold/10 text-tea-gold"
              >
                <Icon size={10} />
                {resolveTermLabel(termId)}
              </span>
            );
          })}
        </div>
      )}

      {/* Voice notes */}
      {r.voice_notes && r.voice_notes.length > 0 && (
        <div className="space-y-1">
          {r.voice_notes.map((note, i) => (
            <p key={i} className="text-ui-12 text-tea-text-sec italic leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
              &ldquo;{note}&rdquo;
            </p>
          ))}
        </div>
      )}

      {/* Written notes */}
      {r.notes && (
        <p className="text-xs text-tea-text-sec leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
          {r.notes}
        </p>
      )}

      <p className="text-ui-10 text-tea-text-dim">
        {r.session_date || r.updated_at.slice(0, 10)}
      </p>
    </motion.div>
  );
};
