import { describe, expect, it } from 'vitest';
import { internationalWhatsAppNumber } from './whatsappContact';

describe('explicit international WhatsApp contact', () => {
  it('normalizes display punctuation without guessing the country', () => {
    expect(internationalWhatsAppNumber(' +62 (813) 3971-2339 ')).toBe('+6281339712339');
    for (const value of ['081339712339', '6281339712339', '+081339712339', '+123', '+1234567890123456', 'hi +6281339712339', 'guest@example.com', null]) {
      expect(internationalWhatsAppNumber(value)).toBeNull();
    }
  });
});
