import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { familyErasureStatements, familyPhotoKeysForUser } from '../src/familyErasure';

// "Does anyone know this tea?" on the Tea Table (Launch 5, M8). Every route,
// driven through worker.fetch against SQLite built from the migration ledger.
// The privacy rules: only the asker reads what people told them; a question
// taken off, hidden, named (for writing) or absent answers the same 404; no
// answer carries a count; with the switch off every route is absent.

const SECRET = 'know-this-tea-secret';
const SHOP = 'acc_teajia_bali';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

class Bucket {
  objects = new Map<string, Uint8Array>();
  async put(key: string, value: Uint8Array) { this.objects.set(key, value); }
  async get(key: string) {
    const bytes = this.objects.get(key);
    return bytes ? { body: bytes, httpEtag: '"e"', writeHttpMetadata: (headers: Headers) => headers.set('content-type', 'image/jpeg') } : null;
  }
  async delete(key: string | string[]) { for (const k of Array.isArray(key) ? key : [key]) this.objects.delete(k); }
}

function jpeg(width: number, height: number, pad = 64) {
  const parts: number[] = [0xff, 0xd8];
  parts.push(0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00);
  parts.push(0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03,
    0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01);
  parts.push(0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00);
  for (let i = 0; i < pad; i += 1) parts.push(0x12);
  parts.push(0xff, 0xd9);
  return new Uint8Array(parts);
}

function setup(flags: Record<string, string> = { TEA_TABLE_OPEN: 'true', KNOW_THIS_TEA_OPEN: 'true' }) {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: SHOP, accountSlug: 'teajia-bali', role: 'owner' });
  seedIdentity(db, { userId: 'platform-owner', accountId: 'acc-platform', platformRole: 'platform_owner' });
  for (const [id, name] of [['asker', 'Lin Wei'], ['knower', 'Mei Chen'], ['shy', 'Hana Sato'], ['stranger', 'Tom']]) {
    db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version, email_verified_at)
      VALUES (?, ?, ?, 'x', 'user', 0, '2026-11-01')`).run(id, `${id}@test.dev`, name);
  }
  db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, slug, is_public, shown_in_shop, status, stock_grams,
      cost_amount, cost_currency, shipping_rate_per_kg, markup_multiplier)
    VALUES ('tea-a', ?, 'Oolong', 'Old Bush Shuixian', 'Old Bush Shuixian', 'old-bush-shuixian', 1, 1, 'Active', 100, NULL, NULL, NULL, NULL),
           ('tea-hidden', ?, 'Oolong', 'Not for sale', 'Not for sale', 'not-for-sale', 0, 0, 'Active', 100, NULL, NULL, NULL, NULL)`).run(SHOP, SHOP);
  const bucket = new Bucket();
  const env = { DB: db as any, JWT_SECRET: SECRET, MEDIA_BUCKET: bucket as any, ...flags };
  return { db, env, bucket };
}

type Who = { userId: string } | null;
async function call(env: any, who: Who, path: string, init: { method?: string; body?: unknown; form?: FormData } = {}) {
  const headers = new Headers();
  if (who) {
    const token = await signedToken(SECRET, {
      sub: who.userId, email: `${who.userId}@test.dev`, name: who.userId, active_account_id: null, platform_role: null, session_version: 0,
    });
    headers.set('Authorization', `Bearer ${token}`);
  }
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) { body = JSON.stringify(init.body); headers.set('Content-Type', 'application/json'); }
  return worker.fetch(new Request(`https://worker.test${path}`, { method: init.method ?? 'GET', headers, body }), env);
}
async function ok(env: any, who: Who, path: string, init: { method?: string; body?: unknown; form?: FormData } = {}, status = 200) {
  const response = await call(env, who, path, init);
  expect(response.status, `${init.method ?? 'GET'} ${path}`).toBe(status);
  return await response.json() as any;
}

const ASKER = { userId: 'asker' };
const KNOWER = { userId: 'knower' };
const SHY = { userId: 'shy' };
const STRANGER = { userId: 'stranger' };
const PLATFORM = { userId: 'platform-owner' };

function questionForm(whereFrom: string | null = 'A market stall in Fuzhou, wrapped in plain paper.') {
  const form = new FormData();
  if (whereFrom !== null) form.set('where_from', whereFrom);
  form.set('full', new File([jpeg(1600, 1200, 4000)], 'full.jpg', { type: 'image/jpeg' }));
  form.set('small', new File([jpeg(480, 360)], 'small.jpg', { type: 'image/jpeg' }));
  return form;
}
const ask = async (env: any, who: Who = ASKER) => (await ok(env, who, '/api/tea-table/questions', { method: 'POST', form: questionForm() }, 201)).question;
const table = (env: any) => ok(env, null, '/api/tea-table');
const absent = { error: 'Not found', code: 'not_found' };

async function expectAbsent(env: any, who: Who, path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await call(env, who, path, init);
  expect(response.status, `${init.method ?? 'GET'} ${path}`).toBe(404);
  expect(await response.json()).toEqual(absent);
}

describe('the switch', () => {
  it('answers every route as absent while it is off, even with the Tea Table open', async () => {
    const { env, db } = setup({ TEA_TABLE_OPEN: 'true', KNOW_THIS_TEA_OPEN: 'false' });
    db.sqlite.prepare(`INSERT INTO tea_table_questions (id, asker_user_id, where_from, full_key, small_key, small_width, small_height)
      VALUES ('q-1', 'asker', 'Somewhere', 'family-photos/tea-table-questions/q-1-full.jpg', 'family-photos/tea-table-questions/q-1-small.jpg', 480, 360)`).run();
    expect((await call(env, ASKER, '/api/tea-table/questions', { method: 'POST', form: questionForm() })).status).toBe(404);
    await expectAbsent(env, null, '/api/tea-table/questions/q-1');
    await expectAbsent(env, ASKER, '/api/tea-table/questions/q-1/asked');
    await expectAbsent(env, ASKER, '/api/tea-table/questions/q-1', { method: 'DELETE' });
    await expectAbsent(env, KNOWER, '/api/tea-table/questions/q-1/note', { method: 'PUT', body: { words: 'Shuixian' } });
    await expectAbsent(env, ASKER, '/api/tea-table/questions/q-1/named', { method: 'PUT', body: { name: 'Shuixian' } });
    await expectAbsent(env, ASKER, '/api/tea-table/questions/q-1/named', { method: 'DELETE' });
    await expectAbsent(env, ASKER, '/api/tea-table/questions/q-1/thanks', { method: 'PUT', body: { note_id: 'x' } });
    await expectAbsent(env, ASKER, '/api/tea-table/questions/q-1/thanks', { method: 'DELETE' });
    await expectAbsent(env, PLATFORM, '/api/admin/tea-table/questions');
    await expectAbsent(env, PLATFORM, '/api/admin/tea-table/questions/q-1/hide', { method: 'POST', body: { hidden: true } });
    const page = await table(env);
    expect(page.items).toEqual([]);
    const mine = await ok(env, ASKER, '/api/tea-table/me');
    expect(mine.mine).toEqual([]);
  });

  it('is closed with the Tea Table closed', async () => {
    const { env } = setup({ TEA_TABLE_OPEN: 'false', KNOW_THIS_TEA_OPEN: 'true' });
    expect((await call(env, ASKER, '/api/tea-table/questions', { method: 'POST', form: questionForm() })).status).toBe(404);
  });
});

describe('asking', () => {
  it('puts the photograph and where it came from on the table, in time order, with nothing counted', async () => {
    const { env, db, bucket } = setup();
    expect((await call(env, null, '/api/tea-table/questions', { method: 'POST', form: questionForm() })).status).toBe(401);
    const question = await ask(env);
    expect(question).toMatchObject({
      kind: 'question', where_from: 'A market stall in Fuzhou, wrapped in plain paper.',
      person: { name: 'Lin', path: null }, named: null,
      photograph: { small_width: 480, small_height: 360, shape: 'across' },
    });
    expect(question.photograph.small_url).toMatch(/^https:\/\/media\.teajia\.co\/family-photos\/tea-table-questions\//);
    expect(bucket.objects.size).toBe(2);
    // An older tasting-free table: the question is the one piece, and it sits by its moment.
    db.sqlite.prepare("UPDATE tea_table_questions SET asked_at = '2026-11-20 10:00:00' WHERE id = ?").run(question.id);
    const second = await ask(env, KNOWER);
    const page = await table(env);
    expect(page.items.map((item: any) => item.id)).toEqual([second.id, question.id]);
    expect(page.held).toEqual([]);
    expect(JSON.stringify(page)).not.toMatch(/count|notes|answers|asker_user_id/);
    // Not in the tastings or sessions views.
    expect((await ok(env, null, '/api/tea-table?show=tastings')).items).toEqual([]);
    // Earlier pages carry it by its moment.
    expect((await ok(env, null, `/api/tea-table?before=${encodeURIComponent('2026-11-21 00:00:00')}`)).items.map((i: any) => i.id)).toEqual([question.id]);
    // The asker's own pieces include it.
    expect((await ok(env, ASKER, '/api/tea-table/me')).mine).toEqual([`question:${question.id}`]);
    expect((await ok(env, STRANGER, '/api/tea-table/me')).mine).toEqual([]);
    // One question, public.
    expect((await ok(env, null, `/api/tea-table/questions/${question.id}`)).question.id).toBe(question.id);
  });

  it('shows the asker by their published page when they have one', async () => {
    const { env, db } = setup();
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published, page_tier, links)
      VALUES ('lin-page', ?, 'asker', 'Lin Wei', 1, 'family', '[]')`).run(SHOP);
    const question = await ask(env);
    expect(question.person).toEqual({ name: 'Lin Wei', path: '/people/lin-page' });
  });

  it('refuses a question without where it came from, and past the limits', async () => {
    const { env, bucket } = setup();
    expect((await ok(env, ASKER, '/api/tea-table/questions', { method: 'POST', form: questionForm(null) }, 400)).code).toBe('where_from_missing');
    expect((await ok(env, ASKER, '/api/tea-table/questions', { method: 'POST', form: questionForm('x'.repeat(281)) }, 400)).code).toBe('where_from_too_long');
    for (let i = 0; i < 3; i += 1) await ask(env);
    expect((await ok(env, ASKER, '/api/tea-table/questions', { method: 'POST', form: questionForm() }, 429)).code).toBe('question_limit');
    expect(bucket.objects.size).toBe(6);
  });
});

describe('telling the asker, privately', () => {
  it('only the asker reads what people told them; everyone else gets the absent answer', async () => {
    const { env } = setup();
    const question = await ask(env);
    expect(await ok(env, KNOWER, `/api/tea-table/questions/${question.id}/note`, { method: 'PUT', body: {
      words: 'This is Old Bush Shuixian, from the shop.', tea: '/shop/product/old-bush-shuixian?store=teajia-bali', name_shown: true,
    } })).toEqual({ told: true });
    await ok(env, SHY, `/api/tea-table/questions/${question.id}/note`, { method: 'PUT', body: { words: 'Looks like a Wuyi rock tea.' } });
    // Writing again replaces the note.
    await ok(env, SHY, `/api/tea-table/questions/${question.id}/note`, { method: 'PUT', body: { words: 'A Wuyi rock tea, I think.' } });

    const asked = await ok(env, ASKER, `/api/tea-table/questions/${question.id}/asked`);
    expect(asked.notes).toHaveLength(2);
    expect(asked.notes[0]).toMatchObject({
      by: 'Mei', words: 'This is Old Bush Shuixian, from the shop.', name_shown: true, thanked: false,
      tea: { name: 'Old Bush Shuixian', path: '/shop/product/old-bush-shuixian?store=teajia-bali' },
    });
    expect(asked.notes[1]).toMatchObject({ by: 'Hana', words: 'A Wuyi rock tea, I think.', name_shown: false, tea: null });
    expect(JSON.stringify(asked)).not.toMatch(/knower|shy@|writer_user_id/);

    for (const who of [null, KNOWER, SHY, STRANGER, PLATFORM]) {
      const response = await call(env, who, `/api/tea-table/questions/${question.id}/asked`);
      expect(response.status).toBe(who ? 404 : 401);
      if (who) expect(await response.json()).toEqual(absent);
    }
    // The public piece never carries the notes or how many.
    const publicPiece = JSON.stringify(await ok(env, null, `/api/tea-table/questions/${question.id}`));
    expect(publicPiece).not.toMatch(/Wuyi|Shuixian, from|notes|count/);
    expect(JSON.stringify(await table(env))).not.toMatch(/Wuyi|notes/);
  });

  it('refuses the asker writing to their own question, a bad shop link, and empty words', async () => {
    const { env } = setup();
    const question = await ask(env);
    const path = `/api/tea-table/questions/${question.id}/note`;
    expect((await ok(env, ASKER, path, { method: 'PUT', body: { words: 'Mine' } }, 409)).code).toBe('own_question');
    expect((await ok(env, KNOWER, path, { method: 'PUT', body: { words: ' ' } }, 400)).code).toBe('words_missing');
    expect((await ok(env, KNOWER, path, { method: 'PUT', body: { words: 'x'.repeat(601) } }, 400)).code).toBe('words_too_long');
    expect((await ok(env, KNOWER, path, { method: 'PUT', body: { words: 'Hm', tea: '/shop/product/not-for-sale' } }, 400)).code).toBe('tea_not_in_shop');
    expect((await ok(env, KNOWER, path, { method: 'PUT', body: { words: 'Hm', tea: 'https://elsewhere.test/a' } }, 400)).code).toBe('tea_not_in_shop');
    expect((await call(env, null, path, { method: 'PUT', body: { words: 'Hm' } })).status).toBe(401);
  });

  it('a closed question looks exactly like one that never was', async () => {
    const { env } = setup();
    const takenOff = await ask(env);
    const hidden = await ask(env);
    const named = await ask(env);
    for (const q of [takenOff, hidden, named]) {
      await ok(env, KNOWER, `/api/tea-table/questions/${q.id}/note`, { method: 'PUT', body: { words: 'Shuixian', name_shown: true } });
    }
    await ok(env, ASKER, `/api/tea-table/questions/${takenOff.id}`, { method: 'DELETE' });
    await ok(env, PLATFORM, `/api/admin/tea-table/questions/${hidden.id}/hide`, { method: 'POST', body: { hidden: true } });
    await ok(env, ASKER, `/api/tea-table/questions/${named.id}/named`, { method: 'PUT', body: { name: 'Shuixian' } });

    for (const id of [takenOff.id, hidden.id, 'never-was']) {
      await expectAbsent(env, null, `/api/tea-table/questions/${id}`);
      await expectAbsent(env, ASKER, `/api/tea-table/questions/${id}/asked`);
      await expectAbsent(env, KNOWER, `/api/tea-table/questions/${id}/note`, { method: 'PUT', body: { words: 'Again' } });
      await expectAbsent(env, ASKER, `/api/tea-table/questions/${id}/named`, { method: 'PUT', body: { name: 'X' } });
      await expectAbsent(env, ASKER, `/api/tea-table/questions/${id}/thanks`, { method: 'PUT', body: { note_id: 'x' } });
    }
    // Named: still on the table and still the asker's to read, but closed to new notes.
    await expectAbsent(env, SHY, `/api/tea-table/questions/${named.id}/note`, { method: 'PUT', body: { words: 'Late' } });
    expect((await ok(env, ASKER, `/api/tea-table/questions/${named.id}/asked`)).notes).toHaveLength(1);
    const ids = (await table(env)).items.map((item: any) => item.id);
    expect(ids).toEqual([named.id]);
  });
});

describe('taking it off', () => {
  it('only the asker takes it off, and its photograph goes with it', async () => {
    const { env, bucket } = setup();
    const question = await ask(env);
    const key = question.photograph.small_url.replace('https://media.teajia.co/', '');
    expect((await call(env, null, `/api/media/${key}`)).status).toBe(200);
    await expectAbsent(env, STRANGER, `/api/tea-table/questions/${question.id}`, { method: 'DELETE' });
    await expectAbsent(env, PLATFORM, `/api/tea-table/questions/${question.id}`, { method: 'DELETE' });
    expect(await ok(env, ASKER, `/api/tea-table/questions/${question.id}`, { method: 'DELETE' })).toEqual({ kind: 'question', id: question.id, on_table: false });
    expect(bucket.objects.size).toBe(0);
    expect((await call(env, null, `/api/media/${key}`)).status).toBe(404);
    expect((await table(env)).items).toEqual([]);
    expect((await ok(env, ASKER, '/api/tea-table/me')).mine).toEqual([]);
    await expectAbsent(env, ASKER, `/api/tea-table/questions/${question.id}`, { method: 'DELETE' });
  });
});

describe('naming it, and the thanks', () => {
  it('the asker names it with the tea in the shop, then thanks the one who allowed their name', async () => {
    const { env } = setup();
    const question = await ask(env);
    await ok(env, KNOWER, `/api/tea-table/questions/${question.id}/note`, { method: 'PUT', body: { words: 'Shuixian', name_shown: true } });
    await ok(env, SHY, `/api/tea-table/questions/${question.id}/note`, { method: 'PUT', body: { words: 'Rock tea' } });
    const notes = (await ok(env, ASKER, `/api/tea-table/questions/${question.id}/asked`)).notes;
    const [mei, hana] = notes;

    // Thanks waits for the name.
    expect((await ok(env, ASKER, `/api/tea-table/questions/${question.id}/thanks`, { method: 'PUT', body: { note_id: mei.id } }, 409)).code).toBe('not_named');
    // Nobody else names it.
    await expectAbsent(env, KNOWER, `/api/tea-table/questions/${question.id}/named`, { method: 'PUT', body: { name: 'Mine' } });
    expect((await ok(env, ASKER, `/api/tea-table/questions/${question.id}/named`, { method: 'PUT', body: { name: ' ' } }, 400)).code).toBe('name_missing');
    expect((await ok(env, ASKER, `/api/tea-table/questions/${question.id}/named`, { method: 'PUT', body: { tea: '/shop/product/nope' } }, 400)).code).toBe('tea_not_in_shop');

    const named = await ok(env, ASKER, `/api/tea-table/questions/${question.id}/named`, { method: 'PUT', body: {
      tea: 'https://teajia.co/shop/product/old-bush-shuixian?store=teajia-bali',
    } });
    expect(named.question.named).toEqual({ name: 'Old Bush Shuixian', path: '/shop/product/old-bush-shuixian?store=teajia-bali', by: null });

    // Hana asked for her name not to show.
    expect((await ok(env, ASKER, `/api/tea-table/questions/${question.id}/thanks`, { method: 'PUT', body: { note_id: hana.id } }, 409)).code).toBe('name_not_shown');
    await expectAbsent(env, KNOWER, `/api/tea-table/questions/${question.id}/thanks`, { method: 'PUT', body: { note_id: mei.id } });
    const thanked = await ok(env, ASKER, `/api/tea-table/questions/${question.id}/thanks`, { method: 'PUT', body: { note_id: mei.id } });
    expect(thanked.question.named).toEqual({ name: 'Old Bush Shuixian', path: '/shop/product/old-bush-shuixian?store=teajia-bali', by: 'Mei' });
    const onTable = (await table(env)).items[0];
    expect(onTable.named.by).toBe('Mei');
    expect((await ok(env, ASKER, `/api/tea-table/questions/${question.id}/asked`)).notes.find((n: any) => n.id === mei.id).thanked).toBe(true);

    // Mei later takes her yes back: her name leaves the piece.
    await call(env, KNOWER, `/api/tea-table/questions/${question.id}/note`, { method: 'PUT', body: { words: 'Shuixian', name_shown: false } });
    // (Named questions are closed to notes, so her change is refused like an absent one, and the thanks stands.)
    expect((await table(env)).items[0].named.by).toBe('Mei');

    // The asker takes the thanks back, then the name.
    expect((await ok(env, ASKER, `/api/tea-table/questions/${question.id}/thanks`, { method: 'DELETE' })).question.named.by).toBeNull();
    expect((await ok(env, ASKER, `/api/tea-table/questions/${question.id}/named`, { method: 'DELETE' })).question.named).toBeNull();
  });

  it('keeps a typed name without a shop link, and drops the link when the tea leaves the shop', async () => {
    const { env, db } = setup();
    const question = await ask(env);
    const typed = await ok(env, ASKER, `/api/tea-table/questions/${question.id}/named`, { method: 'PUT', body: { name: 'Wuyi Shuixian' } });
    expect(typed.question.named).toEqual({ name: 'Wuyi Shuixian', path: null, by: null });
    await ok(env, ASKER, `/api/tea-table/questions/${question.id}/named`, { method: 'PUT', body: { name: 'Shuixian', tea: '/shop/product/tea-a' } });
    db.sqlite.prepare("UPDATE products SET is_public = 0 WHERE id = 'tea-a'").run();
    expect((await ok(env, null, `/api/tea-table/questions/${question.id}`)).question.named).toEqual({ name: 'Shuixian', path: null, by: null });
  });
});

describe('the owner in Manage', () => {
  it('lists every question for the platform owner alone, and hides and brings one back', async () => {
    const { env } = setup();
    const question = await ask(env);
    await ok(env, KNOWER, `/api/tea-table/questions/${question.id}/note`, { method: 'PUT', body: { words: 'Shuixian' } });
    expect((await call(env, ASKER, '/api/admin/tea-table/questions')).status).toBe(403);
    expect((await call(env, ASKER, `/api/admin/tea-table/questions/${question.id}/hide`, { method: 'POST', body: { hidden: true } })).status).toBe(403);
    const list = await ok(env, PLATFORM, '/api/admin/tea-table/questions');
    expect(list.items).toEqual([expect.objectContaining({ id: question.id, by: 'Lin', hidden: false, showing: true, named: null })]);
    // Even the owner's list does not carry the notes or how many.
    expect(JSON.stringify(list)).not.toMatch(/Shuixian|notes|count/);
    expect((await ok(env, PLATFORM, `/api/admin/tea-table/questions/${question.id}/hide`, { method: 'POST', body: {} }, 400)).code).toBe('validation_failed');

    await ok(env, PLATFORM, `/api/admin/tea-table/questions/${question.id}/hide`, { method: 'POST', body: { hidden: true } });
    expect((await table(env)).items).toEqual([]);
    const key = question.photograph.full_url.replace('https://media.teajia.co/', '');
    expect((await call(env, null, `/api/media/${key}`)).status).toBe(404);
    expect((await ok(env, PLATFORM, '/api/admin/tea-table/questions')).items[0]).toMatchObject({ hidden: true, showing: false });

    await ok(env, PLATFORM, `/api/admin/tea-table/questions/${question.id}/hide`, { method: 'POST', body: { hidden: false } });
    expect((await table(env)).items.map((i: any) => i.id)).toEqual([question.id]);
    expect((await call(env, null, `/api/media/${key}`)).status).toBe(200);
    await expectAbsent(env, PLATFORM, '/api/admin/tea-table/questions/never-was/hide', { method: 'POST', body: { hidden: true } });
  });
});

describe('erasing a person', () => {
  it('removes their questions, the notes on them, and the notes they wrote', async () => {
    const { env, db } = setup();
    const mine = await ask(env);
    const theirs = await ask(env, KNOWER);
    await ok(env, KNOWER, `/api/tea-table/questions/${mine.id}/note`, { method: 'PUT', body: { words: 'Shuixian', name_shown: true } });
    await ok(env, ASKER, `/api/tea-table/questions/${theirs.id}/note`, { method: 'PUT', body: { words: 'Dancong' } });
    await ok(env, ASKER, `/api/tea-table/questions/${mine.id}/named`, { method: 'PUT', body: { name: 'Shuixian' } });
    const note = (await ok(env, ASKER, `/api/tea-table/questions/${mine.id}/asked`)).notes[0];
    await ok(env, ASKER, `/api/tea-table/questions/${mine.id}/thanks`, { method: 'PUT', body: { note_id: note.id } });

    const keys = await familyPhotoKeysForUser(db as any, 'asker');
    expect(keys).toHaveLength(2);
    await (db as any).batch(familyErasureStatements(db as any, 'asker'));
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM tea_table_questions WHERE asker_user_id = 'asker'").get()).toEqual({ n: 0 });
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM tea_table_question_notes").get()).toEqual({ n: 0 });

    // And the knower's erasure clears a thanks that pointed at their note.
    const again = await ask(env, STRANGER);
    await ok(env, KNOWER, `/api/tea-table/questions/${again.id}/note`, { method: 'PUT', body: { words: 'Shuixian', name_shown: true } });
    await ok(env, STRANGER, `/api/tea-table/questions/${again.id}/named`, { method: 'PUT', body: { name: 'Shuixian' } });
    const knowerNote = (await ok(env, STRANGER, `/api/tea-table/questions/${again.id}/asked`)).notes[0];
    await ok(env, STRANGER, `/api/tea-table/questions/${again.id}/thanks`, { method: 'PUT', body: { note_id: knowerNote.id } });
    await (db as any).batch(familyErasureStatements(db as any, 'knower'));
    expect((await ok(env, null, `/api/tea-table/questions/${again.id}`)).question.named.by).toBeNull();
  });
});
