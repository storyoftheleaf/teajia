import React, {useState} from 'react';
import type { Product } from '../types';
import { ProductEditPanel } from '../components/ProductEditPanel';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '../../lib/api';
import { ToastProvider } from '../components/Toast';
import { IntakeWorkspace } from './IntakeWorkspace';
import '../../styles/tailwind.css';
import '../../styles/card-utilities.css';

/**
 * Harness for `IntakeWorkspace.behavior.test.ts`, following the pattern in
 * `OrdersView.behavior.harness.tsx`: mount the real component with the API
 * surface it actually calls overridden by the test, so a real browser drives
 * a real upload-and-commit flow instead of a static render.
 *
 * Item 4's regression: `plainCostWords` is unit-tested, but nothing drives
 * this component's own call to it (line ~399), so deleting that call would
 * leave the whole suite green while the operator started seeing raw server
 * markers again in the "not added" toast.
 */
let draftState: any = null;
let mountRevision=0;
api.curateImports.create = async body => operation('create',body);
api.curateImports.get = async id => operation('draftGet',undefined,id);
Object.assign(api.curateImports,{saveIntakeState:async(id:string,state:unknown,expectedRevision?:number)=>{
 const result=await operation('draftSave',{state,expectedRevision},id);draftState=state;return result;
}});
api.curateImports.listIncomplete = async () => ({ imports: [] } as any);
let abandonCalls = 0;
api.curateImports.abandon = async () => { abandonCalls++; return {} as any; };
api.curateImports.uploadEvidence = async () => ({} as any);
api.batches.list = async () => ({ batches: [] } as any);
const operation = async (kind: string, payload?: unknown, id?: string) => {
  const response = await fetch('/__intake-operations', { method: 'POST', body: JSON.stringify({ kind, payload, id }) });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'Operation failed') as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return result;
};
api.intakeCommits.get = async id => operation('get',undefined,id);
api.intakeCommits.save = async (id, payload) => operation('save', payload,id);
api.intakeCommits.complete = async id => operation('complete',undefined,id);
api.purchaseOrders.create = async body => operation('purchase', body);
api.products.bulkCreate = async (products, batchId, receiptLabel) => operation('bulk', { products, batchId, receiptLabel });

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const root = createRoot(document.getElementById('root')!);

const editorProduct:Product={id:'tea',type:'Oolong',givenName:'Cloud',productName:'Cloud Oolong',originCountry:'Taiwan',originRegion:'Alishan',pricePerGramUSD:.4,costPerGramUSD:.1,costAmount:20,stockGrams:100,lowStockThreshold:10,description:'Floral tea',tastingNotes:[],imageUrl:'',status:'Active',costCurrency:'USD',quantityPurchased:100,isPersonal:false,canReorder:true,isPublic:false,shownInShop:false};
let saveFailures=0;
api.customers.list=async()=>[];
api.products.getEvents=async()=>[];
api.rates.list=async()=>[];
api.accounts.get=async()=>({id:'account',default_shipping_rate_per_kg:85,default_shipping_rate_currency:'Yuan'}) as any;
function EditorHarness(){
 const [product,setProduct]=useState(editorProduct);
 return <ProductEditPanel product={product} rates={[{currency:'USD',rateToUSD:1}]} onClose={()=>{}} products={[editorProduct,{...editorProduct,id:'second',productName:'Second Tea'}]} onNavigate={setProduct} onSaveField={async(id,field,value)=>{const previous=product;setProduct({...product,[field]:value});await new Promise(resolve=>setTimeout(resolve,20));if(saveFailures-->0){setProduct(previous);throw new Error('Save interrupted')} }} />;
}

(window as any).intakeWorkspaceTest = {
  mount(entryOrReset: string | boolean = '/admin/intake') {
    const entry = typeof entryOrReset === 'string' ? entryOrReset : '/admin/intake?importId=test-import';
    client.clear();
    abandonCalls = 0;
    root.render(
      <QueryClientProvider key={++mountRevision} client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <ToastProvider>
            <Routes><Route path="/admin/intake" element={<IntakeWorkspace/>}/><Route path="/admin/purchase-orders" element={<p>Purchase review opened</p>}/><Route path="*" element={<p>Capture opened</p>}/></Routes>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  },
  setBulkCreateResult(result: any) { return operation('configure', { bulkResult: result }); },
  failPurchase(count = 1) { return operation('configure', { purchaseFailures: count }); },
  seedLegacyPlan(plan:unknown){return operation('configure',{plan,purchaseReview:true});},
  failLookup(count = 1) { return operation('configure', { getFailures: count }); },
  mountEditor(){
    root.render(<QueryClientProvider key={++mountRevision} client={client}><MemoryRouter><ToastProvider><EditorHarness/></ToastProvider></MemoryRouter></QueryClientProvider>);
  },
  failSave(){saveFailures=1;},
  savedDraft(){return draftState;},
  abandonCalls() { return abandonCalls; },
};
