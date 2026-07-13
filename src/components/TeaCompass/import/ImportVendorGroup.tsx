import React, { useState } from 'react';
import type { ImportReviewGroupRow } from './importReviewDomain';
import { ImportItemRow } from './ImportItemRow';
import type { CurateImportItem, CurateImportItemUpdate, LookupState } from '../../../lib/api';
import { ImportMatchPicker } from './ImportMatchPicker';
import type { ImportIdentityOption, ImportHoldingOption } from './ImportItemRow';

export interface ImportVendorOption { id: string; name: string }

interface Props {
  group: ImportReviewGroupRow;
  vendorLookup: LookupState<ImportVendorOption>;
  identityLookup: LookupState<ImportIdentityOption>;
  holdingLookup: LookupState<ImportHoldingOption>;
  busyId: string | null;
  onRetryVendors: () => void;
  onRetryIdentities: () => void;
  onRetryHoldings: () => void;
  onUpdateItem: (item: CurateImportItem, updates: CurateImportItemUpdate) => Promise<boolean>;
  onChangeVendor: (groupId: string, vendorId: string) => Promise<boolean>;
  onCreateVendor: (groupId: string, name: string) => Promise<boolean>;
}

export const ImportVendorGroup: React.FC<Props> = ({ group, vendorLookup, identityLookup, holdingLookup, busyId, onRetryVendors, onRetryIdentities, onRetryHoldings, onUpdateItem, onChangeVendor, onCreateVendor }) => {
  const [changing, setChanging] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const vendorName = group.resolved_vendor_name || vendorLookup.options.find(vendor => vendor.id === group.resolved_vendor_customer_id)?.name || group.proposed_vendor_name || 'Choose vendor';
  const groupNoun = group.items.every(row => row.item.category === 'tea') ? (group.items.length === 1 ? 'tea' : 'teas') : group.items.every(row => row.item.category === 'teaware') ? (group.items.length === 1 ? 'teaware item' : 'teaware items') : (group.items.length === 1 ? 'item' : 'items');
  return (
    <section data-testid="import-vendor-group" aria-labelledby={`vendor-${group.id}`} className="space-y-2 border-t border-tea-border pt-4 first:border-t-0">
      <div>
        <div className="flex min-h-8 items-start justify-between gap-3">
          <p className="pt-1 text-ui-10 uppercase tracking-[1.2px] text-tea-text-dim">Vendor · {group.items.length} {groupNoun}{!group.vendorResolved ? ' · suggested' : ''}</p>
          <button type="button" disabled={Boolean(busyId)} onClick={() => setChanging(value => !value)} aria-label={`Change vendor for ${vendorName}`} aria-expanded={changing} className="tap-target shrink-0 text-ui-10 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Change</button>
        </div>
        <h4 id={`vendor-${group.id}`} className="w-full break-words font-display text-ui-20 leading-tight text-tea-text">{vendorName}</h4>
      </div>
      {changing && (
        <div className="space-y-3 border-l-2 border-tea-border pl-3">
          <ImportMatchPicker label={`Vendor for ${vendorName}`} lookup={vendorLookup} selectedId={group.resolved_vendor_customer_id || ''} proposedName={group.proposed_vendor_name} disabled={Boolean(busyId)} onRetry={onRetryVendors} onSelect={vendorId => { void onChangeVendor(group.id, vendorId).then(ok => { if (ok) setChanging(false); }); }} />
          <label className="block text-ui-11 text-tea-text-sec">Create new vendor
            <input disabled={Boolean(busyId) || !['ready', 'empty'].includes(vendorLookup.status)} value={newVendorName} onChange={event => setNewVendorName(event.target.value)} placeholder={vendorLookup.status === 'error' ? 'Retry existing vendors first' : group.proposed_vendor_name || 'Vendor name'} className="mt-1 min-h-11 w-full rounded-md border border-tea-border bg-tea-elevated px-3 text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold disabled:opacity-50 lg:text-ui-13" />
          </label>
          <div className="flex justify-between gap-3">
            <button type="button" disabled={Boolean(busyId)} onClick={() => setChanging(false)} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Cancel</button>
            <button type="button" disabled={Boolean(busyId) || !['ready', 'empty'].includes(vendorLookup.status) || !newVendorName.trim()} onClick={() => void onCreateVendor(group.id, newVendorName.trim()).then(ok => { if (ok) { setNewVendorName(''); setChanging(false); } })} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 text-ui-12 font-medium text-tea-bg disabled:opacity-50">Create vendor</button>
          </div>
        </div>
      )}
      <div className="divide-y divide-tea-border border-y border-tea-border">
        {group.items.map(row => <ImportItemRow key={row.item.id} item={row.item} busy={Boolean(busyId)} identityLookup={identityLookup} holdingLookup={holdingLookup} onRetryIdentities={onRetryIdentities} onRetryHoldings={onRetryHoldings} onUpdate={updates => onUpdateItem(row.item, updates)} />)}
      </div>
    </section>
  );
};
