import React, { useState } from 'react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { TastingData } from '../../types';

export const STORAGE_CHARACTER_WORDS = ['Parched', 'Dry', 'Sweet spot', 'Wet', 'Near mouldy'] as const;
export const STORAGE_NOTES = [
  ['Musty', 'An unpleasant closed, stale, damp-room note.'],
  ['Stale', 'A tired, stale taste or aroma.'],
  ['Sour off-note', 'An unwanted sour note in this tasting.'],
  ['Foreign odor', 'An unwanted smell that feels out of place.'],
  ['Cardboard', 'An unwanted papery or cardboard-like taste.'],
  ['Incense', 'An unwanted incense-like taste or smell.'],
  ['Moldy', 'An unwanted mold-like taste or smell.'],
  ['Mildewy', 'A damp-cloth or mildew-like smell.'],
  ['Dusty', 'A dusty, stale-room impression.'],
  ['Plastic-like', 'An unwanted plastic-like taste or smell.'],
  ['Perfumed', 'An unwanted perfume-like fragrance.'],
] as const;

interface StorageZoneProps {
  value: TastingData;
  onChange: (data: TastingData) => void;
}

export function withStorageCharacter(value: TastingData, character: number | undefined): TastingData {
  return {
    ...value,
    storageCharacter: character === undefined || !Number.isFinite(character)
      ? undefined : Math.max(0, Math.min(4, Math.round(character))),
  };
}

export function toggleStorageNote(value: TastingData, note: string): TastingData {
  const notes = value.storageNotes ?? [];
  return { ...value, storageNotes: notes.includes(note) ? notes.filter(item => item !== note) : [...notes, note] };
}

export function StorageZone({ value, onChange }: StorageZoneProps) {
  const character = withStorageCharacter(value, value.storageCharacter).storageCharacter;
  const [draft, setDraft] = useState<number | null>(null);
  const position = draft ?? character ?? 2;
  const nearest = Math.max(0, Math.min(4, Math.round(position)));
  const hasCharacter = draft !== null || character !== undefined;
  const settle = (next: number) => {
    setDraft(null);
    onChange(withStorageCharacter(value, next));
  };
  return (
    <div className="space-y-3" role="group" aria-label="Storage">
      <section aria-label="Storage character">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <h3 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Character</h3>
          {character !== undefined && (
            <button type="button" className={`${TYPOGRAPHY_CLASSES.link} min-h-11 min-w-11 text-tea-text-sec rounded-xl focus-visible:ring-2 focus-visible:ring-tea-gold`} aria-label="Clear storage character" onClick={() => { setDraft(null); onChange(withStorageCharacter(value, undefined)); }}>Clear</button>
          )}
        </div>
        <div className="tasting-storage-rail" data-selected={hasCharacter}>
          <div className="tasting-storage-ticks" aria-hidden="true">{STORAGE_CHARACTER_WORDS.map(word => <i key={word} />)}</div>
          <input type="range" min="0" max="4" step="0.01" value={position}
            aria-label="Storage character, parched to near mouldy"
            aria-valuetext={hasCharacter ? STORAGE_CHARACTER_WORDS[nearest] : 'Not selected'}
            onChange={event => setDraft(Number(event.target.value))}
            onPointerUp={event => settle(Number(event.currentTarget.value))}
            onPointerCancel={() => setDraft(null)}
            onBlur={() => { if (draft !== null) settle(draft); }}
            onKeyDown={event => {
              const changes: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 1, PageDown: -1 };
              if (event.key in changes) {
                event.preventDefault();
                settle(nearest + changes[event.key]);
              } else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                settle(event.key === 'Home' ? 0 : 4);
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                settle(nearest);
              }
            }}
          />
        </div>
        <p className={`${TYPOGRAPHY_CLASSES.link} flex h-7 items-center justify-center text-tea-text`} aria-live="polite">{hasCharacter ? STORAGE_CHARACTER_WORDS[nearest] : ''}</p>
      </section>
      <section aria-label="Unwanted notes">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <h3 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Unwanted notes</h3>
          <details className="relative">
            <summary className={`${TYPOGRAPHY_CLASSES.link} flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl text-tea-text-dim focus-visible:ring-2 focus-visible:ring-tea-gold`} aria-label="Explain unwanted notes">?</summary>
            <div className="absolute right-0 z-10 max-h-60 overflow-y-auto w-64 max-w-[75vw] rounded-xl border border-tea-border bg-tea-elevated p-3 shadow-lg">
              <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>What detracts from the taste?</p>
              <dl className="mt-2 space-y-2">{STORAGE_NOTES.map(([note, meaning]) => <div key={note}><dt className={`${TYPOGRAPHY_CLASSES.link} text-tea-text`}>{note}</dt><dd className={`${TYPOGRAPHY_CLASSES.accountMeta} text-tea-text-sec`}>{meaning}</dd></div>)}</dl>
            </div>
          </details>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Unwanted storage notes">
          {STORAGE_NOTES.map(([note]) => <button key={note} type="button" aria-pressed={value.storageNotes?.includes(note) ?? false} onClick={() => onChange(toggleStorageNote(value, note))} className={`${TYPOGRAPHY_CLASSES.link} min-h-11 rounded-xl px-3 transition-colors focus-visible:ring-2 focus-visible:ring-tea-gold ${value.storageNotes?.includes(note) ? 'bg-tea-elevated text-tea-text' : 'bg-tea-surface text-tea-text-sec hover:bg-tea-elevated'}`}>{note}</button>)}
        </div>
      </section>
    </div>
  );
}
