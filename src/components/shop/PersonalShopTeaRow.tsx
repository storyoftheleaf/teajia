import type { PublicShelfItem } from '../../lib/api';
import { hasShelfAmount, shelfAmount, shelfPrice } from '../../lib/publicShelf';
import { TeaLedgerRow } from './TeaLedger';

interface PersonalShopTeaRowProps {
  item: PublicShelfItem;
  headingId?: string;
  orderHref?: string | null;
  seller?: string | null;
  preview?: boolean;
}

export function PersonalShopTeaRow({ item, headingId, orderHref, seller, preview }: PersonalShopTeaRowProps) {
  const actionClass = 'btn-secondary btn-sm w-full';
  const price = shelfPrice(item);
  return (
    <article>
      <TeaLedgerRow
        item={{ name: item.name, type: item.type ?? '', origin: item.origin ?? '', year: item.year == null ? '' : String(item.year) }}
        showType
        saved={false}
        headingId={headingId}
        trailing={
          <div className="flex flex-col items-end gap-1">
            {hasShelfAmount(item) && <span className="num text-ui-12 text-tea-text-dim">{shelfAmount(item.grams)}</span>}
            {orderHref ? (
              <a className={actionClass} href={orderHref} target="_blank" rel="noopener noreferrer"
                aria-label={`${seller ? `Order from ${seller}` : 'Order on WhatsApp'} for ${price}`}>{price}</a>
            ) : price ? <span className={preview ? actionClass : 'num text-ui-12 text-tea-text-sec'}>{price}</span> : null}
          </div>
        }
      />
    </article>
  );
}
