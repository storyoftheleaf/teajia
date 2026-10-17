import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  analysisModelCapabilities,
  ANALYSIS_JSON_ONLY_INSTRUCTION,
  AnalysisProviderError,
  analysisProviderFailure,
  buildAnalysisProviderBody,
  CURATE_IMPORT_ANALYSIS_DEFAULT_MODEL,
  sanitizedProviderDetail,
} from '../src/curateAnalysisProvider';

/**
 * The analysis request must fit the model it is sent to.
 *
 * On 2026-07-20 commit `4fb95152` added `output_config.format` and, in the
 * same diff, moved the default model from `claude-sonnet-5` to
 * `claude-sonnet-4-6`, which does not accept structured outputs. Every
 * `intake_analyze` from that commit to 2026-10-17 was refused with
 * `invalid_request_error` and surfaced as `analysis_provider_400`; a two-line
 * pasted invoice failed exactly like a fifty-page one, because the record was
 * never read. Putting the model back without touching the `temperature: 0`
 * beside it would have traded that 400 for another, since the Claude 5 family
 * removed sampling parameters.
 *
 * So the two facts live in one table and are asserted together here. A test
 * that only pinned the model would have passed on the day the outage started.
 */

const schema = { type: 'object', properties: {}, additionalProperties: false };
const body = (model: string) => buildAnalysisProviderBody({ model, maxTokens: 8192, prompt: 'READ THIS', media: [], schema });
const promptOf = (value: Record<string, any>) => value.messages[0].content.at(-1).text as string;

describe('the analysis request is built against the model it is sent to', () => {
  it('sends the shop default a schema and no temperature', () => {
    expect(analysisModelCapabilities(CURATE_IMPORT_ANALYSIS_DEFAULT_MODEL)).toEqual({ structuredOutput: true, sampling: false });
    const request = body(CURATE_IMPORT_ANALYSIS_DEFAULT_MODEL);
    expect(request.output_config).toEqual({ format: { type: 'json_schema', schema } });
    expect(request).not.toHaveProperty('temperature');
    expect(promptOf(request)).toBe('READ THIS');
  });

  it('sends the model that caused the outage no schema, and asks for JSON in words instead', () => {
    const request = body('claude-sonnet-4-6');
    expect(request).not.toHaveProperty('output_config');
    expect(request.temperature).toBe(0);
    expect(promptOf(request)).toContain(ANALYSIS_JSON_ONLY_INSTRUCTION);
  });

  it('reads a dated snapshot as its family', () => {
    expect(analysisModelCapabilities('claude-haiku-4-5-20251001')).toEqual({ structuredOutput: true, sampling: true });
  });

  it('sends an unrecognised model neither, because a refused parameter is a total outage', () => {
    const request = body('some-model-nobody-here-has-heard-of');
    expect(request).not.toHaveProperty('output_config');
    expect(request).not.toHaveProperty('temperature');
    expect(promptOf(request)).toContain(ANALYSIS_JSON_ONLY_INSTRUCTION);
  });
});

describe('what the provider said reaches the draft, and the key does not', () => {
  it('keeps the provider type and message and drops anything key-shaped', () => {
    const detail = sanitizedProviderDetail(JSON.stringify({
      type: 'error',
      error: { type: 'invalid_request_error', message: 'output_config: unsupported for this model (sk-ant-api03-aaaaaaaaaaaaaaaaaaaa)' },
    }));
    expect(detail).toContain('invalid_request_error');
    expect(detail).toContain('unsupported for this model');
    expect(detail).not.toContain('sk-ant');
  });

  it('falls back to the raw text when the body is not provider JSON, bounded and on one line', () => {
    const detail = sanitizedProviderDetail(`upstream\nsaid\nno ${'x'.repeat(400)}`);
    expect(detail.startsWith('upstream said no')).toBe(true);
    expect(detail).not.toContain('\n');
    expect(detail.length).toBeLessThanOrEqual(240);
  });

  it('keeps the code matchable while the message carries the reason', () => {
    const failure = analysisProviderFailure(new AnalysisProviderError('analysis_provider_400', 'invalid_request_error: no'));
    expect(failure.code).toBe('analysis_provider_400');
    expect(failure.message).toBe('analysis_provider_400: invalid_request_error: no');
    /* The browser decides a draft is retryable by the prefix, so the stored
       message has to keep it. src/components/CurateV2/import/importErrorMessage.ts */
    expect(failure.message.startsWith('analysis_')).toBe(true);
    expect(analysisProviderFailure(new Error('analysis_no_usable_evidence'))).toMatchObject({ code: 'analysis_no_usable_evidence', detail: '' });
  });
});

describe('the request shape has one home', () => {
  const sources = ['curateImports.ts', 'curateImportAnalysis.ts', 'index.ts', 'mcp.ts', 'curateSaidFiling.ts']
    .map(name => ({ name, text: readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8') }));

  it('builds the analysis body nowhere but the provider module', () => {
    for (const source of sources) {
      /* A second place that decides whether to send output_config or a
         temperature is a second place that can be wrong about the model, which
         is the four-freight-rates shape with an outage on the end of it. */
      expect(source.text, `${source.name} assembles its own analysis request`).not.toContain('output_config');
    }
    expect(sources.find(source => source.name === 'curateImports.ts')!.text).toContain('buildAnalysisProviderBody');
  });

  it('names no analysis model of its own outside the provider module', () => {
    const importsSource = sources.find(source => source.name === 'curateImports.ts')!.text;
    expect(importsSource).toContain('CURATE_IMPORT_ANALYSIS_DEFAULT_MODEL');
    expect(importsSource).not.toMatch(/'claude-[a-z0-9-]+'/);
  });
});
