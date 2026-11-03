import { describe, expect, it } from 'vitest';
import { hydrateIntakeItems, intakeStorageKey, readIntakeSnapshot } from './intakeDraft';
describe('intake draft recovery',()=>{
 it('restores canonical capture facts without treating ordered grams as arrived',()=>{
  const items=hydrateIntakeItems({batch:{id:'draft'},items:[{id:'row',source_id:'source',review_state:'pending',name:'Tea',parsed_data:{type:'Oolong',lineCost:40,currency:'USD',totalQuantityGrams:100,disposition:'in_transit',vendorResolution:{kind:'new',vendorName:'Lin'}}}]} as never);
  expect(items[0]).toMatchObject({id:'row',givenName:'Tea',type:'Oolong',costAmount:40,costCurrency:'USD',quantityPurchased:100,stockGrams:0,vendor:'Lin'});
 });
 it('does not reimport already accepted rows and keeps account recovery keys separate',()=>{
  expect(hydrateIntakeItems({batch:{id:'draft'},items:[{review_state:'accepted'}]} as never)).toEqual([]);
  expect(intakeStorageKey('a','user','draft')).not.toBe(intakeStorageKey('b','user','draft'));
  expect(readIntakeSnapshot({version:1})).toBeNull();
 });
});
