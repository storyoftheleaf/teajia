import { Fragment, type MouseEvent } from 'react';
import { Leaf } from 'lucide-react';
import { TeaSaveTile } from './TeaSaveTile';
import { getTeaLedgerTones } from '../../designTokens';
import { teaPurchaseQuote } from '../../lib/shopPurchase';
import { TeaWeighControl } from './TeaWeighControl';
import { useTheme } from '../../context/ThemeContext';
import type { InventoryItem } from '../../types';

export interface TeaLedgerGroup {
  type: string;
  items: InventoryItem[];
}

interface TeaLedgerProps {
  groups: TeaLedgerGroup[];
  activeType: string;
  specialFilter: string;
  tastingCounts: ReadonlyMap<string, number>;
  priceWeight: number;
  formatPrice: (price: number) => string;
  favoriteIds: ReadonlySet<string>;
  onToggleFavorite: (itemId: string, event: MouseEvent) => void;
  onOpenProduct: (item: InventoryItem) => void;
  onChooseAmount?: (item: InventoryItem) => void;
  onAddToCart?: (item: InventoryItem, grams: number, totalUsd: number) => void;
  isAdmin?: boolean;
  onAdminEdit?: (itemId: string) => void;
}

/**
 * A tea's origin arrives as one comma-joined string ("Mahei, Yiwu,
 * Xishuangbanna, Yunnan, China"). Read left to right it narrows from garden to
 * country, so the first two parts carry the weight and everything past them
 * steps back. Split only: never guess which part is the country, because the
 * catalogue is not consistent enough for that to be safe.
 */
function splitOrigin(origin: string): { near: string; mid: string; far: string } {
  const parts = origin.split(',').map(p => p.trim()).filter(Boolean);
  return {
    near: parts[0] ?? '',
    mid: parts[1] ?? '',
    far: parts.slice(2).join(', '),
  };
}

/**
 * One line for the middle column, and where to find it.
 *
 * `description` used to hold the factual write-up and now holds Adrian's
 * personal notes, present on only some teas, so reading it alone left the
 * middle of every row empty. Terroir leads instead: it is the field about
 * place, and place is what this row is already saying. Processing is the
 * fallback, then whatever personal note exists.
 */
function curatorLine(item: InventoryItem): string {
  const source = [item.terroir, item.processingNotes, item.description]
    .map(v => (v || '').trim())
    .find(Boolean);
  if (!source) return '';
  const end = source.search(/[.!?](\s|$)/);
  return end === -1 ? source : source.slice(0, end + 1);
}

/**
 * One line of plain fact per type, sitting beside the heading it belongs to.
 * Category facts, not brand voice: what the leaf went through, in the register
 * the product descriptions use. Any of these is Adrian's to overwrite.
 */
const TYPE_NOTES: Record<string, string> = {
  Green: 'Unoxidised, fired soon after picking',
  Yellow: 'Fired, then smothered to mellow',
  White: 'Withered and dried, barely handled',
  Oolong: 'Partly oxidised, rolled and roasted',
  Red: 'Oxidised whole leaf, warm and low',
  Dark: 'Post-fermented, aged after pressing',
  Sheng: 'Raw pu-erh, left to age on its own',
  Shou: 'Ripened pu-erh, settled and dark',
  Herbal: 'No tea leaf, brewed the same way',
};

export function TeaLedger({
  groups,
  activeType,
  specialFilter,
  tastingCounts,
  priceWeight,
  formatPrice,
  favoriteIds,
  onToggleFavorite,
  onOpenProduct,
  onChooseAmount,
  onAddToCart,
  isAdmin = false,
  onAdminEdit,
}: TeaLedgerProps) {
  const { theme } = useTheme();

  return (
    <div className="flex flex-col animate-[fadeIn_0.5s_ease-out]">
      {groups.map(group => {
        const tones = getTeaLedgerTones(group.type, theme);

        return (
          <Fragment key={group.type}>
            {activeType === 'All' && specialFilter === 'None' && (
              <div className="flex items-baseline justify-between gap-4 pt-9 first:pt-2 pb-2.5">
                <div className="flex min-w-0 items-baseline gap-3">
                  <h2 className="font-display text-ui-26 font-normal tracking-[0.02em] text-tea-text">
                    {group.type}
                  </h2>
                  {TYPE_NOTES[group.type] && (
                    <p className="hidden truncate font-body text-ui-13 italic leading-snug text-tea-text-sec sm:block">
                      {TYPE_NOTES[group.type]}
                    </p>
                  )}
                </div>
                <span className="num text-ui-11 text-tea-text-dim tabular-nums">
                  {String(group.items.length).padStart(2, '0')}
                </span>
              </div>
            )}
            {activeType === 'All' && specialFilter === 'None' && (
              <div className="-mx-3 px-3 md:-mx-4 md:px-4 h-px bg-tea-gold/20" aria-hidden="true" />
            )}

            {group.items.map(item => {
              const isFavorite = favoriteIds.has(item.id);
              const purchase = teaPurchaseQuote(item, priceWeight);
              const stockG = item.stock_g ?? 0;
              const showType = activeType !== 'All' || specialFilter !== 'None';
              const rowTones = showType ? getTeaLedgerTones(item.type, theme) : tones;
              const soldOut = item.category === 'tea' && stockG <= 0;

              const origin = splitOrigin(item.origin || '');
              const lead = curatorLine(item);
              const tastingCount = tastingCounts.get(item.id) || 0;

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${item.name}`}
                  style={{
                    backgroundImage: `linear-gradient(to right, ${rowTones.wash}, transparent 38%)`,
                  }}
                  className="-mx-3 px-3 md:-mx-4 md:px-4 border-b border-tea-border transition-colors cursor-pointer hover:bg-tea-text/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-tea-gold/30"
                  onClick={() => onOpenProduct(item)}
                  /* The ground and the rule reach back across the shop's
                     gutter, so the row is a field the content sits inside
                     rather than a band that begins where the block begins.
                     Same on both sides, so nothing lands on a rule's end. */
                  onKeyDown={event => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      onOpenProduct(item);
                    }
                  }}
                >
                  <div className="flex items-center gap-2.5 py-3">
                    <TeaSaveTile
                      year={item.year}
                      name={item.name}
                      saved={isFavorite}
                      background={rowTones.markBg}
                      savedColor={rowTones.savedBg}
                      onToggle={event => onToggleFavorite(item.id, event)}
                    />

                    <div className="tea-ledger-identity min-w-0 flex-1 lg:flex-none lg:w-[240px] xl:w-[300px]">
                      <div className="flex min-w-0 items-start gap-2">
                        <h3 className="min-w-0 break-words whitespace-normal font-display text-[18px] font-medium leading-tight text-tea-text lg:text-ui-20">
                          {item.name}
                        </h3>
                        {tastingCount > 0 && (
                          <span
                            className="inline-flex shrink-0 items-center gap-0.5 text-tea-green"
                            title={`Tasted ${tastingCount} time${tastingCount > 1 ? 's' : ''}`}
                          >
                            <Leaf className="w-2.5 h-2.5" />
                            {tastingCount > 1 && (
                              <span className="text-ui-9 font-medium leading-none">{tastingCount}</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-y-1 font-sans text-ui-12 tracking-[0.02em] text-tea-text-sec">
                        <span className="min-w-0 break-words">
                        {showType && (
                          <>
                            <span className="uppercase">{item.type}</span>
                            <span className="px-1.5 text-tea-text-dim">&middot;</span>
                          </>
                        )}
                        {origin.near}
                        {origin.mid && (
                          <>
                            <span className="px-1.5 text-tea-text-dim">&middot;</span>
                            {origin.mid}
                          </>
                        )}
                        {origin.far && (
                          <>
                            <span className="px-1.5 text-tea-text-dim">&middot;</span>
                            <span className="text-tea-text-dim">{origin.far}</span>
                          </>
                        )}
                        </span>
                      </div>
                    </div>

                    {/* Not every tea carries a description, and without one
                        this column does not render at all, which left the
                        price sitting against the name in the middle of the
                        row. The price rail pushes itself right instead of
                        relying on this column to hold the space.

                        The width the shop reclaimed goes to the curator's line
                        rather than to blank space. Desktop only: on a phone
                        the row stays focused on the title and origin. */}
                    {lead && (
                      <p className="hidden min-w-0 flex-1 pr-4 font-body text-ui-13 italic leading-relaxed text-tea-text-sec lg:line-clamp-2">
                        {lead}
                      </p>
                    )}

                    <div className="ml-auto flex shrink-0 items-center gap-4">
                      {/* Owners edit from here, on its own and clear of the
                          name and region. It used to sit in the region line,
                          where its 44px tap area stretched that line and
                          pushed the region away from the name. */}
                      {isAdmin && onAdminEdit && (
                        <button
                          type="button"
                          className="relative text-ui-11 text-tea-text-dim transition-colors before:absolute before:-inset-3 before:content-[''] hover:text-tea-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
                          onClick={event => {
                            event.stopPropagation();
                            onAdminEdit(item.id);
                          }}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                          }}
                          aria-label={`Edit ${item.name}`}
                        >
                          Edit
                        </button>
                      )}
                      {/* Price on top adds that amount to the cart; minus and
                          plus step the weight and the price follows; Weigh
                          itself opens every amount, custom sizes included. */}
                      {purchase ? (
                        <TeaWeighControl
                          item={item}
                          preferredGrams={priceWeight}
                          formatPrice={formatPrice}
                          onAddToCart={onAddToCart}
                          onChooseAmount={onChooseAmount}
                        />
                      ) : (
                        <span className="text-ui-11 uppercase tracking-[0.1em] text-tea-text-dim">
                          {soldOut ? 'Sold out' : 'Unavailable'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
