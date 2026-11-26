import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authPagePath, authReturnTo } from '../../lib/authNavigation';
import { isYourTablePath, yourTablePageOpen } from '../../lib/yourTablePage';
import { historyIndex } from '../../admin/components/adminHistory';
import type { PanelView } from './types';

export { YOUR_TABLE_PATHS } from '../../lib/yourTablePage';

/**
 * Your Table as a page (YOUR_TABLE_PAGE_OPEN, Launch 4 K8), as the app shell
 * sees it. Open, the glyph and every "open Your Table" go to its address
 * instead of laying the overlay over the page, and leaving it is simply going
 * back. Closed (`open` false), the shell skips all of this and the overlay
 * opens exactly as before.
 */
export function useYourTablePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const open = yourTablePageOpen();
  const onPage = open && isYourTablePath(location.pathname);

  /** Go to Your Table, or to one of its views, as a step in the address. */
  const openPage = (view?: PanelView) => {
    if (view === 'signin' || view === 'signup') {
      navigate(authPagePath(view, authReturnTo(`${location.pathname}${location.search}${location.hash}`)));
      return;
    }
    const path =
      view === 'journal' ? '/account/journal' :
      view === 'cellar' ? '/account/cellar' :
      view === 'events' ? '/account/sessions' :
      view === 'location-switcher' ? '/account/tea-houses' :
      '/account';
    if (location.pathname !== path) navigate(path);
  };

  /** Leave the page: back when there is somewhere to go back to, else home. */
  const leave = () => {
    if (historyIndex() > 0) navigate(-1);
    else navigate('/');
  };

  /** The glyph on the phone's bar: open the page, or leave it when on it. */
  const toggle = () => (onPage ? leave() : openPage());

  // For listeners registered once: always the current answers.
  const ref = useRef({ open, openPage });
  ref.current = { open, openPage };

  return { open, onPage, openPage, leave, toggle, ref };
}
