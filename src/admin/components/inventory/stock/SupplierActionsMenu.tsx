import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { AnchoredMenu } from '../../../../components/shared/AnchoredMenu';
import type { Product } from '../../../../admin/types';

/** One supplier group's menu, the same on the laptop heading and the phone's
 *  8 October supplier line: open the supplier, rename it, or give the teas a supplier. */
export function SupplierActionsMenu({ label, items, onRename, onAssign, onDetails, phone }: {
  label: string;
  items: readonly Product[];
  onRename: (supplier: Product) => void;
  onAssign: (items: Product[]) => void;
  onDetails?: (supplier: Product) => void;
  phone?: boolean;
}) {
  const supplier = items.find(product => product.vendor?.trim());
  const Icon = phone ? ChevronRight : ChevronDown;
  return <AnchoredMenu align="right" width={180} trigger={props => <button {...props} type="button" className={phone ? 'tap-target w-10 flex items-end justify-center pb-3 text-tea-gold' : 'tap-target'} aria-label={`Supplier actions for ${label}`}><Icon size={16} aria-hidden="true" /></button>}>
    {close => <>
      {onDetails && supplier && <button type="button" role="menuitem" className="stock-supplier-edit-option" onClick={() => { close(); onDetails(supplier); }}>Supplier details</button>}
      <button type="button" role="menuitem" className="stock-supplier-edit-option" onClick={() => { close(); if (supplier) onRename(supplier); else onAssign([...items]); }}><Pencil size={15} aria-hidden="true" />{supplier ? 'Edit supplier name' : 'Assign suppliers'}</button>
    </>}
  </AnchoredMenu>;
}
