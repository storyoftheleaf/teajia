/** Tea previews can use the Workers AI binding already installed on this worker.
 * No key is copied into the browser, and model output still passes each task's
 * existing evidence/field validator before it becomes a reviewable proposal. */
export interface InstalledTeaAiEnvironment {
  AI?: { run?: (model: string, input: Record<string, unknown>) => Promise<unknown>; toMarkdown?: unknown };
}
export const INSTALLED_TEA_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export async function installedTeaJson(env: InstalledTeaAiEnvironment, messages: Array<{ role: string; content: string }>, maxTokens: number, schema?: Record<string, unknown>, timeoutMs = 20_000): Promise<unknown> {
  if (typeof env.AI?.run !== 'function') throw new Error('The installed tea AI connection is unavailable.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 40_000) throw new Error('Choose a bounded tea AI timeout.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      env.AI.run(INSTALLED_TEA_MODEL, { messages, stream: false, temperature: 0, max_tokens: maxTokens, response_format: schema ? { type: 'json_schema', json_schema: schema } : { type: 'json_object' } }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('The installed tea AI took too long. Try again.')), timeoutMs); }),
    ]);
    if (!response || typeof response !== 'object' || !('response' in response)) throw new Error('The installed tea AI returned an incomplete response.');
    const content = (response as { response: unknown }).response;
    if (typeof content === 'string') return JSON.parse(content);
    if (content && typeof content === 'object' && !Array.isArray(content)) return content;
    throw new Error('The installed tea AI returned an incomplete response.');
  } finally { if (timer) clearTimeout(timer); }
}
