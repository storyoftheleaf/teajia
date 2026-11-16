import {describe,expect,it} from 'vitest';
import {fallbackShopFreightDefault,shopFreightDefaultFrom,shippingRateUsdFor,shopRateInCurrency} from './shippingRate';
import {rateToUsd} from './currency';
import {curateShelfPreview,orderLanded} from '../components/CurateV2/curatePricing';
import {formPricingPreview} from '../admin/components/inventory/stock/formPricingModel';
const account={default_shipping_rate_per_kg:85,default_shipping_rate_currency:'Yuan'};
describe('unknown freight conversion stays unknown',()=>{
 for(const missing of [null,undefined,0,-2,NaN,Infinity]){
  it(`does not price Yuan freight using invalid FX ${String(missing)}`,()=>{
   expect(shopFreightDefaultFrom(account,()=>missing).perKgUsd).toBeNull();
   expect(fallbackShopFreightDefault(missing as number).perKgUsd).toBeNull();
  });
 }
 it('does not borrow another currency conversion for a recorded shop quote',()=>{
  expect(shopFreightDefaultFrom({...account,default_shipping_rate_currency:'HKD'},c=>c==='Yuan'?7:null).perKgUsd).toBeNull();
 });
 it('passes an empty actual exchange table through inherited freight as unknown',()=>{
  const shop=shopFreightDefaultFrom(null,c=>rateToUsd([],c));
  expect(shop).toEqual({perKg:85,currency:'Yuan',perKgUsd:null});
  expect(shippingRateUsdFor(null,1,shop.perKgUsd)).toBeNull();
  expect(shopRateInCurrency(shop.perKgUsd,1)).toBeNull();
 });
 it('does not turn unknown shop freight into free freight in a USD price preview',()=>{
  const rates=[{currency:'USD' as const,rateToUSD:1}];
  const shop=shopFreightDefaultFrom(null,c=>rateToUsd(rates,c));
  expect(curateShelfPreview({costAmount:20,grams:100,currency:'USD',rates,shopFreightPerKgUsd:shop.perKgUsd})).toBeNull();
  expect(formPricingPreview({type:'Green',costAmount:20,costCurrency:'USD',shippingRatePerKg:null,quantityPurchased:100,form:'Loose',soldInWholeUnits:false,fixedRetailPriceUSD:null},rates,shop.perKgUsd).calculatedPerGram).toBeNull();
 });
 it('preserves known quote, precision, aliases and remembered positive rates',()=>{
  const rates=[{currency:'Yuan',rateToUSD:7.123456}];
  const shop=shopFreightDefaultFrom({...account,default_shipping_rate_currency:'CNY'},c=>rateToUsd(rates,c));
  expect(shop.perKgUsd).toBe(85/7.123456);
  expect(shopFreightDefaultFrom(null,c=>rateToUsd(rates,c))).toEqual({perKg:85,currency:'Yuan',perKgUsd:85/7.123456});
  expect(shippingRateUsdFor(14,7,shop.perKgUsd)).toBe(2);
  expect(shippingRateUsdFor(14,7,null)).toBe(2);
 });
 it('preserves entered zero at both levels without needing an exchange rate',()=>{
  expect(shopFreightDefaultFrom({...account,default_shipping_rate_per_kg:0},()=>null).perKgUsd).toBe(0);
  expect(shippingRateUsdFor(0,null,null)).toBe(0);
  expect(shopRateInCurrency(0,null)).toBe(0);
 });
 it('preserves all-teaware landed totals without requiring shop FX',()=>{
  const tx={currency:'USD' as const,items:[{id:'cup',name:'Synthetic cup',currency:'USD' as const,type:'Teaware',quantityUnits:1,pricePerUnit:40,priceIsPerGram:false,addedAt:''}]};
  expect(orderLanded(tx,[{currency:'USD',rateToUSD:1}],null)?.landedUsd).toBe(40);
 });
 it('preserves teaware zero freight when the shop FX is missing',()=>{
  const preview=curateShelfPreview({costAmount:40,grams:1,currency:'USD',rates:[{currency:'USD',rateToUSD:1}],shopFreightPerKgUsd:null,isTeaware:true});
  expect(preview?.freightPerKgSource).toBe(0);
  expect(preview?.retailPerGramUsd).toBe(120);
 });
});
