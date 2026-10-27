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
  children?: ReactNode;
};

const viewSection = (filter: string) => ['All', 'Working', 'ForSale', 'Samples', 'Personal'].includes(filter) ? 'Collection'
  : ['ToTaste', 'Untasted', 'Tasted', 'HasProductTasting', 'NeedsProductTasting'].includes(filter) ? 'Tasting'
  : ['Archived', 'SoldOut'].includes(filter) ? 'Archive' : 'Work to do';

/** Four independent browsing choices stay within reach; arrangement stays separate. */
export function StockBrowseBar(props: Props) {
  const sections = ['Collection', 'Tasting', 'Work to do', 'Archive'];
  return <div className={`stock-browse-bar ${props.tea ? '' : 'stock-browse-teaware'}`} data-testid="inventory-purpose-row" data-inventory-header-row>
    {props.tea && <label><span>Type</span><select aria-label="Tea type" title={props.type || 'All types'} value={props.type} onChange={event => props.onType(event.target.value)}><option value="">All</option>{props.types.map(type => <option key={type} value={type}>{type}</option>)}</select></label>}
    <label><span>Supplier</span><select aria-label="Supplier" title={props.supplier || 'All suppliers'} value={props.supplier} onChange={event => props.onSupplier(event.target.value)}><option value="">All</option>{props.suppliers.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
    <label><span>Stock</span><select aria-label="Show teas" value={props.view} onChange={event => props.onView(event.target.value)}>{sections.map(section => <optgroup key={section} label={section}>{props.views.filter(view => viewSection(view.filter) === section).map(view => <option key={view.value} value={view.value}>{view.filter === 'All' ? 'All' : view.label}</option>)}</optgroup>)}</select></label>
    {props.tea && <label><span>Tasting</span><select aria-label="Tasting status" value={props.tasting} onChange={event => props.onTasting(event.target.value)}><option value="">Any</option><option value="Untasted">To taste</option><option value="Tasted">Tasted</option><option value="HasProductTasting">Has profile</option><option value="NeedsProductTasting">Needs profile</option></select></label>}
    {props.children}
  </div>;
}
