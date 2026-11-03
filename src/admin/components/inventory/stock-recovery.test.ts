import { describe, expect, it } from 'vitest';
import { movementStorageKey, readPendingMovement } from './movementRecovery';
describe('stock movement recovery', () => {
 it('restores the original immutable intent with its original retry key', () => {
  const intent={productId:'tea',body:{movement_type:'gift',unit:'g',quantity:5,expected_balance:20,idempotency_key:'original'}};
  expect(readPendingMovement(JSON.stringify(intent))).toEqual(intent);
  expect(movementStorageKey('a','tea')).not.toBe(movementStorageKey('b','tea'));
 });
 it('refuses malformed recovery payloads',()=>expect(readPendingMovement('{"body":{}}')).toBeNull());
});
