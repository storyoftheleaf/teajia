import React from 'react';

interface AlcoveOriginLineProps {
  /** Where the tea comes from, verbatim from the record. */
  origin?: string;
  /** Harvest year. */
  harvest?: string | number;
  /**
   * Elevation as the wisdom base offers it. Only the value travels here: the
   * base's long label ("Recorded elevation") existed to stop a county range
   * being read as a tea-growing claim, and on one tracked line with no other
   * labels there is nothing for it to be confused with.
   */
  elevation?: { label: string; value: string } | null;
  /** How much of the growing country is under forest. */
  forestCover?: string;
  /** What the trees are: ancient stands, planted terraces, and so on. */
  treeCharacter?: string;
}

/**
 * Where the tea is from, floating under the label.
 *
 * This replaced the facts ledger on the product page. The ledger set origin,
 * year and elevation as a bordered table of label/value rows, which read as a
 * spreadsheet at the top of a page whose job is reading, and it repeated a
 * grammar the label above was already using better.
 *
 * Here the place carries the weight, set in the display serif at reading size,
 * and everything the base can add about it follows on one quiet tracked line
 * underneath. Nothing encloses it. It is the first thing under the label and
 * reads as part of the same object rather than as the first row of a document.
 *
 * Renders nothing when there is no origin AND nothing to put on the second
 * line, because a floating block with one word in it is worse than no block.
 */
export const AlcoveOriginLine: React.FC<AlcoveOriginLineProps> = ({
  origin,
  harvest,
  elevation,
  forestCover,
  treeCharacter,
}) => {
  // Everything short enough to sit on the tracked line, in the order the base
  // knows it. Absent facts simply do not appear; nothing is padded.
  const details = [
    harvest ? String(harvest) : '',
    elevation?.value ?? '',
    forestCover ? `${forestCover} forest` : '',
    treeCharacter ?? '',
  ].filter(Boolean);

  if (!origin && details.length === 0) return null;

  return (
    <div className="px-5 pb-7 pt-7 text-center lg:pb-8 lg:pt-9">
      {origin && (
        <p className="m-0 font-display text-[22px] font-normal leading-[1.34] text-tea-text [text-wrap:balance] lg:text-ui-26">
          {origin}
        </p>
      )}
      {details.length > 0 && (
        <p
          className={`m-0 font-sans text-ui-11 font-medium uppercase leading-[1.6] tracking-[0.24em] text-tea-text-dim lg:text-ui-12 ${
            origin ? 'mt-[11px] lg:mt-3' : ''
          }`}
        >
          {details.map((detail, i) => (
            <React.Fragment key={detail}>
              {i > 0 && (
                <span aria-hidden="true" className="px-[9px] text-tea-gold">
                  ·
                </span>
              )}
              {detail}
            </React.Fragment>
          ))}
        </p>
      )}
    </div>
  );
};
