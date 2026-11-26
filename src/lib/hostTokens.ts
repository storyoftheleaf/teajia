// Launch 5, M6 part two: a host's own agent token
// (todo/plans/guests-and-tea-masters-launch-5-run.md, hard question 2).
//
// A host connects their own assistant (Adrian named ChatGPT) to their own
// tables, guests, teas, notes and chest, from "Your assistant" on
// /account/host. The key it is given reaches those and nothing else: never
// Manage, another host, or the shop's books (worker/src/hostTokens.ts and
// HOST_SELF_TOOLS in worker/src/mcp.ts).
//
// Closed until Adrian opens it. Two switches stand together: this one and
// Launch 2's (src/lib/fewHosts.ts), so nothing here opens while hosting
// itself is closed. With either off, every route answers 404 and no host key
// works on /mcp.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_HOST_TOKENS_OPEN ('true' or 'false'), the worker reads the
// HOST_TOKENS_OPEN variable. Neither is set on the live site.
import { fewHostsOpen } from './fewHosts';

export const HOST_TOKENS_OPEN = false;

type Env = { HOST_TOKENS_OPEN?: string; FEW_HOSTS_OPEN?: string } | null | undefined;

function hostTokensSwitch(env?: Env): boolean {
  if (env?.HOST_TOKENS_OPEN === 'true') return true;
  if (env?.HOST_TOKENS_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_HOST_TOKENS_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return HOST_TOKENS_OPEN;
}

/** Whether a host may connect their own assistant, on the site or in the worker. Needs Launch 2 open too. */
export function hostTokensOpen(env?: Env): boolean {
  return hostTokensSwitch(env) && fewHostsOpen(env);
}

/** The one scope a host's key carries. Never mixed with a shop scope. */
export const HOST_SELF_SCOPE = 'host:self';

/** The longest name a host may give a key. */
export const HOST_TOKEN_LABEL_MAX = 60;

/** One of the host's own keys, as their page lists it. The secret itself is never listed. */
export interface HostToken {
  id: string;
  label: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

/** What "Your assistant" shows: the host's live keys, whether they may make a new one, and the address to give an assistant. */
export interface HostTokenList {
  tokens: HostToken[];
  may_connect: boolean;
  mcp_url: string;
}

/** A key just made. `token` is the secret, shown this once and never again. */
export interface HostTokenMinted extends HostToken {
  token: string;
  mcp_url: string;
}
