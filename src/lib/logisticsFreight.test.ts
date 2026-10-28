import { describe, expect, it } from 'vitest';
import { calculateShipmentFreight, estimatePackedVolume, type LogisticsFreightInput } from './logisticsFreight';
const charge: LogisticsFreightInput = { basis:'m3',rate:800,billed_quantity:0.4,total_amount:null,currency:'CNY',confirmed:true };
const lines = [
  {id:'tea',weight_kg:10,volume_m3:0.1,volume_estimated:true},
  {id:'ware',weight_kg:5,volume_m3:0.3,volume_estimated:true},
];
describe('shipment freight accounting',()=>{
 it('splits a confirmed volume bill using visibly estimated packing shares',()=>{
  const result=calculateShipmentFreight(charge,lines);
  expect(result).toMatchObject({total_amount:320,estimated:true,issue:null,allocations:[{id:'tea',amount:80},{id:'ware',amount:240}]});
 });
 it('uses actual invoice total once instead of adding it to the quoted calculation',()=>{
  expect(calculateShipmentFreight({...charge,total_amount:300},lines).allocations).toEqual([{id:'tea',amount:75},{id:'ware',amount:225}]);
 });
 it('uses weight shares for kg and a chosen basis for fixed bills',()=>{
  const result=calculateShipmentFreight({...charge,basis:'kg',rate:20,billed_quantity:15},lines);
  expect(result.allocations).toEqual([{id:'tea',amount:200},{id:'ware',amount:100}]);
  expect(calculateShipmentFreight({...charge,basis:'fixed',allocation_basis:'kg',total_amount:300},lines).allocations).toEqual(result.allocations);
 });
 it('keeps missing currency, volume and charges unknown instead of free',()=>{
  expect(calculateShipmentFreight({...charge,currency:null},lines).total_amount).toBeNull();
  expect(calculateShipmentFreight(charge,[{...lines[0],volume_m3:null}])).toMatchObject({total_amount:320,allocations:[{id:'tea',amount:null}]});
  expect(calculateShipmentFreight({...charge,rate:null},lines).total_amount).toBeNull();
 });
 it('preserves explicit zero freight even with unknown dimensions',()=>{
  expect(calculateShipmentFreight({...charge,total_amount:0},[{...lines[0],volume_m3:null}])).toMatchObject({total_amount:0,issue:null,allocations:[{id:'tea',amount:0}]});
 });
 it('allocates rounding remainders without creating or losing money',()=>{
  const equal=['c','a','b'].map(id=>({...lines[0],id,volume_m3:1}));
  const result=calculateShipmentFreight({...charge,total_amount:1},equal);
  expect(result.allocations).toEqual([{id:'c',amount:0.33},{id:'a',amount:0.34},{id:'b',amount:0.33}]);
  expect(result.allocations.reduce((sum,line)=>sum+line.amount!,0)).toBe(1);
 });
 it('rejects invalid totals and duplicate line identities',()=>{
  expect(calculateShipmentFreight({...charge,total_amount:NaN},lines).issue).toBeTruthy();
  expect(calculateShipmentFreight(charge,[lines[0],lines[0]]).issue).toBeTruthy();
 });
 it('does not call provisional rate or estimated billed weight an actual allocation',()=>{
  expect(calculateShipmentFreight({...charge,confirmed:false},lines).estimated).toBe(true);
  expect(calculateShipmentFreight({...charge,basis:'kg'},[{...lines[0],weight_estimated:true}]).estimated).toBe(true);
 });
});
describe('packed-volume planning estimates',()=>{
 it('scales editable allowances by amount and always marks them as estimates',()=>{
  expect(estimatePackedVolume({kind:'loose_tea',quantity:1000,unit:'g'})).toMatchObject({volume_m3:0.008,estimated:true});
  expect(estimatePackedVolume({kind:'gaiwan',quantity:4,unit:'unit'})).toMatchObject({volume_m3:0.012,estimated:true});
 });
 it('does not invent a size for unknown items or confuse grams with pieces',()=>{
  expect(estimatePackedVolume({kind:'other',quantity:4,unit:'unit'}).volume_m3).toBeNull();
  expect(estimatePackedVolume({kind:'gaiwan',quantity:4,unit:'g'}).volume_m3).toBeNull();
 });
});
