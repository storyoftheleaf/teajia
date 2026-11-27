// Short codes (Adrian, 2026-11-27): every vendor has a code such as V1 (the
// vendor page's Vendor code), and every tea or sample a number within its
// vendor, so "V1T12" is vendor V1's twelfth tea. The numbers are handed out
// by the database (migration 0155) and never reused. This file only reads
// and writes the text form, the same on the site and for the agent.

export interface ShortCode {
  /** The vendor's code as typed, upper-cased: "V1", or a hand-typed "HW9". */
  vendor: string;
  /** The tea's number within that vendor, or null for the vendor alone. */
  tea: number | null;
}

/** The tea's code, e.g. "V1T12", or null when either half is not known yet. */
export function teaShortCode(vendorCode: string | null | undefined, teaNumber: number | null | undefined): string | null {
  const vendor = vendorCode?.trim();
  if (!vendor || teaNumber == null || !Number.isInteger(teaNumber) || teaNumber < 1) return null;
  return `${vendor.toUpperCase()}T${teaNumber}`;
}

/** Reads "V1T12", "v1 t12", "V1-T12" or a vendor alone ("V1"). Anything else
 *  is not a code, so ordinary searches like "yiwu" are left alone. */
export function parseShortCode(text: string): ShortCode | null {
  const match = /^\s*([a-z]{1,4}\d{1,4})\s*(?:[-\s]?\s*t\s*(\d{1,5}))?\s*$/i.exec(text);
  // "T12" alone names a tea without its vendor, so it is not a code.
  if (!match || (/^t\d+$/i.test(match[1]) && !match[2])) return null;
  return { vendor: match[1].toUpperCase(), tea: match[2] ? Number(match[2]) : null };
}

/** Whether a tea with this vendor code and number is the one the code names. */
export function matchesShortCode(code: ShortCode, vendorCode: string | null | undefined, teaNumber: number | null | undefined): boolean {
  if (!vendorCode || vendorCode.trim().toUpperCase() !== code.vendor) return false;
  return code.tea == null || teaNumber === code.tea;
}
