import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BottomSheet } from './CurateSheet';
import { api } from '../../lib/api';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
import { SAID_LABEL, applySaidParts, type SaidPart } from './saidFiling';

interface Filing { parts: SaidPart[]; keep: boolean[]; applied: boolean }

const storeKey = (entryId: string, recKey: string) => `curate-said:${entryId}:${recKey}`;
const readFiling = (key: string): Filing | null => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as Filing : null; } catch { return null; }
};
const writeFiling = (key: string, f: Filing) => { try { localStorage.setItem(key, JSON.stringify(f)); } catch { /* the page still works without it */ } };

/**
 * What was said about a tea, as drawn: each recording kept whole, then filed
 * line by line, Tea, Price, Taste, Story, Vendor, To do, each with ✓ or ✕.
 * Only the ticked parts are applied, and none overwrites what was typed.
 */
export const SaidSheet: React.FC<{ entryId: string | null; onClose: () => void }> = ({ entryId, onClose }) => {
  const entry = useTeaCompassStore((s) => entryId ? s.pendingEntries.find((e) => e.id === entryId) ?? s.entries.find((e) => e.id === entryId) : undefined);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const notes = useNotesStore((s) => s.notes);
  const [filings, setFilings] = useState<Record<string, Filing | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordings = useMemo(() => {
    if (!entry) return [];
    const fromNotes = notes
      .filter((n) => n.compassEntryId === entry.id && !n.deleted && n.sourceType === 'voice' && n.text?.trim())
      .map((n) => ({ key: n.id, text: n.text.trim(), at: n.createdAt }));
    const fromClips = (entry.audioClips ?? [])
      .filter((c) => c.transcript?.trim())
      .map((c, i) => ({ key: `clip-${i}-${c.timestamp}`, text: c.transcript!.trim(), at: c.timestamp }));
    return [...fromNotes, ...fromClips].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  }, [notes, entry]);

  if (!entry || !entryId) return null;

  const filingFor = (key: string) => filings[key] ?? readFiling(storeKey(entryId, key));
  const save = (key: string, f: Filing) => { writeFiling(storeKey(entryId, key), f); setFilings((prev) => ({ ...prev, [key]: f })); };

  const file = async (key: string, text: string) => {
    setBusy(key); setError(null);
    try {
      const res = await api.compass.fileSaid({ text, tea_name: entry.name || undefined });
      save(key, { parts: res.parts, keep: res.parts.map(() => true), applied: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Filing did not answer. Try again.');
    } finally { setBusy(null); }
  };

  const apply = async (key: string) => {
    const f = filingFor(key);
    if (!f) return;
    const chosen = f.parts.filter((_, i) => f.keep[i]);
    const { updates, todos } = applySaidParts(entry, chosen);
    if (Object.keys(updates).length) updateEntry(entry.id, updates);
    for (const text of todos) await api.compass.addTodo({ text, tea_id: entry.id }).catch(() => {});
    save(key, { ...f, applied: true });
  };

  return (
    <BottomSheet open={!!entryId} onOpenChange={(o) => { if (!o) onClose(); }} title="What you said" description={entry.name || undefined} large>
      <div className="curate-v2 pb-nav-gap" data-testid="said-sheet">
        {recordings.length === 0 && <p className="px-4 py-4 font-body text-ui-14 text-tea-text-sec">Nothing said about this tea yet. Hold the microphone on its row to talk.</p>}
        {recordings.map((r) => {
          const f = filingFor(r.key);
          return (
            <section key={r.key} className="border-b border-tea-border pb-3">
              <div className="flex items-baseline justify-between px-4 pt-3">
                <span className="curate-v2-label">{r.at ? new Date(r.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Recording'}</span>
                {f?.applied && <span className="text-ui-12 text-tea-gold">Filed</span>}
              </div>
              <p className="mx-4 mt-2 border-l border-tea-gold pl-3 font-body text-ui-15 italic leading-relaxed text-tea-text-sec">“{r.text}”</p>
              {!f && (
                <div className="px-4 pt-3">
                  <button type="button" onClick={() => void file(r.key, r.text)} disabled={busy === r.key} className="curate-v2-frame is-on is-tall is-wide gap-2 uppercase tracking-[0.14em]">
                    {busy === r.key ? <><Loader2 size={14} className="animate-spin" /> Filing</> : 'File it, part by part'}
                  </button>
                </div>
              )}
              {f && (
                <div className="mt-2 border-t border-tea-border">
                  {f.parts.length === 0 && <p className="px-4 py-3 text-ui-13 text-tea-text-sec">Nothing in it to file.</p>}
                  {f.parts.map((p, i) => (
                    <div key={i} className="flex min-h-11 items-center gap-3 border-b border-tea-border px-4">
                      <span className="curate-v2-label w-16 shrink-0 !text-tea-gold">{SAID_LABEL[p.kind]}</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-ui-14 text-tea-text">{p.text}</span>
                      {!f.applied ? (
                        <span className="flex shrink-0 items-center gap-1">
                          <button type="button" aria-label={`Keep: ${p.text}`} aria-pressed={f.keep[i]} onClick={() => save(r.key, { ...f, keep: f.keep.map((k, j) => (j === i ? true : k)) })} className={`curate-v2-frame is-slim h-9 min-w-[44px] ${f.keep[i] ? 'is-on' : ''}`}>keep</button>
                          <button type="button" aria-label={`Leave out: ${p.text}`} aria-pressed={!f.keep[i]} onClick={() => save(r.key, { ...f, keep: f.keep.map((k, j) => (j === i ? false : k)) })} className={`curate-v2-frame is-slim h-9 min-w-[44px] ${!f.keep[i] ? 'is-on' : ''}`}>skip</button>
                        </span>
                      ) : (
                        <span className={`shrink-0 text-ui-12 ${f.keep[i] ? 'text-tea-gold' : 'text-tea-text-sec'}`}>{f.keep[i] ? (p.kind === 'story' || p.kind === 'vendor' ? 'source kept' : 'filed') : 'left out'}</span>
                      )}
                    </div>
                  ))}
                  {f.parts.some((p) => p.kind === 'story' || p.kind === 'vendor') && <p className="px-4 pt-2 text-ui-12 text-tea-text-sec">Story and vendor claims stay in this recording. Review them in the tea or vendor details before filing them as facts.</p>}
                  {!f.applied && f.parts.length > 0 && (
                    <div className="px-4 pt-3">
                      <button type="button" onClick={() => void apply(r.key)} className="curate-v2-frame is-on is-tall is-wide uppercase tracking-[0.14em]">
                        File {f.keep.filter(Boolean).length} {f.keep.filter(Boolean).length === 1 ? 'part' : 'parts'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
        {error && <p className="px-4 pt-2 text-ui-12 text-tea-error">{error}</p>}
      </div>
    </BottomSheet>
  );
};
