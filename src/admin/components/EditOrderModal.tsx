import React, { useState, useEffect, useMemo } from 'react';
import { X, Pencil, Loader2, Plus, Trash2, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useProducts } from '../hooks/useAdminData';
import Fuse from 'fuse.js';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: any;
  showToast: (msg: string, type?: string) => void;
}

interface LineItem {
  id?: string;
  product_id: string;
  product_name: string;
  given_name: string;
  quantity: number;
  price_at_sale: number;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen, onClose, onSuccess, invoice, showToast,
}) => {
  const { data: products = [] } = useProducts();
  const [items, setItems] = useState<LineItem[]>([]);
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
      setItems((data || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name || '',
        given_name: item.given_name || '',
        quantity: Number(item.quantity) || 0,
        price_at_sale: Number(item.price_at_sale) || 0,
      })));
      setFetching(false);
    }).catch(() => {
      showToast('Could not load invoice items', 'error');
      setFetching(false);
    });
  }, [isOpen, invoice]);

  if (!isOpen) return null;

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
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
        lineItems: items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price_at_sale: item.price_at_sale,
        })),
        shipping_cost_usd: shippingCost,
        customer_name: customerName,
        notes,
      });
      showToast('Order updated.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast('Update failed: ' + err.message, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-text/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-tea-text-sec hover:text-tea-text transition-colors">
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Pencil size={18} className="text-tea-gold" />
          <h3 className="text-lg font-serif text-tea-text">Edit Order</h3>
        </div>
        <p className="text-xs text-tea-text-sec mb-5">{invoice?.invoice_number} — Only pending orders can be edited.</p>

        {fetching ? (
          <div className="py-8 text-center text-tea-text-sec"><Loader2 className="animate-spin inline" /></div>
        ) : (
          <>
            {/* Customer & Shipping */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec mb-1 block">Customer</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-tea-surface border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-gold/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec mb-1 block">Shipping (USD)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={shippingCost}
                  onChange={(e) => setShippingCost(Number(e.target.value) || 0)}
                  className="w-full bg-tea-surface border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-gold/50 transition-colors num"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec mb-1 block">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-tea-surface border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-gold/50 transition-colors resize-none"
                placeholder="Optional notes..."
              />
            </div>

            {/* Line Items */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec">Items</label>
                <button
                  onClick={() => setAddingProduct(!addingProduct)}
                  className="text-xs text-tea-gold hover:text-tea-gold/80 flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} /> Add Item
                </button>
              </div>

              {/* Add product search */}
              {addingProduct && (
                <div className="bg-tea-surface border border-tea-border rounded-xl p-3 mb-3">
                  <div className="relative mb-2">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search products..."
                      className="w-full bg-tea-bg border border-tea-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-tea-text outline-none focus:border-tea-gold/50 transition-colors"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                    {searchResults.map(product => (
                      <button
                        key={product.id}
                        onClick={() => addProduct(product)}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-tea-elevated/50 transition-colors flex justify-between items-center"
                      >
                        <span className="text-tea-text truncate">{product.givenName || product.productName}</span>
                        <span className="text-tea-text-sec text-[10px] shrink-0 ml-2">${product.pricePerGramUSD.toFixed(2)}/g</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {items.map((item, index) => (
                  <div key={index} className="bg-tea-surface border border-tea-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-tea-text font-medium truncate">{item.given_name || item.product_name}</span>
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
                        <label className="text-[9px] text-tea-text-sec">Qty (g/u)</label>
                        <input
                          type="number"
                          min={0}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value) || 0)}
                          className="w-full bg-tea-bg border border-tea-border rounded px-2 py-1 text-xs text-tea-text outline-none num"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] text-tea-text-sec">Price/unit (USD)</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.price_at_sale}
                          onChange={(e) => updateItem(index, 'price_at_sale', Number(e.target.value) || 0)}
                          className="w-full bg-tea-bg border border-tea-border rounded px-2 py-1 text-xs text-tea-text outline-none num"
                        />
                      </div>
                      <div className="w-16 text-right">
                        <label className="text-[9px] text-tea-text-sec">Subtotal</label>
                        <div className="text-xs text-tea-text num pt-1">${(item.quantity * item.price_at_sale).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center py-3 border-t border-tea-border mb-4">
              <span className="text-xs text-tea-text-sec">Total</span>
              <span className="text-lg font-serif text-tea-text num">${total.toFixed(2)}</span>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-tea-text-sec hover:text-tea-text transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading || fetching || items.length === 0}
            className="px-5 py-2 text-sm font-medium bg-tea-gold text-tea-bg rounded-lg hover:bg-tea-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            <Pencil size={14} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
