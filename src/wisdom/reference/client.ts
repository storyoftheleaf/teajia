import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicProducts } from '../../hooks/usePublicProducts';
import { buildGeneratedTeaReferenceCatalogue, buildTeaReferenceCatalogue } from './catalogue';
import type { WebsiteReceivingPublicTransport } from '../receiving/previewImporter';
import { TEA_REFERENCE_PREVIEW_ENABLED } from './previewMode';

export {
  ACTIVE_TEA_REFERENCE_ROUTE_PATHS,
  TEA_REFERENCE_PREVIEW_ENABLED,
  TEA_REFERENCE_ROUTE_PATHS,
  teaReferenceRoutePaths,
} from './previewMode';
export const TEA_REFERENCE_PREVIEW_QUERY_KEY = ['wisdom', 'tea-reference-preview'] as const;

async function fetchTeaReferencePreview(): Promise<WebsiteReceivingPublicTransport> {
  const response = await fetch('/__tea-reference-preview', {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Tea Reference preview could not be loaded.');

  const transport = await response.json() as WebsiteReceivingPublicTransport;
  if (
    transport?.manifest?.schemaVersion !== 1
    || transport.manifest.mode !== 'preview-only'
    || !transport.publicPreview
  ) {
    throw new Error('Tea Reference preview returned an unsupported public response.');
  }
  return transport;
}

/**
 * Joins the preview's public-only transport to the existing public storefront.
 * The raw handoff and receiving report never enter this module or the browser.
 */
export function useTeaReferenceCatalogue() {
  const previewQuery = useQuery({
    queryKey: TEA_REFERENCE_PREVIEW_QUERY_KEY,
    queryFn: fetchTeaReferencePreview,
    enabled: TEA_REFERENCE_PREVIEW_ENABLED,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const productsQuery = usePublicProducts();
  const products = productsQuery.data ?? [];
  const catalogue = useMemo(
    () => {
      if (!productsQuery.data) return null;
      if (previewQuery.data) return buildTeaReferenceCatalogue(previewQuery.data.publicPreview, products);
      return TEA_REFERENCE_PREVIEW_ENABLED ? null : buildGeneratedTeaReferenceCatalogue(products);
    },
    [previewQuery.data, productsQuery.data, products],
  );

  return {
    catalogue,
    products,
    isLoading: productsQuery.isPending || (TEA_REFERENCE_PREVIEW_ENABLED && previewQuery.isPending),
    isError: productsQuery.isError || (TEA_REFERENCE_PREVIEW_ENABLED && previewQuery.isError),
  };
}
