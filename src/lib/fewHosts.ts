// Launch 2, "a few hosts" (todo/plans/guests-and-tea-masters-launch-2-run.md).
//
// One switch for everything Launch 2 adds: a host Adrian approved making their
// own table, its link, and the host's pages for it. Closed until Adrian ships
// Launch 2. Two gates stand together: this switch, and the person's host
// approval (worker/src/hostApproval.ts). Every new write route answers 404
// unless both hold.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_FEW_HOSTS_OPEN ('true' or 'false'), the worker reads the
// FEW_HOSTS_OPEN variable. Neither is set on the live site. A local check of
// the open state sets it to 'true'.
export const FEW_HOSTS_OPEN = true;

type Env = { FEW_HOSTS_OPEN?: string } | null | undefined;

/** Whether Launch 2 is open, on the site or in the worker. */
export function fewHostsOpen(env?: Env): boolean {
  if (env?.FEW_HOSTS_OPEN === 'true') return true;
  if (env?.FEW_HOSTS_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_FEW_HOSTS_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return FEW_HOSTS_OPEN;
}
