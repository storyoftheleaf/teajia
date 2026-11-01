import { describe, expect, it } from 'vitest';
import type { PurchaseTrackingRow } from '../../../lib/api';
import type { LogisticsOrder, LogisticsShipment } from '../../../lib/logisticsTypes';
import { purchaseJourneyGroups } from './purchaseJourneyGroups';
const purchase = (id: string) => ({ id, purchase: { id } } as PurchaseTrackingRow);
const order = (id: string, company: string) => ({ purchase_id: id, receipt_id: null, vendor_name: null, inbound_courier: null, inbound_tracking_number: null, logistics_arrived_at: null, logistics_company_id: company, logistics_company_name: 'Forwarder', lines: [] } satisfies LogisticsOrder);
const shipment = (id: string, company: string) => ({ id, logistics_company_id: company, logistics_company_name: 'Forwarder', lines: [] } as unknown as LogisticsShipment);
describe('purchases beside onward shipments', () => {
  it('keeps split purchases and their onward shipments in the same company workspace', () => {
    const rows=[purchase('one'),purchase('two')];
    const ship=shipment('boat','company');
    const result=purchaseJourneyGroups(rows,[ship],[order('one','company'),order('two','company')]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].purchases).toEqual(rows);
    expect(result.groups[0].shipments).toEqual([ship]);
    expect(result.groups[0].orders).toHaveLength(2);
  });
  it('keeps distinct company identities separate even when names match', () => {
    const result=purchaseJourneyGroups([purchase('one')],[shipment('boat','second')],[order('one','first')]);
    expect(result.groups.map(group=>group.id)).toEqual(['contact:first','contact:second']);
  });
  it('keeps unmatched purchases visible and does not create empty company workspaces', () => {
    const row=purchase('unmatched');
    expect(purchaseJourneyGroups([row],[],[order('hidden','company')])).toEqual({ groups:[], other:[row] });
  });
});
