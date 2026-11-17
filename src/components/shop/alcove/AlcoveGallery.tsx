import React from 'react';
import { mediaUrl } from '../../../lib/mediaUrl';

interface AlcoveGalleryProps {
  allImages: string[];
  onExpandImage: (url: string) => void;
  itemName?: string;
  layout?: 'card' | 'page';
}

export const AlcoveGallery: React.FC<AlcoveGalleryProps> = ({
  allImages,
  onExpandImage,
  itemName = '',
  layout = 'card',
}) => {
  if (allImages.length === 0) return null;

  const imageUrls = allImages.map(url => mediaUrl(url));

  const altFor = (i: number) =>
    i === 0
      ? itemName
      : itemName
        ? `${itemName}, view ${i + 1}`
        : '';

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
