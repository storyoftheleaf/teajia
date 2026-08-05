import React from 'react';

interface AlcoveGalleryProps {
  allImages: string[];
  onExpandImage: (url: string) => void;
  itemName?: string;
}

export const AlcoveGallery: React.FC<AlcoveGalleryProps> = ({
  allImages,
  onExpandImage,
  itemName = '',
}) => {
  if (allImages.length === 0) return null;

  const altFor = (i: number) =>
    i === 0
      ? itemName
      : itemName
        ? `${itemName}, view ${i + 1}`
        : '';

  return (
    <div className="alcove-gallery px-3 pt-3 flex-shrink-0">
      {allImages.length === 1 ? (
        <button
          type="button"
          onClick={() => onExpandImage(allImages[0])}
          aria-label={itemName ? `View ${itemName} larger` : 'View image larger'}
          className="alcove-thumb-btn-single"
        >
          <img
            src={allImages[0]}
            alt={altFor(0)}
            loading="lazy"
            className="alcove-thumb-img"
          />
        </button>
      ) : (
        <div role="group" aria-label="Product gallery" className="flex flex-wrap justify-center gap-1">
          {allImages.map((img, i) => (
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
