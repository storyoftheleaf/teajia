import type { DiscoveryLevel, DiscoveryQuestion, TeaDiscoveryAnswers } from './types';
import { deriveThreads } from './threads';
import { TeabagIcon, BowlIcon, TeapotIcon, GaiwanIcon, YixingIcon } from './VesselIcons';

/* ───────────────────────────────────────────────────────────────────────────
   Tea Discovery — the five screens. Data-driven so the flow is one map and
   future edits are config, not new components. Each option carries lightweight
   tags (level / effect) used today to derive a level + disposition, and stored
   on the profile for Phase 2 matching + the taster integration.
   ─────────────────────────────────────────────────────────────────────────── */

export const QUESTIONS: DiscoveryQuestion[] = [
  {
    id: 'experience',
    prompt: 'Where are you with tea right now?',
    helper: 'No wrong answer. Just where you actually are.',
    display: 'text',
    options: [
      { id: 'bags', label: 'I mostly drink tea bags', level: 'curious' },
      { id: 'coffee', label: "I'm a coffee person, curious about tea", level: 'curious' },
      { id: 'loose', label: 'I brew loose-leaf at home', level: 'practicing' },
      { id: 'deep', label: 'I’m deep in it: gongfu, aged cakes, the rabbit hole', level: 'devoted' },
    ],
  },
  {
    id: 'brew',
    prompt: 'How do you like to brew?',
    helper: 'Not sure what something is? Tap “What’s this?”',
    display: 'icon',
    options: [
      {
        id: 'teabag',
        label: 'Just a mug and a tea bag',
        icon: TeabagIcon,
        learnMore: 'The everyday way most of us start. A sealed bag of (usually broken) leaf, steeped once in a mug. Perfectly fine. There’s just a lot more leaf can do.',
      },
      {
        id: 'bowl',
        label: 'Straight in a bowl (grandpa style)',
        icon: BowlIcon,
        learnMore: 'Loose leaves dropped right into a bowl or tall glass, topped with water, sipped as they settle. Casual and old as the hills, “grandpa style.” No gear required.',
      },
      {
        id: 'teapot',
        label: 'A teapot (any kind)',
        icon: TeapotIcon,
        learnMore: 'A pot with a spout and a lid: porcelain, glass, or clay. Brews a larger batch to share or refill from.',
      },
      {
        id: 'gaiwan',
        label: 'A gaiwan (lidded cup)',
        icon: GaiwanIcon,
        learnMore: 'A lidded cup with a saucer, the workhorse of Chinese tea. The lid holds the leaves back as you pour, letting you brew the same leaves many short times to taste them change.',
      },
      {
        id: 'yixing',
        label: 'A clay teapot, Yixing or similar',
        icon: YixingIcon,
        learnMore: 'An unglazed clay pot from Yixing, China. Many people own one without knowing: it’s meant to brew one type of tea and season to it over the years. Not a decorative pot, and not for every tea at once.',
      },
    ],
  },
  {
    id: 'flavor',
    prompt: 'What flavors pull you in?',
    helper: 'Go with your gut. We can always surprise you later.',
    display: 'swatch',
    options: [
      { id: 'light', label: 'Light, floral, fresh: greens & whites', swatch: '#cdd6a3' },
      { id: 'roasted', label: 'Sweet, roasted, nutty: oolongs', swatch: '#c08a4a' },
      { id: 'deep', label: 'Deep, earthy, aged: puerh & dark tea', swatch: '#6b4326' },
      { id: 'unsure', label: 'Not sure yet, show me', swatch: '#8c8378' },
    ],
  },
  {
    id: 'temperament',
    prompt: 'How do you like to take your tea?',
    helper: 'The mood you reach for it in.',
    display: 'text',
    options: [
      { id: 'solo', label: 'Quiet & solo, a meditative cup' },
      { id: 'pair', label: 'One-on-one' },
      { id: 'group', label: 'Social & talkative, with a group' },
      { id: 'depends', label: 'Depends on the day' },
    ],
  },
  {
    id: 'motivation',
    prompt: 'What does tea give you?',
    helper: 'Pick as many as ring true.',
    multiSelect: true,
    display: 'text',
    options: [
      { id: 'energy', label: 'Energy & focus', effect: 'energy' },
      { id: 'stillness', label: 'Stillness & meditation', effect: 'stillness' },
      { id: 'flavor', label: 'Flavor & craft', effect: 'flavor' },
      { id: 'calm', label: 'Calm & ritual', effect: 'calm' },
      { id: 'connection', label: 'Culture & connection', effect: 'connection' },
    ],
  },
];

/** Look up an option's display label by question id + option id (for the results recap). */
export function optionLabel(questionId: string, optionId: string): string | undefined {
  return QUESTIONS.find((q) => q.id === questionId)?.options.find((o) => o.id === optionId)?.label;
}

function deriveLevel(answers: TeaDiscoveryAnswers): DiscoveryLevel {
  const experienceQ = QUESTIONS[0];
  const chosen = answers[experienceQ.id];
  const optId = Array.isArray(chosen) ? chosen[0] : chosen;
  return experienceQ.options.find((o) => o.id === optId)?.level ?? 'curious';
}

/** Pure derivation from raw answers → the profile's level (Axis 2) + threads (Axis 1). */
export function deriveProfile(answers: TeaDiscoveryAnswers): {
  level: DiscoveryLevel;
  threadIds: string[];
} {
  return { level: deriveLevel(answers), threadIds: deriveThreads(answers) };
}
