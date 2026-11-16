// Purchase-order statuses this screen shows: placed and not yet received or
// cancelled. 'ordered' is what an order becomes once it has expected receipt
// lines, and what an agent's or an invoice's order starts as.
//
// The agent tools (IN_PROCESS in worker/src/mcpTools/orderTracking.ts) also
// count 'pending'. This screen leaves it out on purpose: a pending order can be
// an older intake whose stock was already recorded, which Purchases flags "do
// not receive it again" for as long as it stays pending. Mark sent here would
// move it off that status and drop the warning.
export const IN_PROCESS_STATUSES = ['ordered', 'confirmed', 'sent', 'shipped'];

/**
 * Which of the four steps (Placed, Sent to supplier, Shipped, Received) an
 * order is on. 'ordered' is placed and not yet sent, so Placed.
 */
export const stepOf = (status: string): number => {
  if (status === 'ordered') return 0;
  return Math.max(0, ['confirmed', 'sent', 'shipped', 'received'].indexOf(status));
};
