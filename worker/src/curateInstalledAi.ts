import { parseExtractReply } from './extractImageReply';
/** Tea previews can use the Workers AI binding already installed on this worker.
 * No key is copied into the browser, and model output still passes each task's
 * existing evidence/field validator before it becomes a reviewable proposal.
 *
 * Every tea preview route reads its model reply here, so a reply the model
 * wrapped in a sentence, and a single busy moment, are both handled once rather
 * than in each route. On 2026-10-08 the label scanner answered 502 once with
 * nothing to say why, and both of its 502 paths turned out to be a reply a
 * kinder reading would have read or a hiccup a retry would have cleared
 * ([extractImageReply](extractImageReply.ts)). These routes shipped on
 * 2026-10-21 with the bare `JSON.parse` and the single attempt that fix had
 * just removed, and on 2026-10-28 the description route answered 502 the same
 * way, from the same blind spot. */
export interface InstalledTeaAiEnvironment {
  AI?: { run?: (model: string, input: Record<string, unknown>) => Promise<unknown>; toMarkdown?: unknown };
}
export const INSTALLED_TEA_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const INSTALLED_TEA_TIMEOUT_MS = 20_000;

/** A spent deadline, kept apart from every other failure because it is the one
 * that must not be retried: the caller has already waited its whole budget. */
class InstalledTeaTimeoutError extends Error {
  constructor() { super('The installed tea AI took too long. Try again.'); this.name = 'InstalledTeaTimeoutError'; }
}

type InstalledRun = NonNullable<NonNullable<InstalledTeaAiEnvironment['AI']>['run']>;

async function askInstalledTea(run: InstalledRun, messages: Array<{ role: string; content: string }>, maxTokens: number): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      run(INSTALLED_TEA_MODEL, { messages, stream: false, temperature: 0, max_tokens: maxTokens, response_format: { type: 'json_object' } }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new InstalledTeaTimeoutError()), INSTALLED_TEA_TIMEOUT_MS); }),
    ]);
    if (!response || typeof response !== 'object' || !('response' in response)) throw new Error('The installed tea AI returned an incomplete response.');
    const content = (response as { response: unknown }).response;
    if (content && typeof content === 'object' && !Array.isArray(content)) return content;
    // The prompt asks for a bare object and usually gets one, but a reply
    // wrapped in a sentence or a code fence is still a good reply. Nothing that
    // holds no object at all is read, which is the only genuinely failed draft.
    const parsed = typeof content === 'string' ? parseExtractReply(content) : null;
    if (!parsed) throw new Error('The installed tea AI returned an incomplete response.');
    return parsed;
  } finally { if (timer) clearTimeout(timer); }
}

export async function installedTeaJson(env: InstalledTeaAiEnvironment, messages: Array<{ role: string; content: string }>, maxTokens: number): Promise<unknown> {
  const run = env.AI?.run;
  if (typeof run !== 'function') throw new Error('The installed tea AI connection is unavailable.');
  try {
    return await askInstalledTea(run, messages, maxTokens);
  } catch (error) {
    // One more attempt, because a busy model or one unusable reply is a hiccup
    // and not a failed draft. Exactly one: a second refusal is the model's
    // answer, and the route then says so instead of asking all afternoon.
    if (error instanceof InstalledTeaTimeoutError) throw error;
    return askInstalledTea(run, messages, maxTokens);
  }
}
