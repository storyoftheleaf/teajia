/** Preserve an entered vintage or decade; blank means unrecorded, not zero. */
export function enteredYear(value: unknown): number | string | null {
  if (value == null || String(value).trim() === '') return null;
  const text = String(value).trim().toLowerCase();
  if (/^\d{4}$/.test(text)) return Number(text);
  if (/^\d{3}0s$/.test(text)) return text;
  throw new Error('Enter a four-digit year or a decade such as 1980s.');
}
