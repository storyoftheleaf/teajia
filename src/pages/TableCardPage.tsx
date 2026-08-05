import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, hasToken } from '../lib/api';

type Verdict = 'love' | 'like' | 'neutral' | 'pass';

interface TableCardEntry {
  name: string;
  chineseName?: string;
  type?: string;
  form?: string;
  year?: number | string;
  season?: string;
  originRegion?: string;
  photo?: string;
  teaKey?: string;
}

interface TableCardData {
  entry: TableCardEntry;
  verdictCounts: { love: number; like: number; neutral: number; pass: number };
  token: string;
}

function getBrowserToken(): string {
  const existing = localStorage.getItem('teajia_bt');
  if (existing) return existing;
  const generated = crypto.randomUUID();
  localStorage.setItem('teajia_bt', generated);
  return generated;
}

function getStoredVerdict(tableToken: string): Verdict | null {
  return (localStorage.getItem(`teajia_bt_${tableToken}`) as Verdict) || null;
}

function storeVerdict(tableToken: string, verdict: Verdict) {
  localStorage.setItem(`teajia_bt_${tableToken}`, verdict);
}

const VERDICT_OPTIONS: { value: Verdict; label: string; description: string }[] = [
  { value: 'love', label: 'Love', description: 'This one stays with me' },
  { value: 'like', label: 'Like', description: 'Enjoyed it' },
  { value: 'neutral', label: 'Neutral', description: 'Neither here nor there' },
  { value: 'pass', label: 'Pass', description: 'Not for me' },
];

const TableCardPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();

  const browserToken = getBrowserToken();
  const [selectedVerdict, setSelectedVerdict] = useState<Verdict | null>(
    token ? getStoredVerdict(token) : null
  );
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, isError } = useQuery<TableCardData>({
    queryKey: ['table-card', token],
    queryFn: () => api.tableCard.get(token!),
    enabled: !!token,
    retry: false,
    refetchInterval: 30_000,
  });

  const submitVerdict = useCallback(
    async (verdict: Verdict, noteText?: string) => {
      if (!token) return;
      setSubmitting(true);
      try {
        await api.tableCard.submitVerdict(token, {
          browser_token: browserToken,
          verdict,
          notes: noteText ?? undefined,
        });
        storeVerdict(token, verdict);
        setSelectedVerdict(verdict);
        queryClient.invalidateQueries({ queryKey: ['table-card', token] });
      } catch {
        // silent, verdict counts will refresh on next poll
      } finally {
        setSubmitting(false);
      }
    },
    [token, browserToken, queryClient]
  );

  const handleVerdictClick = (verdict: Verdict) => {
    if (submitting) return;
    submitVerdict(verdict, notes || undefined);
    setNotesSaved(false);
  };

  const handleSaveNote = () => {
    if (!selectedVerdict) return;
    submitVerdict(selectedVerdict, notes);
    setNotesSaved(true);
  };

  useEffect(() => {
    setNotesSaved(false);
  }, [notes]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 mx-auto mb-4" />
          <div className="h-3 w-32 bg-tea-text-sec/10 rounded-md mx-auto" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="font-serif text-2xl text-tea-text mb-3">Table not found</h1>
          <p className="text-sm text-tea-text-sec mb-6">
            This QR code may be expired or inactive.
          </p>
          <Link
            to="/"
            className="text-xs uppercase tracking-[0.2em] text-tea-gold hover:text-tea-text transition-colors"
          >
            Explore Teajia
          </Link>
        </div>
      </div>
    );
  }

  const { entry, verdictCounts } = data;
  const totalVotes = verdictCounts.love + verdictCounts.like + verdictCounts.neutral + verdictCounts.pass;

  const metaChunks = [
    entry.type,
    entry.form,
    entry.year ? String(entry.year) : undefined,
    entry.season,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-tea-bg pb-nav">
      <div className="max-w-md mx-auto">

        {/* Photo */}
        {entry.photo && (
          <div className="w-full aspect-[4/3] overflow-hidden">
            <img
              src={entry.photo}
              alt={entry.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="px-6 pt-8 pb-12 space-y-10">

          {/* Tea name */}
          <div>
            <h1 className="font-serif text-4xl text-tea-text leading-tight tracking-tight mb-2">
              {entry.name}
            </h1>
            {entry.chineseName && (
              <p className="text-lg text-tea-text-dim font-serif">
                {entry.chineseName}
              </p>
            )}

            {/* Metadata strip */}
            {(metaChunks.length > 0 || entry.originRegion) && (
              <div className="mt-4 space-y-1">
                {metaChunks.length > 0 && (
                  <p className="text-xs uppercase tracking-[0.15em] text-tea-text-sec">
                    {metaChunks.join(' · ')}
                  </p>
                )}
                {entry.originRegion && (
                  <p className="text-xs text-tea-text-dim tracking-wide">
                    {entry.originRegion}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Verdict section */}
          <div>
            <h2 className="text-ui-11 uppercase tracking-[0.2em] text-tea-text-sec mb-5">
              How does this tea feel to you?
            </h2>

            {/* 2x2 grid on wider screens, stacked on narrow */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VERDICT_OPTIONS.map(({ value, label, description }) => {
                const isSelected = selectedVerdict === value;
                const isOther = selectedVerdict !== null && !isSelected;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleVerdictClick(value)}
                    className={[
                      'relative py-5 px-6 rounded-md text-left transition-all duration-200 disabled:opacity-60',
                      isSelected
                        ? 'bg-tea-gold/10 border border-tea-gold'
                        : isOther
                        ? 'bg-tea-surface border border-tea-border opacity-50'
                        : 'bg-tea-surface border border-tea-border hover:border-tea-gold/40 hover:bg-tea-elevated',
                    ].join(' ')}
                  >
                    {isSelected && (
                      <span className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-tea-gold" />
                    )}
                    <span
                      className={[
                        'block font-serif text-xl leading-none mb-1',
                        isSelected ? 'text-tea-gold' : 'text-tea-text',
                      ].join(' ')}
                    >
                      {label}
                    </span>
                    <span className="block text-ui-11 text-tea-text-dim">
                      {description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes, shown only after voting */}
          {selectedVerdict && (
            <div className="space-y-3">
              <label className="block text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec">
                Leave a note
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you notice? Aroma, body, finish..."
                rows={3}
                className="w-full bg-tea-surface border border-tea-border rounded-md px-4 py-3 text-sm text-tea-text placeholder:text-tea-text-dim resize-none focus:outline-none focus:border-tea-gold/60 transition-colors"
              />
              <button
                type="button"
                disabled={submitting || !notes.trim()}
                onClick={handleSaveNote}
                className="text-xs uppercase tracking-[0.2em] text-tea-gold hover:text-tea-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {notesSaved ? 'Saved' : 'Save note'}
              </button>
            </div>
          )}

          {/* Live verdict counts */}
          {totalVotes > 0 && (
            <div>
              <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim mb-3">
                {totalVotes} {totalVotes === 1 ? 'response' : 'responses'}
              </p>
              <div className="space-y-2">
                {VERDICT_OPTIONS.map(({ value, label }) => {
                  const count = verdictCounts[value];
                  const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                  return (
                    <div key={value} className="flex items-center gap-3">
                      <span className="w-14 text-ui-11 text-tea-text-sec">{label}</span>
                      <div className="flex-1 h-1 bg-tea-surface rounded-full overflow-hidden">
                        <div
                          className="h-full bg-tea-gold/60 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-5 text-ui-11 text-tea-text-dim text-right num">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer CTA */}
          <div className="pt-4 border-t border-tea-border space-y-4">
            <Link
              to="/"
              className="block text-xs uppercase tracking-[0.2em] text-tea-text-sec hover:text-tea-gold transition-colors"
            >
              Explore Teajia
            </Link>
            {hasToken() ? (
              <Link
                to="/account/journal"
                className="block text-xs uppercase tracking-[0.2em] text-tea-text-dim hover:text-tea-gold transition-colors"
              >
                Add to your journal
              </Link>
            ) : (
              <Link
                to="/signin"
                className="block text-xs uppercase tracking-[0.2em] text-tea-text-dim hover:text-tea-gold transition-colors"
              >
                Add to your compass
              </Link>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default TableCardPage;
