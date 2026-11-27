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

/** Contact handles a note names ("WeChat Weeee36", "WhatsApp: +62 812…"). */
export interface NoteContact { channel: 'wechat' | 'whatsapp' | 'line' | 'instagram' | 'telegram'; label: string; handle: string }

const NOTE_CONTACT_PATTERNS: Array<{ channel: NoteContact['channel']; label: string; re: RegExp }> = [
  { channel: 'wechat', label: 'WeChat', re: /\b(?:we\s?chat|weixin|微信)\s*(?:id)?\s*[:：]?\s*([A-Za-z][A-Za-z0-9_-]{2,40})/i },
  { channel: 'whatsapp', label: 'WhatsApp', re: /\bwhats\s?app\s*[:：]?\s*(\+?[\d][\d\s-]{6,20}\d)/i },
  { channel: 'line', label: 'Line', re: /\bline\s*(?:id)?\s*[:：]\s*([A-Za-z0-9._-]{3,40})/i },
  { channel: 'instagram', label: 'Instagram', re: /\binstagram\s*[:：]?\s*@?([A-Za-z0-9._]{2,30})/i },
  { channel: 'telegram', label: 'Telegram', re: /\btelegram\s*[:：]?\s*@?([A-Za-z0-9_]{4,32})/i },
];

/**
 * Handles written into a vendor's notes that their contacts do not hold yet,
 * so the page can offer to move each one across with a tap. Only for offering:
 * nothing is saved until the person taps.
 */
export function contactsInNotes(notes: string | null | undefined, existing: Array<{ channel: string; handle: string }>): NoteContact[] {
  if (!notes?.trim()) return [];
  const known = new Set(existing.map(c => `${c.channel}:${c.handle.replace(/[\s-]/g, '').toLowerCase()}`));
  const found: NoteContact[] = [];
  for (const { channel, label, re } of NOTE_CONTACT_PATTERNS) {
    const match = notes.match(re);
    if (!match) continue;
    const handle = match[1].trim().replace(/[.,;]+$/, '');
    if (known.has(`${channel}:${handle.replace(/[\s-]/g, '').toLowerCase()}`)) continue;
    found.push({ channel, label, handle });
  }
  return found;
}
