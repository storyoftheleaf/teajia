/** Durable references include archived records: deleting a contact must not
 * erase the identity behind holdings, commercial evidence, or audit history.
 * The same predicates drive preview counts and the atomic deletion gate. */
const direct = (table: string, columns: string[]) =>
  `SELECT 1 FROM ${table} r WHERE r.account_id = customers.account_id AND (${columns.map(column => `r.${column} = customers.id`).join(' OR ')})`;

export const VENDOR_DEPENDENCIES: Record<string, string> = {
  // Receipt proposals and inventory receipt lines identify the source through
  // their Compass tea/product; arrivals identify it through purchase_orders.
  // Counting those parents also blocks deleting vendors behind these records.
  products: direct('products', ['vendor_id']),
  invoices: direct('invoices', ['customer_id']),
  vendor_groups: direct('curate_import_vendor_groups', ['resolved_vendor_customer_id']),
  product_listings: direct('product_listings', ['vendor_id']),
  curate_teas: direct('tea_compass_entries', ['vendor_id', 'linked_customer_id']),
  samples: direct('tea_samples', ['source_id']),
  sample_sets: direct('tea_sample_sets', ['source_id']),
  visits: direct('curate_visits', ['vendor_id']),
  todos: direct('curate_todos', ['vendor_id']),
  vendor_profiles: direct('curate_vendor_profiles', ['vendor_id']),
  freight_costs: direct('curate_freight_costs', ['vendor_id']),
  quotes: direct('curate_quotes', ['vendor_id']),
  purchase_orders: direct('purchase_orders', ['vendor_id']),
  contributors: direct('contributors', ['contact_customer_id']),
  event_attendees: direct('event_attendees', ['customer_id']),
  interest_signups: direct('interest_signups', ['customer_id']),
  event_party_members: direct('event_party_members', ['customer_id']),
  contact_relationships: direct('contact_relationships', ['customer_id']),
  private_notes: direct('contact_private_notes', ['customer_id']),
  merged_contacts: direct('customers', ['merged_into_id']),
  attachments: `SELECT 1 FROM curate_attachments r WHERE r.account_id = customers.account_id
    AND r.entity_type = 'vendor' AND r.entity_id = customers.id`,
  history: `SELECT 1 FROM curate_mutation_records r WHERE r.account_id = customers.account_id
    AND r.entity_type IN ('vendor','vendor_profile') AND r.entity_id = customers.id`,
};

export async function readVendorDependencies(db: D1Database, accountId: string, vendorId: string) {
  const columns = Object.entries(VENDOR_DEPENDENCIES).map(([key, query]) =>
    `(SELECT COUNT(*) FROM (${query})) AS ${key}`).join(',');
  const row = await db.prepare(`SELECT ${columns} FROM customers WHERE id = ? AND account_id = ?`)
    .bind(vendorId, accountId).first<Record<string, number>>();
  return Object.fromEntries(Object.keys(VENDOR_DEPENDENCIES).map(key => [key, Number(row?.[key] ?? 0)]));
}

export const vendorHasDependencies = (references: Record<string, number>) => Object.values(references).some(count => count > 0);

export async function deleteUnreferencedVendor(db: D1Database, accountId: string, vendorId: string) {
  // One SQLite statement sees dependencies and deletes atomically. A reference
  // arriving after the confirm read still prevents deletion.
  return db.prepare(`DELETE FROM customers WHERE id = ? AND account_id = ?
    ${Object.values(VENDOR_DEPENDENCIES).map(query => `AND NOT EXISTS (${query})`).join('\n')}`)
    .bind(vendorId, accountId).run();
}
