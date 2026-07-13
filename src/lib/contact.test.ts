import { describe, expect, it } from 'vitest';
import { CONTACT_UNAVAILABLE, resolveContactChannels } from './contact';

describe('resolveContactChannels', () => {
  it('builds configured WhatsApp and addressed email handoffs', () => {
    const result = resolveContactChannels({ whatsappNumber: '+62 812 3456 7890', email: 'tea@example.com', subject: 'Yancha', message: 'Interested in Yancha' });
    expect(result.whatsapp?.href).toContain('wa.me/6281234567890');
    expect(result.email?.href).toBe('mailto:tea@example.com?subject=Yancha&body=Interested%20in%20Yancha');
    expect(result.unavailable).toBe(false);
  });

  it('marks an account without a usable channel unavailable', () => {
    expect(resolveContactChannels({ message: 'hello' }).unavailable).toBe(true);
    expect(CONTACT_UNAVAILABLE).toMatch(/not configured/i);
  });
});
