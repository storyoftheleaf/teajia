import type { ComponentType } from 'react';

/**
 * Axis 2: how far into the practice someone is. Gates content depth today,
 * feeds matching in Phase 2. `devoted` is *conferred*, not self-claimed or
 * counted up to: a member tells us they're new or practicing, but standing as a
 * devoted practitioner is granted (Adrian knows them, or they contribute), the
 * one gate in the whole model, so a beginner can never click their way into it.
 */
export type DiscoveryLevel = 'curious' | 'practicing' | 'devoted';

/** Visual treatment for a question's options. */
export type DiscoveryDisplay = 'text' | 'icon' | 'swatch';

export interface DiscoveryOption {
  id: string;
  label: string;
  /** Maps an answer to an experience level (Q1 only). */
  level?: DiscoveryLevel;
  /** Effect/motivation tag (Q5), forward-compatible with the taster "Effect" zone. */
  effect?: string;
  /** Plain-language explainer revealed by the non-blocking "What's this?" toggle. */
  learnMore?: string;
  /** CSS color for swatch-style options (Q3). */
  swatch?: string;
  /** Inline line-illustration for picture options (Q2). */
  icon?: ComponentType<{ className?: string }>;
  /** Reserved slot for future real photography. Unused in v1. */
  image?: string;
}

export interface DiscoveryQuestion {
  id: string;
  prompt: string;
  helper?: string;
  multiSelect?: boolean;
  display: DiscoveryDisplay;
  options: DiscoveryOption[];
}

/**
 * Axis 1: a "thread": a reason someone comes to tea. Not a box you fall into;
 * threads stack, so a member can hold several at once. The three (Stillness /
 * Connection / Quality) each point at a different shelf, which is the whole job:
 * they're how Teajia knows what to put in front of someone, not a label to wear.
 */
export interface Thread {
  id: string;
  name: string;
  description: string;
}

/** Map of question id -> selected option id (single) or option ids (multi-select). */
export type TeaDiscoveryAnswers = Record<string, string | string[]>;

export interface TeaDiscoveryProfile {
  answers: TeaDiscoveryAnswers;
  /** Axis 2: where they are in the practice (curious → practicing → devoted). */
  level: DiscoveryLevel;
  /** Axis 1: the threads that draw them (any of Stillness / Connection / Quality). */
  threadIds: string[];
  /** ISO timestamp, when the profile was last completed. */
  completedAt: string;
}
