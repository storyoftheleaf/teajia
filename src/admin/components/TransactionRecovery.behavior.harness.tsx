import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { EditOrderModal } from './EditOrderModal';
import { IncomingReceiptsPanel } from './inventory/IncomingReceiptsPanel';
import { ListingFields } from '../views/PartnerListingEdit';
import '../../styles/tailwind.css';
import '../../styles/card-utilities.css';

type OrderRequest = { id: string; resolve: (rows: unknown[]) => void; reject: (error: Error) => void };
const orderRequests: OrderRequest[] = [];
const orderWrites: Array<{ id: string; body: unknown }> = [];
const receiveCalls: Array<{ lineId: string; quantity: number; key: string }> = [];
const receivedKeys = new Set<string>();
const receivedByAccount = new Map<string, number>();
const balanceFor = (account: string | null) => receivedByAccount.get(account || 'no-account') || 0;
const heldLists: Array<{ account: string | null; resolve: (rows: unknown[]) => void }> = [];
const heldReceives: Array<{ resolve: () => void }> = [];
let deferList = false;
let deferReceive = false;
let receiveRejectStatus = 0;
let receiptUnit = 'g';
let listFails = false;
let receiveResponseFails = false;
const toasts: string[] = [];
const listingCalls: unknown[] = [];
let listingFailures = 0;

Object.assign(api.products, { list: async () => [] });
Object.assign(api.invoices, {
  getItems: (id: string) => new Promise<unknown[]>((resolve, reject) => orderRequests.push({ id, resolve, reject })),
  updateItems: async (id: string, body: unknown) => { orderWrites.push({ id, body }); return { success: true }; },
});
Object.assign(api.inventoryReceipts, {
  list: async () => {
    if (listFails) throw new Error('Refresh unavailable');
    const account = useAppStore.getState().activeAccountId;
    const rows = [{ id: 'receipt-a', vendor_name: 'Fixture vendor', state: 'partially_received', legacy: false, lines: [{
      id: 'line-a', product_name: account ? `${account} tea` : 'Fixture tea', expected_quantity: 20,
      received_quantity: balanceFor(account), cancelled_quantity: 0, current_on_hand: balanceFor(account),
      unit: receiptUnit, intended_purpose: 'sale',
    }] }];
    if (deferList) {
      deferList = false;
      return new Promise<unknown[]>(resolve => heldLists.push({ account, resolve }));
    }
    return rows;
  },
  receive: async (lineId: string, quantity: number, key: string) => {
    const account = useAppStore.getState().activeAccountId;
    receiveCalls.push({ lineId, quantity, key });
    if (receiveRejectStatus) {
      const status = receiveRejectStatus;
      receiveRejectStatus = 0;
      throw new ApiError(`Receive rejected (${status})`, status);
    }
    if (deferReceive) {
      deferReceive = false;
      await new Promise<void>(resolve => heldReceives.push({ resolve }));
    }
    if (!receivedKeys.has(key)) {
      receivedByAccount.set(account || 'no-account', balanceFor(account) + quantity);
      receivedKeys.add(key);
    }
    if (receiveResponseFails) { receiveResponseFails = false; throw new Error('Response lost'); }
    return { received_quantity: balanceFor(account) };
  },
});
Object.assign(api.network, { updateListing: async (_id: string, patch: unknown) => {
  listingCalls.push(patch);
  if (listingFailures-- > 0) throw new Error('Listing save unavailable');
  return { success: true };
} });

const root = createRoot(document.getElementById('root')!);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Fixture() {
  const [mode, setMode] = useState<'order' | 'receipt' | 'listing'>('order');
  const [invoiceId, setInvoiceId] = useState('A');
  const [open, setOpen] = useState(true);
  Object.assign(window, { recoveryControls: { setMode, setInvoiceId, setOpen } });
  return mode === 'order'
    ? <EditOrderModal isOpen={open} invoice={{ id: invoiceId, invoice_number: invoiceId, customer_name: `Buyer ${invoiceId}`, shipping_cost_usd: 0 }} onClose={() => setOpen(false)} onSuccess={() => {}} showToast={message => toasts.push(message)} />
    : mode === 'receipt' ? <IncomingReceiptsPanel onClose={() => {}} />
      : <ListingFields listing={{ id: 'listing-a', account_id: 'account-a', profile_id: 'profile-a', stock_grams: 10, fixed_retail_price_usd: 1, store_note: '', listing_photos: [], is_sample: false, status: 'active', created_at: '' }} profile={{ id: 'profile-a', slug: 'fixture-tea', name: 'Fixture tea', canonical_photos: [], status: 'active', curated_by_account_id: 'account-a', originated_by_account_id: 'account-a' }} callerCurrency="USD" callerRateToUsd={1} callerRateResolved />;
}

const testApi = {
  setMode(mode: 'order' | 'receipt' | 'listing') { (window as any).recoveryControls.setMode(mode); },
  setInvoiceId(id: string) { (window as any).recoveryControls.setInvoiceId(id); },
  requests() { return orderRequests.map(request => request.id); },
  resolveOrder(index: number, rows: unknown[]) { orderRequests[index]?.resolve(rows); },
  rejectOrder(index: number) { orderRequests[index]?.reject(new Error('Load unavailable')); },
  orderWrites() { return orderWrites; },
  receiveCalls() { return receiveCalls; },
  received() { return balanceFor(null); },
  receivedFor(account: string | null) { return balanceFor(account); },
  failNextReceiveResponse() { receiveResponseFails = true; },
  setListFailure(value: boolean) { listFails = value; },
  setAccount(id: string | null) { useAppStore.getState().setActiveAccountId(id); },
  deferNextList() { deferList = true; },
  heldLists() { return heldLists.map(item => item.account); },
  resolveList(index: number, productName?: string) {
    const account = heldLists[index]?.account;
    heldLists[index]?.resolve([{ id: 'receipt-a', vendor_name: 'Fixture vendor', state: 'partially_received', legacy: false, lines: [{
      id: 'line-a', product_name: productName || (account ? `${account} tea` : 'Fixture tea'), expected_quantity: 20,
      received_quantity: 0, cancelled_quantity: 0, current_on_hand: 0, unit: receiptUnit, intended_purpose: 'sale',
    }] }]);
  },
  deferNextReceive() { deferReceive = true; },
  heldReceives() { return heldReceives.length; },
  resolveReceive(index: number) { heldReceives[index]?.resolve(); },
  rejectNextReceive(status: number) { receiveRejectStatus = status; },
  setReceiptUnit(unit: string) { receiptUnit = unit; },
  pendingFor(account: string | null) { return sessionStorage.getItem(`teajia:pending-receive:${account || 'no-account'}`); },
  toasts() { return toasts; },
  failListing(count = 1) { listingFailures = count; },
  listingCalls() { return listingCalls; },
};

declare global { interface Window { recoveryTest: typeof testApi } }
window.recoveryTest = testApi;
root.render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
