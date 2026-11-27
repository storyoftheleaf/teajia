import { describe, expect, it } from 'vitest';
import { looksLikePastedDetails, pastedLines, readPastedPayment } from './pastedPayment';

// The shape Wise hands over, with made-up numbers.
const WISE = `Send money to:
Name: Mei Lin Example

From the US (domestic):
Account type: Checking
Routing number (for wire and ACH): 000000000
Account number: 1234567890

From outside the US (Swift):
Swift/BIC: EXAMPLE33`;

describe('readPastedPayment', () => {
  it('reads the name and calls a Wise paste "Wise" when the paste says so', () => {
    expect(readPastedPayment(WISE)).toEqual({
      recipientName: 'Mei Lin Example', externalUrl: null, methodType: 'bank_transfer', suggestedLabel: 'Bank transfer',
    });
    expect(readPastedPayment(`Wise details\n${WISE}`).suggestedLabel).toBe('Wise');
  });

  it('treats a lone link as a payment link', () => {
    expect(readPastedPayment(' https://wise.com/pay/me/meiline ')).toEqual({
      recipientName: null, externalUrl: 'https://wise.com/pay/me/meiline', methodType: 'payment_link', suggestedLabel: 'Wise',
    });
  });
});

describe('pastedLines', () => {
  it('turns headings, values and plain words into lines the pay page can copy from', () => {
    const lines = pastedLines(WISE);
    expect(lines[0]).toEqual({ kind: 'heading', text: 'Send money to' });
    expect(lines).toContainEqual({ kind: 'value', label: 'Routing number (for wire and ACH)', value: '000000000' });
    expect(lines).toContainEqual({ kind: 'heading', text: 'From outside the US (Swift)' });
    expect(lines).toContainEqual({ kind: 'value', label: 'Swift/BIC', value: 'EXAMPLE33' });
    expect(looksLikePastedDetails(WISE)).toBe(true);
    expect(looksLikePastedDetails('Put your name in the reference.')).toBe(false);
  });
});
