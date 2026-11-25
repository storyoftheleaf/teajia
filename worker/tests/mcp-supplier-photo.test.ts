import { afterEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { combineToolModules } from '../src/mcpTools/registry';
import { looksLikeImage, supplierPhotoTools } from '../src/mcpTools/supplierPhoto';
import { curateSupplyTools } from '../src/mcpTools/curateSupply';
import { curateManageModule } from '../src/mcpTools/curateManage';

/*
 * Adrian, 2026-11-25: "I want to change who the supplier is as well as his
 * picture, so that I can just send you his supply info and you can put all the
 * pertinent information in there." The words already had agent doors; this is
 * the picture. What has to hold: the photo lands where the vendor card reads
 * it, only after a preview of that exact picture was confirmed, on a supplier
 * of this shop, and it can be undone.
 */

const SHOP = 'acc-photo';
const OTHER = 'acc-elsewhere';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); vi.restoreAllMocks(); });

type R = Record<string, any>;

// Tiny but honest pictures: the first bytes are what a real file starts with.
const JPEG_A = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const JPEG_B = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9, 9]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const SHRUNK = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 7, 7]);
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

function makeDb() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'adrian', accountId: SHOP, role: 'owner' });
  seedIdentity(db, { userId: 'clerk', accountId: SHOP, role: 'staff' });
  seedIdentity(db, { userId: 'other', accountId: OTHER, role: 'owner' });
  db.sqlite.exec(`
    INSERT INTO customers (id, account_id, name, tags) VALUES
      ('yunan', '${SHOP}', 'Yunan Fam', '["vendor"]'),
      ('friend', '${SHOP}', 'A friend', '[]'),
      ('theirs', '${OTHER}', 'Their Supplier', '["vendor"]');
  `);
  return db;
}

function makeEnv(db: SqliteD1, opts: { images?: 'works' | 'no-face' | 'broken' | 'none'; bucket?: boolean } = {}) {
  const puts: Array<{ key: string; bytes: Uint8Array; type?: string }> = [];
  const transforms: R[] = [];
  const mode = opts.images ?? 'works';
  const IMAGES = mode === 'none' ? undefined : {
    input: () => ({
      transform: (options: R) => ({
        output: async () => {
          transforms.push(options);
          if (mode === 'broken' || (mode === 'no-face' && options.gravity === 'face')) throw new Error('cannot');
          return { response: () => new Response(SHRUNK, { headers: { 'Content-Type': 'image/jpeg' } }) };
        },
      }),
    }),
  };
  const MEDIA_BUCKET = opts.bucket === false ? undefined : {
    put: async (key: string, bytes: Uint8Array, options?: R) => { puts.push({ key, bytes: new Uint8Array(bytes), type: options?.httpMetadata?.contentType }); return {}; },
  };
  return { env: { DB: db, MEDIA_BUCKET, IMAGES } as any, puts, transforms };
}

const owner = (over: R = {}) => ({ accountId: SHOP, userId: 'adrian', userEmail: 'adrian@test.dev', tokenId: 'tok-photo', creatorTier: 'account_owner', ...over }) as any;
const handlers = { ...supplierPhotoTools.handlers, ...curateSupplyTools.handlers, ...curateManageModule.handlers };
const call = (env: any, name: string, args: R, who = owner()): Promise<R> => handlers[name](env, who, args) as Promise<R>;

async function setPhoto(env: any, args: R, who = owner()) {
  const preview = await call(env, 'set_supplier_photo', args, who);
  if (!preview.confirmation_token) return { preview, result: preview };
  return { preview, result: await call(env, 'set_supplier_photo', { ...args, confirm: preview.confirmation_token }, who) };
}

const card = (db: SqliteD1, id = 'yunan') =>
  db.sqlite.prepare('SELECT face_photo, storefront_photo, business_card_photo FROM customers WHERE id = ?').get(id) as R;

describe('registration', () => {
  it('is one stock:write tool, not destructive', () => {
    const { defs } = combineToolModules([supplierPhotoTools]);
    expect(defs.map(d => [d.name, d.scope])).toEqual([['set_supplier_photo', 'stock:write']]);
    expect(defs[0].annotations).toMatchObject({ destructiveHint: false });
  });

  it('knows a picture by its first bytes', () => {
    expect(looksLikeImage(JPEG_A, 'image/jpeg')).toBe(true);
    expect(looksLikeImage(PNG, 'image/png')).toBe(true);
    expect(looksLikeImage(PNG, 'image/jpeg')).toBe(false);
    expect(looksLikeImage(new TextEncoder().encode('<svg onload=x>'), 'image/png')).toBe(false);
  });
});

describe('Yunan Fam gets a face', () => {
  it('previews without storing anything', async () => {
    const db = makeDb();
    const { env, puts } = makeEnv(db);
    const preview = await call(env, 'set_supplier_photo', { vendor_id: 'yunan', image_base64: b64(JPEG_A), agent: 'Claude' });
    expect(preview.confirmation_token).toBeTruthy();
    expect(preview.preview).toMatchObject({
      action: 'set_supplier_photo', photo: 'face', current_photo: null,
      read_back: "Add this picture as Yunan Fam's face photo.",
      new_picture: { type: 'image/jpeg', size_bytes: JPEG_A.length },
    });
    expect(puts).toEqual([]);
    expect(card(db).face_photo).toBeNull();
  });

  it('confirms: the picture is squared on the face, stored on the media path, and put on the card as a recorded change', async () => {
    const db = makeDb();
    const { env, puts, transforms } = makeEnv(db);
    const { result } = await setPhoto(env, { vendor_id: 'yunan', image_base64: b64(JPEG_A), agent: 'Claude' });
    expect(result).toMatchObject({ committed: true, photo: 'face', replaced: null, framed: 'face', vendor: { id: 'yunan', name: 'Yunan Fam' } });
    expect(transforms[0]).toMatchObject({ width: 800, height: 800, fit: 'cover', gravity: 'face' });

    expect(puts).toHaveLength(1);
    expect(puts[0].key).toMatch(new RegExp(`^accounts/${SHOP}/products/[0-9a-f-]+\\.jpg$`));
    expect([...puts[0].bytes]).toEqual([...SHRUNK]);
    expect(card(db).face_photo).toBe(result.url);
    expect(result.url).toMatch(new RegExp(`^https://media\\.teajia\\.co/${puts[0].key}\\?v=\\d+$`));

    const mutation = db.sqlite.prepare('SELECT command_type, agent_name, actor_token_id FROM curate_mutations WHERE id = ?').get(result.mutation_id);
    expect(mutation).toEqual({ command_type: 'vendor:update', agent_name: 'Claude', actor_token_id: 'tok-photo' });
    const record = db.sqlite.prepare('SELECT entity_type, entity_id, before_json, after_json FROM curate_mutation_records WHERE mutation_id = ?').get(result.mutation_id) as R;
    expect(record).toMatchObject({ entity_type: 'vendor', entity_id: 'yunan' });
    expect(JSON.parse(record.before_json).face_photo).toBeNull();
    expect(JSON.parse(record.after_json).face_photo).toBe(result.url);
  });

  it('the vendor card read shows the photos', async () => {
    const db = makeDb();
    const { env } = makeEnv(db);
    const { result } = await setPhoto(env, { vendor_id: 'yunan', image_base64: b64(JPEG_A) });
    const vendor = await call(env, 'curate_get_vendor', { vendor_id: 'yunan' });
    expect(vendor.photos).toEqual({ face: result.url, storefront: null, business_card: null });
  });

  it('replacing a face keeps the old one in history, and curate_undo puts it back', async () => {
    const db = makeDb();
    const { env } = makeEnv(db);
    const first = (await setPhoto(env, { vendor_id: 'yunan', image_base64: b64(JPEG_A) })).result;
    const { preview, result: second } = await setPhoto(env, { vendor_id: 'yunan', image_base64: b64(JPEG_B) });
    expect(preview.preview).toMatchObject({ current_photo: first.url, read_back: "Replace Yunan Fam's face photo with this picture." });
    expect(second.replaced).toBe(first.url);
    expect(card(db).face_photo).toBe(second.url);

    const undo = await call(env, 'curate_undo', { mutation_id: second.mutation_id, agent: 'Claude' });
    expect(undo.confirmation_token, JSON.stringify(undo)).toBeTruthy();
    await call(env, 'curate_undo', { confirmation_token: undo.confirmation_token });
    expect(card(db).face_photo).toBe(first.url);
  });

  it('a storefront or business card is scaled, not cropped, and lands in its own slot', async () => {
    const db = makeDb();
    const { env, transforms } = makeEnv(db);
    const shop = (await setPhoto(env, { vendor_id: 'yunan', photo: 'shop', image_base64: b64(PNG), mime_type: 'image/png' })).result;
    expect(shop).toMatchObject({ photo: 'storefront', framed: 'scaled' });
    expect(transforms[0]).toMatchObject({ width: 1600, height: 1600, fit: 'scale-down' });
    const businessCard = (await setPhoto(env, { vendor_id: 'yunan', photo: 'card', image_base64: b64(JPEG_A) })).result;
    expect(businessCard.photo).toBe('business_card');
    expect(card(db)).toEqual({ face_photo: null, storefront_photo: shop.url, business_card_photo: businessCard.url });
  });

  it('reads a picture from an https link', async () => {
    const db = makeDb();
    const { env } = makeEnv(db);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JPEG_A, { headers: { 'Content-Type': 'image/jpeg' } }));
    const { result } = await setPhoto(env, { vendor_id: 'yunan', image_url: 'https://example.test/yunan.jpg' });
    expect(result.committed).toBe(true);
    expect(card(db).face_photo).toBe(result.url);
  });
});

describe('when Cloudflare Images cannot help', () => {
  it('falls back to a centred square when no face is found', async () => {
    const db = makeDb();
    const { env, transforms } = makeEnv(db, { images: 'no-face' });
    const { result } = await setPhoto(env, { vendor_id: 'yunan', image_base64: b64(JPEG_A) });
    expect(result.framed).toBe('centre');
    expect(transforms.map(t => t.gravity)).toEqual(['face', 'center']);
  });

  it('keeps the picture as sent, and says so, rather than losing it', async () => {
    for (const images of ['broken', 'none'] as const) {
      const db = makeDb();
      const { env, puts } = makeEnv(db, { images });
      const { result } = await setPhoto(env, { vendor_id: 'yunan', image_base64: b64(PNG), mime_type: 'image/png' });
      expect(result.framed).toBe('as_sent');
      expect(puts[0].key).toMatch(/\.png$/);
      expect([...puts[0].bytes]).toEqual([...PNG]);
    }
  });
});

describe('what it must not do', () => {
  it('confirming with a different picture than the preview writes nothing', async () => {
    const db = makeDb();
    const { env, puts } = makeEnv(db);
    const preview = await call(env, 'set_supplier_photo', { vendor_id: 'yunan', image_base64: b64(JPEG_A) });
    const refused = await call(env, 'set_supplier_photo', { vendor_id: 'yunan', image_base64: b64(JPEG_B), confirm: preview.confirmation_token });
    expect(refused.error).toBe('picture_changed');
    expect(puts).toEqual([]);
    expect(card(db).face_photo).toBeNull();
  });

  it('writes nothing when someone changed the photo after the preview', async () => {
    const db = makeDb();
    const { env, puts } = makeEnv(db);
    const preview = await call(env, 'set_supplier_photo', { vendor_id: 'yunan', image_base64: b64(JPEG_A) });
    db.sqlite.prepare("UPDATE customers SET face_photo = 'https://media.teajia.co/set-in-the-app.jpg' WHERE id = 'yunan'").run();
    const refused = await call(env, 'set_supplier_photo', { vendor_id: 'yunan', image_base64: b64(JPEG_A), confirm: preview.confirmation_token });
    expect(refused.error).toBe('photo_changed_since_preview');
    expect(puts).toEqual([]);
    expect(card(db).face_photo).toBe('https://media.teajia.co/set-in-the-app.jpg');
  });

  it('a preview for one supplier cannot confirm another', async () => {
    const db = makeDb();
    db.sqlite.prepare(`INSERT INTO customers (id, account_id, name, tags) VALUES ('second', '${SHOP}', 'Second Supplier', '["vendor"]')`).run();
    const { env } = makeEnv(db);
    const preview = await call(env, 'set_supplier_photo', { vendor_id: 'yunan', image_base64: b64(JPEG_A) });
    const refused = await call(env, 'set_supplier_photo', { vendor_id: 'second', image_base64: b64(JPEG_A), confirm: preview.confirmation_token });
    expect(refused.error).toBe('invalid_or_expired_confirmation_token');
    expect(card(db, 'second').face_photo).toBeNull();
    expect(card(db).face_photo).toBeNull();
  });

  it('a confirmation is spent once', async () => {
    const db = makeDb();
    const { env, puts } = makeEnv(db);
    const args = { vendor_id: 'yunan', image_base64: b64(JPEG_A) };
    const preview = await call(env, 'set_supplier_photo', args);
    await call(env, 'set_supplier_photo', { ...args, confirm: preview.confirmation_token });
    const again = await call(env, 'set_supplier_photo', { ...args, confirm: preview.confirmation_token });
    expect(again.error).toBe('invalid_or_expired_confirmation_token');
    expect(puts).toHaveLength(1);
  });

  it('does not put a supplier photo on a contact who is not a supplier, or on another shop\'s supplier', async () => {
    const db = makeDb();
    const { env } = makeEnv(db);
    expect((await call(env, 'set_supplier_photo', { vendor_id: 'friend', image_base64: b64(JPEG_A) })).error).toBe('not_a_supplier');
    expect((await call(env, 'set_supplier_photo', { vendor_id: 'theirs', image_base64: b64(JPEG_A) })).error).toBe('not_found');
    expect(card(db, 'theirs').face_photo).toBeNull();
  });

  it('refuses a file that is not the picture it says it is, and a type the card cannot show', async () => {
    const db = makeDb();
    const { env } = makeEnv(db);
    const fake = new TextEncoder().encode('<html>not a photo</html>');
    await expect(call(env, 'set_supplier_photo', { vendor_id: 'yunan', image_base64: b64(fake) })).rejects.toThrow(/not the picture it says/);
    await expect(call(env, 'set_supplier_photo', { vendor_id: 'yunan', image_base64: b64(JPEG_A), mime_type: 'image/heic' })).rejects.toThrow(/mime_type/);
  });

  it('needs someone who manages Curate', async () => {
    const db = makeDb();
    const { env } = makeEnv(db);
    await expect(call(env, 'set_supplier_photo', { vendor_id: 'yunan', image_base64: b64(JPEG_A) }, owner({ userId: 'clerk', creatorTier: 'staff' })))
      .rejects.toThrow();
    expect(card(db).face_photo).toBeNull();
  });

  it('stores nothing and changes nothing when photo storage is missing', async () => {
    const db = makeDb();
    const { env } = makeEnv(db, { bucket: false });
    const { result } = await setPhoto(env, { vendor_id: 'yunan', image_base64: b64(JPEG_A) });
    expect(result.error).toBe('media_storage_unavailable');
    expect(card(db).face_photo).toBeNull();
  });
});
