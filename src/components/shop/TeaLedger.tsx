import { Fragment, type MouseEvent } from 'react';
import { Leaf } from 'lucide-react';
import { TEA_TYPE_COLORS } from '../../designTokens';
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
  return (
    <div className="flex flex-col px-0 animate-[fadeIn_0.5s_ease-out]">
      {groups.map(group => (
        <Fragment key={group.type}>
          {activeType === 'All' && specialFilter === 'None' && (() => {
            const typeColor = TEA_TYPE_COLORS[group.type as keyof typeof TEA_TYPE_COLORS]?.card ?? '#737373';
            return (
              <div className="pt-6 first:pt-0 pb-2 px-1">
                <div className="border-t border-tea-border mb-3 first:border-0" />
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeColor }} />
                  <span className="text-ui-11 uppercase tracking-[0.2em] text-tea-text-sec">{group.type}</span>
                </div>
              </div>
            );
          })()}

          {group.items.map(item => {
            const isTeajiaFav = !!item.isFeatured;
            const isFavorite = favoriteIds.has(item.id);
            const pricePerGram = parseFloat(item.price_per_gram || '0') || 0;
            const priceAtWeight = Math.round(pricePerGram * priceWeight * 100) / 100;
            const showType = activeType !== 'All' || specialFilter !== 'None';

            const stockG = item.stock_g ?? 0;
            const stockBadge: { label: string; cls: string } | null = item.category === 'tea'
              ? stockG <= 0
                ? { label: 'Sold Out', cls: 'bg-tea-surface text-tea-text-dim' }
                : stockG <= 50
                  ? { label: 'Low Stock', cls: 'bg-tea-elevated text-tea-gold-lt' }
                  : stockG <= 150
                    ? { label: 'Limited', cls: 'bg-tea-elevated text-tea-text-sec' }
                    : null
              : null;

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`View ${item.name}`}
                className="border-b border-tea-border hover:bg-tea-surface/40 transition-colors cursor-pointer focus:outline-none focus-visible:bg-tea-surface/60 focus-visible:ring-1 focus-visible:ring-tea-gold/30"
                onClick={() => onOpenProduct(item)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenProduct(item);
                  }
                }}
              >
                <div className="flex items-center py-2 lg:py-2.5 px-1 gap-3">
                  <div className="flex-1 min-w-0">
                    {(item.isFeatured || item.isCurated) && (
                      <div className="flex flex-col mb-0.5">
                        {item.isFeatured && (
                          <span className="text-xs tracking-widest uppercase text-tea-gold leading-none">Featured</span>
                        )}
                        {item.isCurated && (
                          <span className="text-xs tracking-widest uppercase text-tea-text-sec leading-none">Curated</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-ui-15 leading-snug text-tea-text font-medium truncate">
                        {item.name}
                      </h3>
                      {isTeajiaFav && <Icons.Seal className="w-2.5 h-2.5 text-tea-gold shrink-0" />}
                      {(tastingCounts.get(item.id) || 0) > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 shrink-0 text-tea-green"
                          title={`Tasted ${tastingCounts.get(item.id)} time${tastingCounts.get(item.id)! > 1 ? 's' : ''}`}
                        >
                          <Leaf className="w-2.5 h-2.5" />
                          {tastingCounts.get(item.id)! > 1 && (
                            <span className="text-ui-9 font-medium leading-none">{tastingCounts.get(item.id)}</span>
                          )}
                        </span>
                      )}
                      {stockBadge && (
                        <span className={`shrink-0 text-ui-10 uppercase tracking-widest px-1.5 py-0.5 rounded-md ${stockBadge.cls}`}>
                          {stockBadge.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate flex items-center gap-1.5">
                      {showType && (
                        <>
                          <span className="text-ui-10 uppercase tracking-wider text-tea-text-sec">{item.type}</span>
                          <span className="text-tea-text-dim">·</span>
                        </>
                      )}
                      {item.origin && (
                        <span className="text-ui-11 text-tea-text-sec">{item.origin}</span>
                      )}
                      {item.year && (
                        <>
                          <span className="text-tea-text-dim">·</span>
                          <span className="text-ui-11 text-tea-text-dim">{item.year}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center shrink-0">
                    <div className="flex items-center gap-1">
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
                    <div className="w-px h-5 bg-tea-border ml-2.5 mr-3" />
                    <div className="text-right num text-sm text-tea-gold font-medium tabular-nums min-w-[44px] whitespace-nowrap">
                      {formatPrice(priceAtWeight)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
