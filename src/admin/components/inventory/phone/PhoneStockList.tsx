import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, X as XIcon } from 'lucide-react';
import type { Product } from '../../../types';
import type { IncomingInventorySummary } from '../domain';
import { fmtNum } from '../../../../utils/formatNumber';
import { getThemeColor, getThemeTextColor } from '../../../themeUtils';
import {
  PHONE_GROUP_LABELS, groupStock, isLow, isTeaware, isUnchecked, onHand, sellingPricePerGram,
  type PhoneGroupBy,
} from './groupStock';

// The phone's stock list (design "2b", todo/plans/stock-phone-by-supplier.md).
// Grouped by who the tea was bought from; a tap on a tea opens a panel under
// the list instead of the full edit page, so the operator can look and move on
// without losing their place. Every action still reaches the same handlers the
// laptop table uses: InventoryView passes them in.

const GROUP_KEY = 'teajia.stockPhone.groupBy';
const OPEN_KEY = 'teajia.stockPhone.openGroups';

export function readPhoneGroupBy(): PhoneGroupBy {
  try {
    const v = localStorage.getItem(GROUP_KEY);
    return v === 'type' || v === 'none' || v === 'vendor' || v === 'stage' ? v : 'vendor';
  } catch { return 'vendor'; }
}

export function writePhoneGroupBy(by: PhoneGroupBy): void {
  try { localStorage.setItem(GROUP_KEY, by); } catch { /* storage blocked */ }
}

/** The compact Supplier · Kind · None switch. It lives in the page header so
 *  the phone's top is two short lines, not four. */
export const PhoneGroupSwitch: React.FC<{ value: PhoneGroupBy; onChange: (by: PhoneGroupBy) => void }> = ({ value, onChange }) => (
  // Three words, a fine underline under the chosen one; each a full tap area.
  <div role="group" aria-label="Group teas by" className="flex shrink-0 items-center gap-1">
    {/* None stays in the Adjust sheet: four choices do not fit beside the view name at 375px. */}
    {(['vendor', 'type', 'stage'] as PhoneGroupBy[]).map(by => (
      <button
        key={by}
        type="button"
        aria-pressed={value === by}
        onClick={() => onChange(by)}
        className="flex h-11 -my-2 items-center px-1.5"
      >
        <span className={`relative text-ui-13 ${value === by ? 'text-tea-text after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:bg-tea-gold' : 'text-tea-text-dim'}`}>{PHONE_GROUP_LABELS[by]}</span>
      </button>
    ))}
  </div>
);

function readOpen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(OPEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

export interface PhoneStockListProps {
  products: Product[];
  groupBy: PhoneGroupBy;
  priceMode: 'retail' | 'cost';
  searchActive: boolean;
  selectedIds: ReadonlySet<string>;
  incomingByProductId: Readonly<Record<string, IncomingInventorySummary>>;
  onToggleSelect: (id: string) => void;
  onOpenEditor: (product: Product) => void;
  onChangeStock: (product: Product, trigger: HTMLElement) => void;
  onRecount: (product: Product, trigger: HTMLElement) => void;
  onOpenSource: (product: Product) => void;
  /** The column the list is sorted by, and which way. Groups keep this order inside them. */
  sortKey?: PhoneSortKey | null;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: PhoneSortKey) => void;
}

export type PhoneSortKey = 'productName' | 'year' | 'stockGrams' | 'pricePerGramUSD' | 'costPerGramUSD';

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function qtyLabel(product: Product): string {
  const qty = onHand(product);
  if (isTeaware(product)) return product.quantityUnits == null ? '—' : `${qty} pc`;
  return `${qty.toLocaleString('en-US')} g`;
}

function checkedLabel(product: Product): string {
  if (!product.stockVerifiedAt) return 'never';
  const d = new Date(product.stockVerifiedAt);
  return Number.isNaN(d.getTime()) ? 'never' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const PhoneStockList: React.FC<PhoneStockListProps> = ({
  products, groupBy, priceMode, searchActive, selectedIds, incomingByProductId,
  onToggleSelect, onOpenEditor, onChangeStock, onRecount, onOpenSource,
  sortKey, sortDir = 'asc', onSort,
}) => {
  const [open, setOpen] = useState<Set<string>>(readOpen);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const countRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { try { sessionStorage.setItem(OPEN_KEY, JSON.stringify([...open])); } catch { /* storage blocked */ } }, [open]);

  const groups = useMemo(() => groupStock(products, groupBy, incomingByProductId), [products, groupBy, incomingByProductId]);
  // A search, or a short list, shows every match without a second tap.
  const expandAll = groupBy === 'none' || searchActive || products.length <= 25;
  const focused = focusedId ? products.find(p => p.id === focusedId) ?? null : null;
  const selecting = selectedIds.size > 0;

  const toggleGroup = (key: string) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const priceOf = (p: Product): number | null => (priceMode === 'cost' ? (Number.isFinite(p.costPerGramUSD) ? p.costPerGramUSD : null) : sellingPricePerGram(p));

  const priceKey: PhoneSortKey = priceMode === 'cost' ? 'costPerGramUSD' : 'pricePerGramUSD';
  const ware = products.length > 0 && products.every(isTeaware);
  // Name, year, stock and price as four columns that read straight down; tap a
  // heading to sort by it, tap again to reverse (todo/plans/stock-phone-by-supplier.md).
  // The three number columns are fenced by hairlines: a grid you can read down,
  // drawn in the quiet border tone so it separates without adding noise.
  const COLS = 'grid grid-cols-[minmax(0,1fr)_36px_42px_38px] items-stretch';
  const NUM = 'flex items-center justify-end pr-1.5 border-l border-tea-border';
  const heads: Array<[PhoneSortKey, string, string]> = [
    ['productName', ware ? 'Piece' : 'Tea', 'text-left'],
    ['year', 'Year', 'text-right'],
    ['stockGrams', ware ? 'Pc' : 'Stock', 'text-right'],
    [priceKey, ware ? '$ ea' : '$/g', 'text-right'],
  ];

  return (
    <div data-testid="stock-phone" className={`stock-phone-tone ${focused && !selecting ? 'pb-[300px]' : selecting ? 'pb-[170px]' : ''}`}>
      <div role="row" className="sticky top-0 z-sticky flex items-center bg-tea-bg pl-9 pr-3 border-b border-tea-border">
        <div className={`${COLS} flex-1`}>
          {heads.map(([key, label, align]) => {
            const on = sortKey === key;
            return (
              <button
                key={key}
                type="button"
                role="columnheader"
                aria-sort={on ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                onClick={() => onSort?.(key)}
                className={`h-8 ${align === 'text-right' ? `${NUM} ` : 'text-left '}text-ui-10 uppercase tracking-[0.06em] ${on ? 'text-tea-gold' : 'text-tea-text-dim'}`}
              >
                {label}{on ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            );
          })}
        </div>
      </div>

      {groups.length === 0 && (
        <p className="px-4 py-10 text-center text-ui-14 text-tea-text-sec">Nothing matches this view.</p>
      )}

      {groups.map(group => {
        const isOpen = expandAll || open.has(group.key);
        return (
          <section key={group.key} aria-label={group.label}>
            {groupBy !== 'none' && (
              <div className="flex items-stretch bg-tea-surface border-y border-tea-border">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={isOpen}
                  className="flex-1 min-w-0 flex items-end justify-between gap-3 pl-5 pr-2 pt-3 pb-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-display text-ui-20 font-semibold leading-none text-tea-text">{group.label}</span>
                      {isOpen ? <ChevronDown size={13} className="shrink-0 text-tea-text-dim" aria-hidden="true" /> : <ChevronRight size={13} className="shrink-0 text-tea-text-dim" aria-hidden="true" />}
                    </span>
                    <span className="block mt-1.5 text-ui-12 text-tea-text-sec tabular-nums">
                      {group.count} {group.count === 1 ? (isTeaware(group.products[0]) ? 'piece' : 'tea') : (isTeaware(group.products[0]) ? 'pieces' : 'teas')} · {isTeaware(group.products[0]) ? `${group.onHand} pc` : `${group.onHand.toLocaleString('en-US')} g`} · {money(group.retailValueUsd)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-ui-12 leading-snug">
                    {group.low > 0 && <span className="block text-tea-error">{group.low} low</span>}
                    {group.unchecked > 0 && <span className="block text-tea-text-sec">{group.unchecked} never counted</span>}
                  </span>
                </button>
                {groupBy === 'vendor' && group.products[0]?.vendor && (
                  <button
                    type="button"
                    onClick={() => onOpenSource(group.products[0])}
                    aria-label={`Supplier details for ${group.label}`}
                    className="tap-target w-10 flex items-end justify-center pb-3 text-tea-gold"
                  ><ChevronRight size={16} aria-hidden="true" /></button>
                )}
              </div>
            )}
            {isOpen && group.products.map(p => {
              const isSel = selectedIds.has(p.id);
              const isFocused = focusedId === p.id;
              const price = priceOf(p);
              const coming = incomingByProductId[p.id];
              const comingQty = coming?.hasOpenIncoming ? coming.remainingQuantity : 0;
              const qty = onHand(p);
              const qtyTone = qty <= 0 ? 'text-tea-text-dim' : isLow(p) ? 'text-tea-error' : 'text-tea-text';
              return (
                <div key={p.id} className={`relative flex items-center ${isSel || isFocused ? 'bg-tea-surface' : ''} after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-tea-border`}>
                  {/* One dot, three jobs: its colour is the kind, filled means counted,
                      hollow means never counted, and tapping it ticks the tea. */}
                  <button
                    type="button"
                    onClick={() => onToggleSelect(p.id)}
                    aria-pressed={isSel}
                    aria-label={`${isSel ? 'Untick' : 'Tick'} ${p.productName}${isUnchecked(p) ? ', never counted' : ''}`}
                    className="relative w-3.5 ml-3 shrink-0 flex items-center justify-center self-stretch before:absolute before:-inset-x-3 before:inset-y-0"
                  >
                    {isSel
                      ? <span className="w-4 h-4 rounded-full cta-solid flex items-center justify-center"><Check size={9} strokeWidth={3.5} aria-hidden="true" /></span>
                      : <span
                          className="w-3.5 h-3.5 rounded-full border-2"
                          style={isTeaware(p)
                            ? undefined
                            : { borderColor: getThemeColor(p.type), background: isUnchecked(p) ? 'transparent' : getThemeColor(p.type) }}
                        />}{/* color-data: the tea kind's own colour, from themeUtils */}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFocusedId(isFocused ? null : p.id)}
                    aria-expanded={isFocused}
                    className={`${COLS} flex-1 min-w-0 pl-2.5 pr-3 text-left min-h-[46px]`}
                  >
                    <span className="min-w-0 py-1.5 pr-2">
                      <span className={`block truncate font-display text-ui-17 font-semibold leading-tight ${isFocused || isSel ? 'text-tea-gold' : 'text-tea-text'}`}>{p.productName}</span>
                      <span className="flex items-center gap-1.5 text-ui-11 leading-tight text-tea-text-sec min-w-0">
                        {(() => {
                          // The second line is the kind in its own colour, then the name
                          // Adrian gives the tea when it has one.
                          const given = (p.givenName || '').trim();
                          const own = given && given.toLowerCase() !== 'unnamed' && given !== p.productName ? given : '';
                          if (groupBy === 'type') return <span className="truncate">{own || p.vendor || p.type}</span>;
                          if (isTeaware(p)) return <span className="truncate">{own || p.teawareCategory || 'Teaware'}</span>;
                          return <>
                            <span className="shrink-0" style={{ color: getThemeTextColor(p.type) }}>{p.type}</span>
                            {own && <span className="truncate">· {own}</span>}
                          </>;
                        })()}
                        {comingQty > 0 && <span className="shrink-0 text-tea-gold-lt">· +{fmtNum(comingQty)}</span>}
                      </span>
                    </span>
                    <span className={`${NUM} font-mono text-ui-13 tracking-tight text-tea-text tabular-nums`}>{p.year || '—'}</span>
                    <span className={`${NUM} font-mono text-ui-13 tracking-tight tabular-nums ${qtyTone}`}>{isTeaware(p) ? (p.quantityUnits == null ? '—' : qty) : qty.toLocaleString('en-US')}</span>
                    <span className={`${NUM} font-mono text-ui-13 tracking-tight text-tea-text tabular-nums`}>{price != null ? fmtNum(price) : '—'}</span>
                  </button>
                </div>
              );
            })}
          </section>
        );
      })}

      {focused && !selecting && (
        <section
          aria-label={`${focused.productName}, at a glance`}
          className="sheet-behind-nav fixed left-0 right-0 z-drawer rounded-t-xl bg-tea-surface px-5 pt-2"
        >
          <div aria-hidden="true" className="mx-auto mb-3 h-[3px] w-8 rounded-full bg-tea-elevated" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setFocusedId(null)} aria-label="Close" className="-ml-2 -my-2 flex h-11 w-8 shrink-0 items-center justify-center text-tea-text-sec hover:text-tea-text"><XIcon size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => onOpenEditor(focused)} className="min-w-0 flex-1 truncate text-left font-display text-ui-20 font-semibold leading-tight text-tea-text">{focused.productName}</button>
            <span className={`shrink-0 font-mono text-ui-16 tabular-nums ${isLow(focused) ? 'text-tea-error' : 'text-tea-text'}`}>
              {isTeaware(focused) ? (focused.quantityUnits ?? '—') : onHand(focused).toLocaleString('en-US')}
              <span className="ml-0.5 font-sans text-ui-11 text-tea-text-dim">{isTeaware(focused) ? 'pc' : 'g'}</span>
            </span>
          </div>
          <div className="ml-8 mt-0.5 flex items-center gap-1.5 text-ui-12 text-tea-text-sec min-w-0">
            {!isTeaware(focused) && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: getThemeColor(focused.type) }} />}{/* color-data: the tea kind's own colour */}
            <span className="truncate">
              <span style={isTeaware(focused) ? undefined : { color: getThemeTextColor(focused.type) }}>{focused.type}</span>
              {focused.year ? <> · <span className="font-mono tabular-nums">{focused.year}</span></> : null}
              {focused.vendor ? <> · <button type="button" onClick={() => onOpenSource(focused)} className="text-tea-text-sec underline decoration-tea-border underline-offset-2">{focused.vendor}</button></> : null}
            </span>
          </div>
          <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 mt-3">
            {([
              [priceMode === 'cost' ? 'Cost' : (isTeaware(focused) ? '$ ea' : '$/g'), (() => { const pr = priceOf(focused); return pr == null ? '—' : fmtNum(pr); })(), 'num'],
              ['Flags', isTeaware(focused) ? '—' : `${(focused.lowStockThreshold ?? 0).toLocaleString('en-US')} g`, 'num'],
              ['Counted', checkedLabel(focused), checkedLabel(focused) === 'never' ? 'warn' : ''],
              ['Shop', !focused.isPublic ? 'off' : focused.shownInShop === false ? 'hidden' : 'shown', ''],
              ['Coming', (() => { const c = incomingByProductId[focused.id]; return c?.hasOpenIncoming && c.remainingQuantity > 0 ? `+${fmtNum(c.remainingQuantity)}` : 'nothing'; })(), ''],
              ['Bought', Number(focused.quantityPurchased) > 0 ? `${Number(focused.quantityPurchased).toLocaleString('en-US')} ${isTeaware(focused) ? 'pc' : 'g'}` : '—', 'num'],
            ] as const).map(([k, v, tone]) => (
              <div key={k} className="flex min-w-0 items-baseline justify-between gap-2 border-b border-tea-border pb-1">
                <dt className="shrink-0 text-ui-10 uppercase tracking-[0.1em] text-tea-text-dim">{k}</dt>
                <dd className={`truncate text-right ${tone === 'num' ? 'font-mono text-ui-14 tabular-nums text-tea-text' : tone === 'warn' ? 'text-ui-13 text-tea-error' : 'text-ui-13 text-tea-text'}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center mt-4 border-t border-tea-border">
            <button type="button" onClick={() => onOpenEditor(focused)} className="flex-1 h-11 text-ui-13 text-tea-gold">Open</button>
            <span aria-hidden="true" className="w-px h-4 bg-tea-border" />
            <button ref={changeRef} type="button" onClick={() => changeRef.current && onChangeStock(focused, changeRef.current)} aria-label={`Change stock for ${focused.productName}`} className="flex-1 h-11 text-ui-13 text-tea-text">Change stock</button>
            <span aria-hidden="true" className="w-px h-4 bg-tea-border" />
            <button ref={countRef} type="button" onClick={() => countRef.current && onRecount(focused, countRef.current)} className="flex-1 h-11 text-ui-13 text-tea-text">Count it</button>
          </div>
        </section>
      )}
    </div>
  );
};
