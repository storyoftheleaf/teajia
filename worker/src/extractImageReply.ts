/**
 * The label scanner's two failure points, kept out of `index.ts` so they can be
 * called directly in a test.
 *
 * On 2026-10-08 a scan answered 502 once and nothing said why: the worker keeps
 * no logs to look in afterwards. Both 502 paths had a cause that a retry or a
 * kinder reading fixes, so both are handled here.
 */

/** Statuses where asking Anthropic again a moment later usually works: busy, overloaded, or a hiccup. */
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529]);

export function isRetryableProviderStatus(status: number): boolean {
  return RETRYABLE.has(status);
}

/**
 * Read the model's JSON out of its reply.
 *
 * The prompt asks for a bare object, and usually gets one, but a reply wrapped
 * in a sentence or a code fence is still a good reply. Taking the outermost
 * braces reads all three shapes. Returns null when there is no object at all,
 * which is the only case that is genuinely a failed scan.
 */
export function parseExtractReply(rawText: string): Record<string, unknown> | null {
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(rawText.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
