import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { selectTableEntries, useTeaCompassStore } from '../../lib/teaCompassStore';
import { parseTeaInput } from './InputParser';
import { REGION_NAMES } from '../../wisdom';
import type { TeaCompassEntry } from './types';
import { linePriceFields, quotedUnit, readLinePrice, tastingLine } from './curateV2Model';
import { VendorPicker } from './VendorPicker';
import { CURRENCY_LABELS } from './PricingRow';
import type { Currency } from '../../admin/types';

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
  /** Bumped by the parent to open the vendor picker (a table was just started elsewhere). */
  pickVendorSignal?: number;
}

/**
 * The teas on this table, one line each: name, then the price as the vendor
 * said it, then a cup (fast tasting) and a microphone (talk about this tea).
 * A tea with a photo shows a small one; a tea without looks the same, minus it.
 * Typing a name in the line at the bottom adds the next tea, reading type, year and region out
 * of the line the same way the capture card's name field does.
 */
export const TableList: React.FC<TableListProps> = ({ activeEntryId, onOpen, onTaste, canTalk, onTalk, talkingEntryId, voiceState, pickVendorSignal }) => {
  const currentSessionId = useTeaCompassStore((s) => s.currentSessionId);
  const entries = useTeaCompassStore((s) => s.entries);
  const pendingEntries = useTeaCompassStore((s) => s.pendingEntries);
  const startNewCaptureOnTable = useTeaCompassStore((s) => s.startNewCaptureOnTable);
  const startNewTable = useTeaCompassStore((s) => s.startNewTable);
  const setTableVendor = useTeaCompassStore((s) => s.setTableVendor);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const commitEntry = useTeaCompassStore((s) => s.commitEntry);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);
  const [name, setName] = useState('');
  const [pickingVendor, setPickingVendor] = useState(false);
  const lastVendorName = useTeaCompassStore((s) => s.lastVendorName);
  const lastCurrency = useTeaCompassStore((s) => s.lastCurrency);
  const setLastCurrency = useTeaCompassStore((s) => s.setLastCurrency);
  const inputRef = useRef<HTMLInputElement>(null);
  const entryRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (pickVendorSignal) setPickingVendor(true); }, [pickVendorSignal]);
  // The line for the next tea is hidden while a vendor is being chosen; when
  // the picker closes after a choice, the cursor goes back to it.
  const wasPicking = useRef(false);
  useEffect(() => {
    if (wasPicking.current && !pickingVendor) inputRef.current?.focus();
    wasPicking.current = pickingVendor;
  }, [pickingVendor]);
  // Hold the microphone to talk and let go to stop, as drawn. A quick tap
  // still starts it, and a second tap stops it, for a longer note.
  const holdRef = useRef<{ id: string; since: number; began: boolean } | null>(null);
  const [holding, setHolding] = useState(false);
  const micDown = (id: string, isTalking: boolean) => {
    holdRef.current = { id, since: Date.now(), began: !isTalking };
    if (!isTalking) { onTalk(id); setHolding(true); }
  };
  const micUp = (id: string) => {
    const hold = holdRef.current;
    holdRef.current = null;
    setHolding(false);
    if (!hold || hold.id !== id) return;
    // Held: letting go stops it. Tapped while recording: that tap stops it.
    if (!hold.began || Date.now() - hold.since > 450) onTalk(id);
  };

  // The open table: exactly the teas in this run, drafts and saved, oldest
  // first. The count in the header is this same list.
  const rows = useMemo(
    () => selectTableEntries({ entries, pendingEntries, currentSessionId }),
    [entries, pendingEntries, currentSessionId],
  );

  const newTable = () => {
    startNewTable();
    setName('');
    setPickingVendor(true);
  };

  const add = () => {
    const typed = name.trim();
    if (!typed) { inputRef.current?.focus(); return; }
    // "Mengku 2018 ¥450/cake": the price comes out first, then the reader
    // finds type, form, year and region in what is left.
    const price = readLinePrice(typed);
    const text = price?.rest || typed;
    const parsed = parseTeaInput(text, REGION_NAMES);
    const keep = activeEntryId;
    const id = startNewCaptureOnTable('tea');
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
    if (price) Object.assign(updates, linePriceFields(price));
    updateEntry(id, updates);
    commitEntry(id);
    if (keep) setActiveEntry(keep);
    setName('');
    inputRef.current?.focus();
    // The next tea is typed below the last one poured: keep that line in sight.
    window.requestAnimationFrame(() => entryRowRef.current?.scrollIntoView({ block: 'nearest' }));
  };

  // No table yet: one line, and nothing else to look at.
  if (!currentSessionId) {
    return (
      <div className="curate-v2 -mx-4 -mt-3 mb-3">
        <button type="button" onClick={newTable} data-testid="table-start" className="curate-v2-row w-full text-left">
          <span className="font-display text-ui-20 text-tea-text">Start a table</span>
          <span className="flex-1" />
          <span className="font-mono text-ui-13 text-tea-gold">whose?</span>
        </button>
        {pickingVendor && (
          <VendorPicker
            onCancel={() => setPickingVendor(false)}
            onPick={(id, vendorName) => { setTableVendor(id ?? null, vendorName); setPickingVendor(false); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="curate-v2 -mx-4 -mt-3 mb-3" data-testid="table-list">
      <div className="curate-v2-row gap-0 pr-2" data-testid="table-header">
      <button type="button" onClick={() => setPickingVendor((v) => !v)} aria-expanded={pickingVendor} aria-label={lastVendorName ? `Table: ${lastVendorName}. Change` : 'Whose table? Choose'} className="flex min-h-12 min-w-0 items-center gap-2 text-left">
        <span className={`truncate ${lastVendorName ? 'curate-v2-name' : 'font-display text-ui-17 text-tea-text-sec'}`}>{lastVendorName || 'Whose table?'}</span>
      </button>
      <span className="shrink-0 pl-2 text-ui-12 text-tea-text-sec tabular-nums" data-testid="table-count">
        {rows.length} {rows.length === 1 ? 'tea' : 'teas'}
      </span>
      {/* The table's money: a price typed without a sign is in this. */}
      <label className="relative ml-2 flex min-h-11 shrink-0 items-center border-l border-tea-border pl-3">
        <span className="sr-only">Prices at this table are in</span>
        <select
          value={lastCurrency}
          onChange={(e) => setLastCurrency(e.target.value as Currency)}
          className="min-h-11 min-w-11 appearance-none bg-transparent pr-1 font-mono text-ui-14 text-tea-gold outline-none"
          aria-label="Currency at this table"
        >
          {(['Yuan', 'NT', 'HKD', 'USD', 'JPY', 'IDR', 'MYR', 'AUD'] as Currency[]).map((c) => (
            <option key={c} value={c}>{CURRENCY_LABELS[c]}</option>
          ))}
        </select>
      </label>
      <span className="flex-1" />
      <button type="button" onClick={newTable} className="curate-v2-word tap-target shrink-0">new table</button>
      </div>
      {pickingVendor && (
        <VendorPicker
          onCancel={() => setPickingVendor(false)}
          onPick={(id, vendorName) => {
            setTableVendor(id ?? null, vendorName);
            setPickingVendor(false);
            inputRef.current?.focus();
          }}
        />
      )}
      {rows.map((e) => {
        const unit = quotedUnit(e);
        const talking = talkingEntryId === e.id && (voiceState === 'recording' || voiceState === 'transcribing');
        const sym = CURRENCY_LABELS[e.priceCurrency] ?? '';
        return (
          <div
            key={e.id}
            className={`curate-v2-row ${e.id === activeEntryId ? 'bg-tea-accent-sub' : ''}`}
          >
            <button type="button" onClick={() => onOpen(e.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
              {e.photos?.[0] && <span className="h-9 w-9 shrink-0 rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${e.photos[0]})` }} aria-hidden="true" />}
              <span className="grid min-w-0 flex-1 gap-0.5">
                {/* The name wraps to two lines rather than being cut: "Mengku Laobanzhang" must read in full. */}
                <span className="curate-v2-name !whitespace-normal line-clamp-2">{e.name?.trim() || (e.category === 'teaware' ? 'Untitled teaware' : 'Untitled tea')}</span>
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-ui-12 tabular-nums">
                  {tastingLine(e.tasting)
                    ? <span className="text-tea-gold">{tastingLine(e.tasting).split(' · ').slice(0, 2).join(' · ')}</span>
                    : e.year != null && <span className="text-tea-text-sec">{e.year}</span>}
                  {e.priceAmount != null ? (
                    <span className="font-medium text-tea-text-sec">
                      {sym}{e.priceAmount.toLocaleString()}
                      {unit && <span className="ml-1 font-normal">{unit}</span>}
                    </span>
                  ) : (
                    <span className="text-tea-text-sec">add cost</span>
                  )}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onTaste(e.id)}
              aria-label={`Fast tasting for ${e.name || 'this tea'}`}
              className={`curate-v2-frame tap-target shrink-0 ${tastingLine(e.tasting) ? "is-on" : ""}`}
            >
              Taste
            </button>
            {canTalk && (
              <button
                type="button"
                onPointerDown={(ev) => { ev.preventDefault(); micDown(e.id, talking); }}
                onPointerUp={() => micUp(e.id)}
                onPointerCancel={() => micUp(e.id)}
                onContextMenu={(ev) => ev.preventDefault()}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onTalk(e.id); } }}
                aria-label={talking ? `Stop recording for ${e.name || 'this tea'}` : `Talk about ${e.name || 'this tea'}`}
                className={`curate-v2-frame tap-target shrink-0 px-0 ${talking ? "is-on" : ""}`}
              >
                {talking && voiceState === 'transcribing' ? <Loader2 size={13} className="animate-spin" />
                  : talking ? <Square size={11} fill="currentColor" strokeWidth={0} />
                  : <Mic size={14} strokeWidth={1.4} />}
              </button>
            )}
          </div>
        );
      })}
      {talkingEntryId && voiceState === 'recording' && (
        <div className="flex items-baseline justify-between px-4 py-2 text-ui-12">
          <span className="text-tea-text-sec">Recording for this tea</span>
          <span className="text-tea-gold">{holding ? 'let go to stop' : 'tap the square to stop'}</span>
        </div>
      )}
      {!pickingVendor && <div className="curate-v2-row" ref={entryRowRef} data-testid="table-entry">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          enterKeyHint="next"
          placeholder="Name the next tea, and its price if you have it…"
          aria-label="Name the next tea"
          className="min-h-11 min-w-0 flex-1 border-0 border-b border-tea-border bg-transparent py-2 font-display text-ui-17 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold"
        />
        {name.trim() && (
          <button type="button" onClick={add} className="curate-v2-word tap-target">Add</button>
        )}
      </div>}
    </div>
  );
};
