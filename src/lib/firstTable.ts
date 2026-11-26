// Launch 1, "the first table" (todo/plans/guests-and-tea-masters-launch-1-run.md).
//
// One switch for everything Launch 1 adds: "Keep this tea" on the thank-you,
// a bought tea arriving in the Tea Chest, and a thank-you's tea links carrying
// where an order began. Off until Adrian says "ship" for the launch; turning
// it on is changing this constant in a reviewed commit.
//
// A local sandbox or a browser check can open it without a code change:
// the site reads VITE_FIRST_TABLE_OPEN=true, the worker reads the
// FIRST_TABLE_OPEN=true variable (see firstTableOpen). Neither is set on the
// live site.
export const FIRST_TABLE_OPEN = false;

type Env = { FIRST_TABLE_OPEN?: string } | null | undefined;

/** Whether Launch 1 is open, on the site or in the worker. */
export function firstTableOpen(env?: Env): boolean {
  if (FIRST_TABLE_OPEN) return true;
  if (env && env.FIRST_TABLE_OPEN === 'true') return true;
  try {
    return (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_FIRST_TABLE_OPEN === 'true';
  } catch {
    return false;
  }
}
