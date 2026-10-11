import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLedgerStore } from '../../lib/ledgerStore';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { createEmptyEntry } from '../TeaCompass/types';
import { applySupplierRenameLocally } from './supplierRenameCaches';
import { describeRename, type SupplierRenamePreview } from './supplierSheetTypes';

/*
 * After the server has renamed a supplier everywhere, the browser still holds
 * copies: the Curate teas in the local store, the open buying basket, and
 * cached reads. The new name has to show without a reload, and only on THIS
 * supplier's rows (by id, or by the old name where a row has no id).
 */

const entry = (id: string, vendorName: string | undefined, vendorId?: string) =>
  ({ ...createEmptyEntry('tea'), id, vendorName, vendorId, synced: true });

beforeEach(() => {
  useTeaCompassStore.setState({
    entries: [
      entry('by-id', 'Bo (Menghai)', 'bo'),
      entry('by-text', ' master bo '),
      entry('other-id', 'Master Bo', 'someone-else'),
      entry('unrelated', 'Lin Tea House', 'lin'),
    ],
    pendingEntries: [entry('draft', 'Master Bo')],
    lastVendorId: 'bo', lastVendorName: 'Master Bo',
  });
  useLedgerStore.setState({ transactions: [], activeTransactionId: null });
});

describe('the local copies follow a supplier rename', () => {
  it('renames this supplier\'s teas by id or by old name, leaves everyone else, and does not mark teas unsynced', () => {
    applySupplierRenameLocally(new QueryClient(), { vendorId: 'bo', oldName: 'Master Bo', newName: 'Bo Lin' });
    const names = Object.fromEntries(useTeaCompassStore.getState().entries.map(e => [e.id, e.vendorName]));
    expect(names).toEqual({ 'by-id': 'Bo Lin', 'by-text': 'Bo Lin', 'other-id': 'Master Bo', unrelated: 'Lin Tea House' });
    expect(useTeaCompassStore.getState().pendingEntries[0].vendorName).toBe('Bo Lin');
    expect(useTeaCompassStore.getState().lastVendorName).toBe('Bo Lin');
    // The server already has the name; nothing is queued to send.
    expect(useTeaCompassStore.getState().entries.every(e => e.synced === true)).toBe(true);
  });

  it('renames the open buying basket for that supplier only', () => {
    const ledger = useLedgerStore.getState();
    const mine = ledger.createTransaction('purchase', 'Master Bo', 'Yuan', 'bo');
    const theirs = ledger.createTransaction('purchase', 'Lin Tea House', 'Yuan', 'lin');
    applySupplierRenameLocally(new QueryClient(), { vendorId: 'bo', oldName: 'Master Bo', newName: 'Bo Lin' });
    expect(useLedgerStore.getState().getTransaction(mine)?.counterpartyName).toBe('Bo Lin');
    expect(useLedgerStore.getState().getTransaction(theirs)?.counterpartyName).toBe('Lin Tea House');
  });

  it('refetches the cached reads that carry a supplier name, and only those', () => {
    const client = new QueryClient();
    client.setQueryData(['purchase-orders', 'acct'], [{ vendor_name: 'Master Bo' }]);
    client.setQueryData(['customers', 'acct'], []);
    client.setQueryData(['curate-samples-only', 'acct'], [{ entry: { vendor_name: 'Master Bo' } }]);
    client.setQueryData(['shop-freight-default'], { rate: 85 });
    applySupplierRenameLocally(client, { vendorId: 'bo', oldName: 'Master Bo', newName: 'Bo Lin' });
    expect(client.getQueryState(['purchase-orders', 'acct'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['customers', 'acct'])?.isInvalidated).toBe(true);
    // The samples drawn in Stock carry the supplier's name too.
    expect(client.getQueryState(['curate-samples-only', 'acct'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['shop-freight-default'])?.isInvalidated).toBe(false);
  });
});

describe('what the confirm step says', () => {
  const preview = (counts: Array<[string, string, number, number]>): SupplierRenamePreview => ({
    vendor_id: 'bo', old_name: 'Master Bo', new_name: 'Bo Lin', total: 1,
    counts: [{ table: 'customers', label: 'the supplier card', by_id: 1, by_name: 0 },
      ...counts.map(([table, label, by_id, by_name]) => ({ table, label, by_id, by_name }))],
  });

  it('lists only what changes, counting rows tied by id and by name together', () => {
    expect(describeRename(preview([['tea_compass_entries', 'teas in Curate', 14, 1], ['products', 'teas on the shelf', 0, 0], ['purchase_orders', 'orders', 3, 0]])))
      .toBe('This changes 15 teas in Curate and 3 orders, and the supplier card.');
  });

  it('says so when only the card carries the name', () => {
    expect(describeRename(preview([['products', 'teas on the shelf', 0, 0]]))).toMatch(/only|Nothing else/i);
  });
});
