import { describe, expect, it } from 'vitest';
import { sampleCurateHref } from './SamplePage';

describe('sampleCurateHref', () => {
  it('opens the linked Curate record in Sourcing', () => {
    expect(sampleCurateHref({ compassEntryId: 'entry / 1' })).toBe('/admin/compass?tab=sourcing&entry=entry%20%2F%201');
  });

  it('keeps the Sourcing action for a sample without a linked record', () => {
    expect(sampleCurateHref({})).toBe('/admin/compass?tab=sourcing');
  });
});
