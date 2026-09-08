/**
 * One row of a pasted spreadsheet, turned into the payload the create takes.
 *
 * It lives out here rather than inside `CsvImportModal` because it was inside
 * `CsvImportModal`, where nothing could reach it. The guard on this door was a
 * scan of the component's source for the expression that carried the bug, and a
 * scan can only tell you the source still says the right thing: appending
 * `?? 0` to the cost reader left the whole suite green while every blank price
 * cell went back to being a free tea. A function that can be called can be
 * asked what it does with a blank cell, and answer.
 *
 * Pure by construction. No React, no toast, no network, so a test costs nothing
 * to run and the component keeps only what it genuinely owns: the file, the
 * review grid, and what the server said about each line.
 */

import { TEA_TYPES, NON_TEA_TYPES } from '../../wisdom';
import { enteredCostCell } from '../productUpdatePayload';
import { knownCurrency } from '../../lib/currency';

/** A staged line as the review grid holds it: every cell still a string. */
export interface CsvStagingRow {
  id: string;
  type: string;
  givenName: string;
  chineseName: string;
  productName: string;
  form: string;
  year: string;
  grams: string; // Grams / Quantity Purchased
  costAmount: string; // Raw cost amount
  currency: string; // Raw currency code
  stockAmount: string;
  vendor: string;
  originCountry: string;
  originRegion: string;
  status: string; // 'Active' or 'Draft'
  isPersonal: boolean;
  purpose: 'working' | 'sample' | 'personal';
  canReorder: boolean;
  description: string;
  lore: string;
  tastingNotes: string;
  processingNotes: string;
  terroir: string;
  mood: string;
  experience: string;
  material: string;
  capacityMl: string;
  teawareCategory: string;
  quantityUnits: string;
  isValid: boolean;
  errors: string[];
  serverIssue?: string;
}

/** The words a person writes in a cell when they do not know the figure. */
export const isMissingOrUnknown = (val: unknown): boolean => {
  if (!val) return true;
  const v = val.toString().toLowerCase().trim();
  return v === '' || v === 'unknown' || v === 'nan' || v === 'null' || v === 'undefined';
};

/**
 * A count read out of a hand-typed cell: grams, units, a capacity.
 *
 * Nothing written is 0, which is the honest reading for a count and the exact
 * opposite of the honest reading for money. Zero grams is an empty shelf; zero
 * cost is a free tea, priced at zero times three. Money goes through
 * `enteredCostCell` instead, which answers null.
 */
export const parseCountCell = (val: unknown): number => {
  if (isMissingOrUnknown(val)) return 0;
  const cleanStr = val!.toString().replace(/[^0-9.-]/g, '');
  return parseFloat(cleanStr) || 0;
};

const parseOptionalCount = (val: unknown): number | null =>
  isMissingOrUnknown(val) ? null : parseCountCell(val);

/**
 * The currency token a sheet wrote, as one of the shop's own codes.
 *
 * `UNK` is what an unrecognised token becomes, and it is not a currency: it is
 * this codebase's sentinel for one nobody recorded, which the server refuses by
 * name. That refusal is now per row, so a single unreadable cell costs its own
 * line and not the file.
 *
 * The sentinel is all that is left here. Which spellings mean which money is
 * the shared map's answer, in `src/lib/currency.ts`. This file kept a six-line
 * copy of it written as includes() lists, which had lost AUD and MYR entirely:
 * a sheet whose currency column said AUD was read as a currency nobody
 * recorded, and every row of it was refused by the server by name.
 */
export const normalizeImportCurrency = (raw: unknown): string => {
  if (isMissingOrUnknown(raw)) return 'UNK';
  return knownCurrency(raw!.toString()) ?? 'UNK';
};

const VALID_FORMS = ['Loose', 'Cake', 'Tuo', 'Brick', 'Rolled', 'Ball', 'Powder', 'Bag', 'Other'];

/** Types this shop retired, folded into the one that replaced them. */
const RETIRED_TO_HERBAL = ['matcha', 'flower'];

/** The shop's type vocabulary, matched case-insensitively against the sheet. */
export const normalizeImportType = (raw: string): string => {
  const validTypes: string[] = [...TEA_TYPES, ...NON_TEA_TYPES];
  let typeToSave = RETIRED_TO_HERBAL.includes((raw || '').toLowerCase()) ? 'Herbal' : raw;
  const matched = validTypes.find(t => t.toLowerCase() === (typeToSave || '').toLowerCase());
  if (matched) return matched;
  // Misc rather than an error: a row with an unreadable type is still a tea
  // somebody bought, and the review grid can be told which line to fix.
  return typeToSave || 'Misc';
};

/**
 * One staged row as the create payload, with empty columns stripped out.
 *
 * The stripping is why a blank price must arrive here as null and not as 0: a
 * null is dropped, so the column is never named, and the server refuses the row
 * by name rather than storing a zero that reads as free. A TYPED zero is a
 * number and travels, because a vendor's gift is a real tea and typing 0 says
 * so.
 */
export function csvRowToProduct(r: CsvStagingRow): Record<string, any> {
  const stock = parseOptionalCount(r.stockAmount);
  const qtyPurchased = parseCountCell(r.grams);
  const cost = enteredCostCell(r.costAmount);

  // "1980s" is a real answer about a year and is kept as written.
  const year = r.year && !isMissingOrUnknown(r.year) ? r.year.toString().trim() : null;

  const matchedForm = VALID_FORMS.find(f => f.toLowerCase() === (r.form || '').toLowerCase());
  const hasWisdom = !!(r.lore || r.tastingNotes || r.mood || r.experience);

  const row: Record<string, any> = {
    type: normalizeImportType(r.type),
    given_name: r.givenName || null,
    chinese_name: r.chineseName || null,
    product_name: r.productName || r.givenName || 'Unnamed Product',
    form: matchedForm || null,
    year,
    origin_country: r.originCountry || 'Unknown',
    origin_region: r.originRegion || null,
    quantity_purchased: qtyPurchased,
    cost_amount: cost,
    cost_currency: normalizeImportCurrency(r.currency),
    vendor: r.vendor || null,
    description: r.description || null,
    status: r.status,
    is_personal: !!r.isPersonal,
    inventory_purpose: r.purpose,
    can_reorder: !!r.canReorder,
    lore: r.lore || null,
    tasting_notes: r.tastingNotes ? r.tastingNotes.split(',').map((s: string) => s.trim()).filter(Boolean) : null,
    processing_notes: r.processingNotes || null,
    terroir: r.terroir || null,
    mood: r.mood || null,
    experience: r.experience || null,
    is_custom_wisdom: false,
    show_wisdom: hasWisdom,
    material: r.material || null,
    capacity_ml: parseCountCell(r.capacityMl) || null,
    teaware_category: r.teawareCategory || null,
    client_row_id: r.id,
  };

  if ((r.type || '').toLowerCase() === 'teaware') {
    const units = parseOptionalCount(r.quantityUnits);
    if (units !== null) row.quantity_units = units;
  } else if (stock !== null) {
    row.stock_grams = stock;
  }

  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && v !== undefined && v !== '') cleaned[k] = v;
  }
  return cleaned;
}
