import { describe, expect, it, vi, afterEach } from 'vitest';
import { checkoutLocation, emptyCheckoutDetails, readCheckoutDetails, validateCheckoutDetails } from './checkoutDetails';

afterEach(() => vi.unstubAllGlobals());

const customer = { ...emptyCheckoutDetails(true), name: 'Ayu', contact: 'ayu@example.com', location: 'Ubud' };

describe('guest delivery and reply details', () => {
  it('accepts a Bali area without demanding country punctuation', () => {
    expect(validateCheckoutDetails(customer, 'website')).toEqual({});
    expect(checkoutLocation(customer)).toBe('Ubud, Bali, Indonesia');
  });
  it('asks for no shipping address for pickup, without promising availability', () => {
    const pickup = { ...customer, location: '', delivery: 'bali-pickup' as const };
    expect(validateCheckoutDetails(pickup, 'website')).toEqual({});
    expect(checkoutLocation(pickup)).toBe('Pickup requested in Bali, Indonesia');
  });
  it('requires an email for website orders and a number for WhatsApp', () => {
    expect(validateCheckoutDetails({ ...customer, contact: '+62 812 3456 7890' }, 'website').contact).toBeTruthy();
    expect(validateCheckoutDetails(customer, 'whatsapp').contact).toBeTruthy();
    expect(validateCheckoutDetails({ ...customer, contact: '+62 812 3456 7890' }, 'whatsapp')).toEqual({});
  });
  it('needs no contact for an explicit WhatsApp chat handoff but still needs a destination', () => {
    expect(validateCheckoutDetails({ ...customer, contact: '' }, 'whatsapp-chat')).toEqual({});
    expect(validateCheckoutDetails({ ...customer, contact: '', location: '' }, 'whatsapp-chat').location).toBeTruthy();
  });
  it('carries country and optional postcode for an overseas quote', () => {
    const overseas = { ...customer, delivery: 'international' as const, location: 'Perth' };
    expect(validateCheckoutDetails(overseas, 'website').country).toBeTruthy();
    expect(checkoutLocation({ ...overseas, country: 'Australia', postcode: '6000' })).toBe('Perth 6000, Australia');
  });
  it('does not label another shop’s customer as being in Bali', () => {
    expect(emptyCheckoutDetails(false).delivery).toBe('international');
  });
  it('ignores malformed saved field types and blocked browser storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ name: 42, contact: null, notes: [], delivery: 'free' }) });
    expect(readCheckoutDetails(true)).toEqual(emptyCheckoutDetails(true));
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(readCheckoutDetails(true)).toEqual(emptyCheckoutDetails(true));
  });
});
