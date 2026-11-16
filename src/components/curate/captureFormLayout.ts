/** Order and look of the Source form. 'flow' (cards like the Library's,
 *  ordered by the sitting) is the default. 'classic' is the earlier form, kept
 *  reachable with `?form=classic` until the owner retires it. The same switch
 *  governs the Curate header rows and the Library card's photo thumbnail. */
export type CaptureFormLayout = 'classic' | 'flow';

/** The layout an address's query string asks for: 'classic' only when it says
 *  `form=classic`, otherwise 'flow'. Pure, so it can be tested directly. */
export function formLayoutFromSearch(search: string): CaptureFormLayout {
  return new URLSearchParams(search).get('form') === 'classic' ? 'classic' : 'flow';
}

/** The layout of the page being shown. */
export function layoutFromAddress(): CaptureFormLayout {
  if (typeof window === 'undefined') return 'flow';
  return formLayoutFromSearch(window.location.search);
}
