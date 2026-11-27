import { useEffect } from 'react';

const SITE_TITLE = 'Teajia · A Home for Tea';

/**
 * Names the browser tab for as long as the page shows. App names the tab by
 * its section after a page mounts (and again when the section settles), which
 * overwrote page titles such as "Page not found" and "The Tea Table"; this
 * holds the page's own title against those later writes. Leaving, the tab
 * falls back to the site's name until the next page or section names itself.
 */
export function useHeldTitle(title: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const hold = () => { if (document.title !== title) document.title = title; };
    hold();
    const head = document.querySelector('head');
    const watcher = typeof MutationObserver === 'undefined' || !head ? null : new MutationObserver(hold);
    watcher?.observe(head as Node, { subtree: true, childList: true, characterData: true });
    return () => {
      watcher?.disconnect();
      if (document.title === title) document.title = SITE_TITLE;
    };
  }, [title]);
}
