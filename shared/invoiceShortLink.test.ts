import { describe, expect, it } from 'vitest';
import { invoiceShortCode, invoiceShortPath, parseInvoiceShortCode, shortLinkOrigin } from './invoiceShortLink';

const TOKEN = 'c6c1e92016bf417aa9a221275cf63268';

describe('the short invoice link', () => {
  it('is the invoice number and twelve characters of the token', () => {
    expect(invoiceShortCode('TJB-00007', TOKEN)).toBe('TJB-00007-c6c1e92016bf');
    expect(invoiceShortPath('TJB-00007', TOKEN)).toBe('/i/TJB-00007-c6c1e92016bf');
  });

  it('reads back to the same two halves, dashes in the number included', () => {
    expect(parseInvoiceShortCode('TJB-00007-c6c1e92016bf')).toEqual({ reference: 'TJB-00007', tokenPrefix: 'c6c1e92016bf' });
    expect(parseInvoiceShortCode(encodeURIComponent('INV 2026-01-c6c1e92016bf'))).toEqual({ reference: 'INV 2026-01', tokenPrefix: 'c6c1e92016bf' });
  });

  it('refuses a short or odd token, and a number that could break the path', () => {
    expect(parseInvoiceShortCode('TJB-00007-c6c1')).toBeNull();
    expect(parseInvoiceShortCode('TJB-00007-zzzzzzzzzzzz')).toBeNull();
    expect(parseInvoiceShortCode('-c6c1e92016bf')).toBeNull();
    expect(invoiceShortCode('a/b', TOKEN)).toBeNull();
    expect(invoiceShortCode('TJB-00007', 'short')).toBeNull();
    expect(invoiceShortCode(null, TOKEN)).toBeNull();
  });

  it('is printed on the bare domain', () => {
    expect(shortLinkOrigin('https://www.teajia.com/')).toBe('https://teajia.com');
    expect(shortLinkOrigin('http://localhost:7777')).toBe('http://localhost:7777');
  });
});
