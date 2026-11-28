import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { buildPublicProductHref, DEFAULT_PUBLIC_STORE_SLUG } from '../../lib/publicProductNavigation';
import type { DbArticle } from '../../types';

export type ArticleTeaReference = { id: string; name: string; detail: string; href: string };

export function normalizeArticleTeaReferences(rows: unknown): ArticleTeaReference[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const references: ArticleTeaReference[] = [];
  for (const value of rows) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = String(row.name ?? row.product_name ?? '').trim();
    if (!name) continue;
    const detail = [row.type, row.origin_region, row.origin, row.year]
      .filter(part => typeof part === 'string' && part.trim())
      .map(String)
      .filter((part, index, all) => all.indexOf(part) === index)
      .join(' · ');
    references.push({ id, name, detail, href: buildPublicProductHref(row) });
  }
  return references;
}

function productDestination(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin && !['https://teajia.com', 'https://www.teajia.com'].includes(url.origin)) return null;
    const match = url.pathname.match(/^\/shop\/product\/([^/]+)\/?$/);
    return match ? {
      address: decodeURIComponent(match[1]),
      store: url.searchParams.get('store')?.trim() || DEFAULT_PUBLIC_STORE_SLUG,
    } : null;
  } catch {
    return null;
  }
}

export function useArticleTeaReferences(article?: DbArticle, omitInlineTeas = false) {
  const { data } = useQuery({
    queryKey: ['public-xref', 'article-products', article?.id],
    queryFn: () => api.publicXref.articles(article!.id),
    enabled: article?.status === 'published' && !!article.id,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    if (article?.status !== 'published') return [];
    const references = normalizeArticleTeaReferences(data);
    if (!omitInlineTeas) return references;
    const inline = article.blocks.flatMap(block => {
      const destination = block.type === 'product_link' ? productDestination(block.href) : null;
      return destination ? [destination] : [];
    });
    if (inline.length === 0) return references;
    return references.filter(reference => {
      const destination = productDestination(reference.href);
      return !destination || !inline.some(link =>
        link.store === destination.store && (link.address === destination.address || link.address === reference.id));
    });
  }, [article, data, omitInlineTeas]);
}
