/**
 * The package scanner in Curate: one photo of a tea's bag, cake wrapper or
 * label goes to a vision model, which reads it (Chinese included), translates
 * it, and answers one JSON object the Curate form fills its empty fields from.
 *
 * Kept out of `index.ts` so the request each provider is sent can be checked
 * in a test without a network.
 *
 * Which model reads the photo, in order (Adrian, 2026-11-23: "We can use the
 * API for ChatGPT on this"):
 *   1. OpenAI, with the shop's own key (Account settings, the same key the
 *      photo enhancer uses). The shop pays for its own scans.
 *   2. Claude, with the worker's ANTHROPIC_API_KEY.
 *   3. Gemini, with the worker's GEMINI_API_KEY.
 * A provider that fails hands the photo to the next one, so a lapsed OpenAI key
 * does not take the scanner down while another key is set.
 *
 * Scanning spends tokens, so only the shop's owner tier may scan (see the
 * route in `index.ts`).
 */
import { isRetryableProviderStatus } from './extractImageReply';

/** Bumped here, in one line, when a newer vision model is wanted. */
export const LABEL_SCAN_OPENAI_DEFAULT_MODEL = 'gpt-5';
export const LABEL_SCAN_CLAUDE_MODEL = 'claude-sonnet-5-5';
export const LABEL_SCAN_GEMINI_MODEL = 'gemini-2.0-flash';

// Field names are the contract with the browser (parseExtractResult in
// src/components/CurateV2/PhotoCapture.tsx and its TeaCompass twin) and with
// the intake desk (src/admin/lib/intakeMapping.ts, extractedToStaged). The
// first block is the original contract; the second is what a Chinese package
// usually also carries, which lands in the tea's notes.
export const LABEL_SCAN_PROMPT = `You are reading the packaging of a tea for a professional tea shop. The photo may be a bag, a cake wrapper (neifei, wrapper or ticket), a tin, a box, a label, a menu or a price tag. Most labels are in Chinese (simplified or traditional); some are Japanese, Korean, Thai or Vietnamese.

Read every piece of printed and handwritten text you can see, including small print, stamps and dates. Translate it to English. Then return ONLY one valid JSON object with these fields, leaving out any you cannot determine from the photo (never guess a field that is not supported by what is visible):
{
  "givenName": "The tea's name in English (translate; keep well known names in pinyin, e.g. Lao Ban Zhang, Dan Cong, Tie Guan Yin)",
  "chineseName": "The tea's name in the original characters, exactly as printed",
  "productName": "Cultivar or botanical name if identifiable (e.g. Da Hong Pao, Rou Gui, Jin Xuan)",
  "type": "One of: Green, Yellow, White, Oolong, Red, Dark, Sheng, Shou, Herbal, Teaware, Misc. Red means what China calls black tea (红茶). Raw pu-erh (生茶) is Sheng, ripe pu-erh (熟茶) is Shou, other heicha is Dark.",
  "form": "One of: Loose, Cake, Tuo, Brick, Rolled, Ball, Powder, Bag, Other",
  "year": 2024,
  "season": "One of: Spring, Summer, Autumn, Winter, if the harvest season is stated (春茶 is Spring, 秋茶 is Autumn, 冬片 is Winter)",
  "originCountry": "Country of origin",
  "originRegion": "Most specific place printed: province, county, mountain or village",
  "vendor": "Brand, factory or producer name, in English with the characters after it",
  "costAmount": 0,
  "costCurrency": "One of: USD, NT, Yuan, IDR, JPY, MYR, HKD, UNK",
  "quantityPurchased": 0,
  "productionDate": "Production or pressing date exactly as printed, then as YYYY-MM-DD if it can be read (生产日期)",
  "harvestDate": "Harvest or picking date if printed separately from the production date",
  "shelfLife": "Shelf life as printed, in English (保质期)",
  "storage": "Storage instructions, in English (贮存条件)",
  "brewing": "Brewing instructions, in English: grams, water temperature, steep times",
  "elevation": "Elevation if printed",
  "farm": "Farm, garden or estate if printed",
  "awards": "Awards or competition results if printed",
  "descriptors": ["Every descriptive word or phrase on the package, each translated to English with the original after it, e.g. 'ancient tree (古树)', 'honey aroma (蜜香)', 'hand-picked (手工采摘)'. Include grade, character, taste, aroma, processing, tree age and marketing words. Leave none out."],
  "grade": "Grade or quality level if printed (特级 is Special Grade, 一级 is First Grade)",
  "processing": "How it was made, if printed (e.g. charcoal roasted, sun dried, stone pressed)",
  "flavor": "Taste words on the package, in English",
  "aroma": "Aroma words on the package, in English",
  "standard": "Product standard or licence number if printed (e.g. GB/T 22111, SC number)",
  "labelTranslation": "Every line of text on the package, each as: original text = English translation, separated by ' | '",
  "description": "One or two plain sentences describing the tea from what the package says",
  "notes": "Anything else useful from the photo that has no field above"
}

Rules:
- "year" is the harvest year, or the production year when only that is printed. A Chinese date like 2023年4月 or 20230415 is year 2023. A Minguo date (民国112年 or 112年) is that number plus 1911.
- Translate all non-English text for givenName, description and every English field; keep chineseName in the original characters.
- costAmount is the numeric price only if one is visible; quantityPurchased is the net weight in grams only if visible (净含量 357g gives 357; 1斤 is 500 grams, 1两 is 50 grams).
- A price like "NT$300" is costAmount 300 with costCurrency "NT"; ¥ or 元 on a mainland package is "Yuan".
- Nothing descriptive may be dropped: every adjective or descriptive phrase on the package belongs in descriptors, even if it also fits another field.
- Return ONLY the JSON object, with no markdown fence and no explanation.`;

export type LabelScanProvider =
  | { kind: 'openai'; apiKey: string; model: string }
  | { kind: 'claude'; apiKey: string; model: string }
  | { kind: 'gemini'; apiKey: string; model: string };

export interface LabelScanImage {
  base64: string;
  mimeType: string;
}

export interface LabelScanKeys {
  /** The shop's own OpenAI key, already decrypted. */
  openaiKey?: string | null;
  openaiModel?: string | null;
  anthropicKey?: string | null;
  geminiKey?: string | null;
}

/** The providers to try, in order. Empty means the scanner has nothing to call. */
export function labelScanProviders(keys: LabelScanKeys): LabelScanProvider[] {
  const providers: LabelScanProvider[] = [];
  if (keys.openaiKey) {
    providers.push({ kind: 'openai', apiKey: keys.openaiKey, model: keys.openaiModel?.trim() || LABEL_SCAN_OPENAI_DEFAULT_MODEL });
  }
  if (keys.anthropicKey) providers.push({ kind: 'claude', apiKey: keys.anthropicKey, model: LABEL_SCAN_CLAUDE_MODEL });
  if (keys.geminiKey) providers.push({ kind: 'gemini', apiKey: keys.geminiKey, model: LABEL_SCAN_GEMINI_MODEL });
  return providers;
}

/** The exact request one provider is sent. */
export function labelScanRequest(provider: LabelScanProvider, image: LabelScanImage): { url: string; init: RequestInit } {
  if (provider.kind === 'openai') {
    // Chat Completions with an inline image. The GPT-5 family is a reasoning
    // model: it takes max_completion_tokens (not max_tokens) and no
    // temperature, and reasoning is paid out of that budget, so it is kept low.
    const isReasoning = /^(gpt-5|o\d)/.test(provider.model);
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      init: {
        method: 'POST',
        headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: provider.model,
          ...(isReasoning ? { reasoning_effort: 'low', max_completion_tokens: 8000 } : { max_tokens: 4096, temperature: 0.1 }),
          response_format: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: LABEL_SCAN_PROMPT },
              { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}`, detail: 'high' } },
            ],
          }],
        }),
      },
    };
  }
  if (provider.kind === 'claude') {
    // Plain fetch, no SDK (keep the worker bundle lean). Thinking is off:
    // thinking is paid out of max_tokens, so a long think could leave no room
    // for the JSON. The Claude 5 family also refuses `temperature`.
    return {
      url: 'https://api.anthropic.com/v1/messages',
      init: {
        method: 'POST',
        headers: { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 4096,
          thinking: { type: 'disabled' },
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
              { type: 'text', text: LABEL_SCAN_PROMPT },
            ],
          }],
        }),
      },
    };
  }
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: LABEL_SCAN_PROMPT }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    },
  };
}

/** The model's text out of one provider's answer. */
export function labelScanReplyText(provider: LabelScanProvider, data: any): string {
  if (provider.kind === 'openai') {
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : '';
  }
  if (provider.kind === 'claude') {
    return data?.content?.find((b: any) => b?.type === 'text')?.text || '';
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export type LabelScanOutcome =
  | { ok: true; text: string; provider: LabelScanProvider['kind'] }
  | { ok: false; error: 'no_ai_provider' | 'provider_error' };

/**
 * Ask each provider in turn, once more after a busy answer, until one replies.
 * Upstream detail is logged and never sent back to the browser (it could name
 * the key's account or echo the request).
 */
export async function scanLabel(
  providers: LabelScanProvider[],
  image: LabelScanImage,
  fetcher: typeof fetch = fetch,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<LabelScanOutcome> {
  if (providers.length === 0) return { ok: false, error: 'no_ai_provider' };
  for (const provider of providers) {
    const { url, init } = labelScanRequest(provider, image);
    try {
      let res = await fetcher(url, init);
      if (!res.ok && isRetryableProviderStatus(res.status)) {
        console.warn(`label scan: ${provider.kind} answered ${res.status}; retrying once`);
        await pause(1500);
        res = await fetcher(url, init);
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error(`label scan: ${provider.kind} upstream error ${res.status}: ${detail.slice(0, 500)}`);
        continue;
      }
      const text = labelScanReplyText(provider, await res.json());
      if (text) return { ok: true, text, provider: provider.kind };
      console.error(`label scan: ${provider.kind} answered with no text`);
    } catch (err) {
      console.error(`label scan: ${provider.kind} request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { ok: false, error: 'provider_error' };
}
