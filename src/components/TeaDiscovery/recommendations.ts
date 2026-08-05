import type { TeaDiscoveryProfile } from './types';
import type { ObservedPalate } from './evolution';

/* ───────────────────────────────────────────────────────────────────────────
   Recommendations, turn the profile into a few tailored next steps with a
   plain "why this" line. v1 routes to the section surfaces (/craft, /shop,
   journal) with personalized framing matched to level + flavor + brewing;
   per-article and per-product deep links can slot in later behind the same
   shape (see docs/TEA_DISCOVERY.md Phase 2).
   ─────────────────────────────────────────────────────────────────────────── */

export interface Recommendation {
  kind: 'learn' | 'shop' | 'practice';
  title: string;
  rationale: string;
  to: string;
}

const FLAVOR_FAMILY: Record<string, string> = {
  light: 'green & white teas',
  roasted: 'roasted oolongs',
  deep: 'puerh & dark teas',
  unsure: 'a flight across styles',
};

export function recommend(profile: TeaDiscoveryProfile, observed?: ObservedPalate): Recommendation[] {
  const recs: Recommendation[] = [];
  const statedFlavor = (profile.answers.flavor as string) || 'unsure';
  const brew = (profile.answers.brew as string) || '';

  // Once there's real signal, lead with what they actually drink, not what they
  // first guessed, this is the evolution loop reaching the recommendations.
  const fromBehavior = !!(observed?.hasEnoughSignal && observed.flavorLean);
  const flavor = fromBehavior ? (observed!.flavorLean as string) : statedFlavor;

  // 1. Learn, matched to where they are in the practice.
  if (profile.level === 'curious') {
    recs.push({
      kind: 'learn',
      title: 'Start with the foundations',
      rationale: 'The leaf, the water, and your first good cup, built for where you are now.',
      to: '/craft',
    });
  } else if (profile.level === 'practicing') {
    recs.push({
      kind: 'learn',
      title: 'Flavor & origins',
      rationale: 'You already brew at home. Go deeper into why terroir and processing taste the way they do.',
      to: '/craft',
    });
  } else {
    recs.push({
      kind: 'learn',
      title: 'The deeper craft',
      rationale: 'Ceremony, aging, and the long view, for a practice that’s already serious.',
      to: '/craft',
    });
  }

  // 2. Shop, matched to their flavor leaning (observed if we have it, else stated).
  const family = FLAVOR_FAMILY[flavor] ?? FLAVOR_FAMILY.unsure;
  recs.push({
    kind: 'shop',
    title: `Teas to try: ${family}`,
    rationale: fromBehavior
      ? 'Based on what you’ve been drinking lately.'
      : flavor === 'unsure'
        ? 'Not sure yet? Start broad and let your palate decide.'
        : `Because you’re drawn to ${family}.`,
    to: '/shop',
  });

  // 3. Practice, ties into the deepening loop; framed by how they brew today.
  recs.push({
    kind: 'practice',
    title: 'Begin a tasting journal',
    rationale: brew === 'teabag' || brew === 'bowl'
      ? 'A simple way to start noticing what’s really in the cup.'
      : 'Keep a record as your palate sharpens. Your profile deepens from it.',
    to: '/account/journal',
  });

  return recs;
}
