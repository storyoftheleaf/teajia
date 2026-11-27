import React from 'react';
import { Link } from 'react-router-dom';
import type { VendorProductSale } from '../../lib/api';

/**
 * The other direction of a vendor relationship: what the shop sold.
 *
 * Adrian, 2026-11-23: "you're sharing what I've purchased from there, but
 * you're not sharing what other people purchased from me." Two lists:
 *   - their teas, sold: every sale of a tea that came from this vendor, and
 *     who bought it;
 *   - bought from you: the vendor's own orders, when they are a customer too.
 */

export interface VendorOwnOrder {
  id: string;
  invoice_number?: string | null;
  status?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
  computed_total?: number | null;
  shipping_cost_usd?: number | null;
}

const linkClass = 'underline decoration-tea-border underline-offset-2 hover:text-tea-text';
/** An invoice opens in Activity's orders list, the one place that already reaches a single order. */
export const invoiceHref = (reference: string) => `/admin/activity?tab=orders&search=${encodeURIComponent(reference)}`;

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso?: string | null) => iso
  ? new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '';
const amount = (sale: VendorProductSale) => {
  if (!Number.isFinite(sale.quantity)) return '';
  return sale.quantity_unit === 'unit' ? `${sale.quantity} ×` : `${sale.quantity.toLocaleString()}g`;
};

/** Totals for the sales of a vendor's teas: money, distinct buyers, distinct teas. */
export function summariseVendorSales(sales: VendorProductSale[]) {
  const total = sales.reduce((sum, s) => sum + (Number.isFinite(s.quantity * s.price_at_sale) ? s.quantity * s.price_at_sale : 0), 0);
  const buyers = new Set(sales.map(s => s.customer_id || s.customer_name || s.invoice_id)).size;
  const teas = new Set(sales.map(s => s.product_id)).size;
  return { total, buyers, teas };
}

const Rows: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul className="divide-y divide-tea-border border-t border-tea-border">{children}</ul>
);

export const VendorSalesCard: React.FC<{
  sales: VendorProductSale[] | undefined;
  salesLoading?: boolean;
  salesError?: boolean;
  ownOrders: VendorOwnOrder[] | undefined;
  ownOrdersLoading?: boolean;
}> = ({ sales, salesLoading, salesError, ownOrders, ownOrdersLoading }) => {
  const list = sales ?? [];
  const summary = summariseVendorSales(list);
  const orders = (ownOrders ?? []).filter(o => !o.deleted_at && String(o.status ?? '').toLowerCase() !== 'cancelled');

  return (
    <section className="bg-tea-surface border border-tea-border rounded-xl p-4 sm:p-5 space-y-6" data-testid="vendor-sales">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
          <h3 className="h3">Their teas, sold</h3>
          {list.length > 0 && (
            <span className="text-ui-13 text-tea-text-sec tabular-nums">
              {usd(summary.total)} · {summary.buyers === 1 ? '1 buyer' : `${summary.buyers} buyers`}
            </span>
          )}
        </div>
        {salesError ? (
          <p className="text-ui-13 text-tea-text-sec">Sales couldn't be loaded.</p>
        ) : salesLoading ? (
          <p role="status" className="text-ui-13 text-tea-text-sec">Loading sales…</p>
        ) : list.length === 0 ? (
          <p className="text-ui-13 text-tea-text-sec">None of their teas sold yet.</p>
        ) : (
          <Rows>
            {list.map(sale => (
              <li key={sale.line_id} className="py-3 flex flex-wrap items-start gap-x-3 gap-y-0.5">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="text-ui-14 text-tea-text break-words">
                    {sale.product_id
                      ? <Link to={`/admin/stock?panel=${encodeURIComponent(sale.product_id)}`} state={{ panelOpenedHere: true }} className={linkClass}>{sale.product_name || 'A tea'}</Link>
                      : (sale.product_name || 'A tea')}
                  </p>
                  <p className="text-ui-12 text-tea-text-sec break-words">
                    {sale.customer_id
                      ? <Link to={`/admin/people/${sale.customer_id}`} className={linkClass}>{sale.customer_name || 'Customer'}</Link>
                      : (sale.customer_name || 'Walk-in')}
                    {sale.created_at ? ` · ${day(sale.created_at)}` : ''}
                    {(sale.invoice_number || sale.invoice_id) && <>{' · '}<Link to={invoiceHref(sale.invoice_number || sale.invoice_id)} className={linkClass}>{sale.invoice_number ? `#${sale.invoice_number}` : 'Invoice'}</Link></>}
                  </p>
                </div>
                <div className="text-right font-mono text-ui-13 tabular-nums text-tea-text-sec">
                  <span>{amount(sale)}</span>{' '}
                  <span className="text-tea-text">{usd(sale.quantity * sale.price_at_sale)}</span>
                </div>
              </li>
            ))}
          </Rows>
        )}
      </div>

      {(ownOrdersLoading || orders.length > 0) && (
        <div>
          <h3 className="h3 mb-3">Bought from you</h3>
          {ownOrdersLoading ? (
            <p role="status" className="text-ui-13 text-tea-text-sec">Loading orders…</p>
          ) : (
            <Rows>
              {orders.map(order => {
                const total = Number(order.computed_total ?? 0) + Number(order.shipping_cost_usd ?? 0);
                return (
                  <li key={order.id} className="py-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <div className="min-w-0">
                      <p className="text-ui-14 text-tea-text">
                        <Link to={invoiceHref(order.invoice_number || order.id)} className={linkClass}>Invoice {order.invoice_number ? `#${order.invoice_number}` : ''}</Link>
                      </p>
                      <p className="text-ui-12 text-tea-text-sec">{[day(order.created_at), order.status].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className="font-mono text-ui-13 tabular-nums text-tea-text">{usd(total)}</span>
                  </li>
                );
              })}
            </Rows>
          )}
        </div>
      )}
    </section>
  );
};
