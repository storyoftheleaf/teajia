// Purchase-order statuses that are in process: placed and not yet received or
// cancelled. Mirrors IN_PROCESS in worker/src/mcpTools/orderTracking.ts, which
// is what the agent tools read, so the screen and the agents agree.
export const IN_PROCESS_STATUSES = ['pending', 'ordered', 'confirmed', 'sent', 'shipped'];

/**
 * Which of the four steps (Placed, Sent to supplier, Shipped, Received) an
 * order is on. 'ordered' and 'pending' are placed and not yet sent, so Placed.
 */
export const stepOf = (status: string): number => {
  if (status === 'pending' || status === 'ordered') return 0;
  return Math.max(0, ['confirmed', 'sent', 'shipped', 'received'].indexOf(status));
};
