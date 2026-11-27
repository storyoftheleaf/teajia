import type { PaymentMethodType } from './types';

// A tea master pastes their payment details the way their bank or Wise hands
// them over (Adrian, 2026-11-27: "this is how Wise gives it to me, just have it
// be pasted into that"). The paste is kept as written, as the method's
// instructions; this file only reads a few things out of it so nobody has to
// fill boxes the paste already answers, and splits it into lines the pay page
// can show with a Copy beside each value.

export const PASTED_DETAILS_LIMIT = 1000;

export interface PastedPaymentReading {
  /** The "Name:" line, when the paste has one. */
  recipientName: string | null;
  /** The first https link in the paste. */
  externalUrl: string | null;
  /** A link and nothing else is a payment link; anything more is a transfer. */
  methodType: PaymentMethodType;
  /** "Wise" when the paste mentions Wise, else "Bank transfer" or "Payment link". */
  suggestedLabel: string;
}

const LINK = /https:\/\/[^\s<>"']+/i;
const KEY_VALUE = /^([^:]{1,48}):\s*(\S.*)$/;

export function readPastedPayment(text: string): PastedPaymentReading {
  const trimmed = text.trim();
  const nameLine = trimmed.split(/\r?\n/).map(line => line.trim()).map(line => KEY_VALUE.exec(line))
    .find(match => match && /^(account holder|recipient|beneficiary)?\s*name$/i.test(match[1].trim()));
  const link = LINK.exec(trimmed)?.[0]?.replace(/[).,;]+$/, '') ?? null;
  const onlyALink = Boolean(link) && trimmed.replace(link ?? '', '').trim() === '';
  const methodType: PaymentMethodType = onlyALink ? 'payment_link' : 'bank_transfer';
  const suggestedLabel = /\bwise\b/i.test(trimmed) || /wise\.com/i.test(link ?? '')
    ? 'Wise'
    : methodType === 'payment_link' ? 'Payment link' : 'Bank transfer';
  return {
    recipientName: nameLine ? nameLine[2].trim() : null,
    externalUrl: link,
    methodType,
    suggestedLabel,
  };
}

export type PastedLine =
  | { kind: 'heading'; text: string }
  | { kind: 'value'; label: string; value: string }
  | { kind: 'text'; text: string };

/**
 * The paste as the pay page shows it: "Label: value" lines become a value the
 * customer can copy, a line ending in a colon becomes a small heading ("From
 * outside the US (Swift):"), and anything else stays as written.
 */
export function pastedLines(text: string | null | undefined): PastedLine[] {
  if (!text) return [];
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line): PastedLine => {
    if (line.endsWith(':')) return { kind: 'heading', text: line.slice(0, -1).trim() };
    const match = KEY_VALUE.exec(line);
    if (match && !/^https?$/i.test(match[1].trim())) return { kind: 'value', label: match[1].trim(), value: match[2].trim() };
    return { kind: 'text', text: line };
  });
}

/** True when the paste reads as details (two or more copyable values), not a sentence of instructions. */
export function looksLikePastedDetails(text: string | null | undefined): boolean {
  return pastedLines(text).filter(line => line.kind === 'value').length >= 2;
}
