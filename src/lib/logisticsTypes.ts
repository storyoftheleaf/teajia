import type { LogisticsTrackingSnapshot } from './logisticsTrackingUpdate';
/** Shared supplier → forwarder → studio tracking. Freight is accounting only. */
export interface LogisticsFreight {
  basis: 'kg' | 'm3' | 'fixed';
  rate: number | null;
  billed_quantity: number | null;
  total_amount: number | null;
  currency: string | null;
  confirmed: boolean;
  allocation_basis?: 'kg' | 'm3';
}
export interface LogisticsPurchaseLine {
  id: string;
  product_id: string;
  product_name: string;
  unit: 'g' | 'unit';
  expected_quantity: number;
  received_quantity: number;
  cancelled_quantity: number;
  available_quantity: number;
  original_cost_amount: number | null;
  original_cost_currency: string | null;
  image_url: string | null;
  source_url: string | null;
}
export interface LogisticsAddressInput {
  label: string;
  role: 'warehouse' | 'destination';
  recipient: string;
  address_lines: string;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country_code: string;
  phone?: string | null;
  logistics_company_id?: string | null;
}
export interface LogisticsAddress extends LogisticsAddressInput { id: string; archived: boolean }

export interface LogisticsOrder {
  tracking_update?: LogisticsTrackingSnapshot | null;
  warehouse_address_id?: string | null;
  warehouse_address?: LogisticsAddress | null;
  purchase_id: string;
  receipt_id: string | null;
  vendor_name: string | null;
  logistics_company_id: string | null;
  logistics_company_name: string | null;
  inbound_courier: string | null;
  inbound_tracking_number: string | null;
  logistics_arrived_at: string | null;
  lines: LogisticsPurchaseLine[];
}
export interface LogisticsShipmentLine {
  id: string;
  shipment_id: string;
  purchase_id: string;
  receipt_line_id: string;
  product_id: string;
  product_name: string;
  unit: 'g' | 'unit';
  quantity: number;
  received_quantity: number;
  weight_kg: number | null;
  weight_estimated: boolean;
  volume_m3: number | null;
  volume_estimated: boolean;
  image_url: string | null;
  source_url: string | null;
  /** Paid supplier cost prorated to this allocated shipment quantity. */
  original_cost_amount: number | null;
  original_cost_currency: string | null;
  allocated_freight: number | null;
}
export interface LogisticsShipment {
  tracking_update?: LogisticsTrackingSnapshot | null;
  delivery_address_id?: string | null;
  delivery_address?: LogisticsAddress | null;
  id: string;
  service_id?: string | null;
  service_quote?: LogisticsService | null;
  logistics_company_id: string | null;
  logistics_company_name: string;
  mode: 'air' | 'sea';
  state: 'draft' | 'in_transit' | 'partially_received' | 'received' | 'cancelled';
  outbound_courier: string | null;
  tracking_number: string | null;
  eta: string | null;
  created_at: string;
  dispatched_at: string | null;
  freight: LogisticsFreight | null;
  freight_total: number | null;
  freight_estimated: boolean;
  freight_issue: string | null;
  studio_receipts?: Array<{id:string;line_id:string;ledger_id:string;quantity:number;received_at:string;recorded_by:string|null}>;
  lines: LogisticsShipmentLine[];
}
export interface LogisticsTracking { orders: LogisticsOrder[]; shipments: LogisticsShipment[]; services: LogisticsService[]; addresses?: LogisticsAddress[] }
export interface LogisticsOrderInput {
  warehouse_address_id?: string | null;
  logistics_company_id: string | null;
  logistics_company_name: string;
  inbound_courier?: string | null;
  inbound_tracking_number?: string | null;
}
export interface LogisticsLineInput {
  receipt_line_id: string;
  quantity: number;
  weight_kg?: number | null;
  weight_estimated?: boolean;
  volume_m3?: number | null;
  volume_estimated?: boolean;
}
export interface LogisticsShipmentInput {
  delivery_address_id?: string | null;
  idempotency_key: string;
  service_id?: string | null;
  logistics_company_id: string | null;
  logistics_company_name: string;
  mode: 'air' | 'sea';
  lines: LogisticsLineInput[];
  freight?: LogisticsFreight | null;
}
export interface LogisticsShipmentUpdate {
  delivery_address_id?: string | null;
  outbound_courier?: string | null;
  tracking_number?: string | null;
  eta?: string | null;
  freight?: LogisticsFreight | null;
  lines?: Array<{ id: string; weight_kg: number | null; weight_estimated: boolean; volume_m3: number | null; volume_estimated: boolean; image_url?: string | null; source_url?: string | null }>;
}
export interface LogisticsReceiveInput { idempotency_key: string; lines: Array<{line_id: string; quantity: number}>; note?: string }

export interface LogisticsServiceInput {
  logistics_company_id: string;
  logistics_company_name: string;
  name: string;
  mode: 'air' | 'sea';
  basis: 'kg' | 'm3' | 'fixed';
  rate: number;
  currency: string;
}
export interface LogisticsService extends LogisticsServiceInput { id:string; active:boolean }
