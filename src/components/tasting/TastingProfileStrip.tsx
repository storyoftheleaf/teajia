import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { resolveTermLabel, resolveTermIcon, TERM_MAP, LIQUOR_COLORS, TASTING_CATEGORY_ORDER } from '../../data/tastingTaxonomy';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';

interface TastingProfileStripProps {
  value: TastingData;
  onRemove: (categoryId: TastingCategoryId, termId: string) => void;
}

export const TastingProfileStrip: React.FC<TastingProfileStripProps> = ({ value, onRemove }) => {
  // Collect all terms across categories
  const allTerms: { categoryId: TastingCategoryId; termId: string }[] = [];
  for (const catId of TASTING_CATEGORY_ORDER) {
    const terms = value[catId];
    if (terms?.length) {
      for (const termId of terms) {
        allTerms.push({ categoryId: catId, termId });
      }
    }
  }

  if (allTerms.length === 0) return null;

  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1.5 pb-1 min-w-0">
        {allTerms.map(({ categoryId, termId }) => {
          const isColor = categoryId === 'liquor-color';
          const hex = isColor ? LIQUOR_COLORS[termId] : null;
          const Icon = !isColor ? resolveTermIcon(termId) : null;
          const label = resolveTermLabel(termId);

          return (
            <motion.button
              key={`${categoryId}-${termId}`}
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onRemove(categoryId, termId)}
              className="tag group shrink-0 cursor-pointer hover:bg-tea-gold/20 transition-colors"
            >
              {hex ? (
                <span
                  className="shrink-0 rounded-full"
                  style={{ width: 10, height: 10, background: hex, display: 'inline-block' }}
                />
              ) : Icon ? (
                <Icon size={11} className="shrink-0" />
              ) : null}
              <span>{label}</span>
              <X size={9} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity ml-0.5" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
