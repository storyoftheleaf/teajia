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
    await compassRequest(db, '/api/compass/sync', {
      method: 'POST', body: JSON.stringify({ entries: [{ id: 'shared-id', name: 'stolen' }] }),
    });
    expect(db.rows.get('shared-id')).toMatchObject({ account_id: 'account-b', user_id: 'user-b', name: 'B tea' });
    const list = await compassRequest(db, '/api/compass/entries');
    expect(await list.json()).toEqual({ entries: [] });
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
