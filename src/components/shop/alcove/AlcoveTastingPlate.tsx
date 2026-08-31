import React from 'react';
import type { CustomerTasting } from '../../../types';
import { resolveTermLabel } from '../../../data/tastingTaxonomy';
import { starredNotes } from '../../../lib/noteEntries';

interface AlcoveTastingPlateProps {
  /** This reader's entry for this tea, or null when they have not written one. */
  entry: CustomerTasting | null;
  /**
   * Opens the tasting session. 'notes' opens it on the notes workspace with the
   * mic ready; 'edit' opens the questions.
   */
  onTaste: (intent?: 'edit' | 'notes') => void;
}

/**
 * The two words in the plate's corner. Deliberately not tap-target: it sets a
 * 44px min-height on the element, which turned a two-word label into a 44px row
 * and made the plate a third taller than it needed to be. The pressable area is
 * grown with a pseudo-element instead, so the header keeps its own line box.
 */
const CORNER_LINK =
  "relative font-sans text-ui-10 uppercase tracking-[0.14em] text-tea-text-sec underline decoration-tea-gold/40 underline-offset-[3px] transition-colors after:absolute after:-inset-x-2 after:-top-4 after:-bottom-4 after:content-[''] hover:text-tea-text hover:decoration-tea-gold";

/** The leaf that marks the plate. Drawn, so it scales and takes the accent. */
const LeafMark: React.FC = () => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0 text-tea-gold-lt"
  >
    <path d="M26 6c0 10-6.6 16.4-14.6 16.4C8.2 22.4 6 20 6 16.6 6 9.8 14 6 26 6Z" />
    <path d="M8.4 26c4.4-6.2 9.4-10.6 15.2-13.6" />
  </svg>
);

/**
 * The reader's own tasting, on a tinted plate.
 *
 * Two states of one object, and the second is the reason the first exists. Empty,
 * it is a single row inviting you to write: a leaf, the invitation in the display
 * serif, an arrow at the far edge. Written, the same plate carries what you wrote
 * and the invitation demotes to an Edit in the corner, because there is one entry
 * per tea and the second visit is a correction, not a second sitting.
 *
 * It replaced a 26px gold hairline over a 10px underlined caps link, which was
 * two faint lines saying nothing and was routinely missed. No keyline here on
 * purpose: the tint alone carries it, so the reading column keeps its habit of
 * holding no bordered objects.
 */
export const AlcoveTastingPlate: React.FC<AlcoveTastingPlateProps> = ({ entry, onTaste }) => {
  const note = entry?.note;
  const terms = note?.tasting?.flavor?.length
    ? note.tasting.flavor
    : note?.tasting?.feeling ?? [];
  /*
   * The plate carries the line you did NOT star: your own paragraph on this tea,
   * which is a private working note. A starred note is the opposite gesture, so
   * it is read out as a quote in the character band above rather than repeated
   * here a hundred pixels away from itself.
   */
  const personalNote = note?.personalNote?.trim();
  const starredCount = starredNotes(note?.tasting).length;
  const hasSomethingToShow = terms.length > 0 || Boolean(personalNote) || starredCount > 0;

  // An entry that exists but holds nothing readable is not worth a plate of its
  // own: the invitation is still the honest thing to show.
  if (!entry || !hasSomethingToShow) {
    return (
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onTaste('edit');
        }}
        className="flex min-h-[52px] w-full items-center gap-[13px] bg-tea-gold/8 px-4 text-left transition-colors hover:bg-tea-gold/10"
      >
        <LeafMark />
        <span className="font-display text-ui-20 font-medium leading-none text-tea-text">
          Add your tasting
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="ml-auto shrink-0 text-tea-gold-lt"
        >
          <path d="M5 12h13" />
          <path d="M12.5 6.5 18 12l-5.5 5.5" />
        </svg>
      </button>
    );
  }

  // "Tasted" dates the sitting, not the last edit, so it takes the first
  // record's date and falls back to the entry's own timestamp.
  const tastedAt = entry.tastings[0]?.createdAt ?? note?.updatedAt;
  const tastedLabel = tastedAt
    ? new Date(tastedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="bg-tea-gold/8 px-4 pb-3.5 pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-sans text-ui-10 font-medium uppercase tracking-[0.2em] text-tea-text-dim">
          Your tasting
        </span>
        <span className="flex shrink-0 items-baseline gap-3">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onTaste('notes');
            }}
            className={CORNER_LINK}
          >
            Note
          </button>
          <span aria-hidden="true" className="h-[11px] w-px self-center bg-tea-border" />
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onTaste('edit');
            }}
            className={CORNER_LINK}
          >
            Edit
          </button>
        </span>
      </div>

      {terms.length > 0 && (
        <p className="m-0 mt-2 font-display text-[21px] font-medium leading-[1.3] text-tea-text">
          {terms.map((termId, i) => (
            <React.Fragment key={termId}>
              {i > 0 && (
                <span aria-hidden="true" className="px-[7px] text-tea-gold-lt">
                  ·
                </span>
              )}
              {resolveTermLabel(termId)}
            </React.Fragment>
          ))}
        </p>
      )}

      {personalNote && (
        <p className="m-0 mt-[7px] line-clamp-2 font-body text-ui-13 italic leading-[1.55] text-tea-text-sec">
          {personalNote}
        </p>
      )}

      {tastedLabel && (
        <p className="m-0 mt-2.5 font-sans text-ui-9 uppercase tracking-[0.18em] text-tea-text-dim">
          Tasted {tastedLabel}
        </p>
      )}
    </div>
  );
};
