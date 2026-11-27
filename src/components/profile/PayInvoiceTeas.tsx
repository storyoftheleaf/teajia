import { useMemo } from 'react';
import { LinkTeaPage, LinkTeaTop } from '../shop/LinkTeaPage';
import { useOpenLinkTea } from '../shop/useOpenLinkTea';
import { linkTeaInventoryItem, type LinkTeaSource } from '../shop/linkTea';
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
 * the shop puts its weigh box. A tea opens in the shop's own tea page with the
 * shop's own order footer, to get more of it; a private tea the shop does not
 * sell carries none. Shown only to a
 * holder of the invoice's own link; the worker decides that before it sends a line.
 */
export function PayInvoiceTeas({ lines, invoiceNumber = null, onAddToCart }: {
  lines: readonly PayLinkTeaLine[];
  invoiceNumber?: string | null;
  onAddToCart?: (item: InventoryItem, grams: number, totalUsd: number) => void;
}) {
  const { openId, open: setOpenId, close: closeTea } = useOpenLinkTea();
  const shopPrice = useShopPrice();
  const favoriteTeas = useAppStore(s => s.favoriteTeas);
  const toggleFavoriteTea = useAppStore(s => s.toggleFavoriteTea);
  const favoriteIds = useMemo(() => new Set(favoriteTeas), [favoriteTeas]);
  // One row per invoice line, as the invoice was written: two 100g packs of
  // the same tea are two rows of 100g (Adrian, 2026-11-27). The first row of a
  // tea carries its product id; a second row of the same tea gets an id of its
  // own and opens the same tea.
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return lines.map((line, index) => {
      const id = line.product_id && !seen.has(line.product_id) ? line.product_id : `invoice-line-${index}`;
      if (line.product_id) seen.add(line.product_id);
      const card = linkTeaInventoryItem({ ...sourceOf(line), ...line, chineseName: line.chinese_name, year: line.year, image: line.image_url });
      const amount: WeighOption = {
        grams: line.quantity,
        totalUsd: Math.round(line.line_total_usd * 100) / 100,
        label: line.unit === 'g' ? undefined : `${line.quantity} ${line.quantity === 1 ? 'piece' : 'pieces'}`,
      };
      return { id, line, product: card, card: { ...card, id } as InventoryItem, amount };
    });
  }, [lines]);
  const totalUsd = Math.round(lines.reduce((sum, line) => sum + line.line_total_usd, 0) * 100) / 100;
  // An invoice owes cents, so dollars read to the cent; another currency
  // reads as the shop quotes it, the near figure.
  const exact = (usd: number) => (shopPrice.code === 'USD'
    ? `$${Number.isInteger(usd) ? usd : usd.toFixed(2)}`
    : shopPrice.symbolTotal(usd));
  const formatPrice = (usd: number) => (usd === 0 ? 'Free' : exact(usd));
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
  const openRow = openId ? byId.get(openId) : undefined;
  if (lines.length === 0) return null;
  return (
    <section aria-label="What this pays for" data-testid="pay-invoice-teas">
      <TeaLedger
        groups={groups}
        activeType="All"
        specialFilter="None"
        tastingCounts={new Map()}
        priceWeight={50}
        formatPrice={formatPrice}
        favoriteIds={favoriteIds}
        onToggleFavorite={(id, event) => { event.stopPropagation(); const row = byId.get(id); if (row?.line.product_id) toggleFavoriteTea(row.line.product_id); }}
        onOpenProduct={card => { if (byId.get(card.id)?.line.product_id) setOpenId(card.id); }}
        weighOptionsFor={card => { const row = byId.get(card.id); return row ? [row.amount] : undefined; }}
      />
      <div className="flex items-baseline justify-between gap-4 border-b border-tea-border px-4 py-4 md:px-6" data-testid="pay-invoice-total">
        <span className="label-caps text-tea-text-sec">Total</span>
        <span className="font-display text-ui-22 tabular-nums text-tea-text">{exact(totalUsd)}</span>
      </div>
      {openRow && (
        <LinkTeaPage
          item={openRow.product}
          onClose={closeTea}
          onAddToCart={onAddToCart}
          top={<LinkTeaTop line={[invoiceNumber ? `On your invoice ${invoiceNumber}` : 'On your invoice', openRow.amount.label ?? `${openRow.amount.grams}g`].join(' · ')} />}
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

