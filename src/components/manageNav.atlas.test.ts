import { describe, expect, it } from 'vitest';
import { buildManageItems, withAtlas } from './manageNav';

// The Tea Atlas sits in the Manage column as reference to read, right after
// Wisdom. It is placed into whatever rooms the person already has, never
// replacing one, and appears once.

const everything = buildManageItems({
  hasCatalog: true, hasSell: true, hasPublish: true, isAdmin: true, isOwnerTier: true, platformRole: 'platform_owner',
});

describe('Manage column: the Tea Atlas row', () => {
  it('comes straight after Wisdom', () => {
    const ids = withAtlas(everything).map(r => r.id);
    expect(ids[ids.indexOf('wisdom') + 1]).toBe('atlas');
  });

  it('comes before Network, Members and Settings when there is no Wisdom', () => {
    const ids = withAtlas(everything.filter(r => r.id !== 'wisdom')).map(r => r.id);
    expect(ids.indexOf('atlas')).toBeLessThan(ids.indexOf('network'));
  });

  it('adds one row and keeps every room', () => {
    const out = withAtlas(everything);
    expect(out).toHaveLength(everything.length + 1);
    expect(out.filter(r => r.id === 'atlas')).toHaveLength(1);
    expect(out.find(r => r.id === 'atlas')?.path).toBe('/tea-atlas');
  });
});
