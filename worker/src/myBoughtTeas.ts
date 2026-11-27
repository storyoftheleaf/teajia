import { linkTeaDetail, linkTeaPhotos, LINK_TEA_DETAIL_SQL, type PayLinkTeaLine } from './publicLinkTea';

/**
 * The teas a person has bought, one entry per tea, for the shop to mark
 * (Adrian, 2026-11-27: "a list, kind of like a store of the teas that she
 * bought before... the identical design of the store... it would just say how
 * much she bought"). The shop draws its own rows and its own tea page and adds
 * this one line to the teas in it; a private tea she bought, which the shop
 * does not list, comes with what its page needs.
 *
 * Read from the invoices that are hers (the same ownership as her orders);
 * a voided, cancelled or deleted invoice is not something she bought.
 */
export interface BoughtTea {
  product_id: string;
  account_id: string;
  /** Grams for a tea, pieces for teaware, added up over every invoice. */
  quantity: number;
  unit: 'g' | 'piece';
  last_bought_at: string | null;
  invoice_numbers: string[];
  /** The tea as its last invoice line shows it, for a tea the shop does not list. */
  tea: Omit<PayLinkTeaLine, 'quantity' | 'unit' | 'line_total_usd'>;
}

export async function listMyBoughtTeas(
  env: { DB: D1Database },
  ownership: { predicate: string; bindings: unknown[] },
): Promise<BoughtTea[]> {
  const rows = await env.DB.prepare(
    `SELECT li.product_id, li.quantity, li.custom_name, i.account_id, i.invoice_number, i.created_at AS bought_at,
            p.type, COALESCE(p.given_name, p.product_name) AS product_name,
            p.chinese_name, p.year, p.origin_region, p.origin_country, p.form,
            p.image_url, p.additional_images, p.description, ${LINK_TEA_DETAIL_SQL}
       FROM invoices i
       JOIN invoice_line_items li ON li.invoice_id = i.id AND (li.account_id = i.account_id OR li.account_id IS NULL)
       JOIN products p ON p.id = li.product_id
      WHERE i.deleted_at IS NULL AND i.cancelled_at IS NULL
        AND COALESCE(i.status, '') NOT IN ('Void', 'Cancelled', 'cancelled')
        AND ${ownership.predicate}
      ORDER BY i.created_at DESC, li.rowid ASC
      LIMIT 2000`
  ).bind(...ownership.bindings).all();

  const byTea = new Map<string, BoughtTea>();
  for (const row of (rows.results ?? []) as Record<string, any>[]) {
    const id = String(row.product_id);
    const quantity = Number(row.quantity) || 0;
    const known = byTea.get(id);
    if (known) {
      known.quantity += quantity;
      if (row.invoice_number && !known.invoice_numbers.includes(row.invoice_number)) known.invoice_numbers.push(row.invoice_number);
      continue;
    }
    const images = linkTeaPhotos(row.image_url, row.additional_images);
    byTea.set(id, {
      product_id: id,
      account_id: String(row.account_id),
      quantity,
      unit: row.type === 'Teaware' ? 'piece' : 'g',
      last_bought_at: row.bought_at ?? null,
      invoice_numbers: row.invoice_number ? [row.invoice_number] : [],
      tea: {
        ...linkTeaDetail(row),
        description: typeof row.description === 'string' ? row.description : null,
        images,
        product_id: id,
        name: String(row.custom_name || row.product_name || 'Tea').trim(),
        type: row.type ?? null,
        chinese_name: row.chinese_name ?? null,
        year: row.year == null ? null : Number(row.year),
        origin_region: row.origin_region ?? null,
        origin_country: row.origin_country ?? null,
        form: row.form ?? null,
        image_url: images[0] ?? null,
      },
    });
  }
  return [...byTea.values()];
}
