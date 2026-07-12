import { describe, expect, it } from 'vitest';
import { compassRequest, FakeDb } from './helpers/compassHarness';

describe('Curate Journey and Visit context', () => {
  it('allows capture to remain context-free', async () => {
    const db = new FakeDb();
    const response = await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: 'plain', price_amount: 8 }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: 'plain' });
  });

  it('creates an account-owned journey and multiple visits with vendor snapshots', async () => {
    const db = new FakeDb();
    const journey = await compassRequest(db, '/api/curate/journeys', {
      method: 'POST', body: JSON.stringify({ id: 'taiwan-2026', name: 'Taiwan', season: 'Spring', year: 2026 }),
    });
    expect(journey.status).toBe(201);
    expect(await journey.clone().json()).toMatchObject({ created_by_user_id: 'user-a' });

    for (const [id, vendor_name] of [['visit-chen', 'Chen Family'], ['visit-lin', 'Lin Tea House']]) {
      db.customers.set(`${id}-vendor`, { id: `${id}-vendor`, account_id: 'account-a', name: vendor_name });
      const response = await compassRequest(db, '/api/curate/visits', {
        method: 'POST', body: JSON.stringify({ id, journey_id: 'taiwan-2026', vendor_id: `${id}-vendor`, vendor_name, place: 'Taipei' }),
      });
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ id, journey_id: 'taiwan-2026', vendor_name });
    }
    const visits = await compassRequest(db, '/api/curate/visits?journey_id=taiwan-2026');
    expect((await visits.json() as { visits: unknown[] }).visits).toHaveLength(2);
  });

  it('allows a Visit without a Journey and preserves its vendor snapshot when edited', async () => {
    const db = new FakeDb();
    db.customers.set('vendor-1', { id: 'vendor-1', account_id: 'account-a', name: 'Authoritative Shop' });
    const created = await compassRequest(db, '/api/curate/visits', {
      method: 'POST', body: JSON.stringify({ id: 'walk-in', vendor_id: 'vendor-1', vendor_name: 'Caller Spoof' }),
    });
    expect(created.status).toBe(201);
    expect(await created.clone().json()).toMatchObject({ created_by_user_id: 'user-a', vendor_name: 'Authoritative Shop' });
    db.customers.get('vendor-1')!.name = 'Renamed Shop';
    const updated = await compassRequest(db, '/api/curate/visits/walk-in', {
      method: 'PUT', body: JSON.stringify({ place: 'Yingge' }),
    });
    expect(await updated.json()).toMatchObject({ journey_id: null, vendor_id: 'vendor-1', vendor_name: 'Authoritative Shop', place: 'Yingge' });
  });

  it('scopes reads, updates, and deletes to the active account', async () => {
    const db = new FakeDb();
    await compassRequest(db, '/api/curate/journeys', {
      method: 'POST', body: JSON.stringify({ id: 'private-trip', name: 'Private' }),
    });
    const foreignList = await compassRequest(db, '/api/curate/journeys', { accountId: 'account-b' });
    expect(await foreignList.json()).toEqual({ journeys: [] });
    const foreignUpdate = await compassRequest(db, '/api/curate/journeys/private-trip', {
      method: 'PUT', accountId: 'account-b', body: JSON.stringify({ name: 'Taken' }),
    });
    expect(foreignUpdate.status).toBe(404);
    const foreignDelete = await compassRequest(db, '/api/curate/journeys/private-trip', { method: 'DELETE', accountId: 'account-b' });
    expect(foreignDelete.status).toBe(404);

    const foreignLink = await compassRequest(db, '/api/compass/entries', {
      method: 'POST', accountId: 'account-b', body: JSON.stringify({ id: 'foreign-link', journey_id: 'private-trip' }),
    });
    expect(foreignLink.status).toBe(400);
  });

  it('links and clears entry context independently of the six-hour session', async () => {
    const db = new FakeDb();
    await compassRequest(db, '/api/curate/journeys', { method: 'POST', body: JSON.stringify({ id: 'trip', name: 'Trip' }) });
    await compassRequest(db, '/api/curate/visits', { method: 'POST', body: JSON.stringify({ id: 'visit', journey_id: 'trip' }) });
    await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: 'entry', session_id: 'sitting', journey_id: 'trip', visit_id: 'visit' }),
    });
    const cleared = await compassRequest(db, '/api/compass/entries/entry', {
      method: 'PUT', body: JSON.stringify({ journey_id: null, visit_id: null }),
    });
    expect(await cleared.json()).toMatchObject({ session_id: 'sitting', journey_id: null, visit_id: null });
  });
});
