
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Icons } from '../Icons';
import { useAppStore } from '../../lib/store';
import { entryEvent } from '../../lib/tastingAccessors';
import { TastingSession, type TastingItem } from '../tasting/TastingSession';
import type { CustomerTasting } from '../../types';
import { ListShell } from './primitives';

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
    <div className="flex flex-wrap gap-1 mt-2">
      {descriptors.map((tag) => (
        <span
          key={tag}
          className="inline-block px-2 py-0.5 text-ui-11 tracking-caps bg-tea-elevated text-tea-text-sec rounded-sm"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

// Back button shared across the three states.
const BackButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Back' }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors mb-5"
    aria-label="Back"
  >
    <Icons.Back className="w-4 h-4" />
    <span className="text-ui-13">{label}</span>
  </button>
);

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
      <BackButton onClick={onClose} label="Tasting Journal" />

      {/* Tea identity — sensory card pattern §34 */}
      <div className="bg-tea-surface border border-tea-border rounded-xl p-5 mb-5 flex items-start gap-4">
        {entry.productImage ? (
          <img src={entry.productImage} alt="" className="w-14 h-14 rounded-md object-cover shrink-0" loading="lazy" />
        ) : (
          <div className="w-14 h-14 rounded-md bg-tea-elevated flex items-center justify-center shrink-0">
            <span className="font-serif text-tea-gold/60 text-ui-20">茶</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="h3 leading-tight">{entry.productName}</h3>
          {entry.productType && (
            <div className="text-ui-12 text-tea-text-dim mt-1">
              {entry.productType}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            {rating > 0 && <StarRating rating={rating} />}
            <span className="text-ui-12 text-tea-text-sec">
              Last touched {formatDate(entry.note.updatedAt || entry.createdAt)}
            </span>
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
        <div className="mt-1 flex items-center gap-3 text-ui-12 text-tea-text-sec h-4">
          {editing && (
            <>
              {/* Cancel-left, Save-right ordering inside the inline editor */}
              <button onClick={() => { setDraft(entry.note.personalNote ?? ''); setEditing(false); }} className="text-tea-text-sec hover:text-tea-text transition-colors">Cancel</button>
              <button onClick={commit} className="ml-auto text-tea-gold hover:text-tea-gold/80 transition-colors">Save</button>
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
      <div className="mt-8 pt-4 border-t border-tea-border flex items-center gap-5 text-ui-13">
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

  // Empty state — §19
  if (entries.length === 0) {
    return (
      <div className="animate-[fadeIn_0.3s_ease-out]">
        <BackButton onClick={onBack} />
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <Sparkles size={28} strokeWidth={1.25} className="text-tea-text-dim" />
          <h3 className="font-display text-ui-17 text-tea-text mt-4">No teas yet</h3>
          <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
            The teas you taste will show up here. Come back to write what you noticed.
          </p>
        </div>
      </div>
    );
  }

  // List view — canonical ListShell + sensory list rows
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="list"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        <BackButton onClick={onBack} />

        {/* Header */}
        <div className="flex items-end justify-between mb-5 gap-3">
          <div className="min-w-0">
            <h3 className="h3">Tasting Journal</h3>
            <p className="text-ui-12 text-tea-text-dim mt-0.5">
              {entries.length} {entries.length === 1 ? 'tea' : 'teas'} kept
            </p>
          </div>
          {unsyncedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-ui-11 tracking-caps bg-tea-gold/10 text-tea-gold border border-tea-gold/20 rounded shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-tea-gold animate-pulse shrink-0" />
              {unsyncedCount} unsynced
            </span>
          )}
        </div>

        {/* Entry list — §34 sensory list pattern: date caps + display name +
            body excerpt. Wrapped in ListShell for canonical bordered surface. */}
        <ListShell>
          {entries.map((entry) => {
            const displayName = entry.productName?.trim() || 'Untitled';
            const ev = entryEvent(entry);
            const rating = entry.note.rating ?? entry.note.tasting.rating ?? 0;
            const noteText = entry.note.personalNote;
            const tastingsCount = entry.tastings.length;
            const dateText = formatDate(entry.note.updatedAt || entry.createdAt);
            const subMeta = [
              entry.productType,
              tastingsCount > 1 ? `${tastingsCount} tastings` : null,
              ev.eventTitle ? `at ${ev.eventTitle}` : null,
            ].filter(Boolean).join(' · ');

            return (
              <li key={entry.id}>
                <button
                  onClick={() => setOpenId(entry.id)}
                  aria-label={`Open ${displayName}`}
                  className="group/entry w-full text-left px-4 md:px-6 py-4 hover:bg-tea-accent-sub transition-colors"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Date caps — §34 label-caps */}
                      <div className="label-caps text-tea-text-dim">{dateText}</div>
                      {/* Tea name — font-display text-ui-15 */}
                      <h4 className="font-display text-ui-15 text-tea-text mt-1 truncate group-hover/entry:text-tea-gold transition-colors">
                        {displayName}
                      </h4>
                      {subMeta && (
                        <div className="text-ui-12 text-tea-text-dim mt-0.5 truncate">{subMeta}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {rating > 0 && <StarRating rating={rating} />}
                      <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text-sec shrink-0" aria-hidden="true" />
                    </div>
                  </div>

                  {/* Descriptors */}
                  <DescriptorPills entry={entry} />

                  {/* Personal note excerpt — body-light italic */}
                  {noteText && (
                    <p className="font-body italic text-ui-13 text-tea-text-sec mt-2 leading-relaxed line-clamp-2">
                      "{noteText}"
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ListShell>
      </motion.div>
    </AnimatePresence>
  );
};
