import { tastingJsonWithoutScores } from './publicScores';

// What a private link (a /c/ collection, an invoice's pay page) may show about
// each tea: the shop's own photographs and facts, so the link reads like a
// part of the shop. Nothing here says what a tea cost or where it is stocked.

/** The product's photos in shop order: the main one, then the others. At most four. */
export function linkTeaPhotos(imageUrl: unknown, additionalImages: unknown): string[] {
  const out: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== 'string') return;
    const url = value.trim();
    if (/^https?:\/\//i.test(url) && !out.includes(url)) out.push(url);
  };
  push(imageUrl);
  let extra: unknown = additionalImages;
  if (typeof extra === 'string') {
    try { extra = JSON.parse(extra); } catch { extra = []; }
  }
  if (Array.isArray(extra)) extra.forEach(push);
  return out.slice(0, 4);
}

/**
 * The written fields the shop's tea card reads, so a link opens the same card.
 * Scores never leave: the tasting is passed through tastingJsonWithoutScores.
 */
export const LINK_TEA_DETAIL_SQL = `p.lore, p.terroir, p.processing_notes, p.mood, p.experience, p.cultivar, p.tasting, p.product_name AS variant_name`;

export interface LinkTeaDetail {
  lore: string | null;
  terroir: string | null;
  processing_notes: string | null;
  mood: string | null;
  experience: string | null;
  cultivar: string | null;
  tasting: string | null;
  variant_name: string | null;
}

export function linkTeaDetail(row: Record<string, any>): LinkTeaDetail {
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  return {
    lore: text(row.lore),
    terroir: text(row.terroir),
    processing_notes: text(row.processing_notes),
    mood: text(row.mood),
    experience: text(row.experience),
    cultivar: text(row.cultivar),
    tasting: row.tasting ? tastingJsonWithoutScores(row.tasting) ?? null : null,
    variant_name: text(row.variant_name),
  };
}

export interface PayLinkTeaLine extends LinkTeaDetail {
  description: string | null;
  images: string[];
  product_id: string | null;
  name: string;
  type: string | null;
  chinese_name: string | null;
  year: number | null;
  origin_region: string | null;
  origin_country: string | null;
  form: string | null;
  image_url: string | null;
  /** Grams for a tea, pieces for teaware. */
  quantity: number;
  unit: 'g' | 'piece';
  line_total_usd: number;
}

/**
 * The lines of one invoice for its pay page. Read only once the worker has
 * already said the viewer holds that invoice's link.
 */
export async function loadPayLinkTeaLines(
  env: { DB: D1Database },
  invoiceId: string,
  accountId: string,
): Promise<PayLinkTeaLine[]> {
  const rows = await env.DB.prepare(
    `SELECT li.product_id, li.quantity, li.price_at_sale, li.custom_name,
            p.type, COALESCE(p.given_name, p.product_name) AS product_name,
            p.chinese_name, p.year, p.origin_region, p.origin_country, p.form,
            p.image_url, p.additional_images, p.description, ${LINK_TEA_DETAIL_SQL}
       FROM invoice_line_items li
       LEFT JOIN products p ON p.id = li.product_id
      WHERE li.invoice_id = ? AND (li.account_id = ? OR li.account_id IS NULL)
      ORDER BY li.rowid ASC`
  ).bind(invoiceId, accountId).all();
  return ((rows.results ?? []) as Record<string, any>[]).map(row => {
    const quantity = Number(row.quantity) || 0;
    const price = Number(row.price_at_sale) || 0;
    const name = String(row.custom_name || row.product_name || 'Tea').trim();
    const images = linkTeaPhotos(row.image_url, row.additional_images);
    return {
      ...linkTeaDetail(row),
      description: typeof row.description === 'string' ? row.description : null,
      images,
      product_id: row.product_id ?? null,
      name,
      type: row.type ?? null,
      chinese_name: row.chinese_name ?? null,
      year: row.year == null ? null : Number(row.year),
      origin_region: row.origin_region ?? null,
      origin_country: row.origin_country ?? null,
      form: row.form ?? null,
      image_url: images[0] ?? null,
      quantity,
      unit: row.type === 'Teaware' ? 'piece' : 'g',
      line_total_usd: Math.round(quantity * price * 100) / 100,
    };
  });
}
