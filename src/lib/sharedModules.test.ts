import { describe, expect, it } from 'vitest';
import { findEditedCopies } from '../../tests/shared/check-shared-copies';

/* Files under tests/shared/ are copies of modules another project owns
   (shared-modules.lock.json says which). Edit the owner, then run modules-sync.
   This lives under src/ because that is where CI's vitest run looks. */
describe('shared modules', () => {
  it('every shared copy matches what modules-sync wrote', () => {
    expect(findEditedCopies(process.cwd())).toEqual([]);
  });
});
