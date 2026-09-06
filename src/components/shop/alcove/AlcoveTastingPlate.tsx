import React, { useState } from 'react';
import type { CustomerTasting } from '../../../types';
import { resolveTermLabel } from '../../../data/tastingTaxonomy';
import { normalizeNotes } from '../../../lib/noteEntries';

interface AlcoveTastingPlateProps {
  /** This reader's entry for this tea, or null when they have not written one. */
  entry: CustomerTasting | null;
  /**
   * Opens the tasting session. 'notes' opens it on the notes workspace with the
   * mic ready; 'edit' opens the questions.
   */
  onTaste: (intent?: 'edit' | 'notes') => void;
  /**
   * 'inline' is the quiet card's plate, sitting inside the character band.
   * 'standalone' is the product page's row: it stands on its own directly
   * above the reading, in its own keyline, because the record above it says
   * what the TEA is and this says what YOU did with it. Two claims of
   * different kinds should not share one box.
   */
  variant?: 'inline' | 'standalone';
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
/** The disclosure caret on the standalone row. Drawn, so it takes the accent. */
const Caret: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="ml-auto shrink-0 text-tea-gold-lt"
  >
    <path d={open ? 'M6 14.5 12 8.5 18 14.5' : 'M6 9.5 12 15.5 18 9.5'} />
  </svg>
);

export const AlcoveTastingPlate: React.FC<AlcoveTastingPlateProps> = ({ entry, onTaste, variant = 'inline' }) => {
  /*
   * Closed by default, on purpose. The row's job on a reading page is to say
   * that your entry EXISTS and to get out of the way; the words you wrote are
   * one tap under it. Open by default would put your own paragraph between the
   * tea and its lore every single visit.
   */
  const [open, setOpen] = useState(false);
  const note = entry?.note;
  const terms = note?.tasting?.flavor?.length
    ? note.tasting.flavor
    : note?.tasting?.feeling ?? [];
  /*
   * Your own paragraph on this tea, and the plate's main body. Any separate
   * notes from the sitting read underneath it. All of it is private to you.
   */
  const personalNote = note?.personalNote?.trim();
  // Everything you wrote in the sitting, starred or not. Starring was a way to
  // offer a note for publication; the shop reads every note now, so the mark
  // means nothing here and all of them simply read back.
  const ownNotes = normalizeNotes(note?.tasting);
  const hasSomethingToShow = terms.length > 0 || Boolean(personalNote) || ownNotes.length > 0;

  const standalone = variant === 'standalone';

  // "Tasted" dates the sitting, not the last edit, so it takes the first
  // record's date and falls back to the entry's own timestamp.
  const tastedAt = entry?.tastings[0]?.createdAt ?? note?.updatedAt;
  const tastedLabel = tastedAt
    ? new Date(tastedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  if (standalone) {
    // Nothing written: one row, one invitation, an arrow that means forward.
    if (!entry || !hasSomethingToShow) {
      /*
       * An invitation is not a field, so it does not take a field's width. It
       * sits as a small centred box in the same bronze as the written row, and
       * only grows to a full row once there is something in it to read.
       */
      return (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onTaste('edit');
            }}
            className="alcove-note-row inline-flex min-h-[44px] items-center gap-2.5 px-[18px] transition-colors"
          >
            <LeafMark />
            <span className="font-display text-ui-17 font-medium leading-none text-tea-text">
              Add your tasting
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0 text-tea-gold-lt"
            >
              <path d="M5 12h13" />
              <path d="M12.5 6.5 18 12l-5.5 5.5" />
            </svg>
          </button>
        </div>
      );
    }

    /*
     * Written: the same row shows what you called it, and opens onto the rest.
     * It is wider than the invitation because it carries words and a drawer,
     * but it is still your note rather than the page, so it stays inside a
     * reading measure instead of running the full width of the record.
     */
    return (
      <div className="mx-auto w-full max-w-[430px]">
        <button
          type="button"
          aria-expanded={open}
          onClick={e => {
            e.stopPropagation();
            setOpen(v => !v);
          }}
          className="alcove-note-row relative flex min-h-[46px] w-full items-center justify-center px-3.5 transition-colors"
        >
          {/*
            What you tasted is the line, so it sits on the centre of the box the
            way the shop's own taste line sits on the centre of the record. The
            leaf and the word saying whose it is are a mark in the margin, held
            out of the flow so they cannot push the words off centre.
          */}
          <span className="pointer-events-none absolute left-3.5 flex items-center gap-[7px]">
            <LeafMark />
            <span className="font-sans text-ui-8 uppercase tracking-[0.2em] text-tea-text-dim">
              Yours
            </span>
          </span>
          <span className="min-w-0 truncate px-[72px] text-center font-display text-ui-17 font-medium text-tea-text">
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
          </span>
          <span className="pointer-events-none absolute right-3.5">
            <Caret open={open} />
          </span>
        </button>

        {open && (
          <div className="alcove-note-open px-4 pb-4 pt-3.5">
            {personalNote && (
              <p className="m-0 font-body text-ui-14 italic leading-[1.62] text-tea-text-sec">
                {personalNote}
              </p>
            )}
            {/*
              The rest of what you wrote during the sitting. It is yours and it
              stays here: nothing you write is offered anywhere, and nothing
              reaches a product page unless the shop reads it and chooses it.
            */}
            {ownNotes.length > 0 && (
              <div className={personalNote ? 'mt-3.5' : ''}>
                {ownNotes.map(note => (
                  <p
                    key={note.id}
                    className="m-0 mt-1.5 font-body text-ui-14 italic leading-[1.62] text-tea-text-sec first:mt-0"
                  >
                    &ldquo;{note.text}&rdquo;
                  </p>
                ))}
              </div>
            )}
            {tastedLabel && (
              <p className={`m-0 font-sans text-ui-9 uppercase tracking-[0.18em] text-tea-text-dim ${personalNote ? 'mt-3' : ''}`}>
                Tasted {tastedLabel}
              </p>
            )}
            <div className="mt-3.5 flex gap-4">
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
            </div>
          </div>
        )}
      </div>
    );
  }

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
