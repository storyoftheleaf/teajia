import type { TastingData } from '../types';
import type { Currency } from '../admin/types';
import type { TeaType, TeaForm, VendorDetails } from '../components/TeaCompass/types';

export type SampleStatus = 'untasted' | 'tasted' | 'favorite' | 'ordering' | 'ordered' | 'passed';
export type SampleSetPurpose = 'sourcing' | 'customer-gifted' | 'event';
export type TastingVerdict = 'love' | 'like' | 'neutral' | 'pass';

export interface SampleTasting {
  id: string;
  tasterId: string;           // 'admin' or customer token/id
  tasterName?: string;
  tasting: TastingData;
  rating?: number;            // 1-10
  verdict: TastingVerdict;
  wouldBuy: boolean;
  personalNote?: string;
  createdAt: string;
}

export interface TeaSample {
  id: string;

  // Identity (printed on label — NO source info)
  name: string;
  chineseName?: string;
  type?: TeaType;
  form?: TeaForm;
  year?: number;
  originRegion?: string;

  // Source (internal only — NEVER on labels)
  sourceId?: string;
  sourceName?: string;
  sourceContact?: VendorDetails;

  // Linkages
  productId?: string;          // If maps to existing inventory item
  compassEntryId?: string;     // If captured via Tea Compass

  // Set grouping
  setId: string;

  // Tasting
  tastings: SampleTasting[];

  // Status
  status: SampleStatus;
  grams: number;              // Amount in sample bag (5-15g typical)

  // Meta
  notes?: string;             // Admin private notes
  photos: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: 'admin' | 'customer';
  synced: boolean;
}

export interface SampleSet {
  id: string;
  name: string;               // "March 2026 — Wuyi trip"
  sourceId?: string;
  sourceName?: string;
  sampleIds: string[];
  purpose: SampleSetPurpose;
  sharedWith?: string[];       // Customer tokens
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Helper to create empty sample
export function createEmptySample(setId: string, defaults?: {
  sourceName?: string;
  sourceId?: string;
  type?: TeaType;
}): TeaSample {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: '',
    setId,
    sourceId: defaults?.sourceId,
    sourceName: defaults?.sourceName,
    type: defaults?.type,
    tastings: [],
    status: 'untasted',
    grams: 10,
    photos: [],
    createdAt: now,
    updatedAt: now,
    createdBy: 'admin',
    synced: false,
  };
}

// Helper to create empty sample set
export function createEmptySampleSet(defaults?: {
  sourceId?: string;
  sourceName?: string;
  purpose?: SampleSetPurpose;
}): SampleSet {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: '',
    sourceId: defaults?.sourceId,
    sourceName: defaults?.sourceName,
    sampleIds: [],
    purpose: defaults?.purpose || 'sourcing',
    createdAt: now,
    updatedAt: now,
  };
}

// Default gram presets for samples (smaller than buying amounts)
export const SAMPLE_GRAM_PRESETS = [5, 8, 10, 15, 20, 25, 50];

// Verdict display config
export const VERDICT_CONFIG: Record<TastingVerdict, { label: string; color: string }> = {
  love: { label: 'Love it', color: 'text-rose-500' },
  like: { label: 'Like it', color: 'text-emerald-500' },
  neutral: { label: 'Neutral', color: 'text-tea-text-sec' },
  pass: { label: 'Pass', color: 'text-tea-text-dim' },
};

// Status display config
export const SAMPLE_STATUS_CONFIG: Record<SampleStatus, { label: string; color: string }> = {
  untasted: { label: 'Untasted', color: 'bg-tea-surface text-tea-text-sec' },
  tasted: { label: 'Tasted', color: 'bg-blue-500/10 text-blue-400' },
  favorite: { label: 'Favorite', color: 'bg-rose-500/10 text-rose-400' },
  ordering: { label: 'Ordering', color: 'bg-amber-500/10 text-amber-400' },
  ordered: { label: 'Ordered', color: 'bg-emerald-500/10 text-emerald-400' },
  passed: { label: 'Passed', color: 'bg-tea-surface text-tea-text-dim' },
};
