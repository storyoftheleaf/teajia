import { describe, expect, it } from 'vitest';

import { mapEvent } from './useEventData';

describe('mapEvent', () => {
  it('losslessly maps the Release 1 event contract fields', () => {
    expect(mapEvent({
      id: 'event-a',
      slug: 'cliff-tea',
      title: 'Cliff Tea',
      event_date: '2032-05-06T10:00:00Z',
      total_capacity: 12,
      claim_window_minutes: 45,
      timezone: 'Asia/Makassar',
      status: 'active',
      event_format: 'workshop',
      gathering_type: 'semi-private',
      venue_id: 'venue-a',
      active_space_ids: '["terrace","library"]',
      requires_approval: 0,
      lifecycle_status: 'published',
      public_visibility: 'unlisted',
      network_discovery: 0,
      recap_status: 'published',
      created_at: '2032-01-01',
      updated_at: '2032-01-02',
    })).toMatchObject({
      format: 'workshop',
      gatheringType: 'semi-private',
      venueId: 'venue-a',
      activeSpaceIds: ['terrace', 'library'],
      requiresApproval: false,
      lifecycleStatus: 'published',
      publicVisibility: 'unlisted',
      networkDiscovery: false,
      recapStatus: 'published',
    });
  });
});
