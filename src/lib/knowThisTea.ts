// Launch 5, M8: "Does anyone know this tea?" on the Tea Table
// (todo/plans/guests-and-tea-masters-launch-5-run.md; the Tea Table rule in
// CLAUDE.md, which Adrian confirmed on 2026-11-26).
//
// A signed-in person puts a photograph of a tea they cannot name on the Tea
// Table, with a line about where they got it. It joins the table in time
// order. Someone who knows the tea tells the person who asked, privately:
// nobody else reads it, nothing is counted, nothing is sent, and the piece
// never shows how many people wrote. The asker may mark it named, with the
// tea in the shop when it is there, and may then thank the one who named it.
// There is no public reply thread: Adrian has not named replies.
//
// One switch for all of it: the piece on the table, the asking, the telling,
// the naming, the thanks, the owner's hide in Manage, and the worker routes
// under /api/tea-table/questions and /api/admin/tea-table/questions. It needs
// the Tea Table open as well. Closed until Adrian says "ship". To open it
// everywhere, set this constant to true.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_KNOW_THIS_TEA_OPEN ('true' or 'false'), the worker reads the
// KNOW_THIS_TEA_OPEN variable. A test or a local check sets it to 'true'.
export const KNOW_THIS_TEA_OPEN = false;

type Env = { KNOW_THIS_TEA_OPEN?: string } | null | undefined;

/** Whether "Does anyone know this tea?" is open, on the site or in the worker. */
export function knowThisTeaOpen(env?: Env): boolean {
  if (env?.KNOW_THIS_TEA_OPEN === 'true') return true;
  if (env?.KNOW_THIS_TEA_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_KNOW_THIS_TEA_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return KNOW_THIS_TEA_OPEN;
}

/** The heading every question carries on the table. */
export const KNOW_THIS_TEA_HEADING = 'Does anyone know this tea?';

/** The longest line about where the tea came from, the longest note someone sends the asker, and the longest tea name. */
export const KNOW_THIS_TEA_LIMITS = { whereFrom: 280, words: 600, teaName: 120 } as const;
/** How many questions one person may have on the table at once, and may put there in one day. */
export const KNOW_THIS_TEA_MOST = { open: 6, perDay: 3 } as const;
