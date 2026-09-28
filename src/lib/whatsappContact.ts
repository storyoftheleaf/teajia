/** Require an explicit international country code; never guess from a location. */
export function internationalWhatsAppNumber(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\+[\d\s().-]+$/.test(value.trim())) return null;
  const number = value.replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(number) ? `+${number}` : null;
}
