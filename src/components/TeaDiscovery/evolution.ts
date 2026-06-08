import type { CustomerTasting } from '../../types';
import type { DiscoveryLevel, TeaDiscoveryProfile } from './types';
import { deriveDisposition } from './dispositions';

/* ───────────────────────────────────────────────────────────────────────────
   Evolution loop — the profile deepens from observed behaviour, not points.
   The disposition someone *chose* (the quiz) is their stated identity and never
   gets overwritten. This derives a parallel *observed palate* from the synced
   tasting journal that (a) shows growth, (b) sharpens recommendations, and
   (c) gently flags drift from what they first told us. No streaks, no scores.
   ─────────────────────────────────────────────────────────────────────────── */

export type FlavorFamily = 'light' | 'roasted' | 'deep';

export interface ObservedPalate {
  tastingCount: number;
  /** The 1–2 most-logged tea types, e.g. ['Oolong', 'Puerh']. */
  topTypes: string[];
  /** Which quiz flavor family their logged teas lean toward, if any. */
  flavorLean: FlavorFamily | null;
  /** Enough signal to say anything honestly (≥ 3 tastings). */
  hasEnoughSignal: boolean;
}

/** Map a tea-type string to one of the quiz's three flavor families. */
export function familyForType(type: string): FlavorFamily | null {
  const t = type.toLowerCase();
  if (/(pu.?erh|puer|sheng|shou|dark|hei|liu.?bao|fu.?brick)/.test(t)) return 'deep';
  if (/(green|white|yellow|sencha|gyokuro|long.?jing|silver.?needle|mao.?feng)/.test(t)) return 'light';
  if (/(oolong|wulong|black|red.?tea|hong|roast|dan.?cong|yan|rock|tieguanyin)/.test(t)) return 'roasted';
  return null;
}

export function observePalate(journal: CustomerTasting[]): ObservedPalate {
  const active = journal.filter((e) => !e.archived && e.productType);

  const typeCounts = new Map<string, number>();
  const familyCounts: Record<FlavorFamily, number> = { light: 0, roasted: 0, deep: 0 };

  for (const entry of active) {
    const type = entry.productType as string;
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    const fam = familyForType(type);
    if (fam) familyCounts[fam] += 1;
  }

  const topTypes = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type]) => type);

  const leadingFamily = (Object.entries(familyCounts) as [FlavorFamily, number][])
    .sort((a, b) => b[1] - a[1])[0];
  const flavorLean = leadingFamily && leadingFamily[1] > 0 ? leadingFamily[0] : null;

  return {
    tastingCount: active.length,
    topTypes,
    flavorLean,
    hasEnoughSignal: active.length >= 3,
  };
}

/** How many tastings carry real substance — a personal note or flavor terms. */
export function noteRichness(journal: CustomerTasting[]): number {
  return journal.filter((e) => {
    if (e.archived) return false;
    const note: any = e.note;
    const hasPersonal = !!(note && typeof note === 'object' && note.personalNote);
    const flavorCount = note?.tasting?.flavor?.length ?? 0;
    return hasPersonal || flavorCount > 0;
  }).length;
}

/* ───────────────────────────────────────────────────────────────────────────
   Learned disposition — behaviour SUGGESTS, it never silently rewrites.
   The only thing the journal can honestly tell us about disposition is depth of
   practice (volume of tastings), so the suggestion is a level bump and, at the
   top of the ladder, surfacing "The Deep Diver". The member must explicitly
   adopt it. Temperament/motivation aren't observable, so we never fabricate
   those-driven disposition changes here — flavor drift stays a "refresh" nudge.
   ─────────────────────────────────────────────────────────────────────────── */

const LEVEL_ORDER: Record<DiscoveryLevel, number> = { curious: 0, practicing: 1, devoted: 2 };

/** Map tasting volume to the level it would imply on its own. */
function levelFromVolume(count: number): DiscoveryLevel {
  if (count >= 20) return 'devoted';
  if (count >= 8) return 'practicing';
  return 'curious';
}

export interface EvolutionSuggestion {
  level: DiscoveryLevel;
  dispositionId: string;
  reason: string;
}

/** Behaviour we can honestly observe elsewhere in Teajia, beyond the journal. */
export interface EvolutionSignals {
  /** Group sessions attended (api.me.journey) — evidence of a social temperament. */
  sessionsAttended?: number;
  /** Tastings with real notes — evidence of a flavor & craft motivation. */
  noteRichness?: number;
}

function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * Returns a suggested (level, disposition) when accumulated practice has clearly
 * outgrown the stated profile — or null when nothing meaningful has changed.
 * Caller surfaces it as an opt-in ("Adopt this"); it is never auto-applied.
 *
 * Only re-derives from dimensions we can honestly observe:
 *  - depth (tasting volume) → level, and The Deep Diver at the top;
 *  - group sessions → a social temperament (The Host);
 *  - rich tasting notes → a flavor & craft motivation (The Flavor Seeker).
 * Temperament/motivation we can't see are left to the "still true?" re-ask.
 */
export function suggestEvolution(
  profile: TeaDiscoveryProfile,
  observed: ObservedPalate,
  signals: EvolutionSignals = {},
): EvolutionSuggestion | null {
  if (!observed.hasEnoughSignal) return null;

  const sessions = signals.sessionsAttended ?? 0;
  const richNotes = signals.noteRichness ?? 0;

  const volumeLevel = levelFromVolume(observed.tastingCount);
  const grew = LEVEL_ORDER[volumeLevel] > LEVEL_ORDER[profile.level];
  const newLevel: DiscoveryLevel = grew ? volumeLevel : profile.level;

  // Build a synthetic answer set from the evidence, then re-derive once.
  const synth = { ...profile.answers };
  if (newLevel === 'devoted') synth.experience = 'deep';

  const socialFromEvents = sessions >= 3;
  if (socialFromEvents) synth.temperament = 'group';

  const craftFromNotes = richNotes >= 4;
  if (craftFromNotes) {
    const motivs = Array.isArray(synth.motivation)
      ? [...synth.motivation]
      : synth.motivation ? [synth.motivation] : [];
    if (!motivs.includes('flavor')) motivs.push('flavor');
    synth.motivation = motivs;
  }

  const newDisposition = deriveDisposition(synth);
  const changed = newLevel !== profile.level || newDisposition.id !== profile.dispositionId;
  if (!changed) return null;

  const bits = [`logged ${observed.tastingCount} ${observed.tastingCount === 1 ? 'tea' : 'teas'}`];
  if (socialFromEvents) bits.push(`sat at ${sessions} sessions`);
  if (craftFromNotes) bits.push(`kept notes on ${richNotes}`);
  const reason = `You've ${joinWithAnd(bits)} since you started.`;

  return { level: newLevel, dispositionId: newDisposition.id, reason };
}
