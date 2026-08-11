import React, { useState, useEffect, useMemo } from 'react';
import { X, Pencil, Loader2, Plus, Trash2, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useProducts } from '../hooks/useAdminData';
import Fuse from 'fuse.js';
import { editLineToInvoiceWrite, editOrderLineLabel, invoiceLineToEditLine, type EditOrderLine } from './editOrderLineDomain';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: any;
  showToast: (msg: string, type?: string) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen, onClose, onSuccess, invoice, showToast,
}) => {
  const { data: products = [] } = useProducts();
  const [items, setItems] = useState<EditOrderLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [addingProduct, setAddingProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const fuse = useMemo(() => new Fuse(products, {
    keys: ['givenName', 'productName', 'type'],
    threshold: 0.3,
    ignoreLocation: true,
  }), [products]);

  const searchResults = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    return fuse.search(productSearch).map(r => r.item).slice(0, 10);
  }, [productSearch, fuse, products]);

  useEffect(() => {
    if (!isOpen || !invoice) return;
    setFetching(true);
    setAddingProduct(false);
    setProductSearch('');
    setCustomerName(invoice.customer_name || '');
    setShippingCost(Number(invoice.shipping_cost_usd) || 0);
    setNotes(invoice.notes || '');

    api.invoices.getItems(invoice.id).then(data => {
      setItems((data || []).map((item: Record<string, unknown>) => invoiceLineToEditLine(item)));
      setFetching(false);
    }).catch(() => {
      showToast('Could not load invoice items. Refresh and try again.', 'error');
      setFetching(false);
    });
  }, [isOpen, invoice]);

  if (!isOpen) return null;

  const updateItem = (index: number, field: keyof EditOrderLine, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      showToast('Order must have at least one item', 'error');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const addProduct = (product: any) => {
    setItems(prev => [...prev, {
      product_id: product.id,
      custom_name: null,
      product_name: product.productName,
      given_name: product.givenName || product.productName,
      quantity: 10,
      price_at_sale: product.pricePerGramUSD,
    }]);
    setAddingProduct(false);
    setProductSearch('');
  };

  const total = items.reduce((sum, item) => sum + item.quantity * item.price_at_sale, 0) + shippingCost;

  const handleSave = async () => {
    if (items.length === 0) {
      showToast('Order must have at least one item', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.invoices.updateItems(invoice.id, {
        lineItems: items.map(editLineToInvoiceWrite),
        shipping_cost_usd: shippingCost,
        customer_name: customerName,
        notes,
      });
      showToast('Order updated.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(`Could not save order changes: ${err.message}`, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-in fade-in duration-200">
      <button
        type="button"
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-tea-bg/70 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit order"
        className="relative bg-tea-surface border border-tea-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-tea-text-sec hover:text-tea-text transition-colors rounded-md p-1.5 tap-target"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="px-6 pt-6 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Pencil size={14} className="text-tea-gold" />
            <h3 className="h3 text-tea-text">Edit Order</h3>
          </div>
          <p className="label-caps text-tea-text-dim mt-1">
            {invoice?.invoice_number} · Pending orders only
          </p>
        </div>

        <div className="px-6 pb-4 flex-1 overflow-y-auto custom-scrollbar">
          {fetching ? (
            <div className="py-8 text-center text-tea-text-sec"><Loader2 className="animate-spin inline" size={20} /></div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block label-caps text-tea-text-sec mb-1.5">Customer</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block label-caps text-tea-text-sec mb-1.5">Shipping (USD)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={shippingCost}
                    onChange={(e) => setShippingCost(Number(e.target.value) || 0)}
                    className="w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors num"
                  />
                </div>
              </div>

              <div>
                <label className="block label-caps text-tea-text-sec mb-1.5">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors resize-none"
                  placeholder="notes"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label-caps text-tea-text-sec">Items</label>
                  <button
                    onClick={() => setAddingProduct(!addingProduct)}
                    className="inline-flex items-center gap-1.5 text-ui-12 text-tea-gold hover:text-tea-gold/90 transition-colors"
                  >
                    <Plus size={12} /> Add Item
                  </button>
                </div>

                {addingProduct && (
                  <div className="bg-tea-bg border border-tea-border rounded-md p-3 mb-3">
                    <div className="relative mb-2">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search products..."
                        className="w-full bg-tea-surface border border-tea-border rounded-md pl-7 pr-3 py-1.5 text-ui-12 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                      {searchResults.map(product => (
                        <button
                          key={product.id}
                          onClick={() => addProduct(product)}
                          className="w-full text-left px-2 py-1.5 rounded-md text-ui-12 hover:bg-tea-accent-sub transition-colors flex justify-between items-center"
                        >
                          <span className="text-tea-text truncate">{product.givenName || product.productName}</span>
                          <span className="text-tea-text-sec text-ui-10 shrink-0 ml-2">${product.pricePerGramUSD.toFixed(2)}/g</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="bg-tea-bg border border-tea-border rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-ui-14 text-tea-text truncate">{editOrderLineLabel(item)}</span>
                        <button
                          onClick={() => removeItem(index)}
                          className="text-tea-text-sec hover:text-tea-text transition-colors p-0.5"
                          title="Remove item"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-ui-10 text-tea-text-dim">Qty (g/u)</label>
                          <input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value) || 0)}
                            className="w-full bg-tea-surface border border-tea-border rounded-md px-2 py-1 text-ui-12 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors num"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-ui-10 text-tea-text-dim">Price/unit (USD)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.price_at_sale}
                            onChange={(e) => updateItem(index, 'price_at_sale', Number(e.target.value) || 0)}
                            className="w-full bg-tea-surface border border-tea-border rounded-md px-2 py-1 text-ui-12 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors num"
                          />
                        </div>
                        <div className="w-16 text-right">
                          <label className="text-ui-10 text-tea-text-dim">Subtotal</label>
                          <div className="text-ui-12 text-tea-text num pt-1">${(item.quantity * item.price_at_sale).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center py-3 border-t border-tea-border">
                <span className="label-caps text-tea-text-sec">Total</span>
                <span className="text-ui-20 font-serif text-tea-text num">${total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 px-6 py-4 border-t border-tea-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || fetching || items.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-tea-gold/10"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />} Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
