import React, { useRef, useState } from 'react';
import { Coffee, Mic, Square, Loader2 } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { parseTeaInput } from './InputParser';
import { REGION_NAMES } from '../../wisdom';
import type { TeaCompassEntry } from './types';
import { quotedUnit } from './curateV2Model';
import { CURRENCY_LABELS } from './PricingRow';

interface TableListProps {
  /** The tea open in the capture card below, if any. */
  activeEntryId: string | null;
  onOpen: (entryId: string) => void;
  onTaste: (entryId: string) => void;
  /** Talking is offered only where voice-to-text is allowed. */
  canTalk: boolean;
  onTalk: (entryId: string) => void;
  talkingEntryId: string | null;
  voiceState: 'idle' | 'recording' | 'transcribing' | 'error' | string;
}

/**
 * The teas on this table, one line each: name, then the price as the vendor
 * said it, then a cup (fast tasting) and a microphone (talk about this tea).
 * A tea with a photo shows a small one; a tea without looks the same, minus it.
 * Typing a name at the top adds the next tea, reading type, year and region out
 * of the line the same way the capture card's name field does.
 */
export const TableList: React.FC<TableListProps> = ({ activeEntryId, onOpen, onTaste, canTalk, onTalk, talkingEntryId, voiceState }) => {
  const sessionEntryIds = useTeaCompassStore((s) => s.sessionEntryIds);
  const currentSessionId = useTeaCompassStore((s) => s.currentSessionId);
  const entries = useTeaCompassStore((s) => s.entries);
  const pendingEntries = useTeaCompassStore((s) => s.pendingEntries);
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const commitEntry = useTeaCompassStore((s) => s.commitEntry);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // This table is the current capture run: teas saved in it, plus any draft
  // in it that already has a name. Newest first.
  const rows: TeaCompassEntry[] = [
    ...sessionEntryIds
      .map((id) => pendingEntries.find((e) => e.id === id))
      .filter((e): e is TeaCompassEntry => !!e),
    ...(currentSessionId ? entries.filter((e) => e.sessionId === currentSessionId) : []),
  ]
    .filter((e, i, all) => e.category === 'tea' && !!e.name?.trim() && all.findIndex((x) => x.id === e.id) === i)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const add = () => {
    const text = name.trim();
    if (!text) { inputRef.current?.focus(); return; }
    const parsed = parseTeaInput(text, REGION_NAMES);
    const keep = activeEntryId;
    const id = startNewCapture('tea');
    // The name stays as typed: the reader fills type, form, year and region
    // from it, but "Old oolong" is a name, not "Old" plus a type. Only a
    // standalone year is lifted out, since it has its own column.
    const typedName = parsed.year ? text.replace(new RegExp(`\\b${parsed.year}\\b`), '').replace(/\s{2,}/g, ' ').trim() : text;
    const updates: Partial<TeaCompassEntry> = { name: typedName || text };
    if (parsed.type) updates.type = parsed.type;
    if (parsed.form) updates.form = parsed.form;
    if (parsed.year) updates.year = parsed.year;
    if (parsed.season) updates.season = parsed.season;
    if (parsed.storage) updates.storage = parsed.storage;
    if (parsed.region) updates.originRegion = parsed.region;
    updateEntry(id, updates);
    commitEntry(id);
    if (keep) setActiveEntry(keep);
    setName('');
    inputRef.current?.focus();
  };

  return (
    <div className="curate-v2 -mx-4 mb-3 border-t border-tea-border">
      <div className="curate-v2-row">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          enterKeyHint="next"
          placeholder="Name the next tea…"
          aria-label="Name the next tea"
          className="min-w-0 flex-1 border-0 border-b border-tea-border bg-transparent py-2 font-display text-ui-17 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold"
        />
        {name.trim() && (
          <button type="button" onClick={add} className="tap-target text-ui-13 font-medium text-tea-gold">Add</button>
        )}
      </div>
      {rows.map((e) => {
        const unit = quotedUnit(e);
        const talking = talkingEntryId === e.id && (voiceState === 'recording' || voiceState === 'transcribing');
        const sym = CURRENCY_LABELS[e.priceCurrency] ?? '';
        return (
          <div
            key={e.id}
            className={`curate-v2-row ${e.id === activeEntryId ? 'bg-tea-accent-sub' : ''}`}
          >
            <button type="button" onClick={() => onOpen(e.id)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
              {e.photos?.[0] && <span className="h-7 w-7 shrink-0 self-center rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${e.photos[0]})` }} aria-hidden="true" />}
              <span className="curate-v2-name">{e.name?.trim() || 'Untitled tea'}</span>
              {e.year != null && <span className="text-ui-12 text-tea-text-dim tabular-nums">{e.year}</span>}
              <span className="flex-1" />
              {e.priceAmount != null ? (
                <span className="text-ui-13 font-medium text-tea-text-sec tabular-nums">
                  {sym}{e.priceAmount.toLocaleString()}
                  {unit && <span className="ml-1 text-ui-12 font-normal text-tea-text-dim">{unit}</span>}
                </span>
              ) : (
                <span className="text-ui-12 text-tea-text-dim">add cost</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onTaste(e.id)}
              aria-label={`Fast tasting for ${e.name || 'this tea'}`}
              className="tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-tea-border text-tea-text-sec hover:text-tea-text"
            >
              <Coffee size={14} strokeWidth={1.6} />
            </button>
            {canTalk && (
              <button
                type="button"
                onClick={() => onTalk(e.id)}
                aria-label={talking ? `Stop recording for ${e.name || 'this tea'}` : `Talk about ${e.name || 'this tea'}`}
                className={`tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  talking ? 'border-tea-gold bg-tea-gold/10 text-tea-gold' : 'border-tea-border text-tea-text-sec hover:text-tea-text'
                }`}
              >
                {talking && voiceState === 'transcribing' ? <Loader2 size={13} className="animate-spin" />
                  : talking ? <Square size={11} fill="currentColor" strokeWidth={0} />
                  : <Mic size={14} strokeWidth={1.6} />}
              </button>
            )}
          </div>
        );
      })}
      {talkingEntryId && voiceState === 'recording' && (
        <div className="flex items-baseline justify-between px-4 py-2 text-ui-12">
          <span className="text-tea-text-sec">Recording for this tea</span>
          <span className="text-tea-gold">tap the square to stop</span>
        </div>
      )}
    </div>
  );
};
