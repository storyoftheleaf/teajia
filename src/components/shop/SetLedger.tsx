import { Fragment, useEffect, useRef, useState } from 'react';
import type { StarterSet } from '../../types';
import type { PublicSetItem } from './setContents';
import { TeaLedgerRow } from './TeaLedger';
import { TeawareGlyph } from './TeawareGlyph';

export interface SetGroup {
  label: string;
  sets: StarterSet[];
}

interface SetLedgerProps {
  groups: SetGroup[];
  resolveItems: (set: StarterSet) => PublicSetItem[];
  /** What the pieces would cost bought one by one, in USD; 0 when unknown. */
  retailTotal: (set: StarterSet) => number;
  formatPrice: (usd: number) => string;
  savedIds: Set<string>;
  onToggleSave: (setId: string) => void;
  onAddSet: (set: StarterSet) => void | Promise<void>;
}

/** "3 teas, 1 piece": what a set holds, in the place a tea row says where it is from. */
function setSummary(set: StarterSet): string {
  const teas = set.items.filter(item => item.type === 'tea').length;
  const ware = set.items.length - teas;
  return [
    teas ? `${teas} ${teas === 1 ? 'tea' : 'teas'}` : '',
    ware ? `${ware} ${ware === 1 ? 'piece' : 'pieces'}` : '',
  ].filter(Boolean).join(', ');
}

/**
 * Sets on the tea shelf's row, so the three tabs read as one shelf. A set has
 * no page of its own, so the row opens its contents in place instead of
 * navigating; the box on the right adds the whole set, the way a tea's box
 * adds the weight it shows.
 */
export function SetLedger({ groups, resolveItems, retailTotal, formatPrice, savedIds, onToggleSave, onAddSet }: SetLedgerProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      {groups.filter(group => group.sets.length > 0).map(group => (
        <Fragment key={group.label}>
          <div className="flex items-baseline justify-between gap-4 pt-9 first:pt-2 pb-2.5">
            <h2 className="font-display text-ui-26 font-normal tracking-[0.02em] text-tea-text">{group.label}</h2>
            <span className="num text-ui-11 text-tea-text-dim tabular-nums">{String(group.sets.length).padStart(2, '0')}</span>
          </div>
          <div className="-mx-4 px-4 h-px bg-tea-gold/20" aria-hidden="true" />

          {group.sets.map(set => {
            const open = openId === set.id;
            const price = parseInt(set.price.replace(/[^0-9]/g, ''), 10) || 0;
            const retail = retailTotal(set);
            return (
              <Fragment key={set.id}>
                <TeaLedgerRow
                  item={{ name: set.name, year: '', type: 'Teaware', origin: setSummary(set), description: set.shortDescription, terroir: '', processingNotes: '' }}
                  showType={false}
                  label={set.tags[0] ?? null}
                  mark={<TeawareGlyph vessel="tray" className="h-[30px] w-[36px] text-tea-text-sec" />}
                  saved={savedIds.has(set.id)}
                  onToggleSave={() => onToggleSave(set.id)}
                  onOpen={() => setOpenId(open ? null : set.id)}
                  expanded={open}
                  openLabel={`${open ? 'Close' : 'Open'} ${set.name}`}
                  trailing={
                    <SetCartControl
                      name={set.name}
                      price={price}
                      retail={retail > price ? retail : 0}
                      formatPrice={formatPrice}
                      onAdd={() => onAddSet(set)}
                    />
                  }
                />
                {open && (
                  <div className="-mx-4 border-b border-tea-border bg-tea-text/[0.03] px-4 pb-5 pt-3">
                    {set.idealFor && (
                      <p className="font-body text-ui-13 italic leading-relaxed text-tea-text-sec">{set.idealFor}</p>
                    )}
                    <p className="mt-2 font-body text-ui-14 leading-relaxed text-tea-text-sec">{set.description}</p>
                    <p className="label-caps mt-4 text-tea-text-dim">What's inside</p>
                    <ul className="mt-1.5 divide-y divide-tea-border">
                      {resolveItems(set).map((item, index) => (
                        <li key={`${item.type}-${index}`} className="flex items-baseline justify-between gap-3 py-1.5 text-ui-13 leading-snug text-tea-text">
                          <span className="min-w-0">{item.name}</span>
                          <span className="num shrink-0 text-ui-12 tabular-nums text-tea-text-dim">
                            {item.type === 'tea' ? `${item.quantity}${item.unit}` : `${item.quantity} pc`}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {set.discount && (
                      <p className="mt-3 font-body text-ui-12 italic text-tea-text-sec">{set.discount}</p>
                    )}
                  </div>
                )}
              </Fragment>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

interface SetCartControlProps {
  name: string;
  price: number;
  /** Shown struck through before the price when the set is the better buy. */
  retail: number;
  formatPrice: (usd: number) => string;
  onAdd: () => void | Promise<void>;
}

/** The tea row's price box, sized the same, adding a whole set. */
function SetCartControl({ name, price, retail, formatPrice, onAdd }: SetCartControlProps) {
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="flex w-[92px] flex-col items-stretch sm:w-[116px]">
      <button
        type="button"
        aria-label={`Add the ${name} set to cart`}
        title="Add set to cart"
        onClick={async event => {
          event.stopPropagation();
          await onAdd();
          setAdded(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setAdded(false), 1500);
        }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }}
        className="flex h-8 items-baseline justify-center gap-2 whitespace-nowrap rounded-md border border-tea-border px-1 pt-[8px] transition-colors hover:border-tea-gold hover:bg-tea-accent-sub focus-visible:outline focus-visible:outline-tea-gold"
      >
        {added ? (
          <span className="text-ui-12 text-tea-gold-lt" aria-live="polite">Added</span>
        ) : (
          <>
            {/* What the pieces cost apart, dim and struck, then the set's price
                bright: the same dim-then-bright order as a tea's weight and price. */}
            {retail > 0 && <s className="num text-ui-12 tabular-nums text-tea-text-dim">{formatPrice(retail)}</s>}
            <span className="num text-ui-12 font-medium tabular-nums text-tea-text">{formatPrice(price)}</span>
          </>
        )}
      </button>
    </div>
  );
}
