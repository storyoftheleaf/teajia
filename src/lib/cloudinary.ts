/**
 * Cloudinary image utility
 *
 * Provides URL-based transformations for any image hosted on Cloudinary.
 * Non-Cloudinary URLs are returned unchanged so existing images keep working.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';

/** Standard transformation presets */
export const CLD_PRESETS = {
  /** Product card thumbnail — 400w, auto quality */
  thumb: 'w_400,c_fill,q_auto,f_auto',
  /** Product card — 600w */
  card: 'w_600,c_fill,q_auto,f_auto',
  /** Full-width hero / feature — 1200w */
  hero: 'w_1200,c_fill,q_auto,f_auto',
  /** Gallery / lightbox — 1600w, high quality */
  gallery: 'w_1600,c_limit,q_auto:best,f_auto',
  /** Tiny placeholder for blur-up — 30w, low quality */
  placeholder: 'w_30,q_auto:low,f_auto,e_blur:800',
} as const;

export type CldPreset = keyof typeof CLD_PRESETS;

/**
 * Build a Cloudinary delivery URL with transformations.
 *
 * @param publicId  The Cloudinary public ID (e.g. "teajia/products/oolong-01")
 * @param preset    A named preset or a raw transformation string
 * @returns         Full Cloudinary URL, or the original string if not a Cloudinary image
 */
export function cldUrl(
  publicId: string | undefined,
  preset: CldPreset | string = 'card'
): string {
  if (!publicId) return '';

  // Already a full URL — check if it's a Cloudinary URL we can transform
  if (publicId.startsWith('http')) {
    return transformCloudinaryUrl(publicId, preset);
  }

  if (!CLOUD_NAME) return publicId;

  const transforms = CLD_PRESETS[preset as CldPreset] ?? preset;
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${publicId}`;
}

/**
 * If a full URL is already a Cloudinary URL, insert transformations.
 * Otherwise return the URL unchanged.
 */
function transformCloudinaryUrl(url: string, preset: CldPreset | string): string {
  if (!CLOUD_NAME) return url;

  // Match: https://res.cloudinary.com/<cloud>/image/upload/<existing-transforms?>/<public-id>
  const cloudinaryPattern = new RegExp(
    `(https://res\\.cloudinary\\.com/${CLOUD_NAME}/image/upload/)(.+)`
  );
  const match = url.match(cloudinaryPattern);
  if (!match) return url;

  const base = match[1];
  const rest = match[2];
  const transforms = CLD_PRESETS[preset as CldPreset] ?? preset;

  // Strip any existing transformation segment (starts with a known param like w_, c_, q_, f_, e_)
  const hasTransforms = /^[a-z]_/.test(rest);
  const publicId = hasTransforms ? rest.replace(/^[^/]+\//, '') : rest;

  return `${base}${transforms}/${publicId}`;
}

/**
 * Generate a Cloudinary upload URL for direct browser uploads (unsigned).
 * Requires an unsigned upload preset configured in your Cloudinary dashboard.
 */
export function cldUploadUrl(): string {
  if (!CLOUD_NAME) return '';
  return `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
}

/**
 * Upload a file directly to Cloudinary from the browser (unsigned upload).
 *
 * @param file          The file to upload
 * @param uploadPreset  The unsigned upload preset name from Cloudinary dashboard
 * @param folder        Target folder (e.g. "teajia/products")
 * @returns             The uploaded image's public_id and secure_url
 */
export async function cldUpload(
  file: File,
  uploadPreset: string,
  folder = 'teajia'
): Promise<{ publicId: string; url: string }> {
  const url = cldUploadUrl();
  if (!url) throw new Error('Cloudinary cloud name not configured');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.statusText}`);

  const data = await res.json();
  return {
    publicId: data.public_id,
    url: data.secure_url,
  };
}
