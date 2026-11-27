import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Check } from '@phosphor-icons/react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

interface TeaSaveTileProps {
  year?: string | number | null;
  name: string;
  saved: boolean;
  background: string;
  savedColor: string;
  onToggle?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Drawn in the year's place, for a row that has no year (teaware). */
  mark?: ReactNode;
  /** The kind of tea, shown in the year's place when the tea has no date (Adrian, 2026-11-27). */
  type?: string | null;
}

/** "Shou Puer" and "Dark Tea" are "Shou" and "Dark" in the tile: one word, so the box keeps its width. */
export function tileTypeWord(type?: string | null): string {
  const word = String(type ?? '').trim().replace(/\s+(pu[\s'’-]?er[h]?|tea)$/i, '').trim();
  return /^(tea|teaware)$/i.test(word) ? '' : word;
}

/** The date and action share a single compact tile and a single tap target. */
export function TeaSaveTile({ year, name, saved, background, savedColor, onToggle, mark, type }: TeaSaveTileProps) {
  const [animateSave, setAnimateSave] = useState(false);
  const word = year ? '' : tileTypeWord(type);
  const size = word ? ' tea-save-tile-word' : String(year ?? '').length > 4 ? ' tea-save-tile-year-long' : '';
  const date = <span className={`tea-save-tile-year${size}`}>{mark ?? (year || word || '—')}</span>;
  if (!onToggle) return <span className="tea-save-tile" style={{ backgroundColor: background }}>{date}</span>;
  return (
    <button
      type="button"
      className={`tea-save-tile${saved && animateSave ? ' tea-save-tile-confirm' : ''}`}
      style={{ backgroundColor: background, '--tea-save-color': savedColor } as CSSProperties}
      aria-pressed={saved}
      aria-label={`${saved ? 'Unsave' : 'Save'} ${name}`}
      title={saved ? 'Saved. Click to unsave' : 'Save tea'}
      onClick={event => {
        event.stopPropagation();
        setAnimateSave(!saved);
        onToggle(event);
      }}
      onAnimationEnd={event => {
        if (event.target === event.currentTarget) setAnimateSave(false);
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
      }}
    >
      {date}
      <span className={`tea-save-tile-action ${TYPOGRAPHY_CLASSES.label}`}>
        {saved && <Check size={10} weight="bold" aria-hidden="true" />}
        {saved ? 'Saved' : 'Save'}
      </span>
    </button>
  );
}
