import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Check } from '@phosphor-icons/react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

interface TeaSaveTileProps {
  year?: string | number | null;
  name: string;
  saved: boolean;
  background: string;
  savedColor: string;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Drawn in the year's place, for a row that has no year (teaware). */
  mark?: ReactNode;
}

/** The date and action share a single compact tile and a single tap target. */
export function TeaSaveTile({ year, name, saved, background, savedColor, onToggle, mark }: TeaSaveTileProps) {
  const [animateSave, setAnimateSave] = useState(false);
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
      <span className={`tea-save-tile-year${String(year ?? '').length > 4 ? ' tea-save-tile-year-long' : ''}`}>{mark ?? (year || '—')}</span>
      <span className={`tea-save-tile-action ${TYPOGRAPHY_CLASSES.label}`}>
        {saved && <Check size={10} weight="bold" aria-hidden="true" />}
        {saved ? 'Saved' : 'Save'}
      </span>
    </button>
  );
}
