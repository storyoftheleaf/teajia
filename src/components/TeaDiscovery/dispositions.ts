import type { Disposition, TeaDiscoveryAnswers } from './types';

/* ───────────────────────────────────────────────────────────────────────────
   Tea dispositions — the "mirror" handed back on the results screen.
   These are mirrors, not horoscopes: every line is traceable to the answers
   that produce it. Copy is easy to tune here without touching logic.
   ─────────────────────────────────────────────────────────────────────────── */

export const DISPOSITIONS: Record<string, Disposition> = {
  quietSteeper: {
    id: 'quietSteeper',
    name: 'The Contemplative',
    description:
      'Tea is your stillness — a cup is a small act of slowing the day. ' +
      'The leaves are reason enough to sit, alone with the steam.',
  },
  host: {
    id: 'host',
    name: 'The Host',
    description:
      'Tea, for you, is something you pour for others. The cup is a reason to gather, ' +
      'to talk, to keep someone a little longer at the table.',
  },
  flavorSeeker: {
    id: 'flavorSeeker',
    name: 'The Connoisseur',
    description:
      'You taste your way through tea — the floral, the roasted, the aged. ' +
      'Each cup is a question about what the leaf can do.',
  },
  dailyDrinker: {
    id: 'dailyDrinker',
    name: 'The Constant',
    description:
      'Tea is woven through your day — for focus, for steadiness, for its rhythm. ' +
      'Not a ceremony so much as a constant, from the first cup onward.',
  },
  curiousBeginner: {
    id: 'curiousBeginner',
    name: 'The Newcomer',
    description:
      'You are at the threshold, and glad to step through. There is no wrong way in — ' +
      'only the next cup, and a little more to notice each time.',
  },
  deepDiver: {
    id: 'deepDiver',
    name: 'The Devotee',
    description:
      'Tea has become a practice for you — gongfu, aged cakes, the long view. ' +
      'No longer simply a drink, but something you keep refining.',
  },
};

const asArray = (v: string | string[] | undefined): string[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

/**
 * Resolve a disposition from the dominant signal — mainly temperament (Q4) ⨯
 * motivation (Q5), nuanced by experience (Q1). Order matters: stronger, more
 * specific signals are checked first; beginners fall through to a gentle
 * default only if nothing more specific fits.
 */
export function deriveDisposition(answers: TeaDiscoveryAnswers): Disposition {
  const experience = answers.experience as string | undefined;
  const temperament = answers.temperament as string | undefined;
  const motivations = asArray(answers.motivation);

  // The deepest practitioners get the truest name regardless of the rest.
  if (experience === 'deep') return DISPOSITIONS.deepDiver;

  if (temperament === 'solo' && motivations.includes('stillness')) return DISPOSITIONS.quietSteeper;
  if (temperament === 'group' || motivations.includes('connection')) return DISPOSITIONS.host;
  if (motivations.includes('flavor')) return DISPOSITIONS.flavorSeeker;
  if (motivations.includes('energy')) return DISPOSITIONS.dailyDrinker;
  if (motivations.includes('stillness') || motivations.includes('calm')) return DISPOSITIONS.quietSteeper;

  // Newcomers with no strong pull yet — meet them where they are.
  if (experience === 'bags' || experience === 'coffee') return DISPOSITIONS.curiousBeginner;

  // Loose-leaf brewers without a dominant motivation lean toward the leaf itself.
  return DISPOSITIONS.flavorSeeker;
}
