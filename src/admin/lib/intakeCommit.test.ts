import { describe, expect, it } from 'vitest';
import { confirmedIntakeRows, purchaseRecordsForIntake } from './intakeCommit';
import { rowToStaged } from './intakeMapping';
const row = rowToStaged({ name:'Tea',cost:40,grams:100 }, {name:'product_name',cost:'cost_amount',grams:'quantity_purchased'},'sheet',0,false);
row.costCurrency='USD'; row.vendor='Lin';
describe('intake commit keeps the same quantities and money across records', () => {
 it('counts only identified successes and preserves exact per-row rejections', () => {
  const result=confirmedIntakeRows([row],{results:[{client_row_id:row.id,status:'skipped',reason:'Cost needed'}]});
  expect(result.confirmed).toEqual([]); expect(result.errors[row.id]).toBe('Cost needed');
 });
 it('records total acquisition cost once and links the confirmed holding', () => {
  const result=confirmedIntakeRows([row],{results:[{client_row_id:row.id,status:'inserted',product_id:'holding'}]});
  const records=purchaseRecordsForIntake(result.confirmed,[],()=>'', 'import');
  expect(records[0].total_usd).toBe(40);
  expect(JSON.parse(records[0].items_json)[0]).toMatchObject({product_id:'holding',quantity:100,unit:'g',unit_price:.4,total_cost:40,currency:'USD'});
  expect(records[0].idempotency_key).toBeTruthy();
 });
});
