import React, { useState } from 'react';
import { mediaUrl } from '../../../lib/mediaUrl';

interface AlcoveGalleryProps {
  allImages: string[];
  onExpandImage: (url: string) => void;
  itemName?: string;
  layout?: 'card' | 'page';
  squarePage?: boolean;
}

export const AlcoveGallery: React.FC<AlcoveGalleryProps> = ({
  allImages,
  onExpandImage,
  itemName = '',
  layout = 'card',
  squarePage = false,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  if (allImages.length === 0) return null;

  const imageUrls = allImages.map(url => mediaUrl(url));

  const altFor = (i: number) =>
    i === 0
      ? itemName
      : itemName
        ? `${itemName}, view ${i + 1}`
        : '';

  if (layout === 'page' && squarePage) {
    const selectedIndex = selectedImage === null ? -1 : imageUrls.indexOf(selectedImage);
    const mobileIndex = Math.max(0, selectedIndex);

    return (
      <div className="alcove-gallery px-3 pt-3">
        <div role="group" aria-label="Product gallery" className="alcove-page-gallery-hero grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
          {imageUrls.map((url, index) => {
            const isDesktopHero = index < 2;
            const isMobileHero = index === mobileIndex;
            if (!isDesktopHero && !isMobileHero) return null;

            return (
              <button
                key={index}
                type="button"
                className={`alcove-thumb-btn-single !aspect-square !h-auto min-w-0 ${isMobileHero ? '' : '!hidden'} ${isDesktopHero ? 'md:!block' : 'md:!hidden'}`}
                onClick={() => onExpandImage(url)}
                aria-label={imageUrls.length === 1 && itemName
                  ? `View ${itemName} larger`
                  : `View ${itemName ? itemName + ' ' : ''}image ${index + 1} larger`}
              >
                <img src={url} alt={altFor(index)} loading="lazy" className="alcove-thumb-img !opacity-100" />
              </button>
            );
          })}
        </div>

        {imageUrls.length > 1 && (
          <div
            role="group"
            aria-label="Photo thumbnails"
            className={`alcove-page-gallery-thumbnails mt-3 flex flex-wrap justify-center gap-2 ${imageUrls.length <= 2 ? 'md:hidden' : ''}`}
          >
            {imageUrls.map((url, index) => (
              <button
                key={index}
                type="button"
                className={`alcove-thumb-btn !flex-none !w-[var(--space-12)] ${index < 2 ? 'md:hidden' : ''} ${index === mobileIndex ? 'ring-1 ring-tea-gold md:ring-0' : ''}`}
                aria-label={`View photo ${index + 1} of ${imageUrls.length}`}
                aria-current={index === mobileIndex || undefined}
                onClick={() => {
                  if (window.matchMedia('(min-width: 768px)').matches) onExpandImage(url);
                  else setSelectedImage(url);
                }}
              >
                <img src={url} alt="" loading="lazy" className="alcove-thumb-img !opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="alcove-gallery px-3 pt-3 flex-shrink-0">
      {imageUrls.length === 1 ? (
        <button
          type="button"
          onClick={() => onExpandImage(imageUrls[0])}
          aria-label={itemName ? `View ${itemName} larger` : 'View image larger'}
          className="alcove-thumb-btn-single"
          data-shop-frame={layout === 'page' ? 'page' : undefined}
        >
          <img
            src={imageUrls[0]}
            alt={altFor(0)}
            loading="lazy"
            className="alcove-thumb-img"
          />
        </button>
      ) : (
        <div role="group" aria-label="Product gallery" className="flex flex-wrap justify-center gap-1">
          {imageUrls.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onExpandImage(img)}
              aria-label={
                itemName ? `View ${itemName} image ${i + 1} larger` : `View image ${i + 1} larger`
              }
              className="alcove-thumb-btn"
            >
              <img src={img} alt={altFor(i)} loading="lazy" className="alcove-thumb-img" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
