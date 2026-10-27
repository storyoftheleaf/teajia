import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Product } from './types';

/** Routes whose content receives the admin shell's full product list.
 * Other screens own their queries (People, collections, tea pickers, etc.). */
export function adminShellNeedsProducts(pathname: string, overlays: {
  registry?: boolean; commandPalette?: boolean; createProduct?: boolean; importProducts?: boolean;
} = {}): boolean {
  return /^\/admin\/(stock|inventory|capture|activity|dashboard)\/?$/.test(pathname)
    || Object.values(overlays).some(Boolean);
}

/** Reconcile known rows only. A partial result must never become a complete
 * inventory, make old untouched rows fresh, or repopulate a logged-out cache. */
export function createProductReconciler(
  client: QueryClient,
  queryKey: QueryKey,
  readProduct: (id: string) => Promise<Product>,
  scopeIsCurrent: () => boolean,
) {
  const versions = new Map<string, number>();
  const query = () => client.getQueryCache().find({ queryKey, exact: true });
  return {
    async refresh(ids: readonly string[]): Promise<boolean> {
      const original = query();
      if (!original || !Array.isArray(original.state.data) || !scopeIsCurrent()) {
        await client.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
        return false;
      }
      const results = await Promise.all([...new Set(ids)].map(async id => {
        const version = (versions.get(id) ?? 0) + 1;
        versions.set(id, version);
        try {
          const row = await readProduct(id);
          if (row.id !== id) return { id, version, row: null, failed: true };
          return { id, version, row, failed: false };
        }
        catch (error) {
          if ((error as { status?: number })?.status === 404) return { id, version, row: null, failed: false };
          return { id, version, row: null, failed: true };
        }
      }));
      if (!scopeIsCurrent() || query() !== original) return false;
      const current = results.filter(result => versions.get(result.id) === result.version);
      if (current.length === 0) return true;
      // Cancel an older full-list request so it cannot overwrite this newer read.
      await client.cancelQueries({ queryKey, exact: true });
      if (!scopeIsCurrent() || query() !== original) return false;
      const updatedAt = original.state.dataUpdatedAt;
      const wasInvalidated = original.state.isInvalidated;
      client.setQueryData<Product[]>(queryKey, previous => {
        if (!previous) return previous;
        let next = previous;
        for (const result of current) {
          if (result.failed || versions.get(result.id) !== result.version) continue;
          if (result.row === null) next = next.filter(row => row.id !== result.id);
          else if (next.some(row => row.id === result.id)) next = next.map(row => row.id === result.id ? result.row! : row);
          else next = [result.row, ...next];
        }
        return next;
      }, { updatedAt });
      if (wasInvalidated || current.some(result => result.failed)) {
        await client.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
        return !current.some(result => result.failed);
      }
      return true;
    },
    async remove(id: string): Promise<void> {
      const original = query();
      versions.set(id, (versions.get(id) ?? 0) + 1);
      if (!original || !scopeIsCurrent()) return;
      await client.cancelQueries({ queryKey, exact: true });
      if (!scopeIsCurrent() || query() !== original) return;
      const wasInvalidated = original.state.isInvalidated;
      client.setQueryData<Product[]>(queryKey, rows => rows?.filter(row => row.id !== id), {
        updatedAt: original.state.dataUpdatedAt,
      });
      if (wasInvalidated) await client.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
    },
  };
}
