// Launch 3, "anyone can host" (todo/plans/guests-and-tea-masters-launch-3-run.md).
//
// One switch for everything Launch 3 adds: reports on a session or a person,
// the session gallery, "this is a tasting", the free or contribution line,
// and later hosting for everyone. Off until Adrian says "ship" for the launch.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_ANYONE_HOSTS_OPEN ('true' or 'false'), the worker reads the
// ANYONE_HOSTS_OPEN variable.
export const ANYONE_HOSTS_OPEN = false;

type Env = { ANYONE_HOSTS_OPEN?: string } | null | undefined;

/** Whether Launch 3 is open, on the site or in the worker. */
export function anyoneHostsOpen(env?: Env): boolean {
  if (env?.ANYONE_HOSTS_OPEN === 'true') return true;
  if (env?.ANYONE_HOSTS_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ANYONE_HOSTS_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return ANYONE_HOSTS_OPEN;
}
