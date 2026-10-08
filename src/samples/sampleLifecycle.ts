import type { PendingSampleBatchOperation, SampleCartItem } from './sampleCartStore';
import { createEmptySample, createEmptySampleSet, type TeaSample } from './types';

export type SampleBatchDraft = PendingSampleBatchOperation;

function sampleListSignature(items: SampleCartItem[]): string {
  return JSON.stringify(items.map((item) => ({
    id: item.id,
    name: item.name,
    chineseName: item.chineseName ?? null,
    type: item.type ?? null,
    vendorName: item.vendorName ?? null,
    grams: item.grams,
    compassEntryId: item.compassEntryId ?? null,
    productId: item.productId ?? null,
    teaKey: item.teaKey ?? null,
  })));
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

export async function saveSampleBatchLifecycle(options: {
  accountId: string;
  draft: SampleBatchDraft;
  isCurrentAccount: (accountId: string) => boolean;
  persistSamples: (draft: SampleBatchDraft) => Promise<void>;
  refreshCompass: () => Promise<void>;
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

  await options.refreshCompass();
  assertAccount();
  options.clearList();
}

export function sampleListSignatureForRetry(items: SampleCartItem[]): string {
  return sampleListSignature(items);
}
