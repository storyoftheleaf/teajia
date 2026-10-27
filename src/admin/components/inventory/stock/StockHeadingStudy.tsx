import { useState } from 'react';
import { BottomSheet } from '../../../../components/shared/BottomSheet';
import { ChevronDown } from 'lucide-react';

type Props = {
  variant: number;
  views: { value: string; label: string }[];
  view: string;
  onView: (value: string) => void;
  groups: readonly { value: string; label: string }[];
  group: string;
  onGroup: (value: string) => void;
  orders: readonly (readonly [string, string])[];
  order: string;
  direction: 'asc' | 'desc';
  onOrder: (value: string) => void;
  onDirection: () => void;
  onOptions: () => void;
};

/** Local heading studies share the actual Stock records and their existing actions. */
export function StockHeadingStudy(p: Props) {
  const [open, setOpen] = useState(false);
  const viewName = p.views.find(v => v.value === p.view)?.label || 'All teas';
  const groupName = p.groups.find(v => v.value === p.group)?.label || 'None';
  const orderName = p.orders.find(([value]) => value === p.order)?.[1] || 'Name';
  const direction = p.direction === 'asc' ? '↑' : '↓';
  const viewSelect = <select aria-label="Show teas" value={p.view} onChange={e => p.onView(e.target.value)}>{p.views.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select>;
  const groupSelect = <select aria-label="Group teas by" value={p.group} onChange={e => p.onGroup(e.target.value)}>{p.groups.map(v => <option key={v.value} value={v.value}>{v.value === 'vendor' ? 'Supplier' : v.label}</option>)}</select>;
  const orderSelect = <select aria-label="Order teas by" value={p.order} onChange={e => p.onOrder(e.target.value)}>{p.orders.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>;
  const summary = `${p.group === 'vendor' ? 'Supplier' : groupName} · ${orderName} ${direction}`;
  return <div className={`stock-heading-study study-heading-${p.variant}`} data-testid="stock-heading-study">
    {p.variant === 1 && <div className="heading-study-fields"><label>Show{viewSelect}</label><label>Group{groupSelect}</label><label>Order<span className="heading-study-order">{orderSelect}<button onClick={p.onDirection} aria-label="Reverse order">{direction}</button></span></label></div>}
    {p.variant === 2 && <><nav className="heading-study-tabs" aria-label="Show teas">{p.views.slice(0,4).map(v => <button key={v.value} aria-pressed={v.value === p.view} onClick={() => p.onView(v.value)}>{v.label === 'All teas' ? 'All' : v.label === 'Shop stock' ? 'Shop' : v.label}</button>)}</nav><div className="heading-study-line"><span>{summary}</span><button onClick={p.onOptions}>Arrange <ChevronDown size={13}/></button></div></>}
    {p.variant === 3 && <button className="heading-study-sentence" onClick={() => setOpen(true)} aria-haspopup="dialog"><span>{viewName}</span><span className="text-tea-text-dim">{summary}</span><ChevronDown size={14}/></button>}
    {p.variant === 4 && <div className="heading-study-line"><span className="heading-study-scope">{viewSelect}</span><button className="heading-study-contained" onClick={p.onOptions}>{summary}<ChevronDown size={13}/></button></div>}
    {p.variant === 5 && <><div className="heading-study-line"><span className="heading-study-scope">{viewSelect}</span><button onClick={p.onOptions}>More options <ChevronDown size={13}/></button></div><nav className="heading-study-tabs" aria-label="Order teas">{[['productName','Name'],['stockGrams','Stock'],['year','Year']].map(([value,label]) => <button key={value} aria-pressed={p.order === value} onClick={() => p.order === value ? p.onDirection() : p.onOrder(value)}>{label}{p.order === value ? ` ${direction}` : ''}</button>)}</nav></>}
    <BottomSheet open={open} onOpenChange={setOpen} title="Show and arrange"><div className="heading-study-sheet"><label>Show{viewSelect}</label><label>Group by{groupSelect}</label><label>Order by{orderSelect}</label><button onClick={p.onDirection}>Direction: {p.direction === 'asc' ? 'Ascending ↑' : 'Descending ↓'}</button><button onClick={() => {setOpen(false);p.onOptions();}}>Prices and columns</button></div></BottomSheet>
  </div>;
}
