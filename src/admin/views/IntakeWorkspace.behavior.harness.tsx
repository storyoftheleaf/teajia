import React, {useState} from 'react';
import type { Product } from '../types';
import { ProductEditPanel } from '../components/ProductEditPanel';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
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
api.curateImports.create = async () => ({ batch: { id: 'test-import' } } as any);
let draftState: unknown = null;
let draftRevision=0;
let mountRevision=0;
api.curateImports.get = async () => ({ batch:{id:'test-import',intake_state:draftState,intake_revision:draftRevision}, sources: [], items: [] } as any);
Object.assign(api.curateImports, {saveIntakeState:async (_id:string,state:unknown) => {draftState=state;return {intake_revision:++draftRevision};}});
api.curateImports.listIncomplete = async () => ({ imports: [] } as any);
let abandonCalls = 0;
api.curateImports.abandon = async () => { abandonCalls++; return {} as any; };
api.curateImports.uploadEvidence = async () => ({} as any);
api.batches.list = async () => ({ batches: [] } as any);
let purchaseFailures = 0;
const purchaseCalls: unknown[] = [];
api.purchaseOrders.create = async body => {
  purchaseCalls.push(body);
  if (purchaseFailures-- > 0) throw new Error('Purchase record unavailable');
  return { id: 'purchase-1' };
};

let bulkCreateResult: any = { inserted: 0, skipped: 0, results: [] };
let bulkCalls = 0;
api.products.bulkCreate = async products => { bulkCalls++; return {...bulkCreateResult,results:bulkCreateResult.results?.length ? bulkCreateResult.results.map((row:any,index:number)=>({...row,client_row_id:products[index]?.client_row_id})) : products.map((item,index)=>({client_row_id:item.client_row_id,status:'inserted',product_id:'product-'+index,ledger_id:'ledger-'+index}))}; };

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
  mount(reset=true) {
    if(reset){localStorage.clear(); draftState=null;draftRevision=0;}
    client.clear();
    bulkCalls = 0;
    purchaseCalls.length = 0;
    purchaseFailures = 0;
    abandonCalls = 0;
    root.render(
      <QueryClientProvider key={++mountRevision} client={client}>
        <MemoryRouter initialEntries={[reset ? '/admin/intake' : '/admin/intake?importId=test-import']}>
          <ToastProvider>
            <IntakeWorkspace />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  },
  mountEditor(){
    root.render(<QueryClientProvider key={++mountRevision} client={client}><MemoryRouter><ToastProvider><EditorHarness/></ToastProvider></MemoryRouter></QueryClientProvider>);
  },
  failSave(){saveFailures=1;},
  savedDraft(){return draftState;},
  setBulkCreateResult(result: any) { bulkCreateResult = result; },
  failPurchase(count = 1) { purchaseFailures = count; },
  bulkCalls() { return bulkCalls; },
  purchaseCalls() { return purchaseCalls; },
  abandonCalls() { return abandonCalls; },
};
