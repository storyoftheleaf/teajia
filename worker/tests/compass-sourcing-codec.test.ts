import { describe, expect, it } from 'vitest';
import { decodeCompassWrite } from '../src/compassCodec';

describe('private sourcing metadata codec', () => {
  it('preserves agent sourcing fields in writes and explicit clears', () => {
    expect(decodeCompassWrite({ shop_name: '惜物堂', transport_mode: 'air' }, true)).toEqual({ values: { shop_name: '惜物堂', transport_mode: 'air' } });
    expect(decodeCompassWrite({ shop_name: null, transport_mode: null }, true)).toEqual({ values: { shop_name: null, transport_mode: null } });
  });
});
