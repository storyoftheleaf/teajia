import React from 'react';
import { TeaItem } from '../TeaInventory';
import { CardContainer } from './CardContainer';

interface CardGridItemProps {
  item: TeaItem;
  onCardClick: (item: TeaItem, e: React.MouseEvent) => void;
  imageComponent: React.ReactNode;
  badgesComponent?: React.ReactNode;
  priceDisplay: React.ReactNode;
  descriptionComponent?: React.ReactNode;
  sliderComponent?: React.ReactNode;
  title: string;
}

/**
 * Unified grid card component for both Tea and Teaware
 * Provides consistent styling and structure across both item types
 * Parent components control content via props
 */
export const CardGridItem: React.FC<CardGridItemProps> = ({
  item,
  onCardClick,
  imageComponent,
  badgesComponent,
  priceDisplay,
  descriptionComponent,
  sliderComponent,
  title,
}) => {
  return (
    <div
      className="group relative break-inside-avoid md:transition-all md:duration-300"
    >
      <CardContainer className="p-2 md:p-3">
        {/* Image Container — clicking opens detail */}
        <div
          className="relative w-full overflow-hidden aspect-square bg-tea-elevated/90 mb-3 cursor-pointer"
          onClick={(e) => onCardClick(item, e)}
        >
          {imageComponent}
          {/* Desktop: hover overlay */}
          <div className="hidden lg:block absolute inset-0 bg-tea-text/0 group-hover:bg-tea-text/10 transition-all duration-300 pointer-events-none" />
        </div>

        {/* Info Section — clicking opens detail */}
        <div className="px-1 cursor-pointer" onClick={(e) => onCardClick(item, e)}>
          {/* Title and Price Row */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-1 mb-1.5">
            <h4 className="card-grid-title">{title}</h4>
            <div className="card-grid-price">{priceDisplay}</div>
          </div>

          {/* Badges/Metadata */}
          {badgesComponent && <div className="mb-2">{badgesComponent}</div>}

          {/* Description */}
          {descriptionComponent && descriptionComponent}
        </div>

        {/* Slider strip — always visible below card content */}
        {sliderComponent && (
          <div className="px-1 pt-2 mt-1 border-t border-tea-border" onClick={(e) => e.stopPropagation()}>
            {sliderComponent}
          </div>
        )}
      </CardContainer>
    </div>
  );
};
