// Three looks for the Manage column beside the rail, for Adrian to choose
// from. All three are his porcelain tiles, attached to the rail and made
// sleeker (2026-11-27: "do porcelain. Can we attach it to the side somehow?
// And make it more sleek? Three more options."). Once he picks one, the
// other two and this switch come out.
//
//   docked    the porcelain card, its flat side against the rail.
//   flush     a full-height porcelain leaf joined to the rail.
//   seamless  the rail itself grown wider, no seam between them.
//
// Pick one with ?manage=docked, ?manage=flush or ?manage=seamless on any
// address; the choice is remembered in this browser.

export type ManageLook = 'docked' | 'flush' | 'seamless';

const KEY = 'teajia_manage_look';
const LOOKS: readonly ManageLook[] = ['docked', 'flush', 'seamless'];

/** How wide each look's column is, in rem. */
export const MANAGE_LOOK_WIDTH_REM: Record<ManageLook, number> = { docked: 4.75, flush: 4.5, seamless: 4.5 };

function isLook(value: string | null | undefined): value is ManageLook {
  return !!value && (LOOKS as readonly string[]).includes(value);
}

/** The look for this browser: the address first, then the one picked last, then docked. */
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
  return 'docked';
}
