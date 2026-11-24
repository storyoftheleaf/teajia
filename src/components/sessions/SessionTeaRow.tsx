import { useNavigate } from 'react-router-dom';
import type { PublicSessionTea } from '../../../shared/sessionTea';
import { publicProductToInventoryItem } from '../../lib/adapters';
import { useAppStore } from '../../lib/store';
import { normalizeProduct } from '../../lib/storefrontApi';
import type { InventoryItem } from '../../types';
import { useShopPrice } from '../shop/shopPrice';
import { TeaLedgerRow } from '../shop/TeaLedger';
import { TeaWeighControl } from '../shop/TeaWeighControl';

// One tea row everywhere a person's teas appear: teas for sale on a profile,
// poured teas on a session, poured teas on a recap. It is the shop's own row
// (year plate with Save, name, type and place) with the shop's price box and
// count beneath it when the tea is for sale. "Pack" counts a personal offer,
// "Weigh" a shop tea; both open the tea's page, where it is bought. A tea not
// for sale keeps the row and leaves the price side empty. A typed name lines
// up with the rest, with no plate and no link.

export type SaleCount = 'pack' | 'weigh';

/** The shop's public product as the shop's own row reads it. */
export function sessionOfferItem(product: Record<string, unknown>): InventoryItem {
  return publicProductToInventoryItem(normalizeProduct(product));
}

type RowIdentity = Pick<InventoryItem, 'name' | 'year' | 'type' | 'origin'>;

/** A real tea in the shop's row; for sale when `sale` carries the product. */
export function SaleTeaRow({ identity, sale, href, count }: {
  identity: RowIdentity;
  sale?: InventoryItem | null;
  href: string | null;
  count?: SaleCount;
}) {
  const navigate = useNavigate();
  const shopPrice = useShopPrice();
  const favorites = useAppStore(state => state.favoriteTeas);
  const toggleFavorite = useAppStore(state => state.toggleFavoriteTea);
  const saveId = sale?.id ?? null;
  return (
    <div data-testid="session-tea-row" data-tea-kind={sale ? 'sale' : 'tea'}>
      <TeaLedgerRow
        item={identity}
        showType
        saved={Boolean(saveId && favorites.includes(saveId))}
        onToggleSave={saveId ? () => toggleFavorite(saveId) : undefined}
        onOpen={href ? () => navigate(href) : undefined}
        openLabel={`Open ${identity.name}`}
        trailing={sale && href ? (
          <TeaWeighControl item={{ ...sale, name: identity.name }} preferredGrams={50} formatPrice={shopPrice.symbolTotal}
            href={href} count={count ?? (sale.exactPackPriceUsd == null ? 'weigh' : 'pack')} />
        ) : undefined}
      />
    </div>
  );
}

/** One poured tea, in the order it was poured. */
export function SessionTeaRow({ tea }: { tea: PublicSessionTea }) {
  if (tea.kind === 'name') {
    return (
      <div data-testid="session-tea-row" data-tea-kind="name" className="tea-ledger-row -mx-4 border-b border-tea-border px-4">
        <div className="flex min-h-tap items-center gap-2 py-3 sm:gap-2.5">
          {/* An empty plate keeps the name in line with the rows that have one. */}
          <span className="tea-save-tile invisible shrink-0" aria-hidden="true" />
          <h3 className="min-w-0 break-words font-display text-ui-18 font-medium leading-tight text-tea-text lg:text-ui-20">{tea.name}</h3>
        </div>
      </div>
    );
  }
  const sale = tea.offer ? sessionOfferItem(tea.offer.product) : null;
  return (
    <SaleTeaRow
      identity={{ name: tea.name, year: tea.year ?? '', type: tea.type ?? '', origin: tea.place ?? '' }}
      sale={sale}
      href={tea.href}
      count={tea.offer?.count}
    />
  );
}
