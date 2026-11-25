import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCustomers } from '../../admin/hooks/useAdminData';
import { api, type ApiRequestInit } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';

/**
 * Vendor faces: one photo per vendor that Adrian can recognise them by.
 *
 * Adrian, 2026-11-23: "a lot of times maybe I don't know the vendor name or
 * the shop name, but I remember the face ... if I have to pick a vendor and
 * I'm not sure which one it is, I could select the vendors and it will show me
 * all their faces and I'll pick the one."
 *
 * The face lives on the vendor's customers row (`face_photo`, migration 0082)
 * beside the storefront and business-card photos. Where a vendor has no face
 * yet, the storefront stands in, then the business card, then the initials, so
 * every vendor still has something to look at.
 */

export interface VendorPhotoFields {
  face_photo?: string | null;
  storefront_photo?: string | null;
  business_card_photo?: string | null;
}

/** The picture to show for a vendor: their face, else the shop, else the card. */
export function vendorFacePhoto(vendor: VendorPhotoFields | null | undefined): string | undefined {
  if (!vendor) return undefined;
  return vendor.face_photo || vendor.storefront_photo || vendor.business_card_photo || undefined;
}

/** Two-letter initials for a vendor with no photo at all. */
export function vendorInitials(name: string | undefined): string {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join('').toUpperCase();
  return (Array.from(parts[0])[0] + Array.from(parts[parts.length - 1])[0]).toUpperCase();
}

/** One vendor as the face views need it. */
export interface FaceVendor {
  id?: string;
  name: string;
  company?: string;
  chineseName?: string;
  country?: string;
  /** What to show: face, storefront or business card. */
  photo?: string;
  /** True only when the photo is the vendor's own face. */
  hasFace: boolean;
}

export function toFaceVendor(row: VendorPhotoFields & {
  id?: string; name: string; company?: string | null; chinese_name?: string | null; country?: string | null;
}): FaceVendor {
  return {
    id: row.id,
    name: row.name,
    company: row.company || undefined,
    chineseName: row.chinese_name || undefined,
    country: row.country || undefined,
    photo: vendorFacePhoto(row),
    hasFace: !!row.face_photo,
  };
}

/** Narrow by anything Adrian might half-remember: name, shop, Chinese name, country. */
export function filterFaceVendors(vendors: FaceVendor[], query: string): FaceVendor[] {
  const q = query.trim().toLowerCase();
  if (!q) return vendors;
  return vendors.filter(v => [v.name, v.company, v.chineseName, v.country]
    .some(text => text?.toLowerCase().includes(q)));
}

/**
 * Faces first, so the ones that can be picked by sight are together at the top;
 * then the rest. Alphabetical inside each group, so a vendor is always in the
 * same place.
 */
export function orderFaceVendors(vendors: FaceVendor[]): { withPhoto: FaceVendor[]; withoutPhoto: FaceVendor[] } {
  const byName = (a: FaceVendor, b: FaceVendor) => a.name.localeCompare(b.name);
  return {
    withPhoto: vendors.filter(v => v.photo).sort(byName),
    withoutPhoto: vendors.filter(v => !v.photo).sort(byName),
  };
}

const isVendorRow = (tags: unknown) => {
  const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[,[\]"]+/) : [];
  return list.some(tag => String(tag).trim().toLowerCase() === 'vendor');
};

/** The shop's vendors, ready for a face grid. Shares the customers query. */
export function useFaceVendors(options?: { enabled?: boolean }) {
  const customers = useCustomers(options);
  const vendors = useMemo(() => (customers.data ?? [])
    .filter(c => isVendorRow(c.tags))
    .map(c => toFaceVendor(c as unknown as Parameters<typeof toFaceVendor>[0])), [customers.data]);
  return { vendors, isLoading: customers.isLoading, isError: customers.isError, refetch: customers.refetch };
}

/**
 * Upload a face and save it on the vendor. Squared and kept small: it is only
 * ever shown as a face, and vendor photos are often taken on a slow connection.
 * Returns the stored URL.
 */
export async function saveVendorFace(vendorId: string, file: File, expectedAuth?: ApiRequestInit['expectedAuth']): Promise<string> {
  const compressed = await compressImage(file, 800, 0.75, { square: true });
  const upload = new File([compressed], 'vendor-face.jpg', { type: 'image/jpeg' });
  const url = await api.uploadImage(upload, { filename: 'vendor-face.jpg', expectedAuth });
  if (!url) throw new Error('The photo upload returned no address.');
  await api.customers.update(vendorId, { face_photo: url }, expectedAuth);
  return url;
}

/** After a face is saved: every list and profile that shows the vendor refreshes. */
export function useRefreshVendorFaces() {
  const queryClient = useQueryClient();
  return (vendorId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['customers'] });
    if (vendorId) void queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] });
  };
}

/**
 * Placing faces (Adrian, 2026-11-25): "I'm going to upload a bunch of pictures
 * ... let's play a drag and drop game where I see them all on one page and I
 * drag one into another." The photos arrive already squared with the face in
 * the middle; Adrian drops the whole batch onto the Faces view, then drags (or
 * taps) each one onto its vendor.
 */
export interface LooseFace {
  key: string;
  file: File;
  /** Object URL for the preview; revoked when the face is placed or removed. */
  preview: string;
}

/** The words in a photo's file name, so "huang-wei-weeee36.jpg" reads "huang wei weeee36". */
export function fileNameWords(fileName: string): string[] {
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * The vendor a photo's file name points to, when it names exactly one: every
 * word of the vendor's name (or their Chinese name) appears in the file name.
 * Only a hint, shown as a ring on that vendor; Adrian still makes the match.
 */
export function suggestVendorForFile(fileName: string, vendors: FaceVendor[]): FaceVendor | undefined {
  const words = fileNameWords(fileName);
  if (words.length === 0) return undefined;
  const joined = words.join(' ');
  const named = vendors.filter(v => {
    if (v.chineseName && joined.includes(v.chineseName.toLowerCase())) return true;
    const nameWords = fileNameWords(v.name);
    return nameWords.length > 0 && nameWords.every(w => words.includes(w));
  });
  return named.length === 1 ? named[0] : undefined;
}

/** Put a face back the way it was (an undo), or clear it when there was none. */
export async function restoreVendorFace(vendorId: string, previous: string | null, expectedAuth?: ApiRequestInit['expectedAuth']): Promise<void> {
  await api.customers.update(vendorId, { face_photo: previous }, expectedAuth);
}
