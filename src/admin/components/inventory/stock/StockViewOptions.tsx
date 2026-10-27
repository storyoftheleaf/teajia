import { BottomSheet } from '../../../../components/shared/BottomSheet';
import { TYPOGRAPHY_CLASSES as T } from '../../../../designTokens';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupValue: string;
  groupOptions: readonly { value: string; label: string }[];
  onGroupChange: (value: string) => void;
  sortValue: string;
  sortDirection: 'asc' | 'desc';
  sortOptions: readonly (readonly [string, string])[];
  onSortChange: (value: string) => void;
  onSortDirectionChange: (value: 'asc' | 'desc') => void;
  priceMode: 'retail' | 'cost';
  onPriceModeChange: (value: 'retail' | 'cost') => void;
  columns?: readonly { key: string; label: string; checked: boolean; disabled?: boolean }[];
  onColumnChange: (key: string) => void;
  previewCurrency: { value: string; options: readonly string[]; onChange: (value: string) => void };
};

export function StockViewOptions(props: Props) {
  return <BottomSheet open={props.open} onOpenChange={props.onOpenChange} title="View options" description="Arrange the list. Your tea details stay the same.">
    <div className="stock-view-options">
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0"><span className={T.label}>Group by</span><select aria-label="Group by" className="stock-view-select" value={props.groupValue} onChange={event => props.onGroupChange(event.target.value)}>{props.groupOptions.map(option => <option key={option.value} value={option.value}>{option.value === 'vendor' ? 'Supplier' : option.label}</option>)}</select></label>
        <label className="min-w-0"><span className={T.label}>Order by</span><select aria-label="Order by" className="stock-view-select" value={props.sortValue} onChange={event => props.onSortChange(event.target.value)}>{props.sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <fieldset><legend className={T.label}>Direction</legend><div className="stock-view-segments">{(['asc', 'desc'] as const).map(value => <button key={value} type="button" aria-pressed={props.sortDirection === value} onClick={() => props.onSortDirectionChange(value)}>{value === 'asc' ? 'Ascending ↑' : 'Descending ↓'}</button>)}</div></fieldset>
      <fieldset><legend className={T.label}>Prices · USD</legend><div className="stock-view-segments">{(['retail', 'cost'] as const).map(value => <button key={value} type="button" aria-pressed={props.priceMode === value} onClick={() => props.onPriceModeChange(value)}>{value === 'retail' ? 'Retail' : 'Cost'}</button>)}</div></fieldset>
      {props.columns && <details className="stock-view-details"><summary>Table columns</summary><div className="grid grid-cols-2 gap-x-3 pt-2">{props.columns.map(column => <label key={column.key} className="flex min-h-11 items-center gap-2 text-ui-14"><input type="checkbox" className="accent-tea-gold" checked={column.checked} disabled={column.disabled} onChange={() => props.onColumnChange(column.key)} />{column.label}</label>)}</div></details>}
      <details className="stock-view-details"><summary>Shop preview currency</summary><label className="block pt-2"><span className={T.label}>Currency for shop preview</span><select className="stock-view-select" value={props.previewCurrency.value} onChange={event => props.previewCurrency.onChange(event.target.value)}>{props.previewCurrency.options.map(value => <option key={value} value={value}>{value}</option>)}</select></label><p className="mt-2 text-ui-13 text-tea-text-sec">Stock prices are shown in USD.</p></details>
    </div>
  </BottomSheet>;
}
