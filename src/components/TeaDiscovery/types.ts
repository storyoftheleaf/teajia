import type { ComponentType } from 'react';

/** How deep someone is in their tea practice — gates content depth today, feeds matching in Phase 2. */
export type DiscoveryLevel = 'curious' | 'practicing' | 'devoted';

/** Visual treatment for a question's options. */
export type DiscoveryDisplay = 'text' | 'icon' | 'swatch';

export interface DiscoveryOption {
  id: string;
  label: string;
  /** Maps an answer to an experience level (Q1 only). */
  level?: DiscoveryLevel;
  /** Effect/motivation tag (Q5) — forward-compatible with the taster "Effect" zone. */
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

/** A named "tea disposition" — the mirror we hand back at the end. */
export interface Disposition {
  id: string;
  name: string;
  description: string;
}

/** Map of question id -> selected option id (single) or option ids (multi-select). */
export type TeaDiscoveryAnswers = Record<string, string | string[]>;

export interface TeaDiscoveryProfile {
  answers: TeaDiscoveryAnswers;
  level: DiscoveryLevel;
  dispositionId: string;
  /** ISO timestamp — when the profile was last completed. */
  completedAt: string;
}
