/**
 * Two display names an agent could not reach, and the one rule they share.
 *
 * Thirteen shelf records showed Chinese where the shop prints a supplier, and
 * nothing in Curate could correct them. `update_tea_catalog` edits the catalog
 * columns and deliberately does not touch `products.vendor`, which is the
 * free-text line the inventory list actually reads; `link_vendor_products`
 * writes the `vendor_id` link and leaves that line exactly as it was. A sample
 * set's own `name` and the `source_name` it is filed under had no agent door
 * at all.
 *
 * Both are the same job - a name a person reads - so both are refused the same
 * way when the name arrives in Han script. English first; the Chinese belongs
 * in `chinese_name` on the vendor card, where the surface already shows it as a
 * secondary line. Refusing rather than storing it is the point: accepting it is
 * how the thirteen rows happened, one call at a time through a door with no
 * form and nobody watching.
 *
 * Both tools are Curate recorded writes (`curateMutations.ts`), so the change
 * is attributed in `curate_history` with the agent's name, lands whole or not
 * at all behind the same full-row snapshot guard, and comes back off through
 * `curate_undo`. The listing mirror rides in the SAME recorded batch rather
 * than being appended beside it, because a mirror undo cannot reach is a
 * second copy of the name, free to drift from the one the shelf reads.
 */
import { prepareCurateRecordedWrite, requireCurateManager, type CurateRecordedChange } from '../curateMutations';
import { sha256Hex } from '../inquiryDomain';
import { agentName, str } from './curateIntake';
import { INVALID_TICKET, consumeTicket, issueTicket, previewEnvelope, type TicketPayload } from './tickets';
import type { ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';

type Row = Record<string, any>;

/**
 * Han script, which covers the U+3400 to U+9FFF range and every other Han
 * block with it. `curateImports.ts` already refuses a hand-built item name this
 * way, so this is the shop's existing reading rather than a second one.
 */
const HAN_SCRIPT = /\p{Script=Han}/u;

/** Up to this many shelf rows in one preview; thirteen was the real batch. */
const MAX_PRODUCTS = 50;

function refuseChinese(field: string, value: string): void {
  if (!HAN_SCRIPT.test(value)) return;
  throw new Error(`${field} is read by people in English; Chinese belongs in chinese_name on the vendor card, never here`);
}

/**
 * The stamp `datetime('now')` writes, not an ISO one.
 *
 * Every other writer of `products.updated_at` and `tea_sample_sets.updated_at`
 * uses SQLite's own `datetime('now')`, which is `YYYY-MM-DD HH:MM:SS` in UTC. A
 * recorded write has to compute the value in JS so the `after` snapshot matches
 * what lands, and an ISO stamp with its `T` and `Z` would leave two shapes in
 * one column for anything that sorts or compares it as text.
 */
const sqliteNow = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function refuseUnknownFields(tool: string, args: Record<string, unknown> | undefined, allowed: string[]): void {
  const unknown = Object.keys(args ?? {}).find(key => !allowed.includes(key));
  if (unknown) throw new Error(`${unknown} has no field on ${tool}`);
}

/* --------------------------- curate_set_product_vendor -------------------- */

interface ProductVendorTicket extends TicketPayload {
  kind: 'curate:set_product_vendor';
  userId: string;
  agent: string;
  productIds: string[];
  vendorText: string;
  vendorId: string | null;
  digest: string;
}

interface ProductVendorPlan {
  items: Array<{
    product_id: string;
    product: string;
    vendor: { from: string | null; to: string };
    vendor_id: { from: string | null; to: string | null };
    changes: boolean;
  }>;
  missing_product_ids: string[];
  changes: CurateRecordedChange[];
  digest: string;
}

/**
 * What the preview showed and what the confirm will write, from one function.
 *
 * It is recomputed at confirmation rather than carried in the ticket: fifty
 * full `products` rows is a payload nobody needs to store, and a plan rebuilt
 * from the live rows is the only one whose snapshot guard is about the row that
 * is actually there. `digest` is what makes that safe - it is the before-state
 * the preview printed, so a supplier line that moved in between refuses by name
 * instead of being quietly overwritten by a read-back nobody saw.
 */
async function planProductVendor(
  env: ToolEnv, accountId: string, productIds: string[], vendorText: string, vendorId: string | null,
): Promise<ProductVendorPlan> {
  const placeholders = productIds.map(() => '?').join(',');
  const products = (await env.DB.prepare(
    `SELECT * FROM products WHERE account_id = ? AND id IN (${placeholders})`
  ).bind(accountId, ...productIds).all<Row>()).results ?? [];
  const listings = (await env.DB.prepare(
    `SELECT * FROM product_listings WHERE account_id = ? AND legacy_product_id IN (${placeholders})`
  ).bind(accountId, ...productIds).all<Row>()).results ?? [];

  const now = sqliteNow();
  const items: ProductVendorPlan['items'] = [];
  const missing: string[] = [];
  const changes: CurateRecordedChange[] = [];

  for (const id of productIds) {
    const row = products.find(p => p.id === id);
    if (!row) { missing.push(id); continue; }
    /* An explicit vendor text with no card leaves the existing link alone: the
       name on the shelf is what was asked for, and dropping the link as well
       would be a second change nobody previewed. */
    const nextVendorId = vendorId ?? (row.vendor_id ?? null);
    const willChange = (row.vendor ?? null) !== vendorText || (row.vendor_id ?? null) !== nextVendorId;
    items.push({
      product_id: id,
      product: (row.given_name || row.product_name) as string,
      vendor: { from: row.vendor ?? null, to: vendorText },
      vendor_id: { from: row.vendor_id ?? null, to: nextVendorId },
      changes: willChange,
    });
    if (!willChange) continue;
    changes.push({ entityType: 'product', entityId: id, before: row, after: { ...row, vendor: vendorText, vendor_id: nextVendorId, updated_at: now } });
    const listing = listings.find(l => l.legacy_product_id === id);
    if (listing && ((listing.vendor ?? null) !== vendorText || (listing.vendor_id ?? null) !== nextVendorId)) {
      changes.push({ entityType: 'product_listing', entityId: listing.id, before: listing, after: { ...listing, vendor: vendorText, vendor_id: nextVendorId, updated_at: now } });
    }
  }

  const digest = await sha256Hex(JSON.stringify(items.map(i => [i.product_id, i.vendor.from, i.vendor_id.from])));
  return { items, missing_product_ids: missing, changes, digest };
}

const setProductVendor: ToolHandler = async (env, auth, args) => {
  refuseUnknownFields('curate_set_product_vendor', args, ['product_id', 'product_ids', 'vendor_id', 'vendor', 'agent', 'confirm']);
  const confirm = str(args?.confirm, 100);

  if (confirm) {
    const ticket = await consumeTicket<ProductVendorTicket, 'curate:set_product_vendor'>(env, confirm, 'curate:set_product_vendor', auth);
    if (!ticket || ticket.userId !== auth.userId) return INVALID_TICKET;
    await requireCurateManager(env.DB, auth);
    const plan = await planProductVendor(env, auth.accountId, ticket.productIds, ticket.vendorText, ticket.vendorId);
    if (plan.digest !== ticket.digest) {
      return { error: 'product_changed_since_preview', message: 'A supplier line moved since the preview. Preview it again and read the new one back.' };
    }
    if (!plan.changes.length) return { error: 'nothing_to_change', message: 'Every one of those products already shows that supplier.' };
    const prepared = prepareCurateRecordedWrite(env.DB, auth, {
      commandType: 'product:set_vendor', agent: ticket.agent, changes: plan.changes, idempotencyKey: await sha256Hex(confirm),
    });
    const result = await env.DB.batch(prepared.statements);
    if (!result[0]?.meta?.changes) {
      return { error: 'stale_preview', message: 'A product changed while confirming. Preview the supplier line again.' };
    }
    const written = plan.changes.filter(c => c.entityType === 'product');
    return {
      committed: true,
      action: 'curate_set_product_vendor',
      mutation_id: prepared.mutationId,
      vendor: ticket.vendorText,
      vendor_id: ticket.vendorId,
      product_ids: written.map(c => c.entityId),
      product_count: written.length,
      listings_mirrored: plan.changes.length - written.length,
      undo: 'curate_undo with this mutation_id puts every one of these names back.',
    };
  }

  const ids = [...new Set([
    ...(Array.isArray(args?.product_ids) ? args.product_ids.map((id: unknown) => str(id, 100)) : []),
    str(args?.product_id, 100),
  ].filter(Boolean) as string[])];
  if (!ids.length) throw new Error('product_id or product_ids is required. Find them with search_tea.');
  if (ids.length > MAX_PRODUCTS) throw new Error(`Up to ${MAX_PRODUCTS} products in one call; ${ids.length} were sent.`);

  const vendorId = str(args?.vendor_id, 100);
  const explicit = str(args?.vendor, 200);
  if (vendorId && explicit) throw new Error('Send vendor_id to take the name off the vendor card, or vendor to write the text, never both.');
  if (!vendorId && !explicit) throw new Error('Send vendor_id (a vendor card from curate_find) or vendor (the supplier name in English).');

  let vendorText: string;
  let card: Row | null = null;
  if (vendorId) {
    card = await env.DB.prepare('SELECT id, name, chinese_name FROM customers WHERE id = ? AND account_id = ?')
      .bind(vendorId, auth.accountId).first<Row>();
    if (!card) return { error: 'vendor_not_found', message: 'No vendor card with that id in this shop. Find it with curate_find.' };
    /* The card's English name, never its chinese_name: the shelf line is what
       the inventory list and every export read, and the card already carries
       the Chinese on its own secondary line. */
    const name = str(card.name, 200);
    if (!name) return { error: 'vendor_card_has_no_name', message: 'That vendor card has no English name. Set one with rename_supplier first.' };
    if (HAN_SCRIPT.test(name)) {
      return {
        error: 'vendor_card_name_is_chinese',
        message: `The vendor card is called "${name}", which is Chinese. Fix the card first with rename_supplier; Chinese belongs in chinese_name on the card.`,
      };
    }
    vendorText = name;
  } else {
    refuseChinese('vendor', explicit as string);
    vendorText = explicit as string;
  }

  await requireCurateManager(env.DB, auth);
  const plan = await planProductVendor(env, auth.accountId, ids, vendorText, vendorId);
  if (!plan.items.length) return { error: 'products_not_found', missing_product_ids: plan.missing_product_ids };

  const token = await issueTicket<ProductVendorTicket>(env, {
    kind: 'curate:set_product_vendor', accountId: auth.accountId, userId: auth.userId, agent: agentName(args),
    productIds: ids, vendorText, vendorId, digest: plan.digest,
  }, auth.tokenId);
  return previewEnvelope({
    action: 'curate_set_product_vendor',
    read_back: `Show ${plan.items.filter(i => i.changes).length} of ${plan.items.length} teas as "${vendorText}".`,
    vendor: vendorText,
    vendor_id: vendorId,
    vendor_from_card: card ? { id: card.id, name: card.name, chinese_name: card.chinese_name ?? null } : null,
    products: plan.items,
    product_count: plan.items.filter(i => i.changes).length,
    already_showing_it: plan.items.filter(i => !i.changes).map(i => i.product_id),
    missing_product_ids: plan.missing_product_ids.length ? plan.missing_product_ids : undefined,
    undoable: true,
    note: 'The supplier line only. Cost, freight, stock and the catalog fields are untouched.',
  }, token);
};

/* --------------------------- curate_update_sample_set --------------------- */

interface SampleSetTicket extends TicketPayload {
  kind: 'curate:update_sample_set';
  userId: string;
  agent: string;
  setId: string;
  name?: string;
  sourceName?: string | null;
  digest: string;
}

async function planSampleSet(
  env: ToolEnv, accountId: string, setId: string, fields: { name?: string; sourceName?: string | null },
): Promise<{ row: Row; after: Row; digest: string } | null> {
  const row = await env.DB.prepare('SELECT * FROM tea_sample_sets WHERE id = ? AND account_id = ?')
    .bind(setId, accountId).first<Row>();
  if (!row) return null;
  /* `source_id` is never touched here. Renaming the line a person reads is not
     the same fact as which vendor card the set hangs off, and moving both from
     one call would retag the set's sourcing without anyone asking. */
  const after: Row = { ...row, updated_at: sqliteNow() };
  if (fields.name !== undefined) after.name = fields.name;
  if (fields.sourceName !== undefined) after.source_name = fields.sourceName;
  return { row, after, digest: await sha256Hex(JSON.stringify([row.name ?? null, row.source_name ?? null])) };
}

const updateSampleSet: ToolHandler = async (env, auth, args) => {
  refuseUnknownFields('curate_update_sample_set', args, ['set_id', 'name', 'source_name', 'agent', 'confirm']);
  const confirm = str(args?.confirm, 100);

  if (confirm) {
    const ticket = await consumeTicket<SampleSetTicket, 'curate:update_sample_set'>(env, confirm, 'curate:update_sample_set', auth);
    if (!ticket || ticket.userId !== auth.userId) return INVALID_TICKET;
    await requireCurateManager(env.DB, auth);
    const plan = await planSampleSet(env, auth.accountId, ticket.setId, { name: ticket.name, sourceName: ticket.sourceName });
    if (!plan) return { error: 'sample_set_not_found' };
    if (plan.digest !== ticket.digest) {
      return { error: 'sample_set_changed_since_preview', message: 'The set was renamed since the preview. Preview it again and read the new one back.' };
    }
    const prepared = prepareCurateRecordedWrite(env.DB, auth, {
      commandType: 'sample_set:rename', agent: ticket.agent, idempotencyKey: await sha256Hex(confirm),
      changes: [{ entityType: 'sample_set', entityId: ticket.setId, before: plan.row, after: plan.after }],
    });
    const result = await env.DB.batch(prepared.statements);
    if (!result[0]?.meta?.changes) {
      return { error: 'stale_preview', message: 'The set changed while confirming. Preview the rename again.' };
    }
    return {
      committed: true,
      action: 'curate_update_sample_set',
      mutation_id: prepared.mutationId,
      set_id: ticket.setId,
      name: plan.after.name,
      source_name: plan.after.source_name ?? null,
      source_id: plan.after.source_id ?? null,
      undo: 'curate_undo with this mutation_id puts the old names back.',
    };
  }

  /* Both id shapes are the same column: a set built by the sample bridge is
     `curate-set-<hex>` and one created in the app is a plain uuid, so nothing
     here parses the id - it is matched exactly, within this shop. */
  const setId = str(args?.set_id, 100);
  if (!setId) throw new Error('set_id is required. Find it with list_sample_sets.');

  const fields: { name?: string; sourceName?: string | null } = {};
  if (args?.name !== undefined) {
    const name = str(args.name, 200);
    if (!name) throw new Error('name must be the set\'s name; a set needs one. Send source_name: null to clear a source.');
    refuseChinese('name', name);
    fields.name = name;
  }
  if (args?.source_name !== undefined) {
    if (args.source_name === null) fields.sourceName = null;
    else {
      const source = str(args.source_name, 200);
      if (!source) throw new Error('source_name must be a name, or null to clear it.');
      refuseChinese('source_name', source);
      fields.sourceName = source;
    }
  }
  if (fields.name === undefined && fields.sourceName === undefined) {
    throw new Error('Send name, source_name, or both.');
  }

  await requireCurateManager(env.DB, auth);
  const plan = await planSampleSet(env, auth.accountId, setId, fields);
  if (!plan) return { error: 'sample_set_not_found', message: 'No sample set with that id in this shop.' };
  if (plan.after.name === plan.row.name && (plan.after.source_name ?? null) === (plan.row.source_name ?? null)) {
    return { error: 'nothing_to_change', message: 'The set already reads that way.' };
  }

  const token = await issueTicket<SampleSetTicket>(env, {
    kind: 'curate:update_sample_set', accountId: auth.accountId, userId: auth.userId, agent: agentName(args),
    setId, ...(fields.name !== undefined ? { name: fields.name } : {}),
    ...(fields.sourceName !== undefined ? { sourceName: fields.sourceName } : {}),
    digest: plan.digest,
  }, auth.tokenId);
  return previewEnvelope({
    action: 'curate_update_sample_set',
    set_id: setId,
    name: { from: plan.row.name ?? null, to: plan.after.name ?? null },
    source_name: { from: plan.row.source_name ?? null, to: plan.after.source_name ?? null },
    source_id_unchanged: plan.row.source_id ?? null,
    archived: !!plan.row.archived,
    undoable: true,
    note: 'The set\'s own names only. The vendor it is filed under (source_id), its samples and its notes are untouched.',
  }, token);
};

/* ------------------------------- definitions ------------------------------ */

const AGENT_PROP = { type: 'string', description: 'Who is calling, in one word: GrokBot, Hermes, ChatGPT, Claude. Shown to Adrian beside what you wrote.' };
const CONFIRM_PROP = { type: 'string', description: 'The confirmation_token from the preview. Send it only after Adrian said yes to the read-back.' };

const defs: ToolDefinition[] = [
  {
    name: 'curate_set_product_vendor',
    scope: 'stock:write',
    annotations: { destructiveHint: true },
    description: 'Set the supplier line shown on shelf products: the free-text vendor field the inventory list prints, which update_tea_catalog does not touch. Send vendor_id to take the name off a vendor card (its English name, never its chinese_name, and the product is linked to that card too), or vendor to write the text yourself. Up to 50 product ids in one call. Chinese is refused: English here, Chinese in chinese_name on the vendor card. Two steps, read the preview back then confirm. Attributed in curate_history and reversible with curate_undo.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'One shelf product id from search_tea.' },
        product_ids: { type: 'array', items: { type: 'string' }, description: 'Up to 50 shelf product ids from search_tea.' },
        vendor_id: { type: 'string', description: 'A vendor card id from curate_find or find_customer. Its English name becomes the shelf line, and the product is linked to it.' },
        vendor: { type: 'string', description: 'The supplier name to show, in English, when there is no card for them. Chinese characters are refused.' },
        agent: AGENT_PROP,
        confirm: CONFIRM_PROP,
      },
      additionalProperties: false,
    },
  },
  {
    name: 'curate_update_sample_set',
    scope: 'stock:write',
    annotations: { destructiveHint: true },
    description: 'Rename a sample set: its own name, the source_name shown on it, or both. Send source_name null to clear it. The vendor the set is filed under (source_id), its sample portions and its notes are untouched. Ids are matched exactly, so curate-set-<hex> and plain uuid sets both work. Chinese is refused: English here, Chinese in chinese_name on the vendor card. Two steps, read the preview back then confirm. Attributed in curate_history and reversible with curate_undo.',
    inputSchema: {
      type: 'object',
      properties: {
        set_id: { type: 'string', description: 'The set id from list_sample_sets.' },
        name: { type: 'string', description: 'What the set is really called, in English.' },
        source_name: { type: ['string', 'null'], description: 'The source shown on the set, in English. Null clears it.' },
        agent: AGENT_PROP,
        confirm: CONFIRM_PROP,
      },
      required: ['set_id'],
      additionalProperties: false,
    },
  },
];

export const curateDisplayNameTools: ToolModule = {
  area: 'curate-display-names',
  defs,
  handlers: {
    curate_set_product_vendor: setProductVendor,
    curate_update_sample_set: updateSampleSet,
  },
};
