import { describe, expect, it } from 'vitest';
import { compassRequest, FakeDb } from './helpers/compassHarness';

describe('Compass storage safety', () => {
  it('creates and lists a price-only entry', async () => {
    const db = new FakeDb();
    const created = await compassRequest(db, '/api/compass/entries', {
      method: 'POST',
      body: JSON.stringify({ id: 'price-only', price_amount: 42, price_currency: 'USD' }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ id: 'price-only', price_amount: 42, price_currency: 'USD' });

    const listed = await compassRequest(db, '/api/compass/entries');
    expect(await listed.json()).toMatchObject({ entries: [{ id: 'price-only', price_amount: 42 }] });
  });

  it('syncs a price-only entry and serializes structured fields', async () => {
    const db = new FakeDb();
    const response = await compassRequest(db, '/api/compass/sync', {
      method: 'POST',
      body: JSON.stringify({ entries: [{
        id: 'sync-price',
        price_amount: 18,
        photos: ['bag.jpg'],
        audio_clips: [{ url: 'note.m4a' }],
        tasting: { aroma: ['orchid'] },
      }] }),
    });
    expect(response.status).toBe(200);
    expect(db.rows.get('sync-price')).toMatchObject({
      price_amount: 18,
      photos: '["bag.jpg"]',
      audio_clips: '[{"url":"note.m4a"}]',
      tasting: '{"aroma":["orchid"]}',
    });
  });

  it('uses the JSON codec for single-entry create and update too', async () => {
    const db = new FakeDb();
    await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: 'json-routes', photos: ['first.jpg'] }),
    });
    await compassRequest(db, '/api/compass/entries/json-routes', {
      method: 'PUT', body: JSON.stringify({ tasting: { finish: ['mineral'] } }),
    });
    expect(db.rows.get('json-routes')).toMatchObject({
      photos: '["first.jpg"]',
      tasting: '{"finish":["mineral"]}',
    });
  });

  it('rejects an unknown update key instead of interpolating it into SQL', async () => {
    const db = new FakeDb();
    await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: 'safe', price_amount: 4 }),
    });
    const response = await compassRequest(db, '/api/compass/entries/safe', {
      method: 'PUT', body: JSON.stringify({ 'price_amount = 0; DROP TABLE products; --': 1 }),
    });
    expect(response.status).toBe(400);
    expect(db.rows.get('safe')?.price_amount).toBe(4);
  });

  it('ignores client ownership fields on create and sync', async () => {
    const db = new FakeDb();
    await compassRequest(db, '/api/compass/entries', {
      method: 'POST',
      body: JSON.stringify({ id: 'owned-create', user_id: 'attacker', account_id: 'account-b', price_amount: 5 }),
    });
    await compassRequest(db, '/api/compass/sync', {
      method: 'POST',
      body: JSON.stringify({ entries: [{ id: 'owned-sync', user_id: 'attacker', account_id: 'account-b', price_amount: 6 }] }),
    });
    expect(db.rows.get('owned-create')).toMatchObject({ user_id: 'user-a', account_id: 'account-a' });
    expect(db.rows.get('owned-sync')).toMatchObject({ user_id: 'user-a', account_id: 'account-a' });
  });

  it('does not let sync steal an id owned by another account', async () => {
    const db = new FakeDb();
    db.rows.set('shared-id', { id: 'shared-id', user_id: 'user-b', account_id: 'account-b', name: 'B tea' });
    const response = await compassRequest(db, '/api/compass/sync', {
      method: 'POST', body: JSON.stringify({ entries: [{ id: 'shared-id', name: 'stolen' }] }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ synced: 0, syncedIds: [], conflicts: ['shared-id'] });
    expect(db.rows.get('shared-id')).toMatchObject({ account_id: 'account-b', user_id: 'user-b', name: 'B tea' });
    const list = await compassRequest(db, '/api/compass/entries');
    expect(await list.json()).toEqual({ entries: [] });
  });

  it('acknowledges successful entries while reporting collisions in the same batch', async () => {
    const db = new FakeDb();
    db.rows.set('collision', { id: 'collision', user_id: 'user-b', account_id: 'account-b', name: 'Protected' });
    const response = await compassRequest(db, '/api/compass/sync', {
      method: 'POST',
      body: JSON.stringify({ entries: [
        { id: 'accepted', price_amount: 25 },
        { id: 'collision', price_amount: 99 },
      ] }),
    });
    expect(await response.json()).toEqual({
      synced: 1,
      syncedIds: ['accepted'],
      conflicts: ['collision'],
    });
    expect(db.rows.get('accepted')?.price_amount).toBe(25);
    expect(db.rows.get('collision')?.price_amount).toBeUndefined();
  });

  it('preserves created_at during an acknowledged upsert', async () => {
    const db = new FakeDb();
    db.rows.set('created', {
      id: 'created', user_id: 'user-a', account_id: 'account-a', created_at: '2024-01-01', price_amount: 1,
    });
    const response = await compassRequest(db, '/api/compass/sync', {
      method: 'POST',
      body: JSON.stringify({ entries: [{ id: 'created', created_at: '2099-01-01', price_amount: 2 }] }),
    });
    expect(await response.json()).toMatchObject({ syncedIds: ['created'], conflicts: [] });
    expect(db.rows.get('created')).toMatchObject({ created_at: '2024-01-01', price_amount: 2 });
  });

  it('preserves server fields omitted by a partial sync', async () => {
    const db = new FakeDb();
    db.rows.set('partial', {
      id: 'partial', user_id: 'user-a', account_id: 'account-a', name: 'Keep me', notes: 'Keep this', price_amount: 10,
    });
    await compassRequest(db, '/api/compass/sync', {
      method: 'POST', body: JSON.stringify({ entries: [{ id: 'partial', price_amount: 12 }] }),
    });
    expect(db.rows.get('partial')).toMatchObject({ name: 'Keep me', notes: 'Keep this', price_amount: 12 });
  });
});
