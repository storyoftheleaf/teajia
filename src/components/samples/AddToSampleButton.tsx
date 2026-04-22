import React from 'react';
import { FlaskConical } from 'lucide-react';
import { useSampleCartStore } from '../../samples/sampleCartStore';
import type { SampleCartItem } from '../../samples/sampleCartStore';

interface AddToSampleButtonProps {
  item: Omit<SampleCartItem, 'grams'> & { grams?: number };
  /** 'icon' renders icon-only; 'labeled' renders icon + text */
  variant?: 'icon' | 'labeled';
  size?: number;
  className?: string;
}

export const AddToSampleButton: React.FC<AddToSampleButtonProps> = ({
  item,
  variant = 'icon',
  size = 14,
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
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
          inCart
            ? 'bg-tea-gold/15 text-tea-gold'
            : 'bg-tea-surface text-tea-text-sec hover:bg-tea-gold/10 hover:text-tea-gold'
        } ${className}`}
        title={inCart ? 'Remove from sample list' : 'Add to sample list'}
      >
        <FlaskConical size={size} />
        {inCart ? 'In Sample List' : 'Add to Sample'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`p-1.5 rounded-lg transition-colors ${
        inCart
          ? 'text-tea-gold bg-tea-gold/10'
          : 'text-tea-text-dim hover:text-tea-gold hover:bg-tea-gold/8'
      } ${className}`}
      title={inCart ? 'Remove from sample list' : 'Add to sample list'}
      aria-label={inCart ? 'Remove from sample list' : 'Add to sample list'}
    >
      <FlaskConical size={size} />
    </button>
  );
};

export default AddToSampleButton;
