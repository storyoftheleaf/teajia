/** People > Suppliers: rows or faces, remembered per browser. */
export type SourcesLayout = 'list' | 'faces';
export const LAYOUT_KEY = 'teajia.sources.layout';
/** `?layout=faces` opens the faces straight away (a link Adrian can tap), and is remembered. */
export const readLayout = (): SourcesLayout => {
  try {
    const asked = new URLSearchParams(window.location.search).get('layout');
    if (asked === 'faces' || asked === 'list') { localStorage.setItem(LAYOUT_KEY, asked); return asked; }
  } catch { /* fall through to the remembered choice */ }
  try { return localStorage.getItem(LAYOUT_KEY) === 'faces' ? 'faces' : 'list'; } catch { return 'list'; }
};
