import type { MouseEvent } from 'react';
import { Check } from '@phosphor-icons/react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

interface TeaSaveTileProps {
  year?: string | number | null;
  name: string;
  saved: boolean;
  background: string;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
}

/** The date and action share a single compact tile and a single tap target. */
export function TeaSaveTile({ year, name, saved, background, onToggle }: TeaSaveTileProps) {
  return (
    <button
      type="button"
      className="tea-save-tile"
      style={{ backgroundColor: background }}
      aria-pressed={saved}
      aria-label={`${saved ? 'Unsave' : 'Save'} ${name}`}
      title={saved ? 'Saved. Click to unsave' : 'Save tea'}
      onClick={event => {
        event.stopPropagation();
        onToggle(event);
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
      }}
    >
      <span className={`tea-save-tile-year${String(year ?? '').length > 4 ? ' tea-save-tile-year-long' : ''}`}>{year || '—'}</span>
      <span className={`tea-save-tile-action ${TYPOGRAPHY_CLASSES.label}`}>
        {saved && <Check size={10} weight="bold" aria-hidden="true" />}
        {saved ? 'Saved' : 'Save'}
      </span>
    </button>
  );
}
