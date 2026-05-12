
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../Icons';
import { useAppStore } from '../../lib/store';
import { entryEvent } from '../../lib/tastingAccessors';
import { TastingSession, type TastingItem } from '../tasting/TastingSession';
import type { CustomerTasting } from '../../types';

interface TastingJournalViewProps {
  onBack: () => void;
  /** Navigates to the product page (separate from opening the entry detail). */
  onOpenTea?: (productId: string) => void;
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
          className={`w-3 h-3 ${i < rating ? 'text-tea-gold' : 'text-tea-text-sec'}`}
          fill="currentColor"
        >
          <path d="M6 1l1.4 2.8 3.1.4-2.2 2.2.5 3.1L6 8l-2.8 1.5.5-3.1L1.5 4.2l3.1-.4z" />
        </svg>
      ))}
    </span>
  );
}

function DescriptorPills({ entry, max = 6 }: { entry: CustomerTasting; max?: number }) {
  const t = entry.note.tasting;
  const descriptors: string[] = [
    ...(t.flavor ?? []),
    ...(t.body ?? []),
    ...(t.feeling ?? []),
    ...(t.finish ?? []),
  ].slice(0, max);

  if (descriptors.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {descriptors.map((tag) => (
        <span
          key={tag}
          className="inline-block px-2 py-0.5 text-ui-11 uppercase tracking-[0.08em] bg-tea-elevated text-tea-text-sec rounded-sm"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

/**
 * Entry detail. The primary surface in the destination per the brief:
 * tea identity, editable note, past-tastings list, and actions.
 */
const EntryDetail: React.FC<{
  entry: CustomerTasting;
  onClose: () => void;
  onOpenTea?: (productId: string) => void;
}> = ({ entry, onClose, onOpenTea }) => {
  const updateTasting = useAppStore((s) => s.updateTasting);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.note.personalNote ?? '');
  const [savedFlash, setSavedFlash] = useState(false);
  const [tastingItem, setTastingItem] = useState<TastingItem | null>(null);
  const blurSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const ev = entryEvent(entry);
  const rating = entry.note.rating ?? entry.note.tasting.rating ?? 0;

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    const current = entry.note.personalNote ?? '';
    if (trimmed === current.trim()) {
      setEditing(false);
      return;
    }
    updateTasting(entry.id, {
      note: {
        ...entry.note,
        personalNote: trimmed || undefined,
        updatedAt: new Date().toISOString(),
      },
    });
    setEditing(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }, [draft, entry, updateTasting]);

  const handleArchive = () => {
    updateTasting(entry.id, { archived: true });
    onClose();
  };

  useEffect(() => {
    if (editing) setTimeout(() => textareaRef.current?.focus(), 0);
    return () => {
      if (blurSaveRef.current) clearTimeout(blurSaveRef.current);
    };
  }, [editing]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="animate-[fadeIn_0.24s_ease-out]"
    >
      {/* Back to list */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-4"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-ui-12 uppercase tracking-[0.15em]">Tasting Journal</span>
      </button>

      {/* Tea identity */}
      <div className="mb-5">
        <div className="flex items-start gap-3">
          {entry.productImage ? (
            <img src={entry.productImage} alt="" className="w-14 h-14 rounded-md object-cover shrink-0" loading="lazy" />
          ) : (
            <div className="w-14 h-14 rounded-md bg-tea-surface flex items-center justify-center shrink-0">
              <span className="font-serif text-tea-gold/60 text-lg">茶</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="h3 leading-tight">{entry.productName}</h3>
            {entry.productType && (
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec mt-1">
                {entry.productType}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              {rating > 0 && <StarRating rating={rating} />}
              <span className="text-ui-11 text-tea-text-sec">
                Last touched {formatDate(entry.note.updatedAt || entry.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Note (editable inline) */}
      <div className="mb-5">
        {editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (blurSaveRef.current) clearTimeout(blurSaveRef.current);
              blurSaveRef.current = setTimeout(commit, 200);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDraft(entry.note.personalNote ?? ''); setEditing(false); }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
            }}
            placeholder="Write your note here."
            rows={6}
            className="w-full bg-tea-surface text-tea-text font-body italic text-ui-14 leading-relaxed rounded-md p-3 outline-none border border-tea-border focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 transition-colors resize-y"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setDraft(entry.note.personalNote ?? ''); setEditing(true); }}
            className="w-full text-left rounded-md p-3 -mx-3 hover:bg-tea-accent-sub transition-colors"
          >
            {entry.note.personalNote ? (
              <p className="font-body italic text-ui-14 leading-relaxed text-tea-text">
                {entry.note.personalNote}
              </p>
            ) : (
              <p className="font-body italic text-ui-13 leading-relaxed text-tea-text-sec">
                Write your note here.
              </p>
            )}
          </button>
        )}
        <div className="mt-1 flex items-center gap-3 text-ui-11 text-tea-text-sec h-4">
          {editing && (
            <>
              <button onClick={() => { setDraft(entry.note.personalNote ?? ''); setEditing(false); }} className="text-tea-text-sec hover:text-tea-text transition-colors">Cancel</button>
              <button onClick={commit} className="text-tea-gold hover:text-tea-gold/80 transition-colors">Save</button>
            </>
          )}
          {!editing && savedFlash && <span className="text-tea-text-sec">Saved</span>}
        </div>
      </div>

      {/* Descriptors */}
      <DescriptorPills entry={entry} max={12} />

      {/* Past tastings list */}
      {entry.tastings.length > 1 && (
        <div className="mt-6">
          <div className="label-caps text-tea-text-dim mb-3">
            Past tastings
          </div>
          <div className="space-y-3 pl-3 border-l border-tea-border">
            {[...entry.tastings].reverse().map(t => (
              <div key={t.id} className="text-ui-12 leading-snug">
                <div className="flex items-baseline gap-2 text-tea-text-sec">
                  <span className="text-ui-11 text-tea-text-sec">{formatDate(t.createdAt)}</span>
                  {t.eventTitle && <span className="text-ui-11 italic text-tea-text-sec">at {t.eventTitle}</span>}
                </div>
                {t.reason && (
                  <div className="font-body italic text-tea-text mt-0.5">
                    "{t.reason}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions footer */}
      <div className="mt-8 pt-4 border-t border-tea-border flex items-center gap-5 text-ui-12">
        <button
          onClick={() => setTastingItem({
            id: entry.productId,
            name: entry.productName,
            type: entry.productType,
            image: entry.productImage,
          })}
          className="text-tea-text-sec hover:text-tea-text transition-colors"
        >
          Open tasting
        </button>
        {onOpenTea && entry.productId && (
          <button
            onClick={() => onOpenTea(entry.productId)}
            className="text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Find this tea
          </button>
        )}
        <button
          onClick={handleArchive}
          className="text-tea-text-sec hover:text-tea-text transition-colors ml-auto"
        >
          Archive
        </button>
      </div>

      {/* Tasting Session: re-open tasting from inside the entry detail */}
      <AnimatePresence>
        {tastingItem && (
          <TastingSession
            item={tastingItem}
            onClose={() => setTastingItem(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const TastingJournalView: React.FC<TastingJournalViewProps> = ({ onBack, onOpenTea }) => {
  const { tastingJournal } = useAppStore();
  const [openId, setOpenId] = useState<string | null>(null);

  const entries = useMemo(
    () =>
      [...tastingJournal]
        .filter((e) => !e.archived)
        .sort((a, b) => new Date(b.note.updatedAt || b.createdAt).getTime() - new Date(a.note.updatedAt || a.createdAt).getTime()),
    [tastingJournal]
  );

  const unsyncedCount = useMemo(
    () => entries.filter((e) => e.synced === false).length,
    [entries]
  );

  const openEntry = openId ? entries.find(e => e.id === openId) ?? null : null;

  // Detail view
  if (openEntry) {
    return <EntryDetail entry={openEntry} onClose={() => setOpenId(null)} onOpenTea={onOpenTea} />;
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="animate-[fadeIn_0.3s_ease-out]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-6"
        >
          <Icons.Back className="w-4 h-4" />
          <span className="text-ui-12 uppercase tracking-[0.15em]">Back</span>
        </button>

        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <Icons.Sparkles className="w-7 h-7 text-tea-text-dim" strokeWidth={1.25} />
          <h3 className="font-display text-ui-17 text-tea-text mt-4">No teas yet</h3>
          <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
            The teas you taste will show up here. Come back to write what you noticed.
          </p>
        </div>
      </div>
    );
  }

  // List view
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="list"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-4"
        >
          <Icons.Back className="w-4 h-4" />
          <span className="text-ui-12 uppercase tracking-[0.15em]">Back</span>
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="h3">Tasting Journal</h3>
            <span className="label-caps text-tea-text-dim">
              {entries.length} {entries.length === 1 ? 'tea' : 'teas'}
            </span>
          </div>
          {unsyncedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-ui-11 uppercase tracking-[0.1em] bg-tea-gold/10 text-tea-gold border border-tea-gold/20 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-tea-gold animate-pulse shrink-0" />
              {unsyncedCount} unsynced
            </span>
          )}
        </div>

        {/* Entry list */}
        <div className="border border-tea-border overflow-hidden">
          {entries.map((entry, i) => {
            const displayName = entry.productName?.trim() || 'Untitled';
            const ev = entryEvent(entry);
            const rating = entry.note.rating ?? entry.note.tasting.rating ?? 0;
            const noteText = entry.note.personalNote;
            const tastingsCount = entry.tastings.length;

            return (
              <button
                key={entry.id}
                onClick={() => setOpenId(entry.id)}
                aria-label={`Open ${displayName}`}
                className={`group/entry relative w-full text-left px-3 py-3 hover:bg-tea-elevated cursor-pointer transition-colors ${
                  i < entries.length - 1 ? 'border-b border-tea-border' : ''
                }`}
              >
                {/* Row 1: tea name + date */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-display text-ui-15 truncate text-tea-text group-hover/entry:text-tea-gold transition-colors">
                      {displayName}
                    </h4>
                    <div className="flex items-center gap-1.5 text-ui-12 text-tea-text-sec mt-1">
                      {entry.productType && <span>{entry.productType}</span>}
                      {tastingsCount > 1 && (
                        <>
                          <span className="text-tea-text-sec">·</span>
                          <span>{tastingsCount} tastings</span>
                        </>
                      )}
                      {ev.eventTitle && (
                        <>
                          <span className="text-tea-text-sec">·</span>
                          <span className="truncate italic">{ev.eventTitle}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-ui-12 text-tea-text-sec whitespace-nowrap">
                        {formatDate(entry.note.updatedAt || entry.createdAt)}
                      </span>
                      {rating > 0 && (
                        <StarRating rating={rating} />
                      )}
                    </div>
                    <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text-sec shrink-0" aria-hidden="true" />
                  </div>
                </div>

                {/* Descriptors */}
                <DescriptorPills entry={entry} />

                {/* Personal note preview */}
                {noteText && (
                  <p className="text-ui-13 text-tea-text-sec mt-2 leading-relaxed line-clamp-2 italic">
                    "{noteText}"
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
