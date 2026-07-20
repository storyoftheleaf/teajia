import { describe, expect, it } from 'vitest';
import { selectSampleSyncPending } from './sampleStore';

describe('sample sync pending selector', () => {
  it('does not treat reconciled server state as new sync work', () => {
    expect(selectSampleSyncPending({
      samples: [{ synced: true }],
      sampleSets: [{ synced: true }],
      sampleTombstones: [],
      sampleSetTombstones: [],
    })).toBe(false);
  });

  it('still detects local records and deletions waiting to sync', () => {
    expect(selectSampleSyncPending({
      samples: [{ synced: false }],
      sampleSets: [],
      sampleTombstones: [],
      sampleSetTombstones: [],
    })).toBe(true);
    expect(selectSampleSyncPending({
      samples: [],
      sampleSets: [],
      sampleTombstones: ['deleted-sample'],
      sampleSetTombstones: [],
    })).toBe(true);
  });
});
