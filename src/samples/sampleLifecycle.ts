import type { CompassSampleState, TeaCompassEntry } from '../components/TeaCompass/types';
import type { SampleCartItem } from './sampleCartStore';
import { createEmptySample, createEmptySampleSet, type SampleSet, type SampleStatus, type TeaSample } from './types';

export interface SampleBatchDraft {
  signature: string;
  sampleSet: SampleSet;
  samples: TeaSample[];
}

function sampleListSignature(items: SampleCartItem[]): string {
  return JSON.stringify(items.map((item) => [item.id, item.grams, item.compassEntryId ?? null]));
}

export function buildSampleBatchDraft(
  items: SampleCartItem[],
  options: { setId?: string; sampleId?: (item: SampleCartItem, index: number) => string; now?: Date } = {},
): SampleBatchDraft {
  const now = options.now ?? new Date();
  const sampleSet = createEmptySampleSet({ purpose: 'sourcing' });
  if (options.setId) sampleSet.id = options.setId;
  sampleSet.name = `Sample list — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const samples = items.map((item, index) => {
    const sample = createEmptySample(sampleSet.id, { sourceName: item.vendorName, type: item.type as TeaSample['type'] });
    if (options.sampleId) sample.id = options.sampleId(item, index);
    sample.name = item.name;
    sample.chineseName = item.chineseName;
    sample.grams = item.grams;
    sample.compassEntryId = item.compassEntryId;
    sample.productId = item.productId;
    sample.teaKey = item.teaKey;
    sample.status = 'requested';
    return sample;
  });
  sampleSet.sampleIds = samples.map((sample) => sample.id);
  return { signature: sampleListSignature(items), sampleSet, samples };
}

export function requestedCompassUpdate(sampleSetId: string): Pick<TeaCompassEntry, 'isSample' | 'sampleState' | 'sampleSetId'> {
  return { isSample: true, sampleState: 'requested', sampleSetId };
}

/** Logistics and tasting only advance the sample lifecycle. They never infer a
 * sourcing decision, stock status, or tasting verdict. */
export function compassLifecycleForSample(sample: {
  status: SampleStatus;
  tastings: Array<{ id: string }>;
}): CompassSampleState | undefined {
  if (sample.tastings.length > 0) return 'tasted';
  if (sample.status === 'requested') return 'requested';
  if (sample.status === 'received' || sample.status === 'untasted') return 'received';
  return undefined;
}

export async function saveSampleBatchLifecycle(options: {
  accountId: string;
  draft: SampleBatchDraft;
  isCurrentAccount: (accountId: string) => boolean;
  persistSamples: (draft: SampleBatchDraft) => Promise<void>;
  getCompassEntry: (id: string) => TeaCompassEntry | undefined;
  updateCompassEntry: (id: string, update: Partial<TeaCompassEntry>) => void;
  persistCompass: (entryIds: string[]) => Promise<void>;
  clearList: () => void;
}): Promise<void> {
  const assertAccount = () => {
    if (!options.isCurrentAccount(options.accountId)) {
      throw new Error('The active account changed while saving. Return to the original account and retry.');
    }
  };

  assertAccount();
  await options.persistSamples(options.draft);
  assertAccount();

  const linkedIds = Array.from(new Set(options.draft.samples
    .map((sample) => sample.compassEntryId)
    .filter((id): id is string => Boolean(id))));
  const updatedIds: string[] = [];
  for (const id of linkedIds) {
    if (options.getCompassEntry(id)) {
      options.updateCompassEntry(id, requestedCompassUpdate(options.draft.sampleSet.id));
      updatedIds.push(id);
    }
  }
  if (updatedIds.length > 0) await options.persistCompass(updatedIds);
  assertAccount();
  options.clearList();
}

export function sampleListSignatureForRetry(items: SampleCartItem[]): string {
  return sampleListSignature(items);
}
