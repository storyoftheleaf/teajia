// Three looks for the Manage column beside the rail, for Adrian to choose
// from. All three are tiles, his pick of the first round, made finer
// (2026-11-27: "I like tiles, but more sophisticated"). Once he picks one,
// the other two and this switch come out.
//
//   porcelain  one quiet card, hairlines between the tiles, serif words.
//   medallion  a dark card, each glyph in a round medallion.
//   seal       each room its own raised tile, a gold seal on the one you are in.
//
// Pick one with ?manage=porcelain, ?manage=medallion or ?manage=seal on any
// address; the choice is remembered in this browser.

export type ManageLook = 'porcelain' | 'medallion' | 'seal';

const KEY = 'teajia_manage_look';
const LOOKS: readonly ManageLook[] = ['porcelain', 'medallion', 'seal'];

/** How wide each look's column is, in rem. */
export const MANAGE_LOOK_WIDTH_REM: Record<ManageLook, number> = { porcelain: 5, medallion: 5.25, seal: 5 };

function isLook(value: string | null | undefined): value is ManageLook {
  return !!value && (LOOKS as readonly string[]).includes(value);
}

/** The look for this browser: the address first, then the one picked last, then porcelain. */
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
  return 'porcelain';
}
