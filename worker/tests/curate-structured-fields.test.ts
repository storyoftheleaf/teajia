import { afterEach, describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { readCompassStructuredPatch, readRouteQuotes, readVendorStructuredPatch } from '../../src/lib/curateStructuredFields';
import { decodeCompassWrite } from '../src/compassCodec';
import { prepareVendorStructuredProfileWrite, readVendorStructuredProfile } from '../src/curateVendorProfile';
import { getCurateQuote, prepareCurateQuoteWrite, validateCompassQuoteLink } from '../src/curateQuotes';
import { curateIntakeTools } from '../src/mcpTools/curateIntake';
import { curateQuoteTools } from '../src/mcpTools/curateQuotes';
import { previewCurateUndo, previewCurateMutation, confirmCurateMutation } from '../src/curateMutations';
const databases: SqliteD1[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
const auth = { accountId: 'a', userId: 'owner', userEmail: 'owner@test.dev', tokenId: 'token', creatorTier: 'account_owner' } as any;
const route = { id: 'air-price', mode: 'air', amount: 0, currency: 'HKD', basis: 'kg', basis_quantity: 1, price_kind: 'landed', destination: 'Bali' };
function setup(shape: 'schema' | 'migrations' = 'schema') {
  const db = new SqliteD1(shape); databases.push(db);
  seedIdentity(db, { accountId: 'a', userId: 'owner', role: 'owner' });
  seedIdentity(db, { accountId: 'a', userId: 'author', role: 'staff', bundles: ['stock'] });
  seedIdentity(db, { accountId: 'b', userId: 'foreign', role: 'owner' });
  db.sqlite.prepare("INSERT INTO customers (id,account_id,name,tags,contacts) VALUES ('vendor','a','Vendor','[\"vendor\"]','[]'),('foreign-vendor','b','Foreign','[\"vendor\"]','[]')").run();
  db.sqlite.prepare("INSERT INTO tea_compass_entries (id,account_id,user_id,name,vendor_id,vendor_name,photos) VALUES ('tea','a','author','Tea','vendor','Vendor','[]'),('tea2','a','author','Second','vendor','Vendor','[]'),('foreign-tea','b','foreign','Foreign','foreign-vendor','Foreign','[]')").run();
  return db;
}
async function vendorWrite(db: SqliteD1, body: any) {
  const prepared = await prepareVendorStructuredProfileWrite(db as any, { ...auth, agent: 'Builder' }, 'vendor', body);
  if (prepared.statements.length) db.batch(prepared.statements as any);
  return readVendorStructuredProfile(db as any, auth, 'vendor');
}
async function quoteWrite(db: SqliteD1, body: any, id?: string) {
  const prepared = await prepareCurateQuoteWrite(db as any, { ...auth, agent: 'Builder' }, body, id);
  db.batch(prepared.statements as any); return getCurateQuote(db as any, auth, prepared.id);
}
const quote = () => ({ vendor_id: 'vendor', reference: 'LKY-2026', issued_to: 'Teajia', quote_date: '2026-10-08', validity_days: 90, minimum_order_amount: 2000, currency: 'HKD', payment_terms: 'In advance', lines: [{ id: 'line1', compass_entry_id: 'tea', vendor_item_number: 'PE1', price_amount: 0, price_currency: 'HKD', price_per_unit_grams: 1000, discount_percent: 25, route_quotes: [route] }] });
async function intake(db: SqliteD1, name: string, args: any, who = auth) {
  const tool = curateIntakeTools.handlers[name];
  const preview = await tool({ DB: db } as any, who, args) as any;
  if (!preview.confirmation_token) return preview;
  return tool({ DB: db } as any, who, { ...args, confirm: preview.confirmation_token }) as any;
}
describe('structured private sourcing evidence boundaries', () => {
  it('keeps zero discounts/prices, explicit null clears and omitted values distinct', () => {
    expect(readCompassStructuredPatch({ discount_percent: 0, age_quoted: null })).toEqual({ discount_percent: 0, age_quoted: null });
    expect(readCompassStructuredPatch({})).toEqual({});
    expect(readRouteQuotes([route])).toMatchObject([{ amount: 0, basis_quantity: 1 }]);
    expect(readRouteQuotes([])).toEqual([]);
    expect(decodeCompassWrite({ age_quoted: 'about 20 years', route_quotes: [route] }, true)).toMatchObject({ values: { age_quoted: 'about 20 years', route_quotes: JSON.stringify([route]) } });
  });
  it('refuses nonfinite, invalid bounds, unknown nested fields and guessed currencies', () => {
    for (const discount_percent of [-1, 101, NaN]) expect(() => readCompassStructuredPatch({ discount_percent })).toThrow();
    expect(() => readCompassStructuredPatch({ pack_size_grams: 0 })).toThrow();
    expect(() => readRouteQuotes([{ ...route, amount: Infinity }])).toThrow();
    expect(() => readRouteQuotes([{ ...route, notes: 'misplaced' }])).toThrow(/no structured field/);
    expect(() => decodeCompassWrite({ route_quotes: [{ ...route, currency: 'unknown' }] }, true)).toThrow(/currency/);
    expect(() => readVendorStructuredPatch({ contact_people: [{ id: 'kate', name: 'Kate', fax: 'misplaced' }] })).toThrow();
  });
  it.each(['schema','migrations'] as const)('stores repeated contacts, labeled addresses and people on %s without notes', async shape => {
    const db = setup(shape);
    let profile = await vendorWrite(db, { vendor_code: 'LKY', contact_people: [{ id: 'kate', name: 'Kate Ng', title: 'Assistant Sales & Marketing Manager' }], contacts: [{ id: 'personal-email', channel: 'email', handle: 'kate@example.com', person_id: 'kate' }, { id: 'office-email', channel: 'email', handle: 'info@example.com' }, { channel: 'fax', handle: '+852 123' }, { channel: 'facebook', handle: 'https://facebook.com/vendor' }], addresses: [{ id: 'office', label: 'Office', address: 'Office address', city: 'Hong Kong' }, { id: 'shop', label: 'Shop', address: 'Shop address' }] });
    expect(profile?.contacts).toHaveLength(4); expect(profile?.addresses).toHaveLength(2);
    profile = await vendorWrite(db, { contacts: [{ channel: 'email', handle: 'third@example.com' }] });
    expect(profile?.contacts).toHaveLength(5);
    profile = await vendorWrite(db, { contacts: [{ id: 'office-email', channel: 'email', handle: 'corrected@example.com' }] });
    expect(profile?.contacts).toHaveLength(5); expect(profile?.contacts.find((contact: any) => contact.id === 'office-email').handle).toBe('corrected@example.com');
    profile = await vendorWrite(db, { contacts: [profile!.contacts[0]], contacts_mode: 'replace' });
    expect(profile?.contacts).toHaveLength(1);
    profile = await vendorWrite(db, { vendor_code: null, contacts: [], contact_people: [], addresses: [] });
    expect(profile).toMatchObject({ vendor_code: null, contacts: [], contact_people: [], addresses: [] });
    expect(db.sqlite.prepare("SELECT notes FROM customers WHERE id='vendor'").get()).toMatchObject({ notes: null });
  });
  it('validates person references and account ownership before any writes', async () => {
    const db = setup();
    await expect(vendorWrite(db, { contacts: [{ channel: 'email', handle: 'kate@example.com', person_id: 'missing' }] })).rejects.toThrow(/missing person/);
    await expect(prepareVendorStructuredProfileWrite(db as any, auth, 'foreign-vendor', { vendor_code: 'OTHER' })).rejects.toThrow(/account/);
    await expect(vendorWrite(db, { notes: 'misplaced' })).rejects.toThrow(/no structured/);
  });
});
describe('a private quote is one header with linked tea snapshots', () => {
  it.each(['schema','migrations'] as const)('round trips quoted terms/route snapshots on %s without applying them to stock', async shape => {
    const db = setup(shape); const saved = await quoteWrite(db, quote());
    expect(saved).toMatchObject({ reference: 'LKY-2026', issued_to: 'Teajia', minimum_order_amount: 2000, currency: 'HKD', lines: [{ price_amount: 0, discount_percent: 25, route_quotes: [route] }] });
    const tea = db.sqlite.prepare("SELECT * FROM tea_compass_entries WHERE id='tea'").get() as any;
    expect(tea.quote_id).toBe(saved!.id); expect(tea.price_amount).toBeNull(); expect(tea.discount_percent).toBeNull();
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM products WHERE account_id=?').get('a')).toMatchObject({ n: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_ledger WHERE account_id=?').get('a')).toMatchObject({ n: 0 });
    await validateCompassQuoteLink(db as any, 'a', tea);
    await expect(validateCompassQuoteLink(db as any, 'b', { ...tea, account_id: 'b' })).rejects.toThrow();
    const edited = await quoteWrite(db, { issued_to: null }, saved!.id);
    expect(edited).toMatchObject({ issued_to: null, reference: 'LKY-2026', lines: [{ vendor_item_number: 'PE1' }] });
  });
  it('soft removes/reassigns lines and clears prior links without deleting evidence', async () => {
    const db = setup(); const saved = await quoteWrite(db, quote());
    await quoteWrite(db, { lines: [{ id: 'line1', compass_entry_id: 'tea2' }] }, saved!.id);
    expect(db.sqlite.prepare("SELECT quote_id FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ quote_id: null });
    expect(db.sqlite.prepare("SELECT quote_id FROM tea_compass_entries WHERE id='tea2'").get()).toMatchObject({ quote_id: saved!.id });
    await quoteWrite(db, { lines: [] }, saved!.id);
    expect((await getCurateQuote(db as any, auth, saved!.id))?.lines).toEqual([]);
    expect(db.sqlite.prepare("SELECT archived_at FROM curate_quote_lines WHERE id='line1'").get()).not.toMatchObject({ archived_at: null });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_mutations').get()).toMatchObject({ n: 3 });
  });
  it('rejects mismatched vendor/account, missing money provenance and invalid dates', async () => {
    const db = setup();
    await expect(quoteWrite(db, { ...quote(), lines: [{ ...quote().lines[0], compass_entry_id: 'foreign-tea' }] })).rejects.toThrow(/vendor/);
    await expect(quoteWrite(db, { ...quote(), minimum_order_amount: null })).rejects.toThrow(/together/);
    await expect(quoteWrite(db, { ...quote(), quote_date: '2026-02-31' })).rejects.toThrow(/ISO/);
    await expect(quoteWrite(db, { ...quote(), lines: [{ id: 'line', compass_entry_id: 'tea', price_amount: 20, price_currency: 'HKD' }] })).rejects.toThrow(/unit/);
    await expect(quoteWrite(db, { ...quote(), lines: [{ id: 'line', compass_entry_id: 'tea', price_amount: 20, price_per_unit_grams: null }] })).rejects.toThrow(/together/);
  });
  it('agent saves a quote only after durable confirmation', async () => {
    const db = setup(); const tool = curateQuoteTools.handlers.curate_save_quote;
    const preview = await tool({ DB: db } as any, auth, { quote: quote(), agent: 'Builder' }) as any;
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_quotes').get()).toMatchObject({ n: 0 });
    const result = await tool({ DB: db } as any, auth, { confirm: preview.confirmation_token }) as any;
    expect(result.committed).toBe(true); expect(result.quote.reference).toBe('LKY-2026');
    expect((await tool({ DB: db } as any, auth, { confirm: preview.confirmation_token }) as any).error).toMatch(/confirmation/);
  });
});
describe('agent tea fields, visibility and history', () => {
  it('an owner edits another author in this shop without reassigning authorship', async () => {
    const db = setup();
    await intake(db, 'curate_update_tea', { tea_id: 'tea', age_quoted: 'about 20 years', grade: '1', pack_size_grams: 1000, pack_size_label: '1kg bag', vendor_item_number: 'PE1', discount_percent: 0, route_quotes: [route] });
    expect(db.sqlite.prepare("SELECT user_id,age_quoted,discount_percent FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ user_id: 'author', age_quoted: 'about 20 years', discount_percent: 0 });
    const found = await curateIntakeTools.handlers.curate_find({ DB: db } as any, auth, {}) as any;
    expect(found.teas.map((tea: any) => tea.id)).toContain('tea'); expect(found.teas.map((tea: any) => tea.id)).not.toContain('foreign-tea');
    const undo = await previewCurateUndo({ DB: db } as any, auth);
    await confirmCurateMutation({ DB: db } as any, auth, undo.confirmation_token);
    expect(db.sqlite.prepare("SELECT age_quoted FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ age_quoted: null });
  });
  it('undo keeps sampled tea, shelf, transcript and todo snapshots in the same correction', async () => {
    const db = setup('migrations');
    await intake(db, 'curate_update_tea', { tea_id: 'tea', sample_state: 'received', sample_grams: 5, said: 'Five grams received.', todo: 'Taste this tea' });
    const sample = db.sqlite.prepare("SELECT * FROM tea_samples WHERE compass_entry_id='tea'").get() as any;
    expect(sample).toMatchObject({ grams: 5, status: 'received', user_id: 'author' });
    const preview = await previewCurateUndo({ DB: db } as any, auth);
    await confirmCurateMutation({ DB: db } as any, auth, preview.confirmation_token);
    expect(db.sqlite.prepare("SELECT sample_state,sample_set_id,user_id FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ sample_state: null, sample_set_id: null, user_id: 'author' });
    expect((db.sqlite.prepare('SELECT archived_at FROM tea_samples WHERE id=?').get(sample.id) as any).archived_at).toBeTruthy();
    expect((db.sqlite.prepare("SELECT deleted FROM notes WHERE compass_entry_id='tea'").get() as any).deleted).toBe(1);
    expect((db.sqlite.prepare("SELECT deleted_at FROM curate_todos WHERE compass_entry_id='tea'").get() as any).deleted_at).toBeTruthy();
  });
  it('default manager searches hide archived, deleted and merged records', async () => {
    const db = setup();
    db.sqlite.prepare("UPDATE tea_compass_entries SET archived_at='2026-10-08' WHERE id='tea2'").run();
    const result = await curateIntakeTools.handlers.curate_find({ DB: db } as any, auth, {}) as any;
    expect(result.teas.map((tea: any) => tea.id)).toEqual(['tea']);
    expect((await curateIntakeTools.handlers.curate_get_tea({ DB: db } as any, auth, { tea_id: 'tea2' }) as any).error).toBe('not_found');
  });
  it('clears vendor contact channels, nullable profile fields and legacy note aliases explicitly', async () => {
    const db = setup();
    await intake(db, 'curate_save_vendor', { vendor_id: 'vendor', chinese_name: '林奇苑', email: 'one@example.com', phone: '+852123', wechat: 'vendor-handle', vendor_code: 'LKY', storage: 'Hong Kong', addresses: [{ id: 'shop', label: 'Shop', address: 'Address' }] });
    expect(db.sqlite.prepare("SELECT chinese_name FROM customers WHERE id='vendor'").get()).toMatchObject({ chinese_name: '林奇苑' });
    db.sqlite.prepare("UPDATE customers SET notes='Old factual note' WHERE id='vendor'").run();
    await intake(db, 'curate_save_vendor', { vendor_id: 'vendor', clear: ['chinese_name','email','note','storage','vendor_code','addresses'] });
    const profile = await readVendorStructuredProfile(db as any, auth, 'vendor');
    expect(profile).toMatchObject({ vendor_code: null, addresses: [] });
    expect(profile?.contacts.map((contact: any) => contact.channel)).toEqual(['wechat','phone']);
    expect(db.sqlite.prepare("SELECT chinese_name,email,notes,phone FROM customers WHERE id='vendor'").get()).toMatchObject({ chinese_name: null, email: null, notes: null, phone: '+852123' });
    expect(db.sqlite.prepare("SELECT storage FROM curate_vendor_profiles WHERE vendor_id='vendor'").get()).toMatchObject({ storage: null });
  });
  it('quote confirmations refuse header/line changes made after the preview', async () => {
    const db = setup(); const saved = await quoteWrite(db, quote());
    const tool = curateQuoteTools.handlers.curate_save_quote;
    const preview = await tool({ DB: db } as any, auth, { quote_id: saved!.id, quote: { issued_to: 'Reviewed name' } }) as any;
    db.sqlite.prepare('UPDATE curate_quotes SET issued_to=? WHERE id=?').run('Newer correction', saved!.id);
    expect((await tool({ DB: db } as any, auth, { confirm: preview.confirmation_token }) as any).error).toBe('quote_changed_since_preview');
    expect((await getCurateQuote(db as any, auth, saved!.id))?.issued_to).toBe('Newer correction');
  });
  it('refuses unknown facts and all agent note fallbacks while preserving an exact transcript', async () => {
    const db = setup();
    for (const args of [{ note: 'about20years' }, { vendor_note: 'Fax123' }, { quote_reference: 'wrong table' }, { hidden_fact: 'missing field' }]) {
      await expect(curateIntakeTools.handlers.curate_update_tea({ DB: db } as any, auth, { tea_id: 'tea', ...args })).rejects.toThrow();
    }
    await intake(db, 'curate_update_tea', { tea_id: 'tea', said: 'These are the exact words.' });
    expect(db.sqlite.prepare("SELECT text,source_type FROM notes WHERE compass_entry_id='tea'").get()).toMatchObject({ text: 'These are the exact words.', source_type: 'voice' });
    const read = await curateIntakeTools.handlers.curate_get_tea({ DB: db } as any, auth, { tea_id: 'tea' }) as any;
    expect(read.notes[0].id).toEqual(expect.any(String));
    const correction = await previewCurateMutation({ DB: db } as any, auth, { entity: 'transcript', id: read.notes[0].id, action: 'edit', fields: { text: 'Corrected exact words.' } }, 'Codex');
    await confirmCurateMutation({ DB: db } as any, auth, correction.confirmation_token);
    expect(db.sqlite.prepare('SELECT text FROM notes WHERE id=?').get(read.notes[0].id)).toMatchObject({ text: 'Corrected exact words.' });
  });
});
