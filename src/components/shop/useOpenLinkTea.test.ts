import { describe, expect, it } from 'vitest';
import { sentLinkOf } from './useOpenLinkTea';

// A tea opened on a sent link is recorded against that link; any other page records nothing.
describe('sentLinkOf', () => {
  it('names a collection link by its slug', () => {
    expect(sentLinkOf('/c/daniels-samples-ab12', new URLSearchParams('tea=y562'))).toEqual({ kind: 'collection', slug: 'daniels-samples-ab12' });
  });
  it('names an invoice by its pay link token', () => {
    expect(sentLinkOf('/people/adrian/pay', new URLSearchParams('t=abc&tea=y562'))).toEqual({ kind: 'invoice', t: 'abc' });
  });
  it('records nothing elsewhere', () => {
    expect(sentLinkOf('/people/adrian/pay', new URLSearchParams('tea=y562'))).toBeNull();
    expect(sentLinkOf('/sit/abc', new URLSearchParams('tea=y562'))).toBeNull();
  });
});
