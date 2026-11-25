import { useCallback, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { Product } from '../../types';
import { withParam } from './helpers';

/**
 * Stock's open record, kept in the address (?panel=) so the browser's back
 * closes it and forward reopens it (Adrian, 2026-11-25: back did nothing in the
 * admin; CLAUDE.md, "Back and forward").
 *
 * Opening is a new history entry; stepping to the next or previous record
 * replaces it; closing a record opened here steps back off that entry rather
 * than stacking a second copy of the list. The snapshot covers a record the
 * list has not caught up with yet, such as one just created. Linked panels
 * resolve against the current store's product list.
 */
export function usePanelInAddress(products: Product[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state: navigationState } = useLocation();
  const navigate = useNavigate();
  const panelParam = searchParams.get('panel') || '';
  const [selected, setSelected] = useState<Product | null>(null);
  const panelProduct = panelParam
    ? products.find(product => product.id === panelParam) ?? (selected?.id === panelParam ? selected : null)
    : null;
  const panelOpenedHere = Boolean((navigationState as { panelOpenedHere?: boolean } | null)?.panelOpenedHere);
  const setPanelProduct = useCallback((product: Product | null) => {
    setSelected(product);
    if (!product && !panelParam) return;
    if (!product && panelOpenedHere) { navigate(-1); return; }
    const baseState = navigationState && typeof navigationState === 'object' ? navigationState as Record<string, unknown> : {};
    if (product && !panelParam) {
      setSearchParams(previous => withParam(previous, 'panel', product.id), { state: { ...baseState, panelOpenedHere: true } });
      return;
    }
    if (product?.id === panelParam) return;
    setSearchParams(previous => withParam(previous, 'panel', product?.id ?? null), { replace: true, state: navigationState }); // history: refine (next / previous record)
  }, [panelParam, panelOpenedHere, navigationState, navigate, setSearchParams]);
  return { panelProduct, setPanelProduct, setSelectedPanelProduct: setSelected };
}
