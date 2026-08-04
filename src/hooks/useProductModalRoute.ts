import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import type { InventoryItem } from '../types';

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
 * shop underneath — grid scroll and filter state survive untouched. Swipes
 * inside the modal replace the entry (background carried along), so one Back
 * always closes the modal. viewItem is derived from the URL instead of local
 * state, so back/forward can never desync and the old cold-deep-link
 * "back-button reopens the modal" trap is structurally impossible.
 */
export function useProductModalRoute(inventory: InventoryItem[]) {
  const location = useLocation();
  const navigate = useNavigate();

  const background = (location.state as BackgroundState | null)?.background;
  const match = PRODUCT_PATH_RE.exec(location.pathname);
  const productId = background && match ? decodeURIComponent(match[1]) : null;

  const viewItem = useMemo(
    () => (productId ? inventory.find(i => i.id === productId) ?? null : null),
    [productId, inventory],
  );

  /** Card tap — push the product URL with the current location as background. */
  const openProduct = useCallback(
    (item: InventoryItem) => {
      navigate(`/shop/product/${encodeURIComponent(item.id)}`, {
        state: { background: background ?? location },
      });
    },
    [navigate, background, location],
  );

  /** Swipe/arrow inside the modal — replace so Back still closes in one step. */
  const navigateWithinModal = useCallback(
    (item: InventoryItem) => {
      if (!background) return;
      navigate(`/shop/product/${encodeURIComponent(item.id)}`, {
        replace: true,
        state: { background },
      });
    },
    [navigate, background],
  );

  /**
   * Close — pop the history entry the open pushed (background case). Without
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
