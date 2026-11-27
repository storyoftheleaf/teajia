// Three looks for the Manage column beside the rail, for Adrian to choose
// from (2026-11-27: "Give me three completely different managed columns").
// Once he picks one, the other two and this switch come out.
//
//   ledger  an index: the rooms in the rail's own lowercase type, hairlines
//           between them, read from the top like a page.
//   tiles   a small floating card of square tiles, a glyph over each word.
//   spines  the slimmest: each room set upright like a book's spine.
//
// Pick one with ?manage=ledger, ?manage=tiles or ?manage=spines on any
// address; the choice is remembered in this browser.

export type ManageLook = 'ledger' | 'tiles' | 'spines';

const KEY = 'teajia_manage_look';
const LOOKS: readonly ManageLook[] = ['ledger', 'tiles', 'spines'];

/** How wide each look's column is, in rem. */
export const MANAGE_LOOK_WIDTH_REM: Record<ManageLook, number> = { ledger: 6.25, tiles: 4.75, spines: 2.75 };

function isLook(value: string | null | undefined): value is ManageLook {
  return !!value && (LOOKS as readonly string[]).includes(value);
}

/** The look for this browser: the address first, then the one picked last, then ledger. */
export function manageLook(search: string): ManageLook {
  const asked = new URLSearchParams(search).get('manage');
  if (isLook(asked)) {
    try { window.localStorage.setItem(KEY, asked); } catch { /* storage refused: the address decides this load */ }
    return asked;
  }
  try {
    const kept = window.localStorage.getItem(KEY);
    if (isLook(kept)) return kept;
  } catch { /* storage refused */ }
  return 'ledger';
}
