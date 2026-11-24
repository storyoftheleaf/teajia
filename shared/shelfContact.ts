// wa.me expects an international number with digits only.
export function normalizeShelfWhatsApp(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\+?[\d().\s-]+$/.test(value.trim())) return null;
  const digits = value.replace(/\D/g, '');
  return /^[1-9]\d{6,14}$/.test(digits) ? digits : null;
}
