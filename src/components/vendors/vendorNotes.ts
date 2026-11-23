/**
 * Vendor notes, read as a list instead of one run-on paragraph.
 *
 * Adrian, 2026-11-23: "the notes is just one weird long list." Notes arrive
 * typed, dictated or imported, often as one line joined with bullets, pipes or
 * semicolons. Each separate thought becomes its own line; a line that starts
 * with a short label ("WeChat: ...", "Prices: ...") keeps the label apart so
 * the eye can scan down the labels.
 *
 * Only for showing. The stored text is never rewritten.
 */

export interface VendorNoteLine {
  label?: string;
  text: string;
}

const BULLET = /^\s*(?:[-*•·▪◦]|\d{1,2}[.)])\s+/;
/** Separators that, inside one line, mean "next thought". */
const INLINE_SPLIT = /\s+[|•·]\s+|\s*;\s+|\s+-\s+(?=[A-Z])/;
const LABELLED = /^([^:：]{1,28})[:：]\s*(.+)$/;

export function structureVendorNotes(notes: string | null | undefined): VendorNoteLine[] {
  if (!notes?.trim()) return [];
  const pieces = notes
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .flatMap(line => line.split(INLINE_SPLIT))
    .map(piece => piece.replace(BULLET, '').trim())
    .filter(Boolean);
  return pieces.map(piece => {
    const match = piece.match(LABELLED);
    // A URL's "https:" is not a label.
    if (match && !/^https?$/i.test(match[1].trim()) && !/\d{1,2}$/.test(match[1])) {
      return { label: match[1].trim(), text: match[2].trim() };
    }
    return { text: piece };
  });
}
