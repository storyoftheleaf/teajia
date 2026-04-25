import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useInventory } from '../../context/InventoryContext';
import { InventoryItem } from '../../types';

/**
 * ProductReferences — shared "quiet footnote" colophon primitive for
 * linking network-level content (Magazine articles, Learn modules,
 * Advise projects) to referenced teas. Renders nothing if there is
 * nothing to link.
 *
 * Editorial, not promotional:
 * - No buy buttons, no price, no CTAs
 * - Italic tea name, descriptor, small eyebrow label
 * - Single click into the /shop?product=<id> modal flow
 *
 * Two shapes:
 * - Hook `useProductReferences(...)` — headless, returns resolved
 *   `InventoryItem[]`. Use when the surrounding layout is custom.
 * - `<ProductReferences>` — full "colophon" layout (centered, bordered
 *   top rule, eyebrow label). Use for long-form editorial surfaces
 *   like the Reader bottom.
 */

export interface UseProductReferencesOptions {
  /** Unique stable id for the fetch — used as part of the react-query key */
  sourceId: string;
  /** React-query key namespace, e.g. `article-products`, `module-products` */
  queryKey: string;
  /** Function that returns a list of product objects with at least `{ id }` */
  fetcher: (sourceId: string) => Promise<Array<{ id: string }>>;
  /** Fallback product id(s) to use if the fetcher returns zero rows */
  fallbackIds?: string[];
}

/**
 * Headless hook — returns the resolved, deduped list of InventoryItems
 * for a given article/module/project id. Rendering is the caller's job.
 */
export function useProductReferences({
  sourceId,
  queryKey,
  fetcher,
  fallbackIds,
}: UseProductReferencesOptions): InventoryItem[] {
  const { inventory } = useInventory();

  const { data: fetched } = useQuery<Array<{ id: string }>>({
    queryKey: ['public-xref', queryKey, sourceId],
    queryFn: async () => {
      const result = await fetcher(sourceId);
      return Array.isArray(result) ? result : [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!sourceId,
  });

  return useMemo(() => {
    const ids: string[] = [];
    const fetchedIds = (fetched || [])
      .map(p => p.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (fetchedIds.length > 0) {
      ids.push(...fetchedIds);
    } else if (fallbackIds && fallbackIds.length > 0) {
      ids.push(...fallbackIds);
    }

    const seen = new Set<string>();
    const resolved: InventoryItem[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const item = inventory.find(p => p.id === id);
      if (item) resolved.push(item);
    }
    return resolved;
  }, [fetched, fallbackIds, inventory]);
}

export interface ProductReferencesProps extends UseProductReferencesOptions {
  /** Label shown above the list, e.g. "Teas in this piece" */
  label: string;
  /** Optional extra classes for the outer container */
  className?: string;
}

export const ProductReferences: React.FC<ProductReferencesProps> = ({
  label,
  className = '',
  ...options
}) => {
  const products = useProductReferences(options);
  if (products.length === 0) return null;

  return (
    <div className={`border-t border-tea-border pt-5 mt-8 max-w-xl mx-auto px-6 ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-tea-text-dim mb-3">
        {label}
      </p>
      <ul className="space-y-1.5">
        {products.map(product => {
          const descriptor = [product.type, product.origin, product.year]
            .filter(part => !!part && String(part).trim().length > 0)
            .join(' \u00b7 ');
          return (
            <li key={product.id}>
              <a
                href={`/shop?product=${encodeURIComponent(product.id)}`}
                onClick={e => e.stopPropagation()}
                className="group inline-flex flex-wrap items-baseline gap-x-2 font-serif text-[13px] leading-snug text-tea-text hover:text-tea-gold transition-colors"
              >
                <span className="italic">{product.name}</span>
                {descriptor && (
                  <>
                    <span className="text-tea-text-dim">&middot;</span>
                    <span className="not-italic text-tea-text-sec">{descriptor}</span>
                  </>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ProductReferences;
