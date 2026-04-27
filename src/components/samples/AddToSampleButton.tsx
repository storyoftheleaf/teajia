import React from 'react';
import { useSampleCartStore } from '../../samples/sampleCartStore';
import type { SampleCartItem } from '../../samples/sampleCartStore';

interface AddToSampleButtonProps {
  item: Omit<SampleCartItem, 'grams'> & { grams?: number };
  /** 'icon' and 'labeled' both render text-only; kept for API compatibility */
  variant?: 'icon' | 'labeled';
  size?: number;
  className?: string;
}

export const AddToSampleButton: React.FC<AddToSampleButtonProps> = ({
  item,
  variant = 'icon',
  className = '',
}) => {
  const inCart = useSampleCartStore((s) => s.items.some((i) => i.id === item.id));
  const addItem = useSampleCartStore((s) => s.addItem);
  const removeItem = useSampleCartStore((s) => s.removeItem);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inCart) {
      removeItem(item.id);
    } else {
      addItem(item);
    }
  };

  if (variant === 'labeled') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`px-3 py-1.5 rounded-lg text-ui-12 font-medium transition-colors ${
          inCart
            ? 'bg-tea-gold/15 text-tea-gold'
            : 'bg-tea-surface text-tea-text-sec hover:bg-tea-gold/10 hover:text-tea-gold'
        } ${className}`}
        title={inCart ? 'Remove from sample pack' : 'Add to sample pack'}
      >
        {inCart ? 'In Sample Pack' : 'Sample'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`text-ui-10 uppercase tracking-[0.08em] transition-colors ${
        inCart
          ? 'text-tea-gold'
          : 'text-tea-text-sec hover:text-tea-gold'
      } ${className}`}
      title={inCart ? 'Remove from sample pack' : 'Add to sample pack'}
      aria-label={inCart ? 'Remove from sample pack' : 'Add to sample pack'}
    >
      {inCart ? 'In Pack' : 'Sample'}
    </button>
  );
};

export default AddToSampleButton;
