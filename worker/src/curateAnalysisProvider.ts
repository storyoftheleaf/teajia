/**
 * One home for the SHAPE of the Curate import analysis request.
 *
 * The request body is model-dependent, and the dependency is not a style
 * choice: a parameter a model does not accept is a 400 on every call, so a
 * body assembled without reference to the model it is being sent to is a
 * request that either works or fails entirely, with no middle. That is
 * precisely what happened. Commit `4fb95152` (2026-07-20) added structured
 * outputs — `output_config.format` — and, in the same diff, moved the default
 * analysis model from `claude-sonnet-5` to `claude-sonnet-4-6`. Sonnet 4.6 does
 * not accept structured outputs (the supported set is the Claude 5 family plus
 * Opus 4.8, Haiku 4.5 and the 4.5/4.1 legacy models), so from that commit
 * forward EVERY `intake_analyze` request was refused with
 * `invalid_request_error`, surfaced to the operator as `analysis_provider_400`
 * and to Adrian as "We couldn't analyze this record". A two-line pasted invoice
 * failed exactly like a fifty-page one, which is the tell: the record was never
 * read.
 *
 * `temperature` is the same trap from the other side. The Claude 5 family and
 * Opus 4.7/4.8 REMOVED sampling parameters and return 400 when one is sent, so
 * simply putting the working model back without touching the `temperature: 0`
 * that rode along beside it would have swapped one permanent 400 for another.
 * Both facts therefore live in one table, read at request-build time, and
 * nowhere else.
 *
 * An unrecognised model is treated as accepting NEITHER. A plain prompt with a
 * "return one JSON object" instruction works on every model the shop could
 * plausibly set, and the decoder already reads that shape — the Groq fallback
 * has always returned it. Guessing the other way turns an unfamiliar model id
 * in `CURATE_IMPORT_ANALYSIS_MODEL` into another silent outage.
 */

export const CURATE_IMPORT_ANALYSIS_DEFAULT_MODEL = 'claude-sonnet-5';

interface AnalysisModelCapabilities {
  /** `output_config.format` — a JSON schema the provider enforces. */
  structuredOutput: boolean;
  /** `temperature` / `top_p` / `top_k`. Removed on the Claude 5 family. */
  sampling: boolean;
}

/**
 * Keyed by the model id prefix, so a dated snapshot
 * (`claude-haiku-4-5-20251001`) reads as its family.
 */
const ANALYSIS_MODEL_CAPABILITIES: ReadonlyArray<readonly [string, AnalysisModelCapabilities]> = [
  ['claude-fable-5-1', { structuredOutput: true, sampling: false }],
  ['claude-fable-5', { structuredOutput: true, sampling: false }],
  ['claude-mythos-5-1', { structuredOutput: true, sampling: false }],
  ['claude-mythos-5', { structuredOutput: true, sampling: false }],
  ['claude-opus-5', { structuredOutput: true, sampling: false }],
  ['claude-opus-4-8', { structuredOutput: true, sampling: false }],
  ['claude-opus-4-7', { structuredOutput: false, sampling: false }],
  ['claude-opus-4-6', { structuredOutput: false, sampling: true }],
  ['claude-opus-4-5', { structuredOutput: true, sampling: true }],
  ['claude-opus-4-1', { structuredOutput: true, sampling: true }],
  ['claude-sonnet-5', { structuredOutput: true, sampling: false }],
  ['claude-sonnet-4-6', { structuredOutput: false, sampling: true }],
  ['claude-haiku-4-5', { structuredOutput: true, sampling: true }],
];

const UNKNOWN_MODEL: AnalysisModelCapabilities = { structuredOutput: false, sampling: false };

export function analysisModelCapabilities(model: string): AnalysisModelCapabilities {
  const id = model.trim();
  return ANALYSIS_MODEL_CAPABILITIES.find(([prefix]) => id === prefix || id.startsWith(`${prefix}-`))?.[1] ?? UNKNOWN_MODEL;
}

/**
 * The instruction that replaces the schema when the model cannot be handed
 * one. Without it a model with no enforced format answers in prose and the
 * decoder throws, which looks like a provider fault and is not one.
 */
export const ANALYSIS_JSON_ONLY_INSTRUCTION =
  'Return ONE valid JSON object matching the requested import shape, and nothing else. No prose, no markdown fence.';

export interface AnalysisProviderRequest {
  model: string;
  maxTokens: number;
  prompt: string;
  media: Array<Record<string, unknown>>;
  schema: unknown;
}

/** The whole body, assembled in one place against one capability table. */
export function buildAnalysisProviderBody(request: AnalysisProviderRequest): Record<string, unknown> {
  const capabilities = analysisModelCapabilities(request.model);
  const prompt = capabilities.structuredOutput
    ? request.prompt
    : `${request.prompt}\n${ANALYSIS_JSON_ONLY_INSTRUCTION}`;
  return {
    model: request.model,
    max_tokens: request.maxTokens,
    ...(capabilities.sampling ? { temperature: 0 } : {}),
    ...(capabilities.structuredOutput
      ? { output_config: { format: { type: 'json_schema', schema: request.schema } } }
      : {}),
    messages: [{ role: 'user', content: [...request.media, { type: 'text', text: prompt }] }],
  };
}

/**
 * What the provider said, in a form safe to store on the draft.
 *
 * `analysis_error` is read by the operator and by whoever is debugging the
 * shop, so a bare `analysis_provider_400` is the one thing it must not be: it
 * says a request was refused without saying which part of it was wrong, and
 * four months were spent not knowing. The body is provider-shaped JSON, so the
 * type and message are taken when present and the raw text only otherwise,
 * with anything key-shaped removed either way and the whole thing bounded.
 */
export function sanitizedProviderDetail(body: string): string {
  let detail = body.trim();
  try {
    const parsed = JSON.parse(detail) as unknown;
    const error = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).error
      : null;
    const errorRecord = error && typeof error === 'object' && !Array.isArray(error) ? error as Record<string, unknown> : null;
    const type = typeof errorRecord?.type === 'string' ? errorRecord.type : null;
    const message = typeof errorRecord?.message === 'string' ? errorRecord.message : null;
    if (type || message) detail = [type, message].filter(Boolean).join(': ');
  } catch { /* not JSON: the raw text, sanitised the same way, is better than nothing */ }
  return detail
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[redacted]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

/**
 * A provider refusal carries two things that must not be merged: the CODE,
 * which the attempt log and the browser both match on, and the DETAIL, which
 * only a person reads. Joining them into one string made the code unmatchable.
 */
export class AnalysisProviderError extends Error {
  constructor(readonly code: string, readonly detail: string) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

export function analysisProviderFailure(error: unknown): { code: string; detail: string; message: string } {
  if (error instanceof AnalysisProviderError) return { code: error.code, detail: error.detail, message: error.message };
  const message = error instanceof Error ? error.message : 'analysis_provider_unavailable';
  return { code: message, detail: '', message };
}
