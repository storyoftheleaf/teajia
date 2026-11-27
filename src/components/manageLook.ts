// Three looks for the Manage column beside the rail, for Adrian to choose
// from. All three are his pick, flush (a full-height porcelain leaf joined
// to the rail), made narrower (2026-11-27: "when I was saying sleek, I mean
// more narrow. Give me three more narrow options."). Once he picks one, the
// other two and this switch come out.
//
//   slim   56px: the glyph over its word, both smaller.
//   glyph  44px: the glyphs alone; a room's word shows beside it on hover.
//   word   52px: the words alone, a second, quieter rail.
//
// Pick one with ?manage=slim, ?manage=glyph or ?manage=word on any address;
// the choice is remembered in this browser.

export type ManageLook = 'slim' | 'glyph' | 'word';

const KEY = 'teajia_manage_look';
const LOOKS: readonly ManageLook[] = ['slim', 'glyph', 'word'];

/** How wide each look's column is, in rem. */
export const MANAGE_LOOK_WIDTH_REM: Record<ManageLook, number> = { slim: 3.5, glyph: 2.75, word: 3.25 };

function isLook(value: string | null | undefined): value is ManageLook {
  return !!value && (LOOKS as readonly string[]).includes(value);
}

/** The look for this browser: the address first, then the one picked last, then slim. */
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
  return 'slim';
}
