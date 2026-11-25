import type { ReactNode } from 'react';

type Choice = { value: string; label: string };
type Props = {
  tea: boolean;
  type: string;
  types: readonly string[];
  onType: (value: string) => void;
  supplier: string;
  suppliers: readonly string[];
  onSupplier: (value: string) => void;
  view: string;
  views: readonly (Choice & { filter: string })[];
  onView: (value: string) => void;
  tasting: string;
  onTasting: (value: string) => void;
  /** Puts every choice back to All. Shown only while at least one choice narrows the list. */
  onClearAll?: () => void;
  children?: ReactNode;
};

const TASTING_LABELS: Record<string, string> = {
  Untasted: 'To taste', Tasted: 'Tasted', HasProductTasting: 'Has profile', NeedsProductTasting: 'Needs profile',
};

/** The choices that are hiding teas right now, in plain words, e.g. "Stock: Samples". */
export function activeStockChoices(props: Pick<Props, 'tea' | 'type' | 'supplier' | 'view' | 'views' | 'tasting'>): string[] {
  const active: string[] = [];
  const view = props.views.find(choice => choice.value === props.view);
  if (view && view.filter !== 'All') active.push(`Stock: ${view.label}`);
  if (props.tea && props.type) active.push(`Type: ${props.type}`);
  if (props.supplier) active.push(`Supplier: ${props.supplier}`);
  if (props.tea && props.tasting) active.push(`Tasting: ${TASTING_LABELS[props.tasting] ?? props.tasting}`);
  return active;
}

const viewSection = (filter: string) => ['All', 'Working', 'ForSale', 'Samples', 'Personal'].includes(filter) ? 'Collection'
  : ['ToTaste', 'Untasted', 'Tasted', 'HasProductTasting', 'NeedsProductTasting'].includes(filter) ? 'Tasting'
  : ['Archived', 'SoldOut'].includes(filter) ? 'Archive' : 'Work to do';

/** Four independent browsing choices stay within reach; arrangement stays separate. */
export function StockBrowseBar(props: Props) {
  const sections = ['Collection', 'Tasting', 'Work to do', 'Archive'];
  const active = props.onClearAll ? activeStockChoices(props) : [];
  return <><div className={`stock-browse-bar ${props.tea ? '' : 'stock-browse-teaware'}`} data-testid="inventory-purpose-row" data-inventory-header-row>
    {props.tea && <label><span>Type</span><select aria-label="Tea type" title={props.type || 'All types'} value={props.type} onChange={event => props.onType(event.target.value)}><option value="">All</option>{props.types.map(type => <option key={type} value={type}>{type}</option>)}</select></label>}
    <label><span>Supplier</span><select aria-label="Supplier" title={props.supplier || 'All suppliers'} value={props.supplier} onChange={event => props.onSupplier(event.target.value)}><option value="">All</option>{props.suppliers.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
    <label><span>Stock</span><select aria-label="Show teas" value={props.view} onChange={event => props.onView(event.target.value)}>{sections.map(section => <optgroup key={section} label={section}>{props.views.filter(view => viewSection(view.filter) === section).map(view => <option key={view.value} value={view.value}>{view.filter === 'All' ? 'All' : view.label}</option>)}</optgroup>)}</select></label>
    {props.tea && <label><span>Tasting</span><select aria-label="Tasting status" value={props.tasting} onChange={event => props.onTasting(event.target.value)}><option value="">Any</option><option value="Untasted">To taste</option><option value="Tasted">Tasted</option><option value="HasProductTasting">Has profile</option><option value="NeedsProductTasting">Needs profile</option></select></label>}
    {props.children}
  </div>
    {active.length > 0 && <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-tea-border px-3 py-2 text-ui-12 text-tea-text-sec" data-testid="stock-active-filters">
      <span>Showing only {active.join(' · ')}</span>
      <button type="button" className="tap-target text-tea-gold underline underline-offset-4" onClick={props.onClearAll}>Clear all</button>
    </p>}
  </>;
}
