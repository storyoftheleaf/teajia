import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LogisticsTrackingUpdate } from './LogisticsTrackingUpdate';
import type { LogisticsTrackingSnapshot } from '../../../lib/logisticsTrackingUpdate';
const update: LogisticsTrackingSnapshot = { id: 1, source: 'agent_update', tracking_number: 'INBOUND-1', status: 'Courier collected', location: 'Guangzhou', description: null, reported_at: null, recorded_at: '2026-10-29T08:00:00Z', recorded_by: 'agent', source_text: 'Collected today', history: [] };
describe('message-sourced status display', () => {
  it('identifies an undated message by save date without inventing a reported time', () => {
    const html = renderToStaticMarkup(<LogisticsTrackingUpdate update={update}/>);
    expect(html).toContain('Saved');
    expect(html).not.toContain('Reported');
    expect(html).toContain('Courier collected');
    expect(html).toContain('Guangzhou');
  });
  it('shows the source report date and distinguishes missing updates', () => {
    expect(renderToStaticMarkup(<LogisticsTrackingUpdate update={{ ...update, reported_at:'2026-10-28T08:00:00Z' }}/>)).toContain('Reported');
    expect(renderToStaticMarkup(<LogisticsTrackingUpdate/>)).toContain('No parcel update reported');
  });
});
