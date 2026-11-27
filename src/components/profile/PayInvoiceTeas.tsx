import { useMemo, useState } from 'react';
import { AlcoveModal } from '../shop/AlcoveModal';
import { LinkTeaEntry, linkTeaInventoryItem, useLinkTeaWriting, type LinkTeaSource } from '../shop/linkTea';
import { TeaLedger, type TeaLedgerGroup } from '../shop/TeaLedger';
import type { WeighOption } from '../shop/TeaWeighControl';
import { useShopPrice } from '../shop/shopPrice';
import { useAppStore } from '../../lib/store';
import type { InventoryItem } from '../../types';
import type { PayLinkTeaLine } from './types';

/**
 * The teas on an invoice, at the top of its pay page, drawn as the shop draws
 * them (Adrian, 2026-11-27: "make her tea invoice look like Daniel's"): the
 * shop's own rows under type headings, with what was bought and its price where
 * the shop puts its weigh box. A tea opens in the shop's own tea card, to read;
 * paying happens here, so the card carries no order footer. Shown only to a
 * holder of the invoice's own link; the worker decides that before it sends a line.
 */
export function PayInvoiceTeas({ lines }: { lines: readonly PayLinkTeaLine[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const shopPrice = useShopPrice();
  const favoriteTeas = useAppStore(s => s.favoriteTeas);
  const toggleFavoriteTea = useAppStore(s => s.toggleFavoriteTea);
  const favoriteIds = useMemo(() => new Set(favoriteTeas), [favoriteTeas]);
  // One row per line. A tea bought twice, or a line with no tea behind it,
  // gets an id of its own so the rows stay apart.
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return lines.map((line, index) => {
      const id = line.product_id && !seen.has(line.product_id) ? line.product_id : `invoice-line-${index}`;
      if (line.product_id) seen.add(line.product_id);
      const card = linkTeaInventoryItem({ ...sourceOf(line), ...line, chineseName: line.chinese_name, year: line.year, image: line.image_url });
      const amount: WeighOption = {
        grams: line.quantity,
        totalUsd: line.line_total_usd,
        label: line.unit === 'g' ? undefined : `${line.quantity} ${line.quantity === 1 ? 'piece' : 'pieces'}`,
      };
      return { id, line, card: { ...card, id } as InventoryItem, amount };
    });
  }, [lines]);
  const byId = useMemo(() => new Map(rows.map(row => [row.id, row])), [rows]);
  const groups = useMemo<TeaLedgerGroup[]>(() => {
    const order: string[] = [];
    const byType = new Map<string, InventoryItem[]>();
    for (const row of rows) {
      const type = row.card.type || 'Tea';
      if (!byType.has(type)) { byType.set(type, []); order.push(type); }
      byType.get(type)!.push(row.card);
    }
    return order.map(type => ({ type, items: byType.get(type)! }));
  }, [rows]);
  const cards = useMemo(() => rows.filter(row => row.line.product_id).map(row => row.card), [rows]);
  if (lines.length === 0) return null;
  return (
    <section aria-label="What this pays for" data-testid="pay-invoice-teas">
      <TeaLedger
        groups={groups}
        activeType="All"
        specialFilter="None"
        tastingCounts={new Map()}
        priceWeight={50}
        formatPrice={usd => (usd === 0 ? 'Free' : shopPrice.symbolTotal(usd))}
        favoriteIds={favoriteIds}
        onToggleFavorite={(id, event) => { event.stopPropagation(); const row = byId.get(id); if (row?.line.product_id) toggleFavoriteTea(row.line.product_id); }}
        onOpenProduct={card => { if (byId.get(card.id)?.line.product_id) setOpenId(card.id); }}
        weighOptionsFor={card => { const row = byId.get(card.id); return row ? [row.amount] : undefined; }}
      />
      {openId && (
        <AlcoveModal
          item={cards.find(card => card.id === openId) ?? null}
          items={cards}
          onClose={() => setOpenId(null)}
          onItemChange={next => setOpenId(next.id)}
          linkFooter={() => null}
          linkAddition={card => {
            const line = byId.get(card.id)?.line;
            return line ? <PayTeaWriting line={line} /> : null;
          }}
        />
      )}
    </section>
  );
}

function sourceOf(line: PayLinkTeaLine): LinkTeaSource {
  return {
    productId: line.product_id,
    name: line.name,
    type: line.type,
    form: line.form,
    originRegion: line.origin_region,
    originCountry: line.origin_country,
  };
}

function PayTeaWriting({ line }: { line: PayLinkTeaLine }) {
  const writing = useLinkTeaWriting(sourceOf(line));
  return <LinkTeaEntry writing={writing} className="alcove-body-section mt-7" />;
}
