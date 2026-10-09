import { prepareCurateRecordedWrite, requireCurateManager, type CurateRecordedChange } from './curateMutations';
import { mergeVendorContacts, readVendorStructuredPatch, VENDOR_STRUCTURED_COLUMNS, type VendorContactEndpoint, type VendorContactPerson } from '../../src/lib/curateStructuredFields';
type Scope = { accountId: string; userId?: string; agent?: string };
type Row = Record<string, any>;
function array(raw: unknown): any[] { if (Array.isArray(raw)) return raw; try { const value = JSON.parse(String(raw ?? '[]')); return Array.isArray(value) ? value : []; } catch { return []; } }
export async function readVendorStructuredProfile(db: D1Database, scope: Scope, vendorId: string): Promise<Row | null> {
  const vendor = await db.prepare('SELECT id, contacts FROM customers WHERE id = ? AND account_id = ?').bind(vendorId, scope.accountId).first<Row>();
  if (!vendor) return null;
  const profile = await db.prepare('SELECT * FROM curate_vendor_profiles WHERE vendor_id = ? AND account_id = ?').bind(vendorId, scope.accountId).first<Row>();
  return { vendor_id: vendorId, vendor_code: profile?.vendor_code ?? null, contact_people: array(profile?.contact_people), addresses: array(profile?.addresses), contacts: array(vendor.contacts) };
}
export async function prepareVendorStructuredProfileWrite(db: D1Database, scope: Scope, vendorId: string, raw: Record<string, unknown>): Promise<{ statements: D1PreparedStatement[] }> {
  const unknown = Object.keys(raw).find(key => !(VENDOR_STRUCTURED_COLUMNS as readonly string[]).includes(key));
  if (unknown) throw new Error(`${unknown} has no structured vendor field`);
  const current = await readVendorStructuredProfile(db, scope, vendorId);
  if (!current) throw new Error('Vendor not found in this account');
  const collision = await db.prepare('SELECT * FROM curate_vendor_profiles WHERE vendor_id = ?').bind(vendorId).first<Row>();
  if (collision && collision.account_id !== scope.accountId) throw new Error('Vendor profile belongs to another account');
  const patch = readVendorStructuredPatch(raw);
  const people: VendorContactPerson[] = patch.contact_people ?? current.contact_people;
  const contacts: VendorContactEndpoint[] = patch.contacts === undefined ? current.contacts : patch.contacts_mode === 'replace' ? patch.contacts : mergeVendorContacts(current.contacts, patch.contacts);
  for (const contact of contacts) if (contact.person_id && !people.some(person => person.id === contact.person_id)) throw new Error(`Contact refers to missing person ${contact.person_id}`);
  if (!scope.userId) throw new Error('Vendor editor identity is required');
  await requireCurateManager(db, { accountId: scope.accountId, userId: scope.userId });
  const changes: CurateRecordedChange[] = [];
  if (patch.contacts !== undefined) {
    const vendor = await db.prepare('SELECT * FROM customers WHERE id = ? AND account_id = ?').bind(vendorId, scope.accountId).first<Row>();
    changes.push({ entityType: 'vendor', entityId: vendorId, before: vendor!, after: { ...vendor, contacts: JSON.stringify(contacts), updated_at: new Date().toISOString() } });
  }
  const columns = ['vendor_code','contact_people','addresses'].filter(key => raw[key] !== undefined);
  if (columns.length) {
    const after: Row = { ...(collision ?? {}), vendor_id: vendorId, account_id: scope.accountId, updated_by_agent: scope.agent ?? null, updated_at: new Date().toISOString() };
    for (const key of columns) after[key] = key === 'vendor_code' ? patch.vendor_code : JSON.stringify((patch as Row)[key]);
    changes.push({ entityType: 'vendor_profile', entityId: vendorId, before: collision, after });
  }
  if (!changes.length) return { statements: [] };
  const write = prepareCurateRecordedWrite(db, { accountId: scope.accountId, userId: scope.userId }, { commandType: 'vendor:structured_fields', agent: scope.agent, changes });
  return { statements: [...write.statements, write.assertion] };
}
