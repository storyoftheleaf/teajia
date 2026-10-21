import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareTeaDescriptionInput, proposeTeaDescription, validateTeaDescriptionDraft } from '../src/curateTeaDescription';

const input = { facts: { name: 'Cloud Peak', type: 'Sheng', year: 2024, originRegion: 'Yiwu' }, sources: [{ id: 'voice-1', title: 'Adrian at the table', text: 'I noticed a clean mineral finish. These leaves were harvested in spring.' }] };
const supported = { paragraphs: [{ text: 'A spring tea with a clean mineral finish.', citations: [{ sourceId: 'voice-1', quote: 'I noticed a clean mineral finish.' }, { sourceId: 'voice-1', quote: 'These leaves were harvested in spring.' }] }] };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('source-grounded tea description drafts', () => {
  it('preserves selected source text and makes public canonical facts a citable source', () => {
    const prepared = prepareTeaDescriptionInput({ ...input, facts: { ...input.facts, vendor_name: 'Private supplier', cost_amount: 99 } });
    expect(prepared.sources[0]).toEqual(input.sources[0]);
    const facts = prepared.sources.find(source => source.id === 'tea-record')!;
    expect(facts.text).toContain('Yiwu');
    expect(facts.text).not.toContain('Private supplier');
    expect(facts.text).not.toContain('99');
    const result = validateTeaDescriptionDraft({ paragraphs: [{ text: 'A 2024 Sheng from Yiwu.', citations: [{ sourceId: 'tea-record', quote: 'originRegion: Yiwu' }] }] }, prepared);
    expect(result.description).toBe('A 2024 Sheng from Yiwu.');
  });
  it('returns editable prose with exact citations and paragraph associations', () => {
    const result = validateTeaDescriptionDraft(supported, prepareTeaDescriptionInput(input));
    expect(result.description).toBe(supported.paragraphs[0].text);
    expect(result.citations).toEqual(supported.paragraphs[0].citations);
    expect(result.paragraphs[0].citations).toHaveLength(2);
  });
  it.each([
    { paragraphs: [{ text: 'Unsupported description.', citations: [] }] },
    { paragraphs: [{ text: 'A tea.', citations: [{ sourceId: 'absent', quote: 'invented' }] }] },
    { paragraphs: [{ text: 'A tea.', citations: [{ sourceId: 'voice-1', quote: 'a magical century-old tree' }] }] },
    { paragraphs: [{ text: 'A tea.', citations: [{ sourceId: 'voice-1', quote: '' }] }] },
    { paragraphs: [{ text: 'A sourced paragraph.', citations: supported.paragraphs[0].citations }, { text: 'An uncited claim.', citations: [] }] },
    { description: 'A malformed free-text answer.' },
    { paragraphs: 'not an array' },
  ])('refuses malformed or uncited provider output %#', raw => {
    expect(() => validateTeaDescriptionDraft(raw, prepareTeaDescriptionInput(input))).toThrow();
  });
  it('rejects source count, total text limit, reserved/duplicate source identities and absent evidence before a provider call', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const examples = [
      { ...input, sources: Array.from({ length: 13 }, (_, index) => ({ ...input.sources[0], id: String(index) })) },
      { facts: {}, sources: [{ id: 'long', title: 'Long talk', text: 'x'.repeat(12001) }] },
      { ...input, sources: [input.sources[0], input.sources[0]] },
      { ...input, sources: [{ ...input.sources[0], id: 'tea-record' }] },
      { facts: {}, sources: [] },
    ];
    for (const example of examples) await expect(proposeTeaDescription({ GROQ_API_KEY: 'test' }, example)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not silently shorten material at the size limit', () => {
    const text = 'x'.repeat(12000);
    const prepared = prepareTeaDescriptionInput({ facts: {}, sources: [{ id: 'talk', title: 'Talk', text }] });
    expect(prepared.sources[0].text).toBe(text);
  });
  it('reports missing configuration before any fetch', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(proposeTeaDescription({}, input)).rejects.toMatchObject({ status: 503, code: 'description_provider_unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('calls the existing provider with a JSON response contract and returns a proposal without writing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(supported) } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await proposeTeaDescription({ GROQ_API_KEY: 'test-key', CURATE_IMPORT_FALLBACK_MODEL: 'configured-model' }, input);
    expect(result.description).toContain('mineral finish');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    const request = JSON.parse(options.body);
    expect(request.model).toBe('configured-model');
    expect(request.response_format).toEqual({ type: 'json_object' });
    expect(request.messages[0].content).toContain('Never invent');
    expect(request.messages[1].content).toContain(input.sources[0].text);
  });
  it.each([429, 500])('reports provider status %s without reflecting upstream private details', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream secret details', { status })));
    await expect(proposeTeaDescription({ GROQ_API_KEY: 'test' }, input)).rejects.toMatchObject({ status: status === 429 ? 429 : 502 });
    await expect(proposeTeaDescription({ GROQ_API_KEY: 'test' }, input)).rejects.not.toThrow('upstream secret details');
  });
  it('refuses truncated/malformed responses and honest insufficient-evidence output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(supported) } }] }), { status: 200 })));
    await expect(proposeTeaDescription({ GROQ_API_KEY: 'test' }, input)).rejects.toMatchObject({ code: 'description_invalid_response' });
    expect(() => validateTeaDescriptionDraft({ insufficientEvidence: true }, prepareTeaDescriptionInput(input))).toThrow('enough supported material');
  });
});
