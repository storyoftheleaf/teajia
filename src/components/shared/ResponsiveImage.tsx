import React, { useState } from 'react';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  fallback?: React.ReactNode;
  /** Cloudflare Image Resizing widths to generate srcset */
  widths?: number[];
}

/**
 * Responsive image component with srcset generation for Cloudflare Image Resizing.
 *
 * When images are served from Cloudflare, this generates optimized srcset entries.
 * For external URLs (picsum, unsplash, etc.) it falls back to a single src.
 */
export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  className = '',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  loading = 'lazy',
  fallback,
  widths = [320, 640, 960, 1280],
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  // Generate srcset for Cloudflare Image Resizing URLs
  const isCloudflare = src.includes('.workers.dev') || src.includes('.pages.dev') || src.includes('teajia.');
  const srcSet = isCloudflare
    ? widths.map((w) => `${src}?width=${w}&format=auto ${w}w`).join(', ')
    : undefined;

  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setHasError(true)}
    />
  );
};
