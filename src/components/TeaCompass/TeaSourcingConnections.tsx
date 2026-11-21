import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCustomers, useShopFreightDefault } from '../../admin/hooks/useAdminData';
import { usePrivateQueryScope } from '../../admin/hooks/usePrivateQueryScope';
import { useLibraryPurchases } from '../../lib/libraryPurchaseState';
import { teaSourcingConnections } from '../../lib/teaSourcingConnections';
import { api } from '../../lib/api';
import { isoCurrencyCode } from '../../lib/currency';
import type { TeaCompassEntry } from './types';

export function useTeaSupplier(entry?: Pick<TeaCompassEntry, 'vendorId' | 'linkedCustomerId' | 'vendorName'>) {
  const scope = usePrivateQueryScope();
  const customers = useCustomers({ enabled: scope.ready });
  const id = entry?.linkedCustomerId ?? entry?.vendorId;
  const supplier = scope.ready ? customers.data?.find(customer => customer.id === id) : undefined;
  return { id, supplier, name: supplier?.name ?? entry?.vendorName, loading: customers.isLoading, failed: customers.isError };
}
const modeName = (mode?: string | null) => (({ air: 'Air', sea: 'Sea', land: 'Land', courier: 'Courier' } as Record<string, string>)[mode ?? ''] ?? mode);

type ConnectedTea = Pick<TeaCompassEntry, 'id'> & Partial<TeaCompassEntry>;
export function useTeaSupplierQuote(entry: ConnectedTea) {
  const scope = usePrivateQueryScope();
  const quote = useQuery({
    queryKey: ['tea-source-quote', ...scope.key, entry.quoteId], enabled: scope.ready && !!entry.quoteId,
    queryFn: () => api.curateWorkspace.quote(entry.quoteId!), staleTime: 30_000,
  });
  const quoteLine = scope.ready && quote.data?.vendor_id === (entry.linkedCustomerId ?? entry.vendorId)
    ? quote.data?.lines?.find((line: { compass_entry_id: string }) => line.compass_entry_id === entry.id) : undefined;
  return { quote, quoteLine };
}

/** Operational facts come from their shared records, never a second tea form. */
export function TeaSourcingConnections({ entry }: { entry: ConnectedTea }) {
  const vendor = useTeaSupplier(entry);
  const purchases = useLibraryPurchases();
  const freight = useShopFreightDefault();
  const linked = teaSourcingConnections(entry, purchases.orders, purchases.receipts);
  const { quote, quoteLine } = useTeaSupplierQuote(entry);
  const supplierHref = vendor.id ? `/admin/vendors/${encodeURIComponent(vendor.id)}` : undefined;
  return <section className="space-y-3 border-t border-tea-border pt-3" aria-label="Connected sourcing">
    <h3 className="text-ui-14 font-medium text-tea-text">Sourcing</h3>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 text-ui-13 text-tea-text-sec">
        <span className="block text-ui-11">Supplier</span>
        <span>{vendor.name || 'Choose the supplier above'}</span>
        {vendor.supplier?.company && vendor.supplier.company !== vendor.name && <span className="block">{vendor.supplier.company}</span>}
        {vendor.supplier && <span className="block">{[vendor.supplier.city, vendor.supplier.country].filter(Boolean).join(', ')}</span>}
      </div>
      {supplierHref && <Link className="btn-quiet btn-sm tap-target" to={supplierHref}>Supplier record</Link>}
    </div>
    <section aria-label="Shipping from orders" className="space-y-2 text-ui-13 text-tea-text-sec">
      <h4 className="text-ui-11">Orders & shipping</h4>
      {purchases.isLoading ? <p role="status">Checking linked orders…</p> : purchases.isError ? <p>Order details could not refresh.</p>
        : !linked.orders.length && !linked.receipts.length ? <p>Shipping is set on the supplier order when you purchase.</p> : null}
      {linked.orders.map(order => <div key={order.id} className="flex flex-wrap items-center justify-between gap-2">
        <div><span>{order.vendorName} · {order.status.replace(/_/g, ' ')}</span>
          <span className="block">{modeName(order.shipMode) || 'Shipping not set on this order'}{order.trackingNumber ? ` · ${order.trackingNumber}` : ''}</span>
        </div>
        <Link className="btn-quiet btn-sm tap-target" to={`/admin/purchase-orders?purchaseId=${encodeURIComponent(order.id)}`}>Open order</Link>
      </div>)}
      {linked.receipts.filter(receipt => receipt.transport_mode).map(receipt => <p key={receipt.id}>Receipt · {modeName(receipt.transport_mode)}{receipt.eta ? ` · ETA ${receipt.eta}` : ''}</p>)}
    </section>
    <div className="flex flex-wrap items-center justify-between gap-2 text-ui-13 text-tea-text-sec">
      <p><span className="block text-ui-11">Store freight default</span>{freight.perKg.toLocaleString()} {isoCurrencyCode(freight.currency)} / kg</p>
      <Link className="btn-quiet btn-sm tap-target" to="/admin/account-settings">Store settings</Link>
    </div>
    {!quoteLine && (entry.discountPercent != null || (entry.routeQuotes?.length ?? 0) > 0) && <section aria-label="Recorded quote evidence" className="space-y-1 text-ui-12 text-tea-text-sec">
      <h4 className="font-medium">Recorded source quote</h4>
      {entry.discountPercent != null && <p>Quoted discount: {entry.discountPercent}%</p>}
      {entry.routeQuotes?.map(item => <p key={item.id}>{item.label || item.mode}: {item.amount} {item.currency} / {item.basis_quantity} {item.basis}</p>)}
      <p>Source evidence; order shipping and store freight are shown above.</p>
    </section>}
    {quoteLine && <div className="space-y-1 text-ui-13 text-tea-text-sec" aria-label="Linked supplier quote">
      <h4 className="text-ui-11">Supplier quote{quote.data.reference ? ` · ${quote.data.reference}` : ''}</h4>
      {quoteLine.vendor_item_number && <p>Item {quoteLine.vendor_item_number}</p>}
      {(quoteLine.discount_percent ?? quote.data.discount_percent) != null && <p>Quoted discount: {quoteLine.discount_percent ?? quote.data.discount_percent}%</p>}
      {quote.data.payment_terms && <p>{quote.data.payment_terms}</p>}
    </div>}
  </section>;
}
