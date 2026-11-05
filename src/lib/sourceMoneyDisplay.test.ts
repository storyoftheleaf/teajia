import { describe, expect, it } from 'vitest';
import { formatSourceMoney, groupRecordedMoney } from './sourceMoneyDisplay';
describe('recorded source money display', () => {
  it.each([['AUD','A$12.50'],['CNY','CN¥12.50'],['RMB','CN¥12.50'],['TWD','NT$13'],['nt$','NT$13'],['hkd','HK$12.50'],['JPY','JP¥13']])('labels %s without conversion', (currency,expected) => expect(formatSourceMoney(12.5,currency)).toBe(expected));
  it('keeps zero, missing amount and missing currency distinct', () => {
    expect(formatSourceMoney(0,'USD')).toBe('$0.00'); expect(formatSourceMoney(null,'USD')).toBe('$–');
    expect(formatSourceMoney(12,'UNK')).toBe('Currency unrecorded: –');
    expect(formatSourceMoney(Infinity,'USD')).toBe('$–');
  });
  it('groups aliases but never sums different money', () => {
    expect(groupRecordedMoney([{amount:85,currency:'Yuan'},{amount:15,currency:'CNY'},{amount:1800,currency:'NT'}])).toEqual([
      {currency:'Yuan',amount:100},{currency:'NT',amount:1800},
    ]);
  });
  it('does not turn incomplete groups into a complete partial sum', () => {
    expect(groupRecordedMoney([{amount:85,currency:'Yuan'},{amount:null,currency:'CNY'}])).toEqual([{currency:'Yuan',amount:null}]);
    expect(groupRecordedMoney([{amount:0,currency:'USD'}])).toEqual([{currency:'USD',amount:0}]);
  });
  it('does not show an overflowing total', () => {
    expect(groupRecordedMoney([{amount:Number.MAX_VALUE,currency:'USD'},{amount:Number.MAX_VALUE,currency:'USD'}])[0].amount).toBeNull();
  });
});
