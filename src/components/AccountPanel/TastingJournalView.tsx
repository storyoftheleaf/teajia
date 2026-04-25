
import React, { useMemo } from 'react';
import { Icons } from '../Icons';
import { useAppStore } from '../../lib/store';
import type { CustomerTasting } from '../../types';

interface TastingJournalViewProps {
  onBack: () => void;
  onOpenTea?: (teaId: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 12 12"
          className={`w-2.5 h-2.5 ${i < rating ? 'text-tea-gold' : 'text-tea-border'}`}
          fill="currentColor"
        >
          <path d="M6 1l1.4 2.8 3.1.4-2.2 2.2.5 3.1L6 8l-2.8 1.5.5-3.1L1.5 4.2l3.1-.4z" />
        </svg>
      ))}
    </span>
  );
}

function DescriptorPills({ entry }: { entry: CustomerTasting }) {
  const descriptors: string[] = [
    ...(entry.tasting.flavor ?? []),
    ...(entry.tasting.body ?? []),
    ...(entry.tasting.feeling ?? []),
    ...(entry.tasting.finish ?? []),
  ].slice(0, 6);

  if (descriptors.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {descriptors.map((tag) => (
        <span
          key={tag}
          className="inline-block px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] bg-tea-elevated/60 text-tea-text-dim rounded-sm"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export const TastingJournalView: React.FC<TastingJournalViewProps> = ({ onBack, onOpenTea }) => {
  const { tastingJournal } = useAppStore();

  const entries = useMemo(
    () =>
      [...tastingJournal]
        .filter((e) => !e.archived)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tastingJournal]
  );

  const unsyncedCount = useMemo(
    () => entries.filter((e) => e.synced === false).length,
    [entries]
  );

  if (entries.length === 0) {
    return (
      <div className="animate-[fadeIn_0.3s_ease-out]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-6"
        >
          <Icons.Back className="w-4 h-4" />
          <span className="text-xs uppercase tracking-[0.15em]">Back</span>
        </button>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
            <Icons.Sparkles className="w-7 h-7 text-tea-gold/40" />
          </div>
          <h3 className="font-serif text-lg text-tea-text mb-2">No Entries Yet</h3>
          <p className="text-sm text-tea-text-sec text-center max-w-[260px] leading-relaxed">
            Your tasting journal is empty. After a session or tasting, your notes will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-4"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-xs uppercase tracking-[0.15em]">Back</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-serif text-lg text-tea-text">Tasting Journal</h3>
          <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        {unsyncedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-[0.12em] bg-tea-gold/10 text-tea-gold border border-tea-gold/20 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-tea-gold animate-pulse shrink-0" />
            {unsyncedCount} unsynced
          </span>
        )}
      </div>

      {/* Entry list */}
      <div className="border border-tea-border overflow-hidden">
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className={`px-3 py-3 hover:bg-tea-elevated/30 transition-colors ${
              i < entries.length - 1 ? 'border-b border-tea-border' : ''
            }`}
          >
            {/* Row 1: tea name + date */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {onOpenTea && entry.teaId !== 'quick-note' ? (
                  <button
                    onClick={() => onOpenTea(entry.teaId)}
                    className="group/tealink inline-flex items-baseline gap-1 max-w-full font-serif text-sm text-tea-text hover:text-tea-gold focus-visible:text-tea-gold focus-visible:outline-none transition-colors text-left"
                  >
                    <span className="truncate">{entry.teaName}</span>
                    <span
                      aria-hidden="true"
                      className="text-[10px] text-tea-gold-lt shrink-0 transition-all duration-200 ease-out lg:opacity-0 lg:-translate-x-1 lg:group-hover/tealink:opacity-100 lg:group-hover/tealink:translate-x-0 lg:group-focus-visible/tealink:opacity-100 lg:group-focus-visible/tealink:translate-x-0"
                      style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
                    >
                      →
                    </span>
                  </button>
                ) : (
                  <h4 className="font-serif text-sm text-tea-text truncate">{entry.teaName}</h4>
                )}
                <div className="flex items-center gap-1.5 text-[10px] text-tea-text-dim mt-0.5">
                  {entry.teaType && <span>{entry.teaType}</span>}
                  {entry.eventTitle && (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="truncate italic">{entry.eventTitle}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-tea-text-dim whitespace-nowrap">
                  {formatDate(entry.createdAt)}
                </span>
                {entry.rating != null && entry.rating > 0 && (
                  <StarRating rating={entry.rating} />
                )}
              </div>
            </div>

            {/* Descriptors */}
            <DescriptorPills entry={entry} />

            {/* Personal note */}
            {entry.personalNote && (
              <p className="text-[11px] text-tea-text-sec mt-1.5 leading-relaxed line-clamp-2 italic">
                "{entry.personalNote}"
              </p>
            )}

            {/* Notes from tasting data */}
            {!entry.personalNote && entry.tasting.notes && entry.tasting.notes.length > 0 && (
              <p className="text-[11px] text-tea-text-sec mt-1.5 leading-relaxed line-clamp-2 italic">
                "{typeof entry.tasting.notes[0] === 'string' ? entry.tasting.notes[0] : entry.tasting.notes[0].text}"
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
