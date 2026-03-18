import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';
import {
  resolveTermLabel,
  resolveTermIcon,
  TERM_MAP,
  LIQUOR_COLORS,
  TASTING_CATEGORY_ORDER,
} from '../../data/tastingTaxonomy';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';

interface TastingProfileStripProps {
  value: TastingData;
  onRemove: (categoryId: TastingCategoryId, termId: string) => void;
}

/** Category display labels - small uppercase */
const CATEGORY_LABELS: Record<string, string> = {
  flavor: 'FLAVOR',
  body: 'BODY',
  finish: 'FINISH',
  feeling: 'FEEL',
  'liquor-color': 'COLOR',
  brewing: 'BREW',
};

/** Category-specific tint classes for term backgrounds */
const CATEGORY_TINT_CLASSES: Record<string, string> = {
  flavor: 'bg-tea-gold/8',
  body: 'bg-tea-surface',
  finish: 'bg-tea-surface',
  feeling: 'bg-tea-accent-sub/30',
  'liquor-color': 'bg-tea-surface',
  brewing: 'bg-tea-elevated/50',
};

/** Maximum visible terms before collapsing */
const MAX_VISIBLE = 8;
const COLLAPSED_SHOW = 6;

const TastingProfileStripInner: React.FC<TastingProfileStripProps> = ({ value, onRemove }) => {
  const [expanded, setExpanded] = useState(false);

  // Group terms by category following the canonical order
  const groupedTerms = TASTING_CATEGORY_ORDER
    .map(catId => ({
      categoryId: catId,
      label: CATEGORY_LABELS[catId] || catId.toUpperCase(),
      tintClass: CATEGORY_TINT_CLASSES[catId] || 'bg-tea-surface',
      terms: value[catId] || [],
    }))
    .filter(g => g.terms.length > 0);

  // Total term count across all categories
  const totalTerms = groupedTerms.reduce((sum, g) => sum + g.terms.length, 0);

  if (totalTerms === 0) return null;

  // Determine if we need compact mode
  const needsCompact = totalTerms > MAX_VISIBLE && !expanded;

  // In compact mode, distribute the visible budget across groups
  let termsRemaining = COLLAPSED_SHOW;

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {groupedTerms.map(group => {
          // In compact mode, limit terms shown per group
          let visibleTerms = group.terms;
          if (needsCompact) {
            if (termsRemaining <= 0) return null;
            visibleTerms = group.terms.slice(0, termsRemaining);
            termsRemaining -= visibleTerms.length;
          }

          return (
            <motion.div
              key={group.categoryId}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              layout
            >
              {/* Tiny category label */}
              <div
                className="text-[9px] uppercase tracking-[0.15em] text-tea-text-dim font-medium mb-1 ml-0.5"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {group.label}
              </div>

              {/* Terms row with category-tinted backgrounds */}
              <div className="flex flex-wrap gap-1.5">
                <AnimatePresence mode="popLayout">
                  {visibleTerms.map(termId => {
                    const isColor = group.categoryId === 'liquor-color';
                    const hex = isColor ? LIQUOR_COLORS[termId] : null;
                    const Icon = !isColor ? resolveTermIcon(termId) : null;
                    const label = resolveTermLabel(termId);

                    return (
                      <motion.button
                        key={`${group.categoryId}-${termId}`}
                        type="button"
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={{ duration: 0.18 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onRemove(group.categoryId, termId)}
                        className={`tag group shrink-0 cursor-pointer hover:bg-tea-gold/20 transition-colors ${group.tintClass}`}
                      >
                        {hex ? (
                          <span
                            className="shrink-0 rounded-full"
                            style={{
                              width: 10,
                              height: 10,
                              background: hex,
                              display: 'inline-block',
                            }}
                          />
                        ) : Icon ? (
                          <Icon size={11} className="shrink-0" />
                        ) : null}
                        <span>{label}</span>
                        <X
                          size={9}
                          className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity ml-0.5"
                        />
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Expand / collapse toggle for compact mode */}
      {totalTerms > MAX_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Show fewer tasting notes' : `Show ${totalTerms - COLLAPSED_SHOW} more tasting notes`}
          className="flex items-center gap-1 text-[10px] text-tea-text-dim hover:text-tea-text-sec transition-colors mt-1 ml-0.5 min-h-[44px]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <span>
            {expanded ? 'Show less' : `+${totalTerms - COLLAPSED_SHOW} more`}
          </span>
          <ChevronDown
            size={10}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  );
};

export const TastingProfileStrip = React.memo(TastingProfileStripInner);
TastingProfileStrip.displayName = 'TastingProfileStrip';
