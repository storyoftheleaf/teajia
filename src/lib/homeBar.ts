// Launch 4, Home in full and the bar's new words (slices K7 and K10 of
// todo/plans/guests-and-tea-masters-launch-4-run.md; the section map is
// docs/SECTIONS.md).
//
// One switch for all of it: Home's new opening lines, its "Come to a table"
// door and its two strips; the four words on the phone bar and the desktop
// rail (src/components/navSections.ts holds them, on one line); the phone
// menu and the rail's foot in their shorter form; and keys 1 to 5. (Read's row
// of three shelf names on /read, /read/lessons and /wisdom used to wait for
// this switch too; since Craft left the bar on 2026-11-27 it always shows.) Adrian answered the bar
// question on 2026-11-26 and then said he doubts "tea table" and "tea house"
// as words, so this ships off. Closed, every one of those renders exactly as
// before. No address is added or taken away by this switch.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_HOME_BAR_OPEN ('true' or 'false'). Neither is set on the live site. A
// test or a local check of the open state sets it to 'true'.
export const HOME_BAR_OPEN = false;

/** Whether the new Home and bar are on. */
export function homeBarOpen(): boolean {
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_HOME_BAR_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return HOME_BAR_OPEN;
}
