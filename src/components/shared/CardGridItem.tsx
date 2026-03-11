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
      className="group relative break-inside-avoid md:hover:-translate-y-1 md:hover:shadow-lg md:transition-all md:duration-300"
    >
      <CardContainer className="p-2 md:p-3">
        {/* Image Container — clicking opens detail */}
        <div
          className="relative w-full overflow-hidden aspect-square bg-tea-elevated/90 mb-3 cursor-pointer"
          onClick={(e) => onCardClick(item, e)}
        >
          {imageComponent}
          {/* Mobile: persistent view hint */}
          <div className="lg:hidden absolute bottom-2 right-2 px-2.5 py-1 bg-tea-text/40 rounded-sm">
            <span className="text-[10px] uppercase tracking-widest text-tea-text/70 font-medium">
              View
            </span>
          </div>
          {/* Desktop: hover quick view overlay */}
          <div className="hidden lg:flex absolute inset-0 items-center justify-center bg-tea-text/0 group-hover:bg-tea-text/30 transition-all duration-300">
            <span className="text-xs uppercase tracking-[0.15em] text-tea-text font-medium px-4 py-2 bg-tea-gold/90 rounded-sm opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-lg">
              Quick View
            </span>
          </div>
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
          <div className="px-1 pt-2 mt-1 border-t border-tea-gold/[0.06]" onClick={(e) => e.stopPropagation()}>
            {sliderComponent}
          </div>
        )}
      </CardContainer>
    </div>
  );
};
