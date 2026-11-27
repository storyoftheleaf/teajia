// Launch 5, M1: tea credit for hosts
// (todo/plans/guests-and-tea-masters-launch-5-run.md, hard question 1).
//
// A host earns credit in tea when a guest's order began from that host's
// thank-you or page. Adrian, 2026-11-26: "Let's start with full tea credit.
// Later on we can work on a cash system." The credit is spent only on tea from
// the shop, is never paid out, and is never shown to guests. It is held under
// "Credit is held securely" in the run sheet: nothing about it is read from
// the browser, earning waits for the order to be Filled by hand, and spending
// waits for the owner's approval.
//
// One switch for all of it: the ledger writes, the host's own read and the
// owner's read in Manage. Closed until Adrian says "ship". To open it
// everywhere, set this constant to true.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_HOST_CREDIT_OPEN ('true' or 'false'), the worker reads the
// HOST_CREDIT_OPEN variable. A test or a local check sets it to 'true'.
export const HOST_CREDIT_OPEN = true;

/**
 * The two terms of the rule, each an account setting: the share of the tea
 * lines (accounts.host_credit_percent) and the most credit one order may earn
 * or use without Adrian's second look (accounts.host_credit_order_ceiling_usd,
 * in US dollars, the currency invoice lines are priced in; the default is no
 * ceiling). NULL on the account means "follow these"; any number there, zero included, is obeyed.
 * They are read when they are used, never copied into a row. There is no time
 * window and no expiry: the credit is an ongoing balance (Adrian, 2026-11-26).
 */
export const HOST_CREDIT_DEFAULT_PERCENT = 10;
/** No ceiling unless the shop sets one (Adrian, 2026-11-26: "no credit ceiling, I can tell something's off"). Spending still waits for his approval every time. */
export const HOST_CREDIT_DEFAULT_ORDER_CEILING_USD: number | null = null;

type Env = { HOST_CREDIT_OPEN?: string } | null | undefined;

/** Whether tea credit for hosts is open, on the site or in the worker. */
export function hostCreditOpen(env?: Env): boolean {
  if (env?.HOST_CREDIT_OPEN === 'true') return true;
  if (env?.HOST_CREDIT_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_HOST_CREDIT_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return HOST_CREDIT_OPEN;
}
