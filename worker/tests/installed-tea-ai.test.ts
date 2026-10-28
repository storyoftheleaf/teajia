import { describe, expect, it, vi } from 'vitest';
import { installedTeaJson, INSTALLED_TEA_MODEL } from '../src/curateInstalledAi';
import { fileSaid } from '../src/curateSaidFiling';
import { proposeTeaDescription, teaDescriptionSchema } from '../src/curateTeaDescription';
const passage = 'The supplier describes this Shuixian as over thirty years old.';
const input = { facts: {}, sources: [{ id: 'talk-1', title: 'Shop conversation', text: passage }] };
describe('tea previews use the existing installed AI binding without a Groq key', () => {
 it('files the actual source through the existing field validator without any network key', async () => {
  const run = vi.fn().mockResolvedValue({ response: JSON.stringify({ parts: [{ kind: 'tea', text: 'Shuixian', fields: { name: 'Shuixian', year: 'invented' } }] }) });
  const parts = await fileSaid({ AI: { run } }, passage, 'Shuixian');
  expect(run).toHaveBeenCalledWith(INSTALLED_TEA_MODEL, expect.objectContaining({ max_tokens: 1024, stream: false, response_format: { type: 'json_object' }, messages: [expect.objectContaining({ content: expect.stringContaining(passage) })] }));
  expect(parts[0].fields.year).toBeUndefined();
 });
 it('returns a description only with exact source citations', async () => {
  const run = vi.fn().mockResolvedValue({ response: { paragraphs: [{ text: 'A Shuixian described by its supplier as over thirty years old.', citations: [{ sourceId: 'talk-1', quote: passage }] }] } });
  const result = await proposeTeaDescription({ AI: { run } }, input);
  expect(result.citations).toEqual([{ sourceId: 'talk-1', quote: passage }]);
  expect(result.description).toContain('described by its supplier');
  expect(run).toHaveBeenCalledWith(INSTALLED_TEA_MODEL, expect.objectContaining({ response_format: { type: 'json_schema', json_schema: teaDescriptionSchema(['talk-1']) } }));
 });
 it('rejects fabricated citations from the installed provider too', async () => {
  const run = vi.fn().mockResolvedValue({ response: JSON.stringify({ paragraphs: [{ text: 'Invented.', citations: [{ sourceId: 'talk-1', quote: 'invented evidence' }] }] }) });
  await expect(proposeTeaDescription({ AI: { run } }, input)).rejects.toMatchObject({ code: 'description_invalid_response' });
 });
 it('fails closed for malformed or missing installed AI output', async () => {
  await expect(installedTeaJson({ AI: { run: vi.fn().mockResolvedValue({ response: 'not JSON' }) } }, [], 100)).rejects.toThrow();
  await expect(installedTeaJson({}, [], 100)).rejects.toThrow('unavailable');
 });
 it('bounds inference time and clears its timer', async () => {
  vi.useFakeTimers();
  try {
   const result = installedTeaJson({ AI: { run: () => new Promise(() => {}) } }, [], 100);
   const assertion = expect(result).rejects.toThrow('too long');
   await vi.advanceTimersByTimeAsync(20_000); await assertion;
   expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
 });
 it('allows the working-material caller 40 seconds without changing the default deadline', async () => {
  vi.useFakeTimers();
  try {
   const result = installedTeaJson({ AI: { run: () => new Promise(resolve => setTimeout(() => resolve({ response: { notes: [] } }), 24_500)) } }, [], 2600, { type: 'object' }, 40_000);
   await vi.advanceTimersByTimeAsync(24_500);
   await expect(result).resolves.toEqual({ notes: [] });
   expect(vi.getTimerCount()).toBe(0);
   await expect(installedTeaJson({ AI: { run: vi.fn() } }, [], 100, undefined, 40_001)).rejects.toThrow('bounded');
  } finally { vi.useRealTimers(); }
 });
 it('still refuses a working-material request at its bounded 40-second deadline', async () => {
  vi.useFakeTimers();
  try {
   const result = installedTeaJson({ AI: { run: () => new Promise(() => {}) } }, [], 2600, { type: 'object' }, 40_000);
   const assertion = expect(result).rejects.toThrow('too long');
   await vi.advanceTimersByTimeAsync(40_000);
   await assertion;
   expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
 });
});
