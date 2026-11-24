import { authedFetch, getApiOrigin } from './api';
import type { ShelfOfferInput, TeaChestAccount } from './teaChestTypes';

interface PersonalStockOffer extends ShelfOfferInput {
  product_id: string;
  available_grams: number;
  price_usd: number;
}

type PersonalOfferQuote = Pick<PersonalStockOffer, 'price_usd' | 'price_amount' | 'price_currency'>;

const offerUrl = (id: string) => `${getApiOrigin()}/api/products/${encodeURIComponent(id)}/personal-offer`;

export const personalStockOfferApi = {
  get: (id: string): Promise<{ offer: PersonalStockOffer | null }> => authedFetch(offerUrl(id)),
  preview: (id: string, offer: ShelfOfferInput): Promise<PersonalOfferQuote> => authedFetch(offerUrl(id), {
    method: 'POST', body: JSON.stringify({ ...offer, preview: true }), callerRefreshesCommerce: true,
  }),
  publish: (id: string, offer: ShelfOfferInput, expectedPriceUsd: number): Promise<{ offer: PersonalStockOffer }> => authedFetch(offerUrl(id), {
    method: 'POST', body: JSON.stringify({ ...offer, expected_price_usd: expectedPriceUsd }), callerRefreshesCommerce: true,
  }),
  withdraw: (id: string): Promise<{ ok: boolean }> => authedFetch(offerUrl(id), {
    method: 'DELETE', callerRefreshesCommerce: true,
  }),
};

const accountUrl = () => `${getApiOrigin()}/api/me/tea-chest/account`;

export const teaChestStockAccountApi = {
  get: (): Promise<{ account: TeaChestAccount | null }> => authedFetch(accountUrl()),
  create: (): Promise<{ account: TeaChestAccount }> => authedFetch(accountUrl(), { method: 'POST' }),
};
