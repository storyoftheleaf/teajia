import { sha256, stableId } from './canonical.mjs';

export function normalizeCapturedText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t \f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createEvidence({
  sourceId,
  normalizedText,
  exact,
  heading = '',
  page = null,
  section = '',
  occurrence = 0,
  extractorVersion = '1',
  confidence = null,
}) {
  const text = normalizeCapturedText(normalizedText);
  const quote = normalizeCapturedText(exact);
  if (!sourceId || !quote) throw new Error('Evidence requires sourceId and exact text');

  let start = -1;
  let from = 0;
  for (let index = 0; index <= occurrence; index += 1) {
    start = text.indexOf(quote, from);
    if (start < 0) throw new Error(`Exact evidence text not found in normalized source: ${quote.slice(0, 80)}`);
    from = start + quote.length;
  }
  const end = start + quote.length;
  const excerptSha256 = sha256(quote);
  const evidenceId = stableId('evidence', [sourceId, start, end, excerptSha256]);

  return Object.freeze({
    evidenceId,
    sourceId,
    exact: quote,
    heading: String(heading || '').trim(),
    section: String(section || '').trim(),
    page,
    start,
    end,
    prefix: text.slice(Math.max(0, start - 80), start),
    suffix: text.slice(end, Math.min(text.length, end + 80)),
    excerptSha256,
    extractorVersion: String(extractorVersion),
    confidence,
  });
}

