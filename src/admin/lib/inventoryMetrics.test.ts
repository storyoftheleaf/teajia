import {expect,it} from 'vitest';
import {inventoryMetrics} from './inventoryMetrics';
const item={status:'Active',costAmount:10,costCurrency:'USD',quantityPurchased:100,stockGrams:100,pricePerGramUSD:0.5,originRegion:'Synthetic',type:'Green'};
it('does not present a partial retail valuation as a complete total',()=>{
 const result=inventoryMetrics([item,{...item,pricePerGramUSD:null}],[{currency:'USD',rateToUSD:1}]);
 expect(result.totalRetailUSD).toBeNull();
 expect(result.potentialProfit).toBeNull();
 expect(result.regionValue[0].value).toBeNull();
});
it('keeps zero-price and empty stock valuation known',()=>{
 expect(inventoryMetrics([{...item,pricePerGramUSD:0}],[]).totalRetailUSD).toBe(0);
 expect(inventoryMetrics([{...item,pricePerGramUSD:null,stockGrams:0}],[]).totalRetailUSD).toBe(0);
});

it('uses existing teaware counts for unknown and zero valuations',()=>{
 const ware={...item,type:'Teaware',stockGrams:0,quantityUnits:2,pricePerGramUSD:null};
 expect(inventoryMetrics([ware],[]).totalRetailUSD).toBeNull();
 expect(inventoryMetrics([{...ware,pricePerGramUSD:0}],[]).totalRetailUSD).toBe(0);
 expect(inventoryMetrics([{...ware,quantityUnits:0}],[]).totalRetailUSD).toBe(0);
 expect(inventoryMetrics([],[]).totalRetailUSD).toBe(0);
 expect(inventoryMetrics([item],[]).totalRetailUSD).toBe(50);
});
it('retains independently fixed retail when calculated retail and cost are unavailable',()=>{
 const fixed={...item,pricePerGramUSD:null,fixedRetailPriceUSD:0.75,costAmount:null};
 const result=inventoryMetrics([fixed],[]);
 expect(result.totalRetailUSD).toBe(75);
 expect(result.costlessCurrencies.get('USD')).toBe(1);
});
