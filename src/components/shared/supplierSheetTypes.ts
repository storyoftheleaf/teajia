/** What the Supplier sheet reads from /api/suppliers/:id/*. Mirrors worker/src/supplierRename.ts. */

export interface SupplierRenameCount {
  table: string;
  /** In words: "teas in Curate", "orders". */
  label: string;
  by_id: number;
  by_name: number;
}

export interface SupplierRenamePreview {
  vendor_id: string;
  old_name: string;
  new_name: string;
  counts: SupplierRenameCount[];
  total: number;
}

export interface SupplierFreightBill {
  id: string;
  leg: string;
  mode: string | null;
  total_amount: number;
  currency: string;
  weight_kg: number;
  per_kg: number;
  per_kg_usd: number | null;
  transit_days: number | null;
  observed_on: string;
  current: boolean;
}

/** The supplier card as GET /api/customers/:id returns it (only what the sheet shows). */
export interface SupplierCard {
  id: string;
  name: string;
  company?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  email?: string | null;
  wechat?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
}

/** The contact fields the sheet edits, in the order it shows them. */
export const CONTACT_FIELDS: ReadonlyArray<{ key: keyof SupplierCard; label: string; inputMode?: 'text' | 'tel' | 'email'; placeholder: string }> = [
  { key: 'whatsapp', label: 'WhatsApp', inputMode: 'tel', placeholder: 'add a number' },
  { key: 'wechat', label: 'WeChat', placeholder: 'add an id' },
  { key: 'phone', label: 'Phone', inputMode: 'tel', placeholder: 'add a number' },
  { key: 'email', label: 'Email', inputMode: 'email', placeholder: 'add an address' },
  { key: 'company', label: 'Shop', placeholder: 'add the shop name' },
  { key: 'address', label: 'Address', placeholder: 'add an address' },
  { key: 'city', label: 'City', placeholder: 'add a city' },
  { key: 'country', label: 'Country', placeholder: 'add a country' },
];

/** The preview as one sentence: "This changes 14 teas in Curate, 3 orders and the supplier card." */
export function describeRename(preview: SupplierRenamePreview): string {
  const parts = preview.counts
    .filter((c) => c.table !== 'customers' && c.by_id + c.by_name > 0)
    .map((c) => `${c.by_id + c.by_name} ${c.label}`);
  if (parts.length === 0) return 'This changes the supplier card. Nothing else carries the name yet.';
  const last = parts.pop()!;
  const list = parts.length ? `${parts.join(', ')} and ${last}` : last;
  return `This changes ${list}, and the supplier card.`;
}
