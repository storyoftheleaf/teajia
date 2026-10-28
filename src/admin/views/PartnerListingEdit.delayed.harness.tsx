import React from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../../lib/api';
import { ListingFields } from './PartnerListingEdit';
import '../../styles/tailwind.css';
import '../../styles/card-utilities.css';

type PendingWrite = {
  patch: Record<string, unknown>;
  resolve: (value: { success: boolean }) => void;
  reject: (error: Error) => void;
};
const pending: PendingWrite[] = [];
let quotedCurrency='USD';let quotedRate=1;let quotedResolved=true;
const root=createRoot(document.getElementById('root')!);

Object.assign(api.network, {
  updateListing: (_id: string, patch: Record<string, unknown>) => new Promise<{ success: boolean }>((resolve, reject) => {
    pending.push({ patch, resolve, reject });
  }),
});

const controls = {
  currency:(currency:string,rate:number,resolved:boolean)=>{quotedCurrency=currency;quotedRate=rate;quotedResolved=resolved;renderFields();},
  patches: () => pending.map(write => write.patch),
  resolve: (index: number) => pending[index]?.resolve({ success: true }),
  reject: (index: number) => pending[index]?.reject(new Error('Synthetic save failure')),
};

declare global { interface Window { partnerListingTest: typeof controls } }
window.partnerListingTest = controls;

function renderFields(){root.render(
  <ListingFields
    listing={{ id: 'listing-a', account_id: 'account-a', profile_id: 'profile-a', stock_grams: 10, fixed_retail_price_usd: 1, store_note: '', listing_photos: [], is_sample: false, status: 'active', created_at: '' }}
    profile={{ id: 'profile-a', slug: 'fixture-tea', name: 'Fixture tea', canonical_photos: [], status: 'active', curated_by_account_id: 'account-a', originated_by_account_id: 'account-a' }}
    callerCurrency={quotedCurrency}
    callerRateToUsd={quotedRate}
    callerRateResolved={quotedResolved}
  />,
);}
renderFields();
