import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';

interface TeaReview {
  id: string;
  tea_key: string;
  author_name?: string;
  author_account_name?: string;
  author_account_slug?: string;
  visibility: string;
  session_date?: string;
  rating?: number;
  notes?: string;
  created_at: string;
}

interface TeaReviewsPanelProps {
  teaKey: string;
  productId?: string;
}

const VISIBILITY_LABELS: Record<string, string> = {
  network: 'Network',
  account: 'My store only',
  private: 'Only me',
};

const inputStyle = "w-full bg-transparent border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-accent placeholder-tea-text-sec/50 transition-colors";
const labelStyle = "block text-xs uppercase tracking-wider text-tea-gold/70 mb-1 font-bold";

export const TeaReviewsPanel: React.FC<TeaReviewsPanelProps> = ({ teaKey, productId }) => {
  const qc = useQueryClient();
  const { activeAccountId } = useAppStore();
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({
    notes: '',
    rating: '',
    session_date: '',
    visibility: 'network' as 'network' | 'account' | 'private',
  });

  const { data: reviews = [], isLoading } = useQuery<TeaReview[]>({
    queryKey: ['tea-reviews', teaKey, activeAccountId],
    queryFn: () => api.teaReviews.list({ tea_key: teaKey }),
    enabled: !!teaKey,
  });

  const createMutation = useMutation({
    mutationFn: () => api.teaReviews.create({
      tea_key: teaKey,
      product_id: productId,
      notes: form.notes || undefined,
      rating: form.rating ? Number(form.rating) : undefined,
      session_date: form.session_date || undefined,
      visibility: form.visibility,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tea-reviews', teaKey] });
      setForm({ notes: '', rating: '', session_date: '', visibility: 'network' });
      setComposing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.teaReviews.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tea-reviews', teaKey] }),
  });

  const ratingStars = (r?: number) => r
    ? '★'.repeat(r) + '☆'.repeat(5 - r)
    : null;

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-tea-text-dim">
          {isLoading ? 'Loading…' : `${reviews.length} review${reviews.length !== 1 ? 's' : ''} across the network`}
        </p>
        {!composing && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="text-xs px-3 py-1 rounded-lg bg-tea-gold/10 text-tea-gold hover:bg-tea-gold/20 transition-colors"
          >
            + Post review
          </button>
        )}
      </div>

      {/* Compose form */}
      {composing && (
        <div className="rounded-lg border border-tea-border bg-tea-surface p-4 space-y-3">
          <div>
            <label className={labelStyle}>Tasting notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3}
              className={`${inputStyle} resize-y min-h-[60px]`}
              placeholder="How did this tea pour today?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelStyle}>Rating (1–5)</label>
              <input
                type="number" min={1} max={5}
                value={form.rating}
                onChange={e => setForm(p => ({ ...p, rating: e.target.value }))}
                className={inputStyle}
                placeholder="—"
              />
            </div>
            <div>
              <label className={labelStyle}>Session date</label>
              <input
                type="date"
                value={form.session_date}
                onChange={e => setForm(p => ({ ...p, session_date: e.target.value }))}
                className={inputStyle}
              />
            </div>
          </div>
          <div>
            <label className={labelStyle}>Visibility</label>
            <select
              value={form.visibility}
              onChange={e => setForm(p => ({ ...p, visibility: e.target.value as any }))}
              className={inputStyle}
            >
              {Object.entries(VISIBILITY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setComposing(false)}
              className="text-xs px-3 py-1.5 text-tea-text-sec hover:text-tea-text transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!form.notes || createMutation.isPending}
              className="text-xs px-4 py-1.5 rounded-lg bg-tea-gold text-tea-bg hover:bg-tea-gold/90 disabled:opacity-40 transition-colors"
            >
              {createMutation.isPending ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {/* Review list */}
      {!isLoading && reviews.length === 0 && !composing && (
        <p className="text-xs text-tea-text-dim py-2">
          No reviews yet. Be the first to post one.
        </p>
      )}
      <div className="space-y-2">
        {reviews.map(r => (
          <div key={r.id} className="rounded-lg border border-tea-border bg-tea-surface p-3 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-tea-text">{r.author_name || 'Unknown'}</span>
                {r.author_account_name && (
                  <span className="text-xs text-tea-text-dim ml-1.5">· {r.author_account_name}</span>
                )}
                {r.rating && (
                  <span className="text-xs text-tea-gold ml-2">{ratingStars(r.rating)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="pill text-tea-text-dim text-[10px]">{VISIBILITY_LABELS[r.visibility]}</span>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(r.id)}
                  className="text-[10px] text-tea-text-dim hover:text-red-400 transition-colors"
                  title="Delete review"
                >
                  ✕
                </button>
              </div>
            </div>
            {r.notes && (
              <p className="text-xs text-tea-text-sec leading-relaxed">{r.notes}</p>
            )}
            <p className="text-[10px] text-tea-text-dim">
              {r.session_date || r.created_at.slice(0, 10)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
