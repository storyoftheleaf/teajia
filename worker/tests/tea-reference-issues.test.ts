import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';

const SECRET = 'tea-reference-issues-secret';
const ACCOUNT_A = 'account-a';
const ACCOUNT_B = 'account-b';
const OWNER_ID = 'platform-owner';
const dirs: string[] = [];

afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));

type IssueRow = {
  id: string;
  account_id: string;
  page_id: string;
  page_slug: string;
  route: string;
  section_key: string;
  category: string;
  note: string;
  normalized_note: string;
  public_text_snapshot: string;
  source_ids_json: string;
  status: 'open' | 'resolved';
  created_by_user_id: string;
  created_at: string;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
};

const compact = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase();

class IssueDb {
  rows: IssueRow[] = [];
  platformRole: string | null = 'platform_owner';
  resolveBeforeNextUpdate: string | null = null;
  resolveBeforeNextDuplicateRead = false;
  issueSql: string[] = [];

  prepare(sql: string) {
    const normalized = compact(sql);
    if (normalized.includes('tea_reference_issues')) this.issueSql.push(normalized);
    let values: unknown[] = [];
    const statement = {
      bind: (...input: unknown[]) => { values = input; return statement; },
      first: async () => {
        if (normalized.includes('select session_version from users')) return { session_version: 0 };
        if (normalized.includes('select platform_role, session_version from users')) {
          return { platform_role: this.platformRole, session_version: 0 };
        }
        if (normalized.includes('select platform_role from users')) return { platform_role: this.platformRole };
        if (normalized.includes('select status from accounts')) return { status: 'active' };
        if (normalized.includes('from tea_reference_issues') && normalized.includes('normalized_note = ?')) {
          const [accountId, pageId, sectionKey, category, normalizedNote] = values;
          if (this.resolveBeforeNextDuplicateRead) {
            const raced = this.rows.find(row => row.account_id === accountId
              && row.page_id === pageId
              && row.section_key === sectionKey
              && row.category === category
              && row.normalized_note === normalizedNote
              && row.status === 'open');
            if (raced) {
              raced.status = 'resolved';
              raced.resolved_by_user_id = OWNER_ID;
              raced.resolved_at = '2026-08-10 02:03:04';
            }
            this.resolveBeforeNextDuplicateRead = false;
          }
          return this.rows.find(row => row.account_id === accountId
            && row.page_id === pageId
            && row.section_key === sectionKey
            && row.category === category
            && row.normalized_note === normalizedNote
            && row.status === 'open') ?? null;
        }
        return null;
      },
      all: async () => {
        if (normalized.includes('select id from tea_reference_issues')) {
          const [accountId, ...ids] = values;
          return { results: this.rows.filter(row => row.account_id === accountId && row.status === 'open' && ids.includes(row.id)).map(row => ({ id: row.id })) };
        }
        if (normalized.includes('from tea_reference_issues')) {
          const [accountId] = values;
          return { results: this.rows.filter(row => row.account_id === accountId && row.status === 'open').map(row => ({ ...row })) };
        }
        return { results: [] };
      },
      run: async () => {
        if (normalized.startsWith('insert into tea_reference_issues')) {
          const [id, account_id, page_id, page_slug, route, section_key, category, note, normalized_note, public_text_snapshot, source_ids_json, created_by_user_id] = values as string[];
          const duplicate = this.rows.some(row => row.account_id === account_id
            && row.page_id === page_id
            && row.section_key === section_key
            && row.category === category
            && row.normalized_note === normalized_note
            && row.status === 'open');
          if (duplicate) return { success: true, meta: { changes: 0 } };
          this.rows.push({ id, account_id, page_id, page_slug, route, section_key, category, note, normalized_note, public_text_snapshot, source_ids_json, status: 'open', created_by_user_id, created_at: '2026-08-10 01:02:03', resolved_by_user_id: null, resolved_at: null });
          return { success: true, meta: { changes: 1 } };
        }
        if (normalized.startsWith('update tea_reference_issues')) {
          const [resolvedBy, accountId, ...remaining] = values as string[];
          const secondAccountIndex = remaining.indexOf(accountId);
          const ids = remaining.slice(0, secondAccountIndex);
          if (this.resolveBeforeNextUpdate) {
            const raced = this.rows.find(row => row.id === this.resolveBeforeNextUpdate);
            if (raced) raced.status = 'resolved';
            this.resolveBeforeNextUpdate = null;
          }
          const allStillOpen = ids.every(id => this.rows.some(row => row.account_id === accountId && row.status === 'open' && row.id === id));
          if (!allStillOpen) return { success: true, meta: { changes: 0 } };
          let changes = 0;
          for (const row of this.rows) {
            if (row.account_id === accountId && row.status === 'open' && ids.includes(row.id)) {
              row.status = 'resolved';
              row.resolved_by_user_id = resolvedBy;
              row.resolved_at = '2026-08-10 02:03:04';
              changes += 1;
            }
          }
          return { success: true, meta: { changes } };
        }
        return { success: true, meta: { changes: 0 } };
      },
    };
    return statement;
  }
}

function base64(value: unknown) {
  return btoa(JSON.stringify(value));
}

async function jwt(platformRole: string | null = 'platform_owner') {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64({ alg: 'HS256', typ: 'JWT' })}.${base64({
    sub: OWNER_ID,
    email: 'owner@teajia.test',
    name: 'Owner',
    platform_role: platformRole,
    active_account_id: ACCOUNT_A,
    session_version: 0,
    iat: now,
    exp: now + 3600,
  })}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

async function call(db: IssueDb, path: string, init: RequestInit = {}, accountId = ACCOUNT_A, platformRole: string | null = 'platform_owner') {
  db.platformRole = platformRole;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await jwt(platformRole)}`);
  headers.set('X-Teajia-Account', accountId);
  if (init.body) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, { ...init, headers }), { DB: db, JWT_SECRET: SECRET } as any);
}

const createBody = {
  page_id: 'yunnan',
  section_key: 'geographic-frame',
  category: 'unclear_writing',
  note: 'Clarify what “place-bound” means.',
};

async function create(db: IssueDb, body: unknown = createBody, accountId = ACCOUNT_A) {
  return call(db, '/api/admin/tea-reference/issues', { method: 'POST', body: JSON.stringify(body) }, accountId);
}

describe('Tea Reference revision issue API', () => {
  it('creates an issue from a canonical public page section and derives all browser-spoofable fields', async () => {
    const db = new IssueDb();
    const response = await create(db);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      duplicate: false,
      issue: {
        account_id: ACCOUNT_A,
        page_id: 'yunnan',
        page_slug: 'yunnan',
        route: '/wisdom/region/yunnan',
        section_key: 'geographic-frame',
        section_label: 'The geographic frame',
        category: 'unclear_writing',
        note: createBody.note,
        public_text_snapshot: expect.stringContaining('Yunnan'),
        source_ids: expect.arrayContaining([expect.any(String)]),
        status: 'open',
        created_by_user_id: OWNER_ID,
      },
    });
    expect(db.rows).toHaveLength(1);

    const spoofed = await create(db, { ...createBody, route: '/admin', public_text_snapshot: 'fake', source_ids: ['private-evidence'] });
    expect(spoofed.status).toBe(400);
    expect(await spoofed.json()).toMatchObject({ code: 'validation_failed' });
    expect(db.rows).toHaveLength(1);
  });

  it('returns the existing open issue for a duplicate normalized note', async () => {
    const db = new IssueDb();
    const first = await create(db);
    const firstBody = await first.json() as any;
    const duplicate = await create(db, { ...createBody, note: '  CLARIFY   what “place-bound” means.  ' });

    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({ duplicate: true, issue: { id: firstBody.issue.id, note: createBody.note } });
    expect(db.rows).toHaveLength(1);
  });

  it('creates a replacement if the duplicate is resolved between insert and read-back', async () => {
    const db = new IssueDb();
    const first = await (await create(db)).json() as any;
    db.resolveBeforeNextDuplicateRead = true;

    const replacement = await create(db, { ...createBody, note: '  CLARIFY   what “place-bound” means.  ' });

    expect(replacement.status).toBe(201);
    expect(await replacement.json()).toMatchObject({
      duplicate: false,
      issue: { id: expect.not.stringMatching(first.issue.id), status: 'open' },
    });
    expect(db.rows.filter(row => row.status === 'open')).toHaveLength(1);
    expect(db.rows.filter(row => row.status === 'resolved')).toHaveLength(1);
  });

  it('lists only open issues belonging to the selected account', async () => {
    const db = new IssueDb();
    await create(db, createBody, ACCOUNT_A);
    await create(db, { ...createBody, note: 'Account B note.' }, ACCOUNT_B);

    const response = await call(db, '/api/admin/tea-reference/issues');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.issues).toHaveLength(1);
    expect(body.issues[0]).toMatchObject({ account_id: ACCOUNT_A, note: createBody.note, section_label: 'The geographic frame' });
    expect(db.issueSql.every(sql => sql.includes('account_id'))).toBe(true);
  });

  it('exports byte-identical code-point ordered Markdown without timestamps or private evidence', async () => {
    const db = new IssueDb();
    await create(db, { ...createBody, category: 'wrong_source', note: 'A note with # heading and [link](https://unsafe.test).' });
    await create(db, { ...createBody, section_key: 'reading-labels', note: 'Second note.' });
    db.rows.reverse();

    const first = await call(db, '/api/admin/tea-reference/issues/export');
    const firstMarkdown = await first.text();
    const second = await call(db, '/api/admin/tea-reference/issues/export');

    expect(first.status).toBe(200);
    expect(first.headers.get('Content-Type')).toContain('text/markdown');
    expect(first.headers.get('Content-Disposition')).toBe('attachment; filename="tea-reference-regeneration-brief.md"');
    expect(await second.text()).toBe(firstMarkdown);
    expect(firstMarkdown.indexOf('The geographic frame')).toBeLessThan(firstMarkdown.indexOf('Read labels with care'));
    expect(firstMarkdown).toContain('A note with \\# heading and \\[link\\]\\(https://unsafe.test\\).');
    expect(firstMarkdown).toContain('Publisher: TeaDB');
    expect(firstMarkdown).toContain("Title: Pu'erh Regions: Yunnan Overview");
    expect(firstMarkdown).toContain('Published: 2014-12-27');
    expect(firstMarkdown).toContain('URL: <https://teadb.org/yunnan/>');
    expect(firstMarkdown).not.toContain('2026-08-10 01:02:03');
    expect(firstMarkdown).not.toMatch(/evidence|translation method|excerpt hash|source_language|locator|excerpt_sha256/i);
  });

  it('resolves explicit open IDs atomically and denies cross-account or unknown IDs', async () => {
    const db = new IssueDb();
    const owned = await (await create(db)).json() as any;
    const foreign = await (await create(db, { ...createBody, note: 'Foreign issue.' }, ACCOUNT_B)).json() as any;

    const denied = await call(db, '/api/admin/tea-reference/issues/resolve', {
      method: 'POST', body: JSON.stringify({ ids: [owned.issue.id, foreign.issue.id] }),
    });
    expect(denied.status).toBe(404);
    expect(db.rows.every(row => row.status === 'open')).toBe(true);

    const resolved = await call(db, '/api/admin/tea-reference/issues/resolve', {
      method: 'POST', body: JSON.stringify({ ids: [owned.issue.id] }),
    });
    expect(resolved.status).toBe(200);
    expect(await resolved.json()).toEqual({ resolved_ids: [owned.issue.id], resolved_count: 1 });
    expect(db.rows.find(row => row.id === owned.issue.id)?.status).toBe('resolved');
    expect(db.rows.find(row => row.id === foreign.issue.id)?.status).toBe('open');
  });

  it('does not partially resolve a selection when one issue changes after validation', async () => {
    const db = new IssueDb();
    const first = await (await create(db, { ...createBody, note: 'First issue.' })).json() as any;
    const second = await (await create(db, { ...createBody, note: 'Second issue.' })).json() as any;
    db.resolveBeforeNextUpdate = second.issue.id;

    const response = await call(db, '/api/admin/tea-reference/issues/resolve', {
      method: 'POST', body: JSON.stringify({ ids: [first.issue.id, second.issue.id] }),
    });

    expect(response.status).toBe(409);
    expect(db.rows.find(row => row.id === first.issue.id)?.status).toBe('open');
    expect(db.rows.find(row => row.id === second.issue.id)?.status).toBe('resolved');
  });

  it('rejects unknown or unroutable pages, unknown sections, invalid categories, and missing notes', async () => {
    const db = new IssueDb();
    for (const body of [
      { ...createBody, page_id: 'unknown' },
      { ...createBody, page_id: 'yunnan-mountain-names', section_key: 'market-names' },
      { ...createBody, section_key: 'unknown' },
      { ...createBody, category: 'rewrite_everything' },
      { ...createBody, note: '   ' },
    ]) {
      const response = await create(db, body);
      expect(response.status).toBe(400);
    }
    expect(db.rows).toEqual([]);
  });

  it('requires both an account context and the exact fresh platform-owner role', async () => {
    const db = new IssueDb();
    const unauthenticated = await worker.fetch(new Request('https://worker.test/api/admin/tea-reference/issues'), { DB: db, JWT_SECRET: SECRET } as any);
    expect(unauthenticated.status).toBe(401);

    const admin = await call(db, '/api/admin/tea-reference/issues', {}, ACCOUNT_A, 'platform_admin');
    expect(admin.status).toBe(403);
    const ordinary = await call(db, '/api/admin/tea-reference/issues', {}, ACCOUNT_A, null);
    expect(ordinary.status).toBe(403);
  });
});

describe('Tea Reference issue migration 123', () => {
  it('is replay-safe, matches the canonical schema, and enforces account-scoped open duplicate uniqueness', () => {
    const migration = readFileSync(new URL('../migrations/123_tea_reference_issues.sql', import.meta.url), 'utf8');
    const canonical = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
    const makeDb = (sql: string) => {
      const dir = mkdtempSync(join(tmpdir(), 'teajia-reference-issues-'));
      dirs.push(dir);
      const path = join(dir, 'test.sqlite');
      execFileSync('sqlite3', [path], { input: `PRAGMA foreign_keys=ON;\n${sql}` });
      return path;
    };
    const query = (path: string, sql: string) => JSON.parse(execFileSync('sqlite3', ['-json', path, sql], { encoding: 'utf8' }) || '[]');
    const base = `CREATE TABLE accounts(id TEXT PRIMARY KEY); CREATE TABLE users(id TEXT PRIMARY KEY);`;
    const upgraded = makeDb(base + migration + migration);
    const fresh = makeDb(canonical);

    expect(query(upgraded, `PRAGMA table_info('tea_reference_issues')`).map(({ cid: _cid, ...row }: any) => row))
      .toEqual(query(fresh, `PRAGMA table_info('tea_reference_issues')`).map(({ cid: _cid, ...row }: any) => row));
    expect(query(upgraded, `PRAGMA index_list('tea_reference_issues')`).map(({ seq: _seq, ...row }: any) => row))
      .toEqual(query(fresh, `PRAGMA index_list('tea_reference_issues')`).map(({ seq: _seq, ...row }: any) => row));

    execFileSync('sqlite3', [upgraded], { input: `
      INSERT INTO accounts(id) VALUES ('a'); INSERT INTO users(id) VALUES ('u');
      INSERT INTO tea_reference_issues(id,account_id,page_id,page_slug,route,section_key,category,note,normalized_note,public_text_snapshot,source_ids_json,created_by_user_id)
      VALUES ('i1','a','yunnan','yunnan','/wisdom/region/yunnan','scope','unclear_writing','Note','note','Text','[]','u');
    ` });
    expect(() => execFileSync('sqlite3', [upgraded], { input: `
      INSERT INTO tea_reference_issues(id,account_id,page_id,page_slug,route,section_key,category,note,normalized_note,public_text_snapshot,source_ids_json,created_by_user_id)
      VALUES ('i2','a','yunnan','yunnan','/wisdom/region/yunnan','scope','unclear_writing','NOTE','note','Text','[]','u');
    ` })).toThrow();
    execFileSync('sqlite3', [upgraded], { input: `
      UPDATE tea_reference_issues SET status='resolved',resolved_by_user_id='u',resolved_at=datetime('now') WHERE id='i1';
      INSERT INTO tea_reference_issues(id,account_id,page_id,page_slug,route,section_key,category,note,normalized_note,public_text_snapshot,source_ids_json,created_by_user_id)
      VALUES ('i2','a','yunnan','yunnan','/wisdom/region/yunnan','scope','unclear_writing','NOTE','note','Text','[]','u');
    ` });
  });
});
