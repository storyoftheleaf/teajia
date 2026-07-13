import { describe, expect, it } from 'vitest';
import { compassRequest, FakeDb } from './helpers/compassHarness';

describe('Compass sample lifecycle', () => {
  it.each(['requested', 'received', 'tasted', null])('round-trips explicit sample_state %s', async sampleState => {
    const db = new FakeDb();
    const response = await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: `sample-${sampleState}`, sample_state: sampleState }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ sample_state: sampleState });
  });

  it('rejects invalid or inferred lifecycle values', async () => {
    const db = new FakeDb();
    const invalid = await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: 'bad-sample', sample_state: 'incoming' }),
    });
    expect(invalid.status).toBe(400);
    const explicitOnly = await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: 'explicit-only', status: 'in_stock', tasting: { quality: 9 } }),
    });
    expect((await explicitOnly.json() as Record<string, unknown>).sample_state).toBeUndefined();
  });

  it('keeps one mutually exclusive durable value through sync', async () => {
    const db = new FakeDb();
    await compassRequest(db, '/api/compass/entries', { method: 'POST', body: JSON.stringify({ id: 'sample-sync', sample_state: 'requested' }) });
    await compassRequest(db, '/api/compass/sync', { method: 'POST', body: JSON.stringify({ entries: [{ id: 'sample-sync', sample_state: 'tasted' }] }) });
    expect(db.rows.get('sample-sync')?.sample_state).toBe('tasted');
  });

  it('round-trips only an account-owned durable sample set link', async () => {
    const db = new FakeDb();
    db.sampleSets.set('set-a', { id: 'set-a', account_id: 'account-a' });
    db.sampleSets.set('set-b', { id: 'set-b', account_id: 'account-b' });
    const accepted = await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: 'linked-a', sample_state: 'requested', sample_set_id: 'set-a' }),
    });
    expect(accepted.status).toBe(201);
    expect(await accepted.json()).toMatchObject({ sample_set_id: 'set-a' });

    const rejected = await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: 'linked-b', sample_state: 'requested', sample_set_id: 'set-b' }),
    });
    expect(rejected.status).toBe(404);

    const rejectedSync = await compassRequest(db, '/api/compass/sync', {
      method: 'POST', body: JSON.stringify({ entries: [{ id: 'linked-a', sample_set_id: 'set-b' }] }),
    });
    expect(rejectedSync.status).toBe(404);
    expect(db.rows.get('linked-a')?.sample_set_id).toBe('set-a');
  });
});
