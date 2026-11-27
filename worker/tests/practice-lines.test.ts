import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { PRACTICE_DOINGS } from '../../src/lib/practiceLines';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// A person's page says their practice, not a title. Three optional lines,
// written only by the page's owner, read by anyone on a published page, and
// served by their own route alone. Closed (the default), the routes are 404
// and no other answer carries the three columns, even when they hold words.

const SECRET = 'practice-lines-secret';
let db: SqliteD1;

beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'mei', accountId: 'shop' });
  seedIdentity(db, { userId: 'other', accountId: 'shop' });
  db.exec(`
    INSERT INTO contributors (id, account_id, user_id, display_name, is_published, links) VALUES
      ('mei-lin', 'shop', 'mei', 'Mei Lin', 1, '[]'),
      ('draft-page', 'shop', 'other', 'Not Yet', 0, '[]');
  `);
});
afterEach(() => db.close());

async function call(path: string, options: { method?: string; body?: unknown; user?: string | null; open?: boolean } = {}) {
  const headers = new Headers({ 'X-Teajia-Account': 'shop' });
  if (options.user) {
    const token = await signedToken(SECRET, {
      sub: options.user, email: `${options.user}@test.dev`, name: options.user,
      active_account_id: 'shop', platform_role: null,
    });
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const env: Record<string, unknown> = { DB: db, JWT_SECRET: SECRET };
  if (options.open !== undefined) env.PRACTICE_LINES_OPEN = options.open ? 'true' : 'false';
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: options.method ?? 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), env as any);
}

const answer = (body: unknown, user: string | null = 'mei', slug = 'mei-lin') =>
  call(`/api/public/people/${slug}/practice`, { method: 'PUT', body, user, open: true });

describe('practice lines, open', () => {
  it('the owner answers each line in place and a visitor reads them', async () => {
    const empty = await call('/api/public/people/mei-lin/practice', { user: 'mei', open: true });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ can_edit: true, lines: { since: null, drawn: null, doings: [] } });

    expect((await answer({ since: 2009 })).status).toBe(200);
    expect((await answer({ drawn: '  The quiet   of the first pour.  ' })).status).toBe(200);
    const saved = await answer({ doings: ['teaches', 'pours'] });
    // Stored and shown in the fixed list's own order, whatever order they were tapped.
    expect(await saved.json()).toEqual({
      can_edit: true,
      lines: { since: 2009, drawn: 'The quiet of the first pour.', doings: ['pours', 'teaches'] },
    });

    const visitor = await call('/api/public/people/mei-lin/practice', { open: true });
    expect(visitor.headers.get('Cache-Control')).toBe('private, no-store');
    const read = await visitor.json() as any;
    expect(read).toEqual({ can_edit: false, lines: { since: 2009, drawn: 'The quiet of the first pour.', doings: ['pours', 'teaches'] } });
    // Nothing computed from them: no years counted, no level, no score.
    expect(JSON.stringify(read)).not.toMatch(/years|level|rank|count|score|master/i);
  });

  it('taking a line off stores nothing for it', async () => {
    await answer({ since: 2009, drawn: 'Old trees', doings: ['daily'] });
    const cleared = await answer({ since: null, drawn: '', doings: [] });
    expect((await cleared.json() as any).lines).toEqual({ since: null, drawn: null, doings: [] });
    const row = db.sqlite.prepare('SELECT practice_since, practice_drawn, practice_doings FROM contributors WHERE id = ?').get('mei-lin');
    expect(row).toEqual({ practice_since: null, practice_drawn: null, practice_doings: null });
  });

  it('refuses what is not a year, a long line, or a word off the list', async () => {
    expect((await answer({ since: 1800 })).status).toBe(400);
    expect((await answer({ since: new Date().getUTCFullYear() + 1 })).status).toBe(400);
    expect((await answer({ since: 'a while' })).status).toBe(400);
    expect((await answer({ drawn: 'x'.repeat(141) })).status).toBe(400);
    expect((await answer({ doings: ['tea master'] })).status).toBe(400);
    expect((await answer({ studied_with: 'Someone' })).status).toBe(400);
  });

  it('only the owner writes, and a draft page is read only by its owner', async () => {
    expect((await answer({ since: 2001 }, 'other')).status).toBe(404);
    expect((await answer({ since: 2001 }, null)).status).toBe(401);
    expect((await call('/api/public/people/draft-page/practice', { open: true })).status).toBe(404);
    const own = await call('/api/public/people/draft-page/practice', { user: 'other', open: true });
    expect(own.status).toBe(200);
    expect((await own.json() as any).can_edit).toBe(true);
  });

  it('the fixed list carries no title and no lineage', () => {
    const words = PRACTICE_DOINGS.map(item => `${item.key} ${item.words}`).join(' ');
    expect(words).not.toMatch(/master|studied|lineage|level|grand|senior|expert/i);
  });
});

describe('practice lines, closed (the default)', () => {
  beforeEach(() => {
    db.exec(`UPDATE contributors SET practice_since = 2009, practice_drawn = 'Old trees', practice_doings = 'pours' WHERE id = 'mei-lin'`);
  });

  it('both routes are 404 with the switch unset and with it set to false', async () => {
    for (const open of [undefined, false]) {
      expect((await call('/api/public/people/mei-lin/practice', { user: 'mei', open })).status).toBe(404);
      expect((await call('/api/public/people/mei-lin/practice', { method: 'PUT', body: { since: 2001 }, user: 'mei', open })).status).toBe(404);
    }
    expect(db.sqlite.prepare('SELECT practice_since FROM contributors WHERE id = ?').get('mei-lin')).toEqual({ practice_since: 2009 });
  });

  it('the public page, the owner\'s profile and the admin read carry none of the three', async () => {
    seedIdentity(db, { userId: 'owner', accountId: 'shop', role: 'owner' });
    const reads = [
      await call('/api/people/mei-lin'),
      await call('/api/me/public-profile', { user: 'mei' }),
      await call('/api/admin/contributors', { user: 'owner' }),
    ];
    for (const response of reads) {
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('Mei Lin');
      expect(text).not.toMatch(/practice_|Old trees/);
    }
  });
});
