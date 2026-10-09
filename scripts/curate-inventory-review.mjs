#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const XWT_IDS = [
  '9fde5545-58f8-4c1f-9182-9e4d0b804d85',
  'fe43957f-4d24-4794-9eae-03f725f43925',
  '28244585-7f44-497e-bfec-46748b1e2831',
];
const command = 'node scripts/curate-inventory-review.mjs EXPORT.json --account ACCOUNT_ID [--user USER_ID]';
const normalizeName = (value) => String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase();
const idOf = (row) => row.id;
const isArchived = (row) => row.archived === true || row.archived === 1 || row.archived === '1';

function collection(data, aliases) {
  for (const alias of aliases) {
    const value = data[alias];
    if (value !== undefined) {
      if (!Array.isArray(value)) throw new Error(`${alias} must be an array. Usage: ${command}`);
      return value;
    }
  }
  throw new Error(`Missing collection ${aliases[0]}. Export it as an array, including [] when empty. Usage: ${command}`);
}
function tagsOf(row) {
  if (Array.isArray(row.tags)) return row.tags;
  try { const tags = JSON.parse(row.tags ?? '[]'); return Array.isArray(tags) ? tags : []; } catch { return []; }
}

/** This is a proposal report only. It never mutates the export or database. */
export function reviewCurateInventory(data, { account, user } = {}) {
  if (!account || typeof account !== 'string') throw new Error(`An explicit --account is required. Usage: ${command}`);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`Expected a JSON export object. Usage: ${command}`);
  const entriesAll = collection(data, ['tea_compass_entries', 'entries']);
  const samplesAll = collection(data, ['tea_samples', 'samples']);
  const setsAll = collection(data, ['tea_sample_sets', 'sets']);
  const customersAll = collection(data, ['customers', 'vendors']);
  const productsAll = collection(data, ['products']);
  const collections = { entries: entriesAll, samples: samplesAll, sets: setsAll, customers: customersAll, products: productsAll };
  for (const [name, rows] of Object.entries(collections)) {
    if (rows.some((row) => !row || typeof row !== 'object' || !row.id || !row.account_id)) {
      throw new Error(`${name} contains rows missing id/account_id; ownership cannot be verified. Export explicit ownership columns. Usage: ${command}`);
    }
  }
  const inAccount = (row) => row.account_id === account;
  const entriesInAccount = entriesAll.filter(inAccount);
  const entries = entriesInAccount.filter((row) => !user || row.user_id === user);
  const entryIds = new Set(entries.map(idOf));
  const samplesInAccount = samplesAll.filter(inAccount);
  const setsInAccount = setsAll.filter(inAccount);
  const samples = samplesInAccount.filter((row) => !user || entryIds.has(row.compass_entry_id) || row.user_id === user);
  const relevantSetIds = new Set(samples.map((row) => row.set_id));
  const sets = setsInAccount.filter((row) => !user || relevantSetIds.has(row.id) || row.user_id === user);
  const vendors = customersAll.filter((row) => inAccount(row) && tagsOf(row).includes('vendor'));
  const vendorIds = new Set(vendors.map(idOf));
  const vendorNames = new Map();
  for (const vendor of vendors) {
    const key = normalizeName(vendor.name);
    if (!key) continue;
    vendorNames.set(key, [...(vendorNames.get(key) ?? []), vendor]);
  }
  const setById = new Map(setsInAccount.map((row) => [row.id, row]));
  const isActive = (sample) => {
    const set = setById.get(sample.set_id);
    return Boolean(set) && !isArchived(set);
  };
  const activeByEntry = new Map();
  for (const sample of samplesInAccount.filter(isActive)) {
    if (!sample.compass_entry_id) continue;
    activeByEntry.set(sample.compass_entry_id, [...(activeByEntry.get(sample.compass_entry_id) ?? []), sample]);
  }
  const missingSamples = entries.filter((row) => row.sample_state && !(activeByEntry.get(row.id)?.length))
    .map((row) => ({ entry_id: row.id, user_id: row.user_id ?? null, name: row.name, sample_state: row.sample_state,
      vendor_id: row.vendor_id ?? null, sample_set_id: row.sample_set_id ?? null }));
  const emptyUnnamedSets = sets.filter((row) => !String(row.name ?? '').trim()
    && !samplesInAccount.some((sample) => sample.set_id === row.id))
    .map((row) => ({ set_id: row.id, source_id: row.source_id ?? null, archived: isArchived(row), action: 'Review only; no deletion proposed automatically.' }));
  const groups = new Map();
  for (const sample of samples) {
    const identity = sample.compass_entry_id ? `compass:${sample.compass_entry_id}`
      : sample.product_id ? `product:${sample.product_id}`
      : normalizeName(sample.name) ? `name:${normalizeName(sample.name)}` : `unidentified:${sample.id}`;
    groups.set(identity, [...(groups.get(identity) ?? []), sample]);
  }
  const repeats = [...groups.entries()].filter(([, rows]) => rows.length > 1)
    .map(([identity, rows]) => ({ identity, ambiguous: identity.startsWith('name:'),
      sample_ids: rows.map(idOf), set_ids: [...new Set(rows.map((row) => row.set_id))],
      statuses: rows.map((row) => ({ sample_id: row.id, status: row.status, active: isActive(row) })),
      action: 'Review separate portions and history; never merge or delete automatically.' }));
  const linkReviews = [];
  const reviewLink = (kind, row, idColumn, nameColumn) => {
    const link = row[idColumn];
    if (link && vendorIds.has(link)) return;
    const name = String(row[nameColumn] ?? '').trim();
    const matches = vendorNames.get(normalizeName(name)) ?? [];
    linkReviews.push({ kind, id: row.id, name: row.name ?? null, recorded_vendor_name: name || null,
      recorded_vendor_id: link ?? null, reason: link ? 'Vendor ID is not a vendor-tagged contact in this account.' : 'Missing vendor link.',
      match: matches.length === 1 ? 'single_exact_name' : matches.length > 1 ? 'ambiguous' : name ? 'unmatched' : 'no_name',
      candidate_vendor_ids: matches.map(idOf), action: 'Review only; do not infer or retag a contact.' });
  };
  for (const row of entries) reviewLink('curate', row, 'vendor_id', 'vendor_name');
  for (const row of samples) reviewLink('sample', row, 'source_id', 'source_name');
  for (const row of sets) reviewLink('sample_set', row, 'source_id', 'source_name');
  // Products have no reliable user owner: under --user only linked products are selected.
  const selectedProductIds = new Set([...entries.map((row) => row.draft_product_id), ...samples.map((row) => row.product_id)].filter(Boolean));
  const products = productsAll.filter((row) => inAccount(row) && (!user || selectedProductIds.has(row.id) || entryIds.has(row.source_compass_entry_id)));
  for (const row of products) reviewLink('product', { ...row, vendor_name: row.vendor_name ?? row.vendor }, 'vendor_id', 'vendor_name');
  const ownerCounts = {};
  for (const row of entriesInAccount) {
    const owner = row.user_id ?? '__missing_owner__';
    ownerCounts[owner] = (ownerCounts[owner] ?? 0) + 1;
  }
  const xwtReceived = entries.filter((row) => XWT_IDS.includes(row.id)).map((row) => ({
    entry_id: row.id, name: row.name, user_id: row.user_id ?? null,
    current_state: row.sample_state ?? null, proposed_state: 'received',
    assertion: 'The handoff says this tea was received; this is unverified evidence pending owner review.',
    active_sample_ids: (activeByEntry.get(row.id) ?? []).map(idOf),
  }));
  return {
    mode: 'review_only', scope: { account_id: account, user_id: user ?? null },
    input_counts: Object.fromEntries(Object.entries(collections).map(([key, rows]) => [key, rows.length])),
    account_counts: { entries: entriesInAccount.length, samples: samplesInAccount.length, sets: setsInAccount.length },
    selected_counts: { entries: entries.length, samples: samples.length, sets: sets.length, products: products.length, vendor_contacts: vendors.length },
    curate_owners_in_account: ownerCounts,
    limitations: [
      'No network requests, writes, deletes, merges, retags or backfill are performed.',
      'An export is a snapshot; verify live scope and approval before any later mutation.',
      ...(user ? ['User selection includes linked samples/sets and explicit user_id matches. Unlinked ownerless samples/sets are excluded, never assumed to belong to this user.'] : []),
      'A same-name match is a review candidate, not proof that two records refer to the same vendor.',
    ],
    sampled_curate_missing_active_samples: missingSamples,
    xwt_received_assertions_pending_review: xwtReceived,
    xwt_ids_absent_from_selected_scope: XWT_IDS.filter((id) => !entryIds.has(id)),
    empty_unnamed_sets: emptyUnnamedSets,
    repeated_sample_identities: repeats,
    vendor_link_reviews: linkReviews,
    exact_single_vendor_name_candidates: linkReviews.filter((row) => row.match === 'single_exact_name'),
    unmatched_or_ambiguous_vendor_names: linkReviews.filter((row) => row.match === 'unmatched' || row.match === 'ambiguous'),
  };
}

export async function main(args = process.argv.slice(2)) {
  const file = args[0];
  let account, user;
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || value.startsWith('--') || !['--account', '--user'].includes(flag)) throw new Error(`Unknown/missing argument ${flag}. Usage: ${command}`);
    if (flag === '--account') { if (account) throw new Error(`Duplicate --account. Usage: ${command}`); account = value; }
    else { if (user) throw new Error(`Duplicate --user. Usage: ${command}`); user = value; }
  }
  if (!file || file.startsWith('--') || !account) throw new Error(`Export path and --account are required. Usage: ${command}`);
  let data;
  try { data = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { throw new Error(`Cannot read JSON export ${file}: ${error.message}. Usage: ${command}`); }
  return reviewCurateInventory(data, { account, user });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
