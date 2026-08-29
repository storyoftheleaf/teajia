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
 * One URL, two containers (the Instagram pattern): /shop/product/:id renders
 * as the AlcoveModal over the still-mounted shop when the navigation state
 * carries a `background` location, and as the standalone ProductPage on cold
 * loads (no background state).
 *
 * This hook is the modal side, used by the shop grid components. A card tap
 * calls openProduct(item), which pushes /shop/product/:id with
 * { state: { background: currentLocation } } so App.tsx keeps rendering the
 * shop underneath. Grid scroll and filter state survive untouched. Swipes
 * inside the modal replace the entry (background carried along), so one Back
 * always closes the modal. viewItem is derived from the URL instead of local
 * state, so back/forward can never desync and the old cold-deep-link
 * "back-button reopens the modal" trap is structurally impossible.
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

  /** Card tap: push the product URL with the current location as background. */
  const openProduct = useCallback(
    (item: InventoryItem) => {
      navigate(buildPublicProductHref({ id: item.id, slug: item.slug }), {
        state: { background: background ?? location },
      });
    },
    [navigate, background, location],
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
