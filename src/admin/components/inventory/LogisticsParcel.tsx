import React from 'react';
import type { LogisticsOrder, LogisticsPurchaseLine } from '../../../lib/logisticsTypes';
import { logisticsNumber as n, logisticsUnit as unit } from './LogisticsControls';

/** The stored supplier amount covers the whole purchase line, not just this parcel. */
export function parcelPaidCost(line: LogisticsPurchaseLine, quantity: number): number | null {
  if (line.original_cost_amount == null || !Number.isFinite(line.original_cost_amount) || line.expected_quantity <= 0) return null;
  return line.original_cost_amount * quantity / line.expected_quantity;
}
export function ParcelContents({ order, openPurchase }: { order: LogisticsOrder; openPurchase: (id: string) => void }) {
  return <div className="parcel-contents">
    <div className="parcel-column-labels"><span>Contents</span><span>Quantity</span><span>Paid</span></div>
    {order.lines.filter(line => line.available_quantity > 0).map(line => {
      const cost = parcelPaidCost(line, line.available_quantity);
      return <div className="parcel-content-row" key={line.id}>
        <button type="button" className="tap-target purchase-place-link" onClick={() => openPurchase(order.purchase_id)}>{line.product_name}</button>
        <span>{n(line.available_quantity)} {unit(line.unit)}</span>
        <span>{cost == null ? 'Not recorded' : `${n(cost)} ${line.original_cost_currency || '(currency needed)'}`}</span>
      </div>;
    })}
  </div>;
}
