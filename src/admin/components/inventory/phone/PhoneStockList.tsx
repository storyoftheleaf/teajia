import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, X as XIcon } from 'lucide-react';
import type { Product } from '../../../types';
import type { IncomingInventorySummary } from '../domain';
import { fmtNum } from '../../../../utils/formatNumber';
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
  <div role="group" aria-label="Group teas by" className="flex shrink-0 rounded-full border border-tea-border">
    {/* None stays in the Adjust sheet: four choices do not fit beside the view name at 375px. */}
    {(['vendor', 'type', 'stage'] as PhoneGroupBy[]).map(by => (
      <button
        key={by}
        type="button"
        aria-pressed={value === by}
        onClick={() => onChange(by)}
        className={`tap-target h-7 px-2.5 rounded-full text-ui-12 ${value === by ? 'bg-tea-elevated text-tea-gold' : 'text-tea-text-sec'}`}
      >{PHONE_GROUP_LABELS[by]}</button>
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
}

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

  return (
    <div data-testid="stock-phone" className={focused && !selecting ? 'pb-[300px]' : selecting ? 'pb-[150px]' : ''}>
      {groups.length === 0 && (
        <p className="px-4 py-10 text-center text-ui-14 text-tea-text-sec">Nothing matches this view.</p>
      )}

      {groups.map(group => {
        const isOpen = expandAll || open.has(group.key);
        return (
          <section key={group.key} aria-label={group.label}>
            {groupBy !== 'none' && (
              <div className="flex items-stretch border-t border-tea-border bg-tea-surface">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={isOpen}
                  className="flex-1 min-w-0 flex items-start gap-2 px-3 py-2 text-left"
                >
                  {isOpen ? <ChevronDown size={14} className="mt-1 shrink-0 text-tea-text-sec" aria-hidden="true" /> : <ChevronRight size={14} className="mt-1 shrink-0 text-tea-text-sec" aria-hidden="true" />}
                  <span className="min-w-0">
                    <span className="block truncate text-ui-15 font-semibold text-tea-text">{group.label}</span>
                    <span className="block font-mono text-ui-11 text-tea-text-sec">
                      {group.count} {group.count === 1 ? 'item' : 'items'} · {isTeaware(group.products[0]) ? `${group.onHand} pc` : `${group.onHand.toLocaleString('en-US')} g`} · {money(group.retailValueUsd)}
                      {group.low > 0 && <span className="text-tea-gold"> · {group.low} low</span>}
                      {group.unchecked > 0 && <span> · {group.unchecked} unchecked</span>}
                    </span>
                  </span>
                </button>
                {groupBy === 'vendor' && group.products[0]?.vendor && (
                  <button
                    type="button"
                    onClick={() => onOpenSource(group.products[0])}
                    aria-label={`Supplier details for ${group.label}`}
                    className="tap-target w-11 flex items-center justify-center text-tea-gold"
                  ><ChevronRight size={18} aria-hidden="true" /></button>
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
              const qtyTone = qty <= 0 ? 'text-tea-text-dim' : isLow(p) ? 'text-tea-gold' : 'text-tea-text';
              const sub = [p.year, groupBy === 'type' ? p.vendor : p.type, price != null ? `$${fmtNum(price)}${isTeaware(p) ? '' : '/g'}` : null].filter(Boolean).join(' · ');
              return (
                <div key={p.id} className={`flex items-center border-t border-tea-border ${isSel || isFocused ? 'bg-tea-elevated' : ''}`}>
                  <button
                    type="button"
                    onClick={() => onToggleSelect(p.id)}
                    aria-pressed={isSel}
                    aria-label={`${isSel ? 'Untick' : 'Tick'} ${p.productName}`}
                    className="tap-target w-10 shrink-0 flex items-center justify-center self-stretch"
                  >
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSel ? 'cta-solid border-tea-gold' : 'border-tea-text-dim'}`}>
                      {isSel && <Check size={11} strokeWidth={3.5} aria-hidden="true" />}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFocusedId(isFocused ? null : p.id)}
                    aria-expanded={isFocused}
                    className="flex-1 min-w-0 flex items-center gap-3 py-2 pr-3 text-left min-h-[48px]"
                  >
                    <span className="flex-1 min-w-0">
                      <span className={`block truncate font-display text-ui-17 font-semibold leading-tight ${isFocused || isSel ? 'text-tea-gold' : 'text-tea-text'}`}>{p.productName}</span>
                      <span className="block truncate text-ui-11 text-tea-text-sec">{sub}</span>
                    </span>
                    <span className="shrink-0 flex flex-col items-end">
                      <span className={`font-mono text-ui-14 ${qtyTone}`}>{qtyLabel(p)}</span>
                      {comingQty > 0 && <span className="font-mono text-ui-10 text-tea-gold-lt">+{fmtNum(comingQty)} coming</span>}
                      {isUnchecked(p) && comingQty <= 0 && <span className="text-ui-10 text-tea-text-dim">not checked</span>}
                    </span>
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
          className="fixed left-0 right-0 bottom-nav z-drawer rounded-t-xl border-t border-tea-border bg-tea-surface px-4 pt-2 pb-3 shadow-xl"
        >
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => setFocusedId(null)} aria-label="Close" className="tap-target -ml-1 mt-1 text-tea-text-sec hover:text-tea-text"><XIcon size={18} aria-hidden="true" /></button>
            <div className="flex-1 min-w-0">
              <div className="truncate text-ui-12 text-tea-gold">{[focused.vendor, focused.type, focused.year].filter(Boolean).join(' · ')}</div>
              <button type="button" onClick={() => onOpenEditor(focused)} className="block w-full truncate text-left font-display text-ui-20 font-semibold leading-tight text-tea-text">{focused.productName}</button>
            </div>
            <button
              ref={changeRef}
              type="button"
              onClick={() => changeRef.current && onChangeStock(focused, changeRef.current)}
              aria-label={`Change stock for ${focused.productName}`}
              className="shrink-0 min-w-[80px] h-12 px-2 rounded-md border border-tea-gold flex flex-col items-center justify-center"
            >
              <span className={`font-mono text-ui-17 ${isLow(focused) ? 'text-tea-gold' : 'text-tea-text'}`}>{qtyLabel(focused)}</span>
              <span className="text-ui-10 text-tea-gold">change</span>
            </button>
          </div>
          <dl className="grid grid-cols-3 gap-x-3 mt-2">
            {[
              ['Checked', checkedLabel(focused)],
              ['In transit', (() => { const c = incomingByProductId[focused.id]; return c?.hasOpenIncoming && c.remainingQuantity > 0 ? `+${fmtNum(c.remainingQuantity)}` : 'nothing'; })()],
              [priceMode === 'cost' ? 'Cost' : 'Retail', (() => { const pr = priceOf(focused); return pr == null ? '—' : `$${fmtNum(pr)}${isTeaware(focused) ? '' : ' /g'}`; })()],
              ['Flags under', isTeaware(focused) ? '—' : `${focused.lowStockThreshold ?? 0} g`],
              ['Shop', !focused.isPublic ? 'off' : focused.shownInShop === false ? 'on, not shown' : 'shown'],
              ['Status', focused.status || '—'],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-tea-border py-1.5 min-w-0">
                <dt className="font-mono text-ui-10 uppercase tracking-[0.06em] text-tea-text-sec">{k}</dt>
                <dd className="truncate text-ui-13 text-tea-text">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 mt-2">
            <button type="button" onClick={() => onOpenEditor(focused)} className="h-10 rounded-md border border-tea-gold text-ui-13 text-tea-gold">Edit everything</button>
            <button ref={countRef} type="button" onClick={() => countRef.current && onRecount(focused, countRef.current)} className="h-10 rounded-md border border-tea-border text-ui-13 text-tea-text">Count it</button>
            <button type="button" onClick={() => onOpenSource(focused)} disabled={!focused.vendor} className="h-10 rounded-md border border-tea-border text-ui-13 text-tea-text disabled:opacity-40">Supplier</button>
          </div>
        </section>
      )}
    </div>
  );
};
