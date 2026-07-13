import React, { useState } from 'react';
import type { ImportReviewGroupRow } from './importReviewDomain';
import { ImportItemRow } from './ImportItemRow';
import type { CurateImportItem, CurateImportItemUpdate } from '../../../lib/api';

export interface ImportVendorOption { id: string; name: string }

interface Props {
  group: ImportReviewGroupRow;
  vendorOptions: ImportVendorOption[];
  busyId: string | null;
  onUpdateItem: (item: CurateImportItem, updates: CurateImportItemUpdate) => Promise<boolean>;
  onChangeVendor: (groupId: string, vendorId: string) => Promise<boolean>;
  onCreateVendor: (groupId: string, name: string) => Promise<boolean>;
}

export const ImportVendorGroup: React.FC<Props> = ({ group, vendorOptions, busyId, onUpdateItem, onChangeVendor, onCreateVendor }) => {
  const [changing, setChanging] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const vendorName = group.resolved_vendor_name || vendorOptions.find(vendor => vendor.id === group.resolved_vendor_customer_id)?.name || group.proposed_vendor_name || 'Choose vendor';
  const groupNoun = group.items.every(row => row.item.category === 'tea') ? (group.items.length === 1 ? 'tea' : 'teas') : group.items.every(row => row.item.category === 'teaware') ? (group.items.length === 1 ? 'teaware item' : 'teaware items') : (group.items.length === 1 ? 'item' : 'items');
  return (
    <section data-testid="import-vendor-group" aria-labelledby={`vendor-${group.id}`} className="space-y-2 border-t border-tea-border pt-4 first:border-t-0">
      <div>
        <div className="flex min-h-8 items-start justify-between gap-3">
          <p className="pt-1 text-ui-10 uppercase tracking-[1.2px] text-tea-text-dim">Vendor · {group.items.length} {groupNoun}{!group.vendorResolved ? ' · suggested' : ''}</p>
          <button type="button" onClick={() => setChanging(value => !value)} aria-label={`Change vendor for ${vendorName}`} aria-expanded={changing} className="tap-target shrink-0 text-ui-10 text-tea-text-sec hover:text-tea-text">Change</button>
        </div>
        <h4 id={`vendor-${group.id}`} className="w-full break-words font-display text-ui-20 leading-tight text-tea-text">{vendorName}</h4>
      </div>
      {changing && (
        <div className="space-y-3 border-l-2 border-tea-border pl-3">
          <label className="block text-ui-11 text-tea-text-sec">Existing vendor
            <select aria-label={`Vendor for ${vendorName}`} value={group.resolved_vendor_customer_id || ''} disabled={Boolean(busyId)} onChange={event => { if (event.target.value) void onChangeVendor(group.id, event.target.value).then(ok => { if (ok) setChanging(false); }); }} className="mt-1 min-h-11 w-full rounded-md border border-tea-border bg-tea-elevated px-3 text-ui-16 text-tea-text outline-none focus:border-tea-gold lg:text-ui-13">
              <option value="">Choose an existing vendor</option>
              {vendorOptions.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </select>
          </label>
          <label className="block text-ui-11 text-tea-text-sec">Create new vendor
            <input value={newVendorName} onChange={event => setNewVendorName(event.target.value)} placeholder={group.proposed_vendor_name || 'Vendor name'} className="mt-1 min-h-11 w-full rounded-md border border-tea-border bg-tea-elevated px-3 text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold lg:text-ui-13" />
          </label>
          <div className="flex justify-between gap-3">
            <button type="button" onClick={() => setChanging(false)} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Cancel</button>
            <button type="button" disabled={Boolean(busyId) || !newVendorName.trim()} onClick={() => void onCreateVendor(group.id, newVendorName.trim()).then(ok => { if (ok) { setNewVendorName(''); setChanging(false); } })} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 text-ui-12 font-medium text-tea-bg disabled:opacity-50">Create vendor</button>
          </div>
        </div>
      )}
      <div className="divide-y divide-tea-border border-y border-tea-border">
        {group.items.map(row => <ImportItemRow key={row.item.id} item={row.item} busy={busyId === row.item.id} onUpdate={updates => onUpdateItem(row.item, updates)} />)}
      </div>
    </section>
  );
};
