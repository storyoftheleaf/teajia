import { describe, expect, it } from 'vitest';
import { teaSourcingConnections } from './teaSourcingConnections';
import type { ShopOrder } from '../components/curate/shopOrders';
import type { InventoryReceipt } from '../admin/types';
const order = (id: string, tea: string, productId?: string) => ({ id, vendorName: 'Same supplier', items: [{ compassEntryId: tea, productId }] }) as ShopOrder;
const receipt = (id: string, source: string, product?: string) => ({ id, source_kind: 'purchase_order', source_ref: source, lines: product ? [{product_id: product}] : [] }) as InventoryReceipt;
describe('connected tea sourcing identity', () => {
  it('keeps another tea from the same vendor out of shipping facts', () => {
    const a = order('a', 'tea'); const b = order('b', 'other');
    expect(teaSourcingConnections({id:'tea'}, [a,b], [receipt('ra','a'), receipt('rb','b')])).toEqual({orders:[a],receipts:[receipt('ra','a')]});
  });
  it('uses a recorded Stock backlink and keeps received shipment history', () => {
    const a=order('a','old-entry','product'); const r=receipt('received','external','product');
    expect(teaSourcingConnections({id:'tea',draftProductId:'product'},[a],[r])).toEqual({orders:[a],receipts:[r]});
  });
  it('does not guess a receipt from a proposal ID or a legacy supplier name', () => {
    const r={...receipt('proposal-shaped','tea'),legacy:true};
    expect(teaSourcingConnections({id:'tea'},[],[r,receipt('unlinked','tea')])).toEqual({orders:[],receipts:[]});
  });
});
