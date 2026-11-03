// What the shared word library should prime Whisper with for Teajia: tea terms, places and people (Gene Keys and
// hexagram names belong to the oracle, so they are left out). Within each tier people and places come before tea terms:
// there are few of them, and a name like Lu Yu or Yixing is what a speech model is most likely to get wrong.
import type { PromptProfile } from './words';

export const TEA_WORDS_PROFILE: PromptProfile = {
  categories: ['person', 'place', 'tea-term'],
  order: 'tier-first',
  budget: 160,
};
