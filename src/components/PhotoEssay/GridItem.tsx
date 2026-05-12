import React, { useState } from 'react';
import { GalleryItem } from '../../types';
import { Icons } from '../Icons';

interface GridItemProps {
  image: GalleryItem;
  index: number;
  onClick: () => void;
}

export const GridItem: React.FC<GridItemProps> = ({ image, index, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setAspectRatio(img.naturalWidth / img.naturalHeight);
    setIsLoaded(true);
  };

  return (
    <button
      onClick={onClick}
      style={isLoaded ? { aspectRatio: aspectRatio.toString() } : { aspectRatio: '1' }}
      className="group relative rounded-lg overflow-hidden bg-tea-text/5 transition-all duration-300 cursor-pointer w-full"
    >
      {/* Loading State */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-tea-text/10 animate-pulse" />
      )}

      {/* Image */}
      {!hasError ? (
        <img
          src={(image as any).thumbnailUrl || image.url}
          alt={image.caption || `Photo ${index + 1}`}
          loading="lazy"
          onLoad={handleImageLoad}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover  transition-transform duration-500 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-tea-text/10">
          <Icons.Image className="w-8 h-8 text-tea-text/30" />
        </div>
      )}
    </button>
  );
};
