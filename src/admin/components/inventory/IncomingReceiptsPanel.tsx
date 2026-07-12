import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, PackageCheck, X } from 'lucide-react';
import { api } from '../../../lib/api';
import type { InventoryReceipt } from '../../types';

export function IncomingReceiptsPanel({ onClose }: { onClose: () => void }) {
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const load = () => { setLoading(true); api.inventoryReceipts.list().then(setReceipts).finally(() => setLoading(false)); };
  useEffect(load, []);
  const receive = async (id: string) => { setWorking(id); try { await api.inventoryReceipts.receive(id); load(); } finally { setWorking(null); } };
  const cancel = async (id: string) => { setWorking(id); try { await api.inventoryReceipts.cancelRemaining(id); load(); } finally { setWorking(null); } };
  return <section className="flex-1 min-h-0 overflow-auto pb-nav-gap bg-tea-bg" aria-label="Incoming stock">
    <div className="sticky top-0 z-10 bg-tea-bg border-b border-tea-border px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button className="tap-target text-tea-text-sec hover:text-tea-text" onClick={onClose} aria-label="Back to inventory"><ArrowLeft size={20}/></button>
        <div><h2 className="font-display text-ui-20 text-tea-text">Incoming stock</h2><p className="text-ui-12 text-tea-text-sec">Expected stock stays separate until it arrives.</p></div>
      </div>
      <button className="tap-target text-tea-text-sec hover:text-tea-text" onClick={onClose} aria-label="Close incoming"><X size={18}/></button>
    </div>
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      {loading && <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-tea-gold"/></div>}
      {!loading && receipts.length === 0 && <div className="py-16 text-center"><PackageCheck className="mx-auto text-tea-text-sec mb-3"/><p className="font-display text-ui-17 text-tea-text">Nothing on the way</p></div>}
      {receipts.map(receipt => <article key={receipt.id} className="border border-tea-border bg-tea-surface rounded-xl overflow-hidden">
        <header className="px-4 py-3 border-b border-tea-border flex flex-wrap items-baseline justify-between gap-2"><span className="font-display text-ui-15 text-tea-text">{receipt.vendor_name || (receipt.legacy ? 'Earlier incoming stock' : 'Incoming receipt')}</span><span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-sec">{receipt.state.replace('_',' ')}</span></header>
        <div className="divide-y divide-tea-border">{receipt.lines.map(line => { const remaining=Math.max(0,Number(line.expected_quantity)-Number(line.received_quantity)-Number(line.cancelled_quantity)); return <div key={line.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><div className="text-ui-14 text-tea-text truncate">{line.product_name}</div><div className="text-ui-12 text-tea-text-sec">{remaining} {line.unit} expected{Number(line.received_quantity)>0 ? ` · ${line.received_quantity} ${line.unit} received` : ''} · {line.intended_purpose}</div></div>
          {!receipt.legacy && remaining > 0 && <div className="flex flex-wrap items-center gap-2"><button disabled={working===line.id} onClick={()=>cancel(line.id)} className="min-h-11 px-3 text-ui-12 text-tea-text-sec hover:text-tea-text">Cancel remaining</button><button disabled={working===line.id} onClick={()=>receive(line.id)} className="min-h-11 px-4 rounded-md bg-tea-gold text-tea-bg text-ui-12 font-medium">{working===line.id ? 'Receiving…' : 'Receive remaining'}</button></div>}
        </div>})}</div>
      </article>)}
    </div>
  </section>;
}
