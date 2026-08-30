import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import type { InventoryItem } from '../types';
import { buildPublicProductHref, findProductByRouteParam } from '../lib/publicProductNavigation';

/** Matches /shop/product/:id (one segment, no trailing slash). */
export const PRODUCT_PATH_RE = /^\/shop\/product\/([^/]+)$/;

interface BackgroundState {
  background?: Location;
}

/**
 * /shop/product/:id is one address with one rendering: the product page.
 *
 * It used to be two. A tap in the shop pushed the same URL with the current
 * location as `background` state, and App rendered a swipeable card over the
 * still-mounted grid; only a cold load got the real page. That meant the same
 * address showed two different designs depending on how you arrived at it, and
 * every improvement to the page was invisible to anyone who got there by
 * tapping, which is almost everyone. Adrian chose the page and accepted the
 * cost, which is the swipe between teas.
 *
 * openProduct now pushes without the background state, so nothing opens as a
 * modal. The `background` plumbing below is deliberately intact: it still
 * governs how Close behaves for any entry that carries one (history from
 * before this change, and the shared-collection surface), and viewItem still
 * derives from the URL rather than local state, so back and forward cannot
 * desync.
 */
export function useProductModalRoute(inventory: InventoryItem[], routeLocation?: Location) {
  const contextLocation = useLocation();
  // Routes rendered against a background location deliberately scope
  // useLocation() to /shop. App passes the actual router location so the
  // still-mounted ledger can see /shop/product/:id and open its modal.
  const location = routeLocation ?? contextLocation;
  const navigate = useNavigate();

  const background = (location.state as BackgroundState | null)?.background;
  const match = PRODUCT_PATH_RE.exec(location.pathname);
  // The segment may be the readable address or a legacy id; the resolver takes
  // either, so old links opened from history still find their tea.
  const productKey = background && match ? decodeURIComponent(match[1]) : null;

  const viewItem = useMemo(
    () => findProductByRouteParam(inventory, productKey ?? undefined),
    [productKey, inventory],
  );

  /** Card tap: push the product URL as a real navigation, no background. */
  const openProduct = useCallback(
    (item: InventoryItem) => {
      navigate(buildPublicProductHref({ id: item.id, slug: item.slug }));
    },
    [navigate],
  );

  /** Swipe/arrow inside the modal: replace so Back still closes in one step. */
  const navigateWithinModal = useCallback(
    (item: InventoryItem) => {
      if (!background) return;
      navigate(buildPublicProductHref({ id: item.id, slug: item.slug }), {
        replace: true,
        state: { background },
      });
    },
    [navigate, background],
  );

  /**
   * Close: pop the history entry the open pushed (background case). Without
   * a background entry there is no modal, only the real page; send the user
   * to the shop without leaving a dead product entry behind.
   */
  const closeProduct = useCallback(() => {
    if (background) {
      navigate(-1);
    } else {
      navigate('/shop', { replace: true });
    }
  }, [navigate, background]);

  return { viewItem, openProduct, navigateWithinModal, closeProduct };
}
