/**
 * A sample becoming a tea on the shelf, and the one thing it cannot bring.
 *
 * A sample record holds a name, a weight and who it came from. It holds nothing
 * about what was paid, because nothing was: a sample arrives in a padded
 * envelope. Graduating one used to send `cost_amount: 0, cost_currency: 'NT'`,
 * which is two inventions at once, a free tea priced in Taiwan dollars nobody
 * chose, and the shelf then sold it at zero times three.
 *
 * Sending nothing instead is honest, and the server refuses it by name, which
 * is correct and also means every graduation fails. A rule that refuses
 * everything has not been enforced, it has been switched off, and the operator
 * is left with an error where a question belongs. So the screen ASKS, once, at
 * the moment it needs the answer, and only when it does not already have it.
 *
 * The functions live out here rather than in the component so a test can call
 * them: what a graduation sends is the whole point of the rule, and a scan of
 * the component's source cannot tell you.
 */

import type { TeaCompassEntry } from '../components/TeaCompass/types';
import { compassEntryToProductDraft } from '../components/TeaCompass/types';
import type { TeaSample } from './types';

/** What the operator answered, in the prompt, before the tea was added. */
export interface GraduationCost {
  /** Zero is an answer: a vendor's gift is a real tea. Null is not. */
  amount: number | null;
  currency: string;
}

/**
 * Yuan, when nothing else is known.
 *
 * Adrian's rule of 2026-09-07: everything is bought and air-freighted from
 * China, that is the default for the whole shelf, and he adjusts the few that
 * differ himself. It is the default the PROMPT opens on, in a picker he is
 * looking at, never a value written behind him.
 */
export const GRADUATION_FALLBACK_CURRENCY = 'Yuan';

/** What the compass entry recorded, if the operator recorded anything. */
export function entryRecordedPrice(entry: TeaCompassEntry | null | undefined): number | null {
  if (!entry) return null;
  return entry.buyTotal ?? entry.priceAmount ?? null;
}

/**
 * Does this graduation already know what the tea cost?
 *
 * When it does, the prompt is skipped: asking again for a figure already on the
 * capture card is a question the system could have answered itself, which is
 * the failure this whole prompt exists to avoid repeating in the other
 * direction.
 */
export function graduationNeedsCost(entry: TeaCompassEntry | null | undefined): boolean {
  return entryRecordedPrice(entry) === null;
}

/**
 * Which currency the prompt opens on.
 *
 * The entry's own currency when the operator actually chose it, and Yuan
 * otherwise. `createEmptyEntry` stamps every new entry `NT`, so the stored
 * value alone cannot tell a choice from a default; `touchedFields` is this
 * codebase's existing answer to exactly that question, and the reason it exists
 * is the sentence in `teaCompassStore`: inherited defaults never become
 * content. A sample added in this screen never passes the capture card's
 * currency picker, so its `NT` is inherited, and opening the prompt on it would
 * present a guess as a recorded fact.
 */
export function graduationCurrencyDefault(entry: TeaCompassEntry | null | undefined): string {
  if (!entry) return GRADUATION_FALLBACK_CURRENCY;
  const chose = Array.isArray(entry.touchedFields) && entry.touchedFields.includes('priceCurrency');
  return chose && entry.priceCurrency ? entry.priceCurrency : GRADUATION_FALLBACK_CURRENCY;
}

/**
 * The draft product a graduation sends.
 *
 * With a compass entry, the entry's own draft, since that carries the tasting,
 * the vendor and the price if one was recorded. Without one, the sample's own
 * fields; a sample whose entry has gone missing is still a tea Adrian holds.
 *
 * `cost` overrides either, and only when it was answered. A typed 0 overrides,
 * because zero is an answer. A null does not, because null is the absence the
 * server refuses, and writing it over a recorded price would lose the price.
 */
export function graduationPayload(
  sample: TeaSample,
  entry: TeaCompassEntry | null | undefined,
  cost: GraduationCost | null,
): Record<string, unknown> {
  const draft: Record<string, unknown> = entry
    ? compassEntryToProductDraft(entry)
    : {
        given_name: sample.name,
        chinese_name: sample.chineseName || '',
        product_name: sample.name,
        type: sample.type || 'Misc',
        year: sample.year || null,
        origin_region: sample.originRegion || '',
        vendor: sample.sourceName || '',
        status: 'Draft',
        is_public: false,
        is_personal: false,
        can_reorder: true,
        stock_grams: 0,
        source_compass_entry_id: sample.compassEntryId || null,
        tea_key: sample.teaKey || null,
      };

  if (cost && cost.amount !== null) {
    draft.cost_amount = cost.amount;
    draft.cost_currency = cost.currency;
  }
  return draft;
}
