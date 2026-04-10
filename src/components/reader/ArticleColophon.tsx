import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useInventory } from '../../context/InventoryContext';
import { InventoryItem } from '../../types';

interface ArticleColophonProps {
  articleId: string;
  fallbackTeaId?: string;
}

interface PublicXrefProduct {
  id: string;
}

const ArticleColophon: React.FC<ArticleColophonProps> = ({ articleId, fallbackTeaId }) => {
  const { inventory } = useInventory();

  // Use the public xref endpoint so unauthenticated Magazine readers
  // (the actual audience) see the colophon too.
  const { data: xrefProducts } = useQuery<PublicXrefProduct[]>({
    queryKey: ['public-xref', 'article-products', articleId],
    queryFn: async () => {
      const result = await api.publicXref.articles(articleId);
      return Array.isArray(result) ? result : [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!articleId,
  });

  const products: InventoryItem[] = useMemo(() => {
    const ids: string[] = [];
    const xrefIds = (xrefProducts || [])
      .map(p => p.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (xrefIds.length > 0) {
      ids.push(...xrefIds);
    } else if (fallbackTeaId) {
      ids.push(fallbackTeaId);
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
  }, [xrefProducts, fallbackTeaId, inventory]);

  if (products.length === 0) return null;

  return (
    <div className="border-t border-tea-border pt-5 mt-8 max-w-xl mx-auto px-6">
      <p className="text-[10px] uppercase tracking-[0.18em] text-tea-text-dim mb-3">
        Teas in this piece
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

export default ArticleColophon;
