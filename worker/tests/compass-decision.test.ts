import { describe, expect, it } from 'vitest';
import { compassRequest, FakeDb } from './helpers/compassHarness';

describe('Compass decision', () => {
  it.each(['considering', 'selected', 'passed_on', null])('accepts decision %s', async decision => {
    const db = new FakeDb();
    const response = await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: `decision-${decision}`, decision, price_amount: 9 }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ decision });
  });

  it('rejects invalid decisions', async () => {
    const db = new FakeDb();
    const response = await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: 'invalid', decision: 'maybe' }),
    });
    expect(response.status).toBe(400);

    await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: 'invalid-update', decision: 'considering' }),
    });
    const update = await compassRequest(db, '/api/compass/entries/invalid-update', {
      method: 'PUT', body: JSON.stringify({ decision: 'automatic' }),
    });
    expect(update.status).toBe(400);

    const sync = await compassRequest(db, '/api/compass/sync', {
      method: 'POST', body: JSON.stringify({ entries: [{ id: 'invalid-sync', decision: 'yes' }] }),
    });
    expect(sync.status).toBe(400);
  });

  it('supports clearing a decision through sync', async () => {
    const db = new FakeDb();
    await compassRequest(db, '/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: 'clear-decision', decision: 'selected' }),
    });
    const response = await compassRequest(db, '/api/compass/sync', {
      method: 'POST', body: JSON.stringify({ entries: [{ id: 'clear-decision', decision: null }] }),
    });
    expect(response.status).toBe(200);
    expect(db.rows.get('clear-decision')?.decision).toBeNull();
  });

  it('keeps decision independent from verdict and status', async () => {
    const db = new FakeDb();
    const response = await compassRequest(db, '/api/compass/entries', {
      method: 'POST',
      body: JSON.stringify({ id: 'independent', decision: 'considering', verdict: 'love', status: 'in_stock' }),
    });
    expect(await response.json()).toMatchObject({ decision: 'considering', verdict: 'love', status: 'in_stock' });
  });

  it('does not infer Selected from buying, stock, status, or verdict fields', async () => {
    const db = new FakeDb();
    const response = await compassRequest(db, '/api/compass/entries', {
      method: 'POST',
      body: JSON.stringify({ id: 'no-inference', buy_quantity_grams: 100, status: 'in_stock', verdict: 'love' }),
    });
    expect(response.status).toBe(201);
    expect((await response.json() as Record<string, unknown>).decision).toBeUndefined();
  });
});
