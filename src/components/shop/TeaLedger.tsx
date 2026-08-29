import { Fragment, type MouseEvent } from 'react';
import { Leaf } from 'lucide-react';
import { getTeaLedgerTones } from '../../designTokens';
import { useTheme } from '../../context/ThemeContext';
import type { InventoryItem } from '../../types';
import { Icons } from '../Icons';

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
              <div className="md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 h-px bg-tea-gold/20" aria-hidden="true" />
            )}

            {group.items.map(item => {
              const isTeajiaFav = !!item.isFeatured;
              const isFavorite = favoriteIds.has(item.id);
              const pricePerGram = parseFloat(item.price_per_gram || '0') || 0;
              const priceAtWeight = Math.round(pricePerGram * priceWeight * 100) / 100;
              const showType = activeType !== 'All' || specialFilter !== 'None';
              const rowTones = showType ? getTeaLedgerTones(item.type, theme) : tones;

              const stockG = item.stock_g ?? 0;
              // Stock state used to sit inline beside the name, where it
              // competed with the product title on the same baseline. It reads
              // as a qualifier on the price, so it lives under the price.
              const stockNote: string | null = item.category === 'tea'
                ? stockG <= 0
                  ? 'Sold out'
                  : stockG <= 50
                    ? `${stockG}g left`
                    : stockG <= 150
                      ? 'Limited'
                      : null
                : null;

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
                  className="md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-tea-border transition-colors cursor-pointer hover:bg-tea-text/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-tea-gold/30"
                  onClick={() => onOpenProduct(item)}
                  /* The ground and the rule reach back across the shop's
                     gutter, so the row is a field the content sits inside
                     rather than a band that begins where the block begins.
                     Same on both sides, so nothing lands on a rule's end. */
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpenProduct(item);
                    }
                  }}
                >
                  <div className="flex items-center gap-5 py-3">
                    {/* The vintage on its liquor ground. A tea with no year
                        recorded still gets the ground, so the column never
                        collapses and the list never looks broken. Roughly half
                        the catalogue has no year, so the empty case is the
                        common one, not the exception.

                        Sized to the text beside it rather than above it: at
                        52px it stood taller than the name and origin together,
                        so the block set the height of every row and read as a
                        box pinned to the margin. At 44 the text sets the row
                        and the block sits inside it. */}
                    <div
                      style={{ backgroundColor: rowTones.markBg, color: rowTones.markFg }}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] font-display text-ui-16 font-medium tracking-[0.03em] tabular-nums"
                      aria-hidden="true"
                    >
                      {item.year || null}
                    </div>

                    <div className="min-w-0 flex-1 lg:flex-none lg:w-[300px]">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display text-ui-17 font-medium leading-tight text-tea-text lg:text-ui-20">
                          {item.name}
                        </h3>
                        {isTeajiaFav && <Icons.Seal className="w-2.5 h-2.5 shrink-0 text-tea-gold" />}
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
                      <div className="mt-1 truncate font-sans text-ui-11 tracking-[0.04em] text-tea-text-sec">
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
                      </div>
                    </div>

                    {/* Not every tea carries a description, and without one
                        this column does not render at all, which left the
                        price sitting against the name in the middle of the
                        row. The price rail pushes itself right instead of
                        relying on this column to hold the space.

                        The width the shop reclaimed goes to the curator's line
                        rather than to blank space. Desktop only: on a phone
                        the row stays two lines. Clamped at two lines, which
                        still fits inside the 52px vintage block, so the row
                        height is unchanged and no sentence is cut mid-word. */}
                    {lead && (
                      <p className="hidden min-w-0 flex-1 line-clamp-2 font-body text-ui-13 italic leading-relaxed text-tea-text-sec lg:block">
                        {lead}
                      </p>
                    )}

                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      {isAdmin && onAdminEdit && (
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            onAdminEdit(item.id);
                          }}
                          aria-label={`Edit ${item.name}`}
                          className="tap-target p-1 text-tea-text-sec hover:text-tea-text transition-colors"
                        >
                          <Icons.Edit className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      <div className="min-w-[76px] whitespace-nowrap text-right">
                        <div className="num text-ui-16 font-medium tabular-nums text-tea-text">
                          {formatPrice(priceAtWeight)}
                          <span className="num ml-1 text-ui-11 font-normal text-tea-text-dim">
                            /&nbsp;{priceWeight}g
                          </span>
                        </div>
                        {stockNote && (
                          <div className="mt-0.5 text-ui-9 uppercase tracking-[0.1em] text-tea-gold-lt">
                            {stockNote}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={event => onToggleFavorite(item.id, event)}
                        aria-pressed={isFavorite}
                        aria-label={isFavorite ? `Unlike ${item.name}` : `Like ${item.name}`}
                        className={`tap-target p-1 transition-colors ${isFavorite ? 'text-tea-text hover:text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}
                      >
                        <Icons.Heart className="w-4 h-4" filled={isFavorite} aria-hidden="true" />
                      </button>
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
