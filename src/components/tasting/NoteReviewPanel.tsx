import React, { useState } from 'react';
import { Star } from 'lucide-react';
import type { NoteEntry } from '../../types';

interface NoteReviewPanelProps {
  notes: NoteEntry[];
  onChange: (next: NoteEntry[]) => void;
}

const SECTION_LABEL: Record<NonNullable<NoteEntry['section']>, string> = {
  flavor: 'Flavor',
  feeling: 'Feeling',
  body: 'Body',
  finish: 'Finish',
  general: 'General',
};

/**
 * Admin-only review surface that appears after the tasting session's term
 * selections are complete. Each captured voice/typed note is shown as an
 * editable card. Tapping the star publishes it to the product's public
 * "Impressions" block; tapping again retracts. Edits persist regardless of
 * star state, so the private pool benefits from polish too.
 */
export const NoteReviewPanel: React.FC<NoteReviewPanelProps> = ({ notes, onChange }) => {
  // Locally track per-note text for a snappy editing UX; commit upwards on blur.
  const [localText, setLocalText] = useState<Record<string, string>>({});

  if (notes.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-[12px] text-tea-text-dim" style={{ fontFamily: 'var(--font-body)' }}>
        No notes captured in this session. Your selections will save as usual.
      </div>
    );
  }

  const getText = (n: NoteEntry) => (localText[n.id] ?? n.text);

  const commitText = (id: string) => {
    const text = localText[id];
    if (text === undefined) return;
    onChange(notes.map(n => (n.id === id ? { ...n, text } : n)));
    setLocalText(({ [id]: _drop, ...rest }) => rest);
  };

  const toggleStar = (id: string) => {
    const current = notes.find(n => n.id === id);
    if (!current) return;
    const pendingText = localText[id];
    onChange(notes.map(n => (
      n.id === id
        ? { ...n, starred: !n.starred, text: pendingText ?? n.text }
        : n
    )));
    if (pendingText !== undefined) {
      setLocalText(({ [id]: _drop, ...rest }) => rest);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 px-3 pb-3">
      <div className="px-1 pb-1">
        <h3
          className="text-[11px] uppercase tracking-[0.15em] text-tea-text-sec"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Review your notes
        </h3>
        <p className="text-[11px] text-tea-text-dim mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
          Star what speaks — those go to the product's Impressions. Edit freely; unstar stays private.
        </p>
      </div>

      {notes.map(note => {
        const starred = !!note.starred;
        const sectionLabel = note.section ? SECTION_LABEL[note.section] : null;
        return (
          <div
            key={note.id}
            className={`rounded-xl p-3 transition-colors ${
              starred ? 'bg-tea-gold/10' : 'bg-tea-surface'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              {sectionLabel ? (
                <span
                  className="text-[9px] uppercase tracking-[0.15em] text-tea-text-dim"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {sectionLabel}
                </span>
              ) : <span />}
              <button
                type="button"
                onClick={() => toggleStar(note.id)}
                aria-pressed={starred}
                aria-label={starred ? 'Unstar note — keeps it private' : 'Star note — publishes to Impressions'}
                className={`transition-colors ${starred ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
              >
                <Star size={16} fill={starred ? 'currentColor' : 'none'} strokeWidth={1.5} />
              </button>
            </div>
            <textarea
              value={getText(note)}
              onChange={e => setLocalText(s => ({ ...s, [note.id]: e.target.value }))}
              onBlur={() => commitText(note.id)}
              rows={Math.max(2, Math.ceil(getText(note).length / 48))}
              className="w-full bg-transparent border-none outline-none resize-none text-sm text-tea-text leading-relaxed placeholder-tea-text-dim focus:ring-0"
              style={{ fontFamily: 'var(--font-body)' }}
              placeholder="Polish the text before starring — this is what goes public."
            />
          </div>
        );
      })}
    </div>
  );
};
