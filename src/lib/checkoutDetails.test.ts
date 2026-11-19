import { describe, expect, it, vi, afterEach } from 'vitest';
import { checkoutLocation, emptyCheckoutDetails, readCheckoutDetails, validateCheckoutDetails } from './checkoutDetails';
import { formatUsShippingAddress, validateUsShippingAddress } from './usShippingAddress';

afterEach(() => vi.unstubAllGlobals());
const customer = { ...emptyCheckoutDetails(true), name: 'Ayu', contact: 'ayu@example.com', address: '12 Test Lane Apt 3', location: 'Los Angeles', state: 'CA', postcode: '90012' };

describe('guest delivery and reply details', () => {
  it('defaults the flagship to US shipping and requires a complete address', () => {
    expect(emptyCheckoutDetails(true)).toMatchObject({ country: 'United States', delivery: 'international' });
    expect(validateCheckoutDetails(customer, 'website', true)).toEqual({});
    expect(checkoutLocation(customer)).toBe('Los Angeles, CA 90012, United States');
    expect(validateCheckoutDetails({ ...customer, address: '', state: '', postcode: '' }, 'website', true)).toMatchObject({ address: expect.any(String), state: expect.any(String), postcode: expect.any(String) });
  });
  it('asks for no shipping address for explicitly requested pickup', () => {
    const pickup = { ...customer, address: '', location: '', state: '', postcode: '', delivery: 'bali-pickup' as const };
    expect(validateCheckoutDetails(pickup, 'website', true)).toEqual({});
    expect(checkoutLocation(pickup)).toBe('Pickup requested in Bali, Indonesia');
  });
  it('requires an email for website orders and a number for WhatsApp', () => {
    expect(validateCheckoutDetails({ ...customer, contact: '+62 812 3456 7890' }, 'website').contact).toBeTruthy();
    expect(validateCheckoutDetails(customer, 'whatsapp').contact).toBeTruthy();
    expect(validateCheckoutDetails({ ...customer, contact: '+62 812 3456 7890' }, 'whatsapp')).toEqual({});
  });
  it('needs no contact for an explicit WhatsApp chat handoff but still needs a destination', () => {
    expect(validateCheckoutDetails({ ...customer, contact: '' }, 'whatsapp-chat', true)).toEqual({});
    expect(validateCheckoutDetails({ ...customer, contact: '', location: '' }, 'whatsapp-chat', true).location).toBeTruthy();
  });
  it('preserves other stores’ destination choices', () => {
    const overseas = { ...customer, country: 'Australia', state: '', location: 'Perth', postcode: '6000' };
    expect(validateCheckoutDetails(overseas, 'website')).toEqual({});
    expect(checkoutLocation(overseas)).toBe('Perth 6000, Australia');
    expect(validateCheckoutDetails(overseas, 'website', true).country).toBeTruthy();
  });
  it('normalizes old saved flagship delivery choices without assuming pickup', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ delivery: 'bali-delivery', country: 'Indonesia' }) });
    expect(readCheckoutDetails(true)).toMatchObject({ country: 'United States', delivery: 'international' });
  });
  it('ignores malformed saved field types and blocked browser storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ name: 42, contact: null, notes: [], delivery: 'free' }) });
    expect(readCheckoutDetails(true)).toEqual(emptyCheckoutDetails(true));
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(readCheckoutDetails(true)).toEqual(emptyCheckoutDetails(true));
  });
  it('stores unambiguous postal lines and rejects invalid states and ZIPs', () => {
    expect(formatUsShippingAddress({ street: customer.address, city: customer.location, state: 'ca', postcode: '90012-1234' })).toBe('12 Test Lane Apt 3\nLos Angeles, CA 90012-1234\nUnited States');
    expect(validateUsShippingAddress({ street: '12 Test', city: 'LA\nUS', state: 'ZZ', postcode: '123' })).toMatchObject({ location: expect.any(String), state: expect.any(String), postcode: expect.any(String) });
  });
});
