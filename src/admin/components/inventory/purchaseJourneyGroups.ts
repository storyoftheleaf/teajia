import type { PurchaseTrackingRow } from '../../../lib/api';
import type { LogisticsOrder, LogisticsShipment } from '../../../lib/logisticsTypes';

type Company = { logistics_company_id: string | null; logistics_company_name: string | null };
const companyKey = (company: Company) => company.logistics_company_id ? `contact:${company.logistics_company_id}` : `name:${company.logistics_company_name}`;
export interface PurchaseJourneyGroup {
  id: string;
  name: string;
  purchases: PurchaseTrackingRow[];
  shipments: LogisticsShipment[];
  orders: LogisticsOrder[];
}

/** Keep both transport legs together, including purchases split across shipments. */
export function purchaseJourneyGroups(rows: PurchaseTrackingRow[], shipments: LogisticsShipment[], orders: LogisticsOrder[]) {
  const groups = new Map<string, PurchaseJourneyGroup>();
  const other: PurchaseTrackingRow[] = [];
  const getGroup = (company: Company) => {
    const id = companyKey(company);
    if (!groups.has(id)) groups.set(id, { id, name: company.logistics_company_name || 'Logistics company', purchases: [], shipments: [], orders: orders.filter(order => companyKey(order) === id) });
    return groups.get(id)!;
  };
  for (const row of rows) {
    const order = orders.find(order => order.purchase_id === row.purchase?.id);
    if (order?.logistics_company_name) getGroup(order).purchases.push(row);
    else other.push(row);
  }
  for (const shipment of shipments) getGroup(shipment).shipments.push(shipment);
  return { groups: [...groups.values()], other };
}
