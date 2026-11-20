import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles/tailwind.css';
import '../../styles/card-utilities.css';
import { api, setToken } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import type { ShippingPaymentNotification } from '../../lib/shippingNotification';
import { OrderShipping } from './OrderShipping';

const root = createRoot(document.getElementById('root')!);
let notification: ShippingPaymentNotification = { state: 'not_requested', channel: null };
let afterSave: ShippingPaymentNotification = { state: 'accepted', channel: 'email' };
let calls: Record<string, unknown>[] = [];
let pendingStatuses: Array<(value: ShippingPaymentNotification) => void> = [];
let defer = false;
api.invoices.getShippingNotification = async () => defer ? new Promise(resolve => { pendingStatuses.push(resolve); }) : notification;
api.invoices.update = async (_id, data) => { calls.push(data); notification = afterSave; return {success:true,shipping_notification:notification}; };
function account(id: string) {
  useAppStore.setState({ activeAccountId: id });
  setToken(`header.${btoa(JSON.stringify({ active_account_id: id, sub:'test-operator' }))}.signature`);
}
(window as any).shippingTest = {
  mount(next: ShippingPaymentNotification) {
    notification = { state: 'not_requested', channel: null }; afterSave = next; calls = []; pendingStatuses = []; defer = false; account('account-a');
    root.render(<OrderShipping key={Math.random()} order={{id:'test-shipping-order',status:'Pending',source_inquiry_id:'test-inquiry',shipping_quote_status:'requested',delivery_address:'123 Example Street\nAustin, TX 78701\nUnited States'}} onChanged={async()=>{}} />);
  },
  deferStatus() { defer = true; },
  switchAccount() { account('account-b'); },
  resolveStatus(value: ShippingPaymentNotification) { pendingStatuses[0]?.(value); },
  calls: () => calls,
};
