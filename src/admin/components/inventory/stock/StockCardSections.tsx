import { Fragment, useCallback, useMemo, useState } from 'react';
import { useNavigate, type SetURLSearchParams } from 'react-router-dom';
import { readInventoryFold, withInventoryFold } from '../helpers';
import { StockTeaCard } from './StockTeaCard';
import { deriveInventoryStage, effectivePurpose, preparationHeadingText, preparationHeadings, type IncomingInventorySummary, type InventoryStage } from '../domain';
import type { InventoryCategory, InventoryProductGroup } from '../types';
import type { Product } from '../../../types';
import { fmtNum } from '../../../../utils/formatNumber';

const headingCache = new WeakMap<InventoryProductGroup, ReturnType<typeof preparationHeadings>>();
function needHeadingsFor(group: InventoryProductGroup) {
  let headings = headingCache.get(group);
  if (!headings) { headings = preparationHeadings(group.items); headingCache.set(group, headings); }
  return headings;
}

export function useStockLayout() {
  const [layout, setLayout] = useState<'cards' | 'table'>(() => localStorage.getItem('teajia-stock-layout') === 'cards' ? 'cards' : 'table');
  const chooseLayout = (next: 'cards' | 'table') => {
    localStorage.setItem('teajia-stock-layout', next);
    setLayout(next);
  };
  return [layout, chooseLayout] as const;
}

/** Keeps the card groups and their next-action routing together, inside the existing scroll container. */
export function StockCardSections({ groups, category, incomingByProductId, onOpen, onListingReview }: {
  groups: InventoryProductGroup[];
  category: InventoryCategory;
  incomingByProductId: Record<string, IncomingInventorySummary>;
  onOpen: (product: Product) => void;
  onListingReview: (id: string) => void;
}) {
  const navigate = useNavigate();
  const openAction = (product: Product, stage: InventoryStage) => {
    if (effectivePurpose(product) !== 'working') { onOpen(product); return; }
    if (stage === 'published' || stage === 'ready_private') {
      onListingReview(product.id);
      onOpen(product);
      return;
    }
    if (stage === 'needs_preparation') {
      navigate(product.sourceCompassEntryId
        ? `/admin/compass?tab=sourcing&entry=${encodeURIComponent(product.sourceCompassEntryId)}`
        : `/admin/compass?tab=sourcing&developProduct=${encodeURIComponent(product.id)}&developName=${encodeURIComponent(product.givenName || product.productName)}&developType=${encodeURIComponent(product.type)}`);
      return;
    }
    onOpen(product);
  };
  return (
    <div className="stock-card-sections" data-testid="stock-card-sections">
      {groups.filter(group => group.items.length > 0).map(group => (
        <section key={group.key} data-stock-group={group.label} data-testid={group.lifecycle ? `inventory-stage-${group.key}` : undefined} aria-label={`${group.label}, ${group.items.length} ${category === 'tea' ? 'teas' : 'items'}`}>
          <div className="stock-card-section-heading">
            <h2>{group.label}</h2>
            <span>{group.items.length} {category === 'tea' ? group.items.length === 1 ? 'tea' : 'teas' : 'items'} · {fmtNum(group.totalStock, 0)} {category === 'tea' ? 'g' : 'units'}</span>
          </div>
          <div className="stock-card-grid">
            {group.items.map(product => {
              const needHeading = group.lifecycle && group.key === 'needs_preparation' && category === 'tea' ? needHeadingsFor(group).get(product.id) : undefined;
              return <Fragment key={product.id}>{needHeading && <h3 className="col-span-full pt-2 text-ui-12 text-tea-text-sec" data-preparation-need={needHeading.need}>{preparationHeadingText(needHeading)}</h3>}<StockTeaCard product={product}
              stage={group.lifecycle ? group.key as InventoryStage : deriveInventoryStage(product, incomingByProductId[product.id])}
              incoming={incomingByProductId[product.id]} onOpen={onOpen} onAction={openAction} /></Fragment>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Group folding remains encoded in the inventory address for reload and browser history. */
export function useStockGroupFolds(searchParams: URLSearchParams, setSearchParams: SetURLSearchParams) {
  const collapsedGroups = useMemo(() => readInventoryFold(searchParams), [searchParams]);
  const toggleCollapsedGroup = useCallback((groupKey: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
    setSearchParams(params => withInventoryFold(params, next), { replace: true });
  }, [collapsedGroups, setSearchParams]);
  return [collapsedGroups, toggleCollapsedGroup] as const;
}
