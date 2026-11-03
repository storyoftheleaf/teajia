import type { Product } from '../../../types';
export type PhotoSlot = 'main' | '1' | '2';
type PhotoProduct = Pick<Product, 'imageUrl' | 'additionalImages'>;
export function firstPhotoSlot(product: PhotoProduct): PhotoSlot | null {
  if (!product.imageUrl?.trim()) return 'main';
  if (!product.additionalImages?.[0]?.trim()) return '1';
  if (!product.additionalImages?.[1]?.trim()) return '2';
  return null;
}
export function photoFieldUpdate(product: PhotoProduct, slot: PhotoSlot, url: string): { field: 'imageUrl' | 'additionalImages'; value: string | string[] } {
  if (slot === 'main') return { field: 'imageUrl', value: url };
  const images = [...(product.additionalImages || [])];
  images[Number(slot) - 1] = url;
  return { field: 'additionalImages', value: images };
}
