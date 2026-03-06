import React, { useState } from 'react';
import { Trash2, Share2, Loader2, Printer, CreditCard, CheckCircle, RefreshCcw, ArrowRight, AlertCircle, Clock, User, DollarSign, Package, Settings2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Product, CartItem, Currency, ExchangeRate } from '../types';
import { formatCurrency } from '../utils';
import { useToast } from './Toast';
import { TeaIllustration } from './TeaIllustration';

interface InvoiceBuilderProps {
  products: Product[];
  rates: ExchangeRate[];
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  onClearCart: () => void;
  onSuccess: () => void;
}

export const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({ 
  rates, cart, setCart, onClearCart, onSuccess
}) => {
  const { showToast } = useToast();

  // State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [displayCurrency, setDisplayCurrency] = useState<Currency>('USD');
  const [shippingCostUSD, setShippingCostUSD] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  // Transaction State
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [transactionComplete, setTransactionComplete] = useState(false);

  // Computed Values
  const subtotalUSD = cart.reduce((acc, item) => acc + (item.quantity * item.priceAtSale), 0);
  const totalUSD = subtotalUSD + shippingCostUSD;

  // Cart Management
  const updateQuantity = (index: number, newQty: number) => {
    if (isNaN(newQty) || newQty < 0) return;
    const newCart = cart.map((item, i) => i === index ? { ...item, quantity: newQty } : item);
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
    showToast("Item removed", 'info');
  };

  // ------------------------------------------------------------------
  // ACTION: CREATE ORDER (Pending Fulfillment)
  // ------------------------------------------------------------------
  const handleCompleteSale = async () => {
    setValidationError('');
    
    if (!customerName.trim()) {
      setValidationError("Name required");
      showToast("Customer name is required", 'error');
      return;
    }
    if (cart.length === 0) return;

    setIsProcessing(true);

    const invoiceNumber = `INV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // 1. Create Invoice + Line Items in one API call
    try {
      const invoiceData = await api.invoices.create(
        {
          invoice_number: invoiceNumber,
          customer_name: customerName,
          customer_whatsapp: customerPhone || null,
          display_currency: displayCurrency,
          shipping_cost_usd: shippingCostUSD,
          status: 'Pending',
        },
        cart.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          price_at_sale: item.priceAtSale,
        }))
      );

      if (!invoiceData) {
        showToast('Transaction failed', 'error');
        setIsProcessing(false);
        return;
      }

    // 4. Finalize
    onSuccess();
    showToast("Order submitted successfully", 'success');
    setLastInvoice({ ...invoiceData, items: cart });
    setTransactionComplete(true);
    } catch (err: any) {
      showToast('Transaction failed: ' + (err.message || 'Unknown error'), 'error');
    }
    setIsProcessing(false);
  };

  const handleStartNewSale = () => {
    onClearCart();
    setCustomerName('');
    setCustomerPhone('');
    setShippingCostUSD(0);
    setLastInvoice(null);
    setTransactionComplete(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const generateWhatsAppLink = () => {
    if (!lastInvoice) return '#';
    let message = `*Teajia Order*\n\n*Invoice:* ${lastInvoice.invoice_number}\n*Customer:* ${lastInvoice.customer_name}\n*Date:* ${new Date().toLocaleDateString()}\n\n*Items:*\n`;
    
    cart.forEach(item => {
      const lineTotalUSD = item.quantity * item.priceAtSale;
      const unit = item.product.type === 'Teaware' ? 'units' : 'g';
      message += `• ${item.product.givenName} - ${item.quantity}${unit} @ ${formatCurrency(item.priceAtSale, displayCurrency, rates)} = ${formatCurrency(lineTotalUSD, displayCurrency, rates)}\n`;
    });
    
    message += `\n*Subtotal:* ${formatCurrency(subtotalUSD, displayCurrency, rates)}\n`;
    if (shippingCostUSD > 0) message += `*Shipping:* ${formatCurrency(shippingCostUSD, displayCurrency, rates)}\n`;
    message += `*Total:* ${formatCurrency(totalUSD, displayCurrency, rates)}`;
    
    const phone = customerPhone.replace(/[^\d+]/g, '').replace(/^\+/, '');
    if (phone.length < 7) return '#'; // Too short to be valid
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  // ------------------------------------------------------------------
  // VIEW: RECEIPT SCREEN (Success)
  // ------------------------------------------------------------------
  if (transactionComplete && lastInvoice) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 animate-in fade-in zoom-in duration-300 print:p-0 print:block overflow-y-auto">
            {/* PRINT-ONLY HEADER */}
            <div className="hidden print:block text-center mb-8 pt-8">
                <h1 className="text-3xl font-serif text-black mb-2">TEAJIA</h1>
                <p className="text-sm text-gray-500 uppercase tracking-widest mb-8">Fine Tea Inventory & Sales</p>
                <div className="border-b border-black mb-8"></div>
            </div>

            <div className="bg-tea-surface border border-tea-border p-8 rounded-2xl shadow-2xl text-center w-full print:border-none print:shadow-none print:w-full print:max-w-none print:p-0 print:text-left print:bg-white">
                <div className="mx-auto bg-tea-accent/10 text-tea-accent w-16 h-16 rounded-full flex items-center justify-center mb-6 border border-tea-accent/20 print:hidden">
                    <Clock size={32} />
                </div>
                <h2 className="text-2xl font-serif text-tea-text mb-2 print:text-black print:text-2xl">Order Submitted</h2>
                <p className="text-tea-muted mb-6 print:text-gray-600 print:mb-4 text-xs">
                    Invoice #{lastInvoice.invoice_number} • {new Date().toLocaleDateString()}
                </p>

                <div className="bg-tea-accent/10 border border-tea-accent/30 p-3 rounded mb-6 text-xs text-tea-accent print:hidden text-left font-serif italic">
                    Status: <strong className="font-sans not-italic">Pending Fulfillment</strong>. <br/>
                    Stock has not been deducted yet. Mark as "Filled" in Orders view when packing.
                </div>

                {/* Customer Details (Print Only) */}
                <div className="hidden print:block mb-8">
                    <p className="text-sm text-gray-500 uppercase">Customer</p>
                    <p className="text-lg font-bold text-black">{lastInvoice.customer_name}</p>
                </div>

                {/* Line Items Table (Visible in UI and Print) */}
                <div className="bg-tea-bg p-4 rounded-lg border border-tea-border mb-6 text-left print:bg-white print:border print:border-gray-200 print:p-0 print:border-none">
                     <div className="space-y-4 mb-4 print:space-y-2">
                        {cart.map((item) => (
                            <div key={item.productId} className="flex justify-between items-start text-sm border-b border-tea-border pb-2 mb-2 print:border-gray-200">
                                <div>
                                    <div className="text-tea-text font-medium print:text-black">{item.product.givenName}</div>
                                    <div className="text-tea-muted text-xs print:text-gray-500">{item.product.productName}</div>
                                </div>
                                <div className="text-right">
                                     <div className="text-tea-text print:text-black">
                                        {formatCurrency(item.quantity * item.priceAtSale, displayCurrency, rates)}
                                     </div>
                                     <div className="text-tea-muted text-xs print:text-gray-500">
                                        {item.quantity}{item.product.type === 'Teaware' ? 'u' : 'g'} x {formatCurrency(item.priceAtSale, displayCurrency, rates)}
                                     </div>
                                </div>
                            </div>
                        ))}
                     </div>

                     <div className="pt-2">
                        <div className="flex justify-between text-sm mb-2 print:text-black">
                            <span className="text-tea-muted print:text-gray-600">Subtotal</span>
                            <span className="text-tea-text print:text-black font-medium">{formatCurrency(subtotalUSD, displayCurrency, rates)}</span>
                        </div>
                        {shippingCostUSD > 0 && (
                            <div className="flex justify-between text-sm mb-2 print:text-black">
                                <span className="text-tea-muted print:text-gray-600">Shipping</span>
                                <span className="text-tea-text print:text-black font-medium">{formatCurrency(shippingCostUSD, displayCurrency, rates)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-lg font-bold border-t border-tea-border pt-3 mt-2 print:border-gray-300 print:text-black">
                            <span className="text-tea-text print:text-black">Total</span>
                            <span className="text-tea-accent print:text-black">{formatCurrency(totalUSD, displayCurrency, rates)}</span>
                        </div>
                     </div>
                </div>

                <div className="space-y-3 print:hidden">
                    {/* WhatsApp Button */}
                    {customerPhone ? (
                      <a
                        href={generateWhatsAppLink()}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm bg-tea-accent/10 hover:bg-tea-accent/20 text-tea-accent border border-tea-accent/30"
                      >
                        <Share2 size={16} /> Share on WhatsApp
                      </a>
                    ) : (
                      <div className="block w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 text-sm bg-tea-bg text-tea-muted cursor-not-allowed border border-tea-border">
                        <Share2 size={16} /> Share on WhatsApp
                      </div>
                    )}

                    {/* Print Button */}
                    <button
                        onClick={handlePrint}
                        className="block w-full bg-tea-bg border border-tea-border text-tea-text py-3 rounded-lg font-medium hover:bg-tea-surface transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <Printer size={16} /> Print Receipt
                    </button>
                    
                    <div className="h-px bg-tea-border my-4"></div>

                    <button 
                        onClick={handleStartNewSale}
                        className="w-full bg-tea-accent text-tea-bg py-3 rounded-lg font-medium hover:bg-tea-accent/90 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <RefreshCcw size={16} /> Start New Sale
                    </button>
                </div>
            </div>
        </div>
    );
  }

  // ------------------------------------------------------------------
  // VIEW: REGISTRY (Cart + Vertical Layout for Drawer)
  // ------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-tea-bg">
      
      {/* HEADER */}
      <div className="p-6 border-b border-tea-border flex justify-between items-center bg-tea-surface/50">
         <div>
            <h2 className="text-xl font-serif text-tea-text tracking-wide">Registry Manifest</h2>
            <p className="text-[10px] text-tea-muted uppercase tracking-widest mt-0.5">Pending Items</p>
         </div>
         {cart.length > 0 && (
            <button onClick={onClearCart} className="text-[10px] text-tea-muted hover:text-tea-accent transition-colors flex items-center gap-1 px-2 py-1 hover:bg-tea-surface rounded">
                <Trash2 size={12} /> Clear
            </button>
         )}
      </div>
      
      {/* SCROLLABLE CART LIST */}
      <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
         {cart.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-tea-muted space-y-4 min-h-[300px]">
                 <Package size={40} strokeWidth={1} className="opacity-50" />
                 <div className="text-center">
                    <p className="font-serif italic text-base mb-1">Registry Empty</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-tea-muted/70">Select items from catalog</p>
                 </div>
             </div>
         ) : (
             <div className="space-y-4">
                {cart.map((item, idx) => (
                    <div key={item.productId} className="group bg-tea-surface border border-tea-border rounded-xl p-3 hover:border-tea-muted/50 transition-colors flex gap-3">
                        <div className="w-12 h-12 bg-tea-bg rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center border border-tea-border">
                           {item.product.imageUrl ? (
                               <img src={item.product.imageUrl} className="w-full h-full object-cover opacity-70" alt="" />
                           ) : (
                               <div className="p-2">
                                   <TeaIllustration type={item.product.type} className="w-full h-full" />
                               </div>
                           )}
                        </div>
                        <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start">
                                 <h4 className="text-sm font-serif text-tea-text truncate pr-2">{item.product.givenName}</h4>
                                 <button onClick={() => removeFromCart(idx)} className="text-tea-muted hover:text-tea-accent p-0.5 transition-colors"><Trash2 size={12} /></button>
                             </div>
                             <p className="text-[10px] text-tea-muted truncate mb-2 font-serif italic">{item.product.productName}</p>
                             
                             <div className="flex justify-between items-center">
                                 <div className="flex items-center gap-2 bg-tea-bg rounded-lg border border-tea-border px-1.5 py-0.5">
                                     <input 
                                        type="number" 
                                        value={item.quantity} 
                                        onChange={(e) => updateQuantity(idx, Number(e.target.value))} 
                                        className="w-8 bg-transparent text-center text-xs outline-none font-mono text-tea-text" 
                                     />
                                     <span className="text-[9px] text-tea-muted border-l border-tea-border pl-1.5 uppercase tracking-[0.2em]">{item.product.type === 'Teaware' ? 'u' : 'g'}</span>
                                 </div>
                                 <span className="font-mono text-xs text-tea-text">
                                     {formatCurrency(item.quantity * item.priceAtSale, displayCurrency, rates)}
                                 </span>
                             </div>
                        </div>
                    </div>
                ))}
             </div>
         )}
      </div>

      {/* FIXED BOTTOM: CONTROLS */}
      <div className="bg-tea-surface border-t border-tea-border p-6 space-y-5 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-20">
          
          {/* Settings Compact */}
          <div className="flex gap-4">
                <div className="flex-1">
                   <label className="text-[9px] text-tea-muted uppercase block mb-1">Currency</label>
                   <div className="relative bg-tea-bg border border-tea-border rounded-lg px-2">
                       <select 
                           value={displayCurrency} 
                           onChange={(e) => setDisplayCurrency(e.target.value as Currency)} 
                           className="w-full bg-transparent py-1.5 text-xs text-tea-text outline-none cursor-pointer"
                       >
                           {rates.map(r => <option key={r.currency} value={r.currency}>{r.currency}</option>)}
                       </select>
                   </div>
                </div>
                <div className="flex-1">
                   <label className="text-[9px] text-tea-muted uppercase block mb-1">Shipping</label>
                   <div className="relative bg-tea-bg border border-tea-border rounded-lg px-2">
                       <input
                           type="number"
                           min={0}
                           value={shippingCostUSD}
                           onChange={(e) => setShippingCostUSD(Math.max(0, Number(e.target.value) || 0))}
                           className="w-full bg-transparent py-1.5 text-xs text-tea-text outline-none font-mono"
                       />
                   </div>
                </div>
          </div>

          {/* Customer Input */}
          <div className="space-y-2">
              <input 
                type="text" 
                value={customerName} 
                onChange={(e) => { setCustomerName(e.target.value); setValidationError(''); }} 
                className={`w-full bg-tea-bg border rounded-lg px-3 py-2 text-sm text-tea-text outline-none transition-colors placeholder-tea-muted/50 ${validationError ? 'border-tea-accent' : 'border-tea-border focus:border-tea-muted'}`}
                placeholder="Client Name *"
              />
              <input 
                type="text" 
                value={customerPhone} 
                onChange={(e) => setCustomerPhone(e.target.value)} 
                className="w-full bg-tea-bg border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-muted placeholder-tea-muted/50"
                placeholder="WhatsApp (Optional)"
              />
          </div>

          {/* Summary & Action */}
          <div>
             <div className="flex justify-between items-end text-tea-text mb-4 pt-2 border-t border-tea-border/50">
                 <span className="text-xs uppercase tracking-[0.2em] text-tea-muted">Total</span>
                 <span className="text-xl font-serif text-tea-accent">{formatCurrency(totalUSD, displayCurrency, rates)}</span>
             </div>

             <button 
                onClick={handleCompleteSale}
                disabled={isProcessing || cart.length === 0}
                className={`w-full py-4 text-xs font-bold uppercase tracking-[0.2em] rounded-lg flex items-center justify-center gap-2 transition-all ${
                    cart.length === 0 
                    ? 'bg-tea-bg text-tea-muted cursor-not-allowed border border-tea-border' 
                    : 'bg-tea-accent text-tea-bg hover:bg-tea-accent/90 shadow-lg shadow-tea-accent/10'
                }`}
              >
                {isProcessing ? <Loader2 className="animate-spin" size={14} /> : 'Create Invoice'}
              </button>
          </div>
      </div>
    </div>
  );
};