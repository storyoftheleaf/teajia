import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { InventoryItem } from '../types';

/**
 * Syncs the currently-viewed product modal with the URL search param `?product=ID`.
 *
 * - When a product modal opens, pushes `?product=<id>` onto the URL.
 * - When the modal closes, removes the param (via browser back or explicit close).
 * - On initial load, if `?product=<id>` is present, returns that item so the
 *   caller can auto-open it.
 *
 * Uses `history.pushState` for opens and `history.back()` for closes so that
 * the browser back button naturally closes the modal without leaving the page.
 */
export function useProductUrl(
  inventory: InventoryItem[],
  viewItem: InventoryItem | null,
  setViewItem: (item: InventoryItem | null) => void,
) {
  const [searchParams] = useSearchParams();
  const productParam = searchParams.get('product');
  const isModalNavRef = useRef(false);

  // On mount / param change: if ?product=ID is in the URL and no modal is open, open it
  useEffect(() => {
    if (productParam && !viewItem) {
      const found = inventory.find(i => i.id === productParam);
      if (found) {
        setViewItem(found);
      }
    }
    // Only react to productParam and inventory changes, not viewItem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productParam, inventory]);

  // When viewItem changes, update URL state.
  useEffect(() => {
    if (viewItem) {
      const currentParam = new URLSearchParams(window.location.search).get('product');
      if (currentParam !== viewItem.id) {
        const url = new URL(window.location.href);
        url.searchParams.set('product', viewItem.id);
        if (isModalNavRef.current) {
          // Navigating within modal (arrows/swipe), replace so back closes
          window.history.replaceState({ productModal: viewItem.id }, '', url.toString());
        } else {
          // Opening a card fresh, push so back button can close
          window.history.pushState({ productModal: viewItem.id }, '', url.toString());
        }
        isModalNavRef.current = false;
      }
    }
    // We intentionally only track viewItem here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewItem?.id]);

  // Listen for popstate (browser back/forward) to close/reopen modal
  useEffect(() => {
    const handlePopState = () => {
      const param = new URLSearchParams(window.location.search).get('product');
      if (param) {
        const found = inventory.find(i => i.id === param);
        if (found) {
          setViewItem(found);
        } else {
          setViewItem(null);
        }
      } else {
        // No product param, close modal
        if (viewItem) {
          setViewItem(null);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory, viewItem]);

  // Close handler: go back in history instead of just removing the param
  const closeWithHistory = useCallback(() => {
    const currentParam = new URLSearchParams(window.location.search).get('product');
    if (currentParam) {
      window.history.back();
    } else {
      setViewItem(null);
    }
  }, [setViewItem]);

  // Navigate within modal, replaces history instead of pushing
  const navigateWithinModal = useCallback((item: InventoryItem) => {
    isModalNavRef.current = true;
    setViewItem(item);
  }, [setViewItem]);

  return { closeWithHistory, navigateWithinModal };
}
