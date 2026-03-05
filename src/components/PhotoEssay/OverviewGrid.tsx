import React from 'react';
import { GalleryItem } from '../../types';
import { GridItem } from './GridItem';

interface OverviewGridProps {
  images: GalleryItem[];
  onImageClick: (index: number) => void;
}

export const OverviewGrid: React.FC<OverviewGridProps> = ({ images, onImageClick }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10">
      {images.map((image, index) => (
        <GridItem
          key={index}
          image={image}
          index={index}
          onClick={() => onImageClick(index)}
        />
      ))}
    </div>
  );
};
