import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Plus, ChevronDown, Loader2, X, Trash2 } from 'lucide-react';
import { api, PurchaseOrder } from '../../lib/api';
import { useProducts, useCustomers } from '../hooks/useAdminData';
import { useToast } from '../components/Toast';
import { IncomingReceiptsPanel } from '../components/inventory/IncomingReceiptsPanel';
import { PurchaseTrackingView } from '../components/inventory/PurchaseTrackingView';
import { refreshCommerceQueries } from '../../lib/refreshCommerce';

const PO_STATUSES = ['pending', 'ordered', 'received', 'cancelled'] as const;
type PoStatus = typeof PO_STATUSES[number];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  ordered: 'Ordered',
  received: 'Received',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-tea-elevated text-tea-text-sec',
  ordered: 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40',
  received: 'bg-tea-elevated text-tea-text',
  cancelled: 'bg-tea-elevated text-tea-text-dim',
};

interface NewPoItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: 'g' | 'unit';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── New PO Form ──
const NewPoForm: React.FC<{ onClose: () => void; onSubmit: (data: Parameters<typeof api.purchaseOrders.create>[0]) => Promise<void>; submitting: boolean }> = ({
  onClose, onSubmit, submitting,
}) => {
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useCustomers();
  const vendors = customers.filter(c => c.tags?.includes('vendor'));

  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [items, setItems] = useState<NewPoItem[]>([{ product_id: '', product_name: '', quantity: 0, unit:'g' }]);
  const [notes, setNotes] = useState('');

  const handleVendorChange = (id: string) => {
    setVendorId(id);
    const vendor = vendors.find(v => v.id === id);
    setVendorName(vendor?.name || '');
  };

  const addItem = () => setItems(prev => [...prev, { product_id: '', product_name: '', quantity: 0, unit:'g' }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof NewPoItem, value: string | number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'product_id') {
        const p = products.find((pr: any) => pr.id === value);
        return { ...item, product_id: value as string, product_name: p ? (p.givenName || p.productName || '') : '', unit:p?.type==='Teaware'?'unit':'g' };
      }
      return { ...item, [field]: value };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) return;
    const validItems = items.filter(i => i.product_id && i.quantity > 0 && (i.unit !== 'unit' || Number.isInteger(i.quantity)));
    await onSubmit({
      vendor_name: vendorName.trim(),
      vendor_id: vendorId || undefined,
      items_json: JSON.stringify(validItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit: i.unit,
      }))),
      notes: notes.trim() || undefined,
      status: 'pending',
    });
  };

  const inputCls = 'w-full bg-tea-gold/[0.06] text-tea-text text-sm rounded-xl px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none transition-colors placeholder:text-tea-text-dim';
  const sectionLabel = (label: string) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-px bg-tea-border" />
      <span className="text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim shrink-0">{label}</span>
      <div className="flex-1 h-px bg-tea-border" />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-tea-bg/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="bg-tea-surface rounded-t-xl sm:rounded-xl w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-tea-border flex-shrink-0">
          <span className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec">New Purchase Order</span>
          <button onClick={onClose} className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors rounded-md" aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {sectionLabel('Vendor')}
          <div>
            {vendors.length > 0 ? (
              <select value={vendorId} onChange={e => handleVendorChange(e.target.value)} className={inputCls}>
                <option value="">Select vendor…</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            ) : (
              <input type="text" value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor name" className={inputCls} required />
            )}
            {vendorId && !vendorName && (
              <input type="text" value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor name override" className={`${inputCls} mt-2`} />
            )}
          </div>

          {sectionLabel('Line Items')}
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={item.product_id}
                  onChange={e => updateItem(idx, 'product_id', e.target.value)}
                  className="flex-1 bg-tea-gold/[0.06] border border-tea-border rounded-xl px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-gold/40 transition-colors"
                >
                  <option value="">Select product…</option>
                  {products

                    .map((p: any) => (
                      <option key={p.id} value={p.id}>{p.givenName || p.productName}</option>
                    ))}
                </select>
                <div className="flex items-center gap-1 bg-tea-gold/[0.06] border border-tea-border rounded-xl px-3 py-2 shrink-0">
                  <input
                    type="number"
                    value={item.quantity || ''}
                    onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                    placeholder="0"
                    inputMode="decimal"
                    min="0" step={item.unit === 'unit' ? 1 : 'any'}
                    className="w-12 bg-transparent text-sm text-right text-tea-text outline-none tabular-nums placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                  />
                  <span className="text-ui-11 text-tea-text-dim">{item.unit === 'unit' ? 'units' : 'g'}</span>
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors shrink-0">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-gold transition-colors mt-1">
              <Plus size={12} /> Add line item
            </button>
          </div>

          {sectionLabel('Notes')}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes…"
            className="w-full bg-tea-gold/[0.06] border border-tea-border rounded-xl px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-gold/40 resize-none placeholder:text-tea-text-sec transition-colors"
          />

          <div className="flex justify-between items-center gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-2 py-2 text-xs text-tea-text-sec hover:text-tea-text transition-colors uppercase tracking-[0.15em]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !vendorName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 cta-solid text-xs font-semibold uppercase tracking-[0.12em] rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <ShoppingBag size={13} />}
              Create PO
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// Legacy intake has already opened its stock. Link that original movement;
// preparing its purchase receipt must never receive the same quantity again.
const OriginalStockMovement:React.FC<{productId:string;quantity:number;value:string;onChange:(id:string)=>void}>=({productId,quantity,value,onChange})=>{
  const [offset,setOffset]=useState(0);
  React.useEffect(()=>setOffset(0),[productId]);
  const {data,isLoading,isError,refetch}=useQuery({queryKey:['stock_ledger',productId,'purchase-link',offset],enabled:!!productId,queryFn:()=>api.stockLedger.list(productId,20,offset)});
  const entries=(data?.entries || []).filter((entry:any)=>Number(entry.delta)===quantity&&['RECEIPT','PURCHASE_RECEIPT'].includes(String(entry.reason).toUpperCase()));
  return <div className="space-y-1"><label className="text-ui-12 text-tea-text-sec">Original stock entry<select aria-label="Original stock entry" disabled={!productId||isLoading} value={value} onChange={event=>onChange(event.target.value)} className="admin-input mt-1 w-full"><option value="">{isLoading?'Loading stock history…':'Choose the stock already received'}</option>{entries.map((entry:any)=><option key={entry.id} value={entry.id}>{new Date(entry.created_at).toLocaleDateString()} · +{entry.delta} · {entry.reference || entry.note || entry.batch_label || 'Received stock'}</option>)}</select></label>{isError?<p role="alert" className="text-ui-12 text-tea-text-sec">Stock history could not be loaded. <button type="button" className="tap-target underline" onClick={()=>void refetch()}>Try again</button></p>:null}<div className="flex flex-wrap gap-3 text-ui-12 text-tea-text-sec">{offset>0&&<button type="button" className="tap-target underline" onClick={()=>setOffset(Math.max(0,offset-20))}>Newer entries</button>}{offset+20<(data?.total || 0)&&<button type="button" className="tap-target underline" onClick={()=>setOffset(offset+20)}>Older entries</button>}</div></div>;
};

// Match older purchase lines explicitly before preparing a canonical receipt.
const MatchPurchaseLines: React.FC<{po:PurchaseOrder;onClose:()=>void;onPrepared:(id:string)=>void}> = ({po,onClose,onPrepared}) => {
  const {data:products=[]}=useProducts();
  const legacyIntake=String((po as PurchaseOrder & {create_request_key?:string}).create_request_key || '').startsWith('intake:');
  const [lines,setLines]=useState<Array<Record<string,any>>>(()=>{try{return JSON.parse(po.items_json).map((item:Record<string,any>)=>({...item,product_id:item.product_id||'',product_name:item.product_name||item.name||'Unnamed item',quantity:item.quantity??item.quantity_grams??0,unit:item.unit||'g'}))}catch{return []}});
  const [saving,setSaving]=useState(false),[error,setError]=useState(legacyIntake?'Stock was already recorded by this intake. Link its original stock entry to review the purchase without adding stock again.':'Match each invoice item to Stock and confirm the ordered quantity. This does not receive stock.');
  const valid=lines.length>0&&lines.every(line=>(!legacyIntake||line.source_movement_id)&&line.product_id&&Number.isFinite(Number(line.quantity))&&Number(line.quantity)>0&&(line.unit!=='unit'||Number.isInteger(Number(line.quantity))));
  const update=(index:number,patch:Record<string,unknown>)=>setLines(current=>current.map((line,i)=>i===index?{...line,...patch}:line));
  async function prepare(){
    if(saving||!valid)return;setSaving(true);
    try{
      const result=await api.purchaseOrders.prepareReceipt(po.id,{items:lines.map(line=>({...line,quantity:Number(line.quantity)}))});
      if(!result.receipt_id)throw new Error(result.unresolved_items.map(item=>`Line ${item.index+1}: ${item.reason}`).join(' ')||'Complete the purchase lines first.');
      onPrepared(result.receipt_id);
    }catch(cause){setError(cause instanceof Error?cause.message:'Receipt could not be prepared. Try again.')}finally{setSaving(false)}
  }
  return <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/80 p-3"><section role="dialog" aria-modal="true" aria-label="Match purchase lines" className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl border border-tea-border bg-tea-surface p-4 pb-nav-gap space-y-3">
    <h2 className="h2">{legacyIntake?'Link recorded stock':'Match purchase items'} · {po.vendor_name}</h2><p role="alert" className="text-ui-12 text-tea-text-sec">{error}</p>
    {lines.map((line,index)=><div key={index} className="space-y-2 border-b border-tea-border py-2"><p className="text-ui-13 text-tea-text">{line.product_name}</p><div className="flex flex-wrap gap-2"><select aria-label={`Holding for line ${index+1}`} disabled={saving} value={line.product_id} onChange={event=>{const product=products.find(item=>item.id===event.target.value);update(index,{product_id:event.target.value,product_name:product?.givenName||product?.productName||line.product_name,unit:product?.type==='Teaware'?'unit':'g',source_movement_id:undefined})}} className="admin-input min-w-0 flex-1"><option value="">Choose holding</option>{products.map(product=><option key={product.id} value={product.id}>{product.givenName||product.productName}</option>)}</select><label className="text-ui-12 text-tea-text-sec"><input aria-label={`Quantity for line ${index+1}`} disabled={saving} type="number" min="0" step={line.unit==='unit'?1:'any'} value={line.quantity} onChange={event=>update(index,{quantity:event.target.value,source_movement_id:undefined})} className="admin-input w-24"/>{line.unit==='unit'?' units':' g'}</label></div>{legacyIntake&&<OriginalStockMovement productId={line.product_id} quantity={Number(line.quantity)} value={line.source_movement_id || ''} onChange={id=>update(index,{source_movement_id:id})}/>}</div>)}
    <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={saving} onClick={onClose} className="tap-target px-3 text-ui-13 text-tea-text-sec">Cancel</button><button type="button" disabled={saving||!valid} onClick={()=>void prepare()} className="tap-target rounded-md cta-solid px-4 py-2 text-ui-13 disabled:opacity-50">{saving?'Preparing…':legacyIntake?'Link recorded stock':'Save matches'}</button></div>
  </section></div>;
};

// ── Main Page ──
export const LegacyPurchaseOrdersPage: React.FC = () => {
  const { showToast } = useToast();
  const [searchParams]=useSearchParams();
  const reviewId=searchParams.get('purchaseId');
  const openedReview=React.useRef<string|null>(null);
  const queryClient = useQueryClient();
  const [isNewFormOpen, setIsNewFormOpen] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);

  const { data: orders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase_orders'],
    queryFn: () => api.purchaseOrders.list(),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  React.useEffect(()=>{
    if (!reviewId || openedReview.current===reviewId) return;
    const order=orders.find(order=>order.id===reviewId);
    if (order) {openedReview.current=reviewId;setReceivePo(order);}
  },[reviewId,orders]);

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.purchaseOrders.create>[0]) => api.purchaseOrders.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      setIsNewFormOpen(false);
      showToast('Purchase order created', 'success');
    },
    onError: (err: Error) => showToast(err.message || 'Failed to create PO', 'error'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.purchaseOrders.updateStatus(id, status),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });

    },
    onError: (err: Error) => showToast(err.message || 'Failed to update status', 'error'),
  });

  const prepareReceipt = async (po:PurchaseOrder) => {
    if(preparingId)return;setPreparingId(po.id);
    try {
      const result = await api.purchaseOrders.prepareReceipt(po.id);
      if(result.receipt_id)setReceiptId(result.receipt_id);
      else setReceivePo(po);
    } catch(cause) { showToast(cause instanceof Error?cause.message:'Could not prepare receipt. Try again.','error'); }
    finally {setPreparingId(null);}
  };
  if(receiptId)return <IncomingReceiptsPanel backLabel="Back to purchases" receiptId={receiptId} onClose={()=>{setReceiptId(null);void refreshCommerceQueries(queryClient);}}/>;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      {/* Header, canonical §5 */}
      <div className="px-4 md:px-6 lg:px-10 pt-6 pb-3 flex-shrink-0 flex items-center gap-3">
        <h1 className="h2 flex-1">Purchases</h1>
        <button
          onClick={() => setIsNewFormOpen(true)}
          className="inline-flex items-center gap-1.5 min-h-10 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors"
        >
          <Plus size={13} />
          New PO
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin text-tea-text-sec" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-tea-text-sec">
            <ShoppingBag size={28} className="mb-3 opacity-30" />
            <p className="text-sm font-serif italic">No purchase orders yet.</p>
            <button onClick={() => setIsNewFormOpen(true)} className="mt-1 py-2.5 text-xs text-tea-gold hover:underline">
              Create your first PO
            </button>
          </div>
        ) : (
          <div className="divide-y divide-tea-border">
            {orders.map(order => {
              const items: Array<Record<string, any>> = (() => {
                try { return JSON.parse(order.items_json); } catch { return []; }
              })();
              return (
                <div key={order.id} className="px-4 md:px-6 py-4 hover:bg-tea-surface/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-serif text-tea-text">{order.vendor_name}</span>
                        <span className={`text-ui-10 uppercase tracking-[0.12em] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[order.status] || STATUS_STYLES.pending}`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </div>

                      {items.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {items.map((item, idx) => (
                            <span key={idx} className="text-xs text-tea-text-sec">
                              {item.product_name} <span className="text-tea-text-dim tabular-nums">{item.quantity ?? item.quantity_grams}{item.unit === 'unit' ? ' units' : 'g'}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {order.notes && (
                        <p className="mt-1 text-xs text-tea-text-dim line-clamp-1">{order.notes}</p>
                      )}

                      <span className="text-ui-10 text-tea-text-dim mt-1 block">{formatDate(order.created_at)}</span>
                    </div>

                    {/* Status selector */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {order.status !== 'received' && order.status !== 'cancelled' && <button type="button" disabled={Boolean(preparingId)} onClick={()=>void prepareReceipt(order)} className="tap-target rounded-md cta-solid px-3 py-1 text-ui-12 disabled:opacity-50">{preparingId===order.id?'Preparing…':'Receive'}</button>}
                      <div className="relative">
                      <select
                        value={order.status}
                        onChange={e => statusMutation.mutate({ id: order.id, status: e.target.value })}
                        disabled={statusMutation.isPending || order.status === 'received'}
                        className="appearance-none bg-tea-elevated border border-tea-border rounded-xl pl-3 pr-7 py-1.5 text-xs text-tea-text outline-none focus:border-tea-gold cursor-pointer"
                      >
                        {PO_STATUSES.filter(s=>s!=='received'||order.status==='received').map(s => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New PO form modal */}
      <AnimatePresence>
        {isNewFormOpen && (
          <NewPoForm
            onClose={() => setIsNewFormOpen(false)}
            onSubmit={async data => { await createMutation.mutateAsync(data); }}
            submitting={createMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Receive stock prompt */}
      <AnimatePresence>
        {receivePo && (
          <MatchPurchaseLines po={receivePo} onPrepared={id=>{setReceivePo(null);setReceiptId(id);}} onClose={()=>setReceivePo(null)}/>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Purchase entry points share the tracking view; manual forms remain available as fallbacks. */
export const PurchaseOrdersPage: React.FC = () => <PurchaseTrackingView NewForm={NewPoForm} MatchForm={MatchPurchaseLines}/>;
export { NewPoForm, MatchPurchaseLines };
