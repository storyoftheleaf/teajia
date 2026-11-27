import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useAppStore } from '../../lib/store';
import { TeaLedger } from '../shop/TeaLedger';
import { useShopPrice } from '../shop/shopPrice';
import type { InventoryItem } from '../../types';

/**
 * Buy more of the invoice's teas (Adrian, 2026-11-27: "there can also be buy
 * more. Which is add to cart... automatically adjusting as I adjust the main
 * one in the shop"). These are the shop's own rows for the teas the shop
 * lists, read from the shop's live inventory, so their prices and amounts are
 * the shop's and follow it. A private tea the shop does not sell is left out.
 * The collection the teas came from, when there is one, is linked beside them.
 */
export function PayInvoiceBuyMore({ productIds, collection, onAddToCart, onOpenTea }: {
  productIds: readonly string[];
  collection?: { title: string; path: string } | null;
  onAddToCart?: (item: InventoryItem, grams: number, totalUsd: number) => void;
  onOpenTea: (productId: string) => void;
}) {
  const { inventory } = useInventory();
  const shopPrice = useShopPrice();
  const priceWeight = useAppStore(s => s.shopPriceWeight);
  const favoriteTeas = useAppStore(s => s.favoriteTeas);
  const toggleFavoriteTea = useAppStore(s => s.toggleFavoriteTea);
  const favoriteIds = useMemo(() => new Set(favoriteTeas), [favoriteTeas]);
  const teas = useMemo(() => {
    const listed = new Map(inventory.map(item => [item.id, item]));
    return [...new Set(productIds)].map(id => listed.get(id)).filter((item): item is InventoryItem => Boolean(item));
  }, [inventory, productIds]);
  if (teas.length === 0 && !collection) return null;

  return (
    <section aria-label="Buy more" className="mt-6" data-testid="pay-buy-more">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2">
        <h2 className="font-display text-ui-22 text-tea-text">Buy more</h2>
        {collection && (
          <Link to={collection.path} className="tap-target inline-flex items-center gap-1 font-sans text-ui-12 text-tea-text-sec hover:text-tea-text" data-testid="pay-collection-link">
            See {collection.title} <ArrowRight size={12} />
          </Link>
        )}
      </div>
      {teas.length > 0 && (
        <TeaLedger
          groups={[{ type: 'Buy more', items: teas }]}
          activeType="Buy more"
          specialFilter="None"
          tastingCounts={new Map()}
          priceWeight={priceWeight}
          formatPrice={shopPrice.symbolTotal}
          favoriteIds={favoriteIds}
          onToggleFavorite={(id, event) => { event.stopPropagation(); toggleFavoriteTea(id); }}
          onOpenProduct={item => onOpenTea(item.id)}
          onAddToCart={onAddToCart}
        />
      )}
    </section>
  );
}
