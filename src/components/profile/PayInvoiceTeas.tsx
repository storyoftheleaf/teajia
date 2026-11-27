import { useMemo, useRef, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTastingCounts } from '../../hooks/useTastingCount';
import { useInventory } from '../../context/InventoryContext';
import { LinkTeaPage } from '../shop/LinkTeaPage';
import { ListTasting } from '../shop/ListTasting';
import { useOpenLinkTea } from '../shop/useOpenLinkTea';
import { linkTeaInventoryItem, type LinkTeaSource } from '../shop/linkTea';
import { TeaLedger, type TeaLedgerGroup } from '../shop/TeaLedger';
import type { WeighOption } from '../shop/TeaWeighControl';
import { useExactUsd } from './useExactUsd';
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
export function PayInvoiceTeas({ lines, invoiceNumber = null, onAddToCart, discount = null, onSave, discountEditor, signedIn = false, onJoin }: {
  lines: readonly PayLinkTeaLine[];
  /** A percent off the shop offered, shown as its own line above the total. */
  discount?: { percent: number; amount_usd: number } | null;
  invoiceNumber?: string | null;
  /** A tea was saved: the invoice goes into their account, through joining when they are signed out. Left out for the shop that sent it. */
  onSave?: () => void;
  onAddToCart?: (item: InventoryItem, grams: number, totalUsd: number) => void;
  /** The sending shop's percent box, drawn in the discount's own line. */
  discountEditor?: ReactNode;
  signedIn?: boolean;
  /** Tasting while signed out: go and join, and come back to the same address. Left out, rows carry no teacup. */
  onJoin?: (mode: 'signup' | 'signin', teas: { name: string; amount?: string }[]) => void;
}) {
  const { openId, open: setOpenId, move: moveTea, close: closeTea } = useOpenLinkTea();
  // The tasting open over the list is a step in the address, so Back closes
  // it and joining returns to it.
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const tastingOpenedHere = useRef(false);
  const tastingId = search.get(TASTING_PARAM);
  const openTasting = (id: string) => {
    const next = new URLSearchParams(search);
    next.set(TASTING_PARAM, id);
    tastingOpenedHere.current = true;
    setSearch(next);
  };
  const closeTasting = () => {
    if (tastingOpenedHere.current) { tastingOpenedHere.current = false; navigate(-1); return; }
    const next = new URLSearchParams(search);
    next.delete(TASTING_PARAM);
    setSearch(next, { replace: true });
  };
  const favoriteTeas = useAppStore(s => s.favoriteTeas);
  const toggleFavoriteTea = useAppStore(s => s.toggleFavoriteTea);
  // One row per invoice line, as the invoice was written: two 100g packs of
  // the same tea are two rows of 100g (Adrian, 2026-11-27). The first row of a
  // tea carries its product id; a second row of the same tea gets an id of its
  // own and opens the same tea.
  // A tea the shop lists is drawn as the shop draws it: its own name, and its
  // date inside the save box (Adrian, 2026-11-27), not the invoice's wording.
  const { inventory } = useInventory();
  const listed = useMemo(() => new Map(inventory.map(item => [item.id, item])), [inventory]);
  const tastingCounts = useTastingCounts();
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return lines.map((line, index) => {
      const shop = line.product_id ? listed.get(line.product_id) : undefined;
      const id = line.product_id && !seen.has(line.product_id) ? line.product_id : `invoice-line-${index}`;
      if (line.product_id) seen.add(line.product_id);
      const drawn = linkTeaInventoryItem({ ...sourceOf(line), ...line, chineseName: line.chinese_name, year: line.year, image: line.image_url });
      const card = shop ? { ...drawn, name: shop.name, year: shop.year } : drawn;
      const amount: WeighOption = {
        grams: line.quantity,
        totalUsd: Math.round(line.line_total_usd * 100) / 100,
        label: line.unit === 'g' ? undefined : `${line.quantity} ${line.quantity === 1 ? 'piece' : 'pieces'}`,
      };
      return { id, line, product: card, card: { ...card, id } as InventoryItem, amount };
    });
  }, [lines, listed]);
  const totalUsd = Math.round((lines.reduce((sum, line) => sum + line.line_total_usd, 0) - (discount?.amount_usd ?? 0)) * 100) / 100;
  // An invoice owes cents, so dollars read to the cent; another currency
  // reads as the shop quotes it, the near figure.
  const exact = useExactUsd();
  const formatPrice = (usd: number) => (usd === 0 ? 'Free' : exact(usd));
  const byId = useMemo(() => new Map(rows.map(row => [row.id, row])), [rows]);
  // Saved is the tea's, so every line of a saved tea shows it.
  const favoriteIds = useMemo(() => new Set(rows.filter(row => row.line.product_id && favoriteTeas.includes(row.line.product_id)).map(row => row.id)), [rows, favoriteTeas]);
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
  // The arrows on an open tea walk down the list as it is drawn, past any line that opens nothing.
  const order = useMemo(() => groups.flatMap(group => group.items).filter(card => byId.get(card.id)?.line.product_id), [groups, byId]);
  const at = openRow ? order.findIndex(card => card.id === openRow.id) : -1;
  const before = at > 0 ? order[at - 1] : undefined;
  const after = at >= 0 ? order[at + 1] : undefined;
  const tastingRow = tastingId ? byId.get(tastingId) : undefined;
  const joinTeas = useMemo(() => rows.map(row => ({ name: row.card.name, amount: row.amount.label ?? `${row.amount.grams}g` })), [rows]);
  if (lines.length === 0) return null;
  return (
    <section aria-label="What this pays for" data-testid="pay-invoice-teas">
      <TeaLedger
        groups={groups}
        activeType="All"
        specialFilter="None"
        tastingCounts={tastingCounts}
        priceWeight={50}
        formatPrice={formatPrice}
        favoriteIds={favoriteIds}
        onToggleFavorite={(id, event) => {
          event.stopPropagation();
          const productId = byId.get(id)?.line.product_id;
          if (!productId) return;
          const saving = !favoriteTeas.includes(productId);
          toggleFavoriteTea(productId);
          if (saving) onSave?.();
        }}
        onOpenProduct={card => {
          const row = byId.get(card.id);
          if (!row?.line.product_id) return;
          setOpenId(card.id);
        }}
        weighOptionsFor={card => { const row = byId.get(card.id); return row ? [row.amount] : undefined; }}
        onTaste={onJoin ? card => { if (byId.get(card.id)?.line.product_id) openTasting(card.id); } : undefined}
      />
      {(discountEditor || (discount && discount.amount_usd > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-tea-border px-4 py-3 md:px-6" data-testid="pay-invoice-discount">
          {discountEditor ?? <span className="label-caps text-tea-gold">{discount?.percent}% off</span>}
          {discount && discount.amount_usd > 0 && <span className="font-display text-ui-18 tabular-nums text-tea-gold">−{exact(discount.amount_usd)}</span>}
        </div>
      )}
      <div className="flex items-baseline justify-between gap-4 border-b border-tea-border px-4 py-4 md:px-6" data-testid="pay-invoice-total">
        <span className="label-caps text-tea-text-sec">Total</span>
        <span className="flex items-baseline gap-2">
          {discount && discount.amount_usd > 0 && (
            <s className="font-display text-ui-15 tabular-nums text-tea-text-sec" data-testid="pay-invoice-full-total">{exact(Math.round((totalUsd + discount.amount_usd) * 100) / 100)}</s>
          )}
          <span className="font-display text-ui-22 tabular-nums text-tea-text">{exact(totalUsd)}</span>
        </span>
      </div>
      {tastingRow?.line.product_id && onJoin && (
        <ListTasting item={{ ...tastingRow.product, id: tastingRow.line.product_id }} signedIn={signedIn} teas={joinTeas}
          onClose={closeTasting} onJoin={mode => onJoin(mode, joinTeas)} />
      )}
      {openRow && (
        <LinkTeaPage
          item={openRow.product}
          onClose={closeTea}
          onAddToCart={onAddToCart}
          yoursLine={['Yours', openRow.amount.label ?? `${openRow.amount.grams}g`, invoiceNumber].filter(Boolean).join(' · ')}
          yoursNav={at >= 0 ? {
            index: at + 1,
            count: order.length,
            onPrev: before ? () => moveTea(before.id) : undefined,
            onNext: after ? () => moveTea(after.id) : undefined,
          } : undefined}
        />
      )}
    </section>
  );
}

const TASTING_PARAM = 'tasting';

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

