import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicProducts } from '../../hooks/usePublicProducts';
import { buildTeaReferenceCatalogue } from './catalogue';
import type { WebsiteReceivingPublicTransport } from '../receiving/previewImporter';

export const TEA_REFERENCE_PREVIEW_ENABLED = import.meta.env.MODE === 'tea-reference-preview';
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
    () => previewQuery.data && productsQuery.data
      ? buildTeaReferenceCatalogue(previewQuery.data.publicPreview, products)
      : null,
    [previewQuery.data, productsQuery.data, products],
  );

  return {
    catalogue,
    products,
    isLoading: previewQuery.isPending || productsQuery.isPending,
    isError: previewQuery.isError || productsQuery.isError,
  };
}
