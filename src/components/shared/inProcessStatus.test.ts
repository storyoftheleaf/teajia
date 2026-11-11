import { describe, expect, it } from 'vitest';
import { IN_PROCESS_STATUSES, stepOf } from './inProcessStatus';

describe('in process statuses', () => {
  it('lists placed orders, including ones that already have expected lines', () => {
    expect([...IN_PROCESS_STATUSES].sort()).toEqual(['confirmed', 'ordered', 'sent', 'shipped']);
    // A pending order may be an older intake that must not be received again.
    expect(IN_PROCESS_STATUSES).not.toContain('pending');
    expect(IN_PROCESS_STATUSES).not.toContain('received');
    expect(IN_PROCESS_STATUSES).not.toContain('cancelled');
  });
  it('places an ordered order on the first step, not before it', () => {
    expect(stepOf('ordered')).toBe(0);
    expect(stepOf('confirmed')).toBe(0);
    expect(stepOf('sent')).toBe(1);
    expect(stepOf('shipped')).toBe(2);
    expect(stepOf('received')).toBe(3);
  });
});
