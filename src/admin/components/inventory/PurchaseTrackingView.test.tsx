import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { PurchaseTrackingRow } from '../../../lib/api';
import { matchesPurchaseTracking, PurchaseTrackingView, scopeLogisticsOrders } from './PurchaseTrackingView';
vi.mock('../../../lib/store', () => ({ useAppStore: (select: (s: unknown) => unknown) => select({ activeAccountId: 'shop' }) }));
const row: PurchaseTrackingRow = {
 id:'purchase', purchase:null, attention:[], source_document:{import_id:'invoice / one',title:'Supplier invoice'},
 receipt:{id:'receipt',state:'partially_received',vendor_name:'Tea workshop',source_kind:'curate_import',lines:[{id:'line',product_id:'tea one',product_name:'Golden Tips',expected_quantity:2000,received_quantity:500,cancelled_quantity:0,current_on_hand:760,unit:'g',intended_purpose:'working'}]},
 history:[{id:'arrival',line_id:'line',product_id:'tea one',quantity:500,unit:'g',balance_after:760,recorded_at:'2026-10-27T10:00:00Z',recorded_by:null,note:'First parcel'}],
};
describe('purchase tracking workflow',()=>{
 it('scopes preparation to purchases matching the selected supplier and company',()=>{
  const data={orders:[{purchase_id:'one'},{purchase_id:'two'}]} as Parameters<typeof scopeLogisticsOrders>[0];
  expect(scopeLogisticsOrders(data,[{purchase:{id:'two'}} as PurchaseTrackingRow])).toEqual([{purchase_id:'two'}]);
  expect(scopeLogisticsOrders(data,[])).toEqual([]);
 });
 it('explains an empty filtered view and offers to clear filters',()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  client.setQueryData(['purchase-tracking','shop'],{rows:[row]});
  const Form=()=>null;
  const html=renderToStaticMarkup(<MemoryRouter initialEntries={['/?view=received']}><QueryClientProvider client={client}><PurchaseTrackingView NewForm={Form} MatchForm={Form}/></QueryClientProvider></MemoryRouter>);
  expect(html).toContain('No purchases match these filters.');
  expect(html).toContain('Clear filters');
  expect(html).not.toContain('No purchases recorded yet.');
 });
 it('keeps an ordinary partial shipment in Coming without demanding a decision',()=>{
  expect(matchesPurchaseTracking(row,'coming')).toBe(true);
  expect(matchesPurchaseTracking(row,'attention')).toBe(false);
  expect(matchesPurchaseTracking({...row,attention:[{code:'partial_delivery',message:'Partial delivery'}]},'attention')).toBe(false);
 });
 it('shows a real unresolved decision in attention without hiding the shipment from Coming',()=>{
  const overdue={...row,attention:[{code:'overdue',message:'Expected arrival has passed.'}]};
  expect(matchesPurchaseTracking(overdue,'attention')).toBe(true);
  expect(matchesPurchaseTracking(overdue,'coming')).toBe(true);
 });
 it('keeps an unfinished invoice in attention and offers its review route without calling it incoming stock',()=>{
  const draft:PurchaseTrackingRow={id:'import:invoice / one',purchase:null,receipt:null,attention:[{code:'invoice_review',message:'Invoice needs review.'}],history:[],source_document:null,invoice_draft:{id:'invoice / one',title:'Autumn invoice',item_count:3,created_at:'2026-10-28',analysis_state:'complete',review_state:'reviewing'}};
  expect(matchesPurchaseTracking(draft,'attention')).toBe(true);
  expect(matchesPurchaseTracking(draft,'coming')).toBe(false);
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  client.setQueryData(['purchase-tracking','shop'],{rows:[draft]});
  const Form=()=>null;
  const html=renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={client}><PurchaseTrackingView NewForm={Form} MatchForm={Form}/></QueryClientProvider></MemoryRouter>);
  expect(html).toContain('Autumn invoice');
  expect(html).toContain('3 items');
  expect(html).toContain('Review invoice');
  expect(html).toContain('/admin/intake?importId=invoice%20%2F%20one');
  expect(html).not.toContain('Supplier not recorded');
 });
 it('keeps already-recorded legacy stock out of Coming while its original movement is being linked',()=>{
  const historical={...row,receipt:null,purchase:{id:'old',status:'pending',create_request_key:'intake:old'},attention:[{code:'historical_stock_link',message:'Link original arrival'}]} as PurchaseTrackingRow;
  expect(matchesPurchaseTracking(historical,'coming')).toBe(false);
  expect(matchesPurchaseTracking(historical,'attention')).toBe(true);
 });
 it('renders shared receipt figures and evidence links while keeping receiving secondary',()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  client.setQueryData(['purchase-tracking','shop'],{rows:[row]});
  const Form=()=>null;
  const html=renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={client}><PurchaseTrackingView NewForm={Form} MatchForm={Form} initialOpen="purchase"/></QueryClientProvider></MemoryRouter>);
  expect(html).toContain('Golden Tips');
  expect(html).toContain('1,500 g');
  expect(html).toContain('/admin/stock?panel=tea%20one');
  expect(html).toContain('Invoice');
  expect(html).not.toContain('/admin/intake?importId=');
  expect(html).toContain('Arrival history');
  expect(html).toMatch(/<details class="purchase-tracking-manual"><summary/);
  expect(html).not.toContain('Arriving now');
  expect(html).not.toContain('Set up delivery');
  expect(html).not.toContain('Received by agent');
 });
});
