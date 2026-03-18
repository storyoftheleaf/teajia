import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import { SECTION_ICONS } from '../../data/tastingTaxonomy';

const LABEL_MAP: Record<TastingCategoryId, string> = {
  'brewing': 'Brew',
  'liquor-color': 'Color',
  'flavor': 'Flavor',
  'body': 'Body',
  'finish': 'Finish',
  'feeling': 'Feel',
};

interface SectionTabsProps {
  sections: TastingCategoryId[];
  activeSection: TastingCategoryId;
  onSectionChange: (section: TastingCategoryId) => void;
  getCategoryCount: (categoryId: TastingCategoryId) => number;
}

export const SectionTabs: React.FC<SectionTabsProps> = ({
  sections,
  activeSection,
  onSectionChange,
  getCategoryCount,
}) => {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view when it changes
  useEffect(() => {
    const activeEl = tabRefs.current.get(activeSection);
    if (activeEl && scrollRef.current) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeSection]);

  return (
    <div
      ref={scrollRef}
      className="tasting-tab-bar flex overflow-x-auto hide-scrollbar gap-1 px-2 py-1.5"
      role="tablist"
      aria-label="Tasting sections"
    >
      {sections.map((sectionId) => {
        const isActive = sectionId === activeSection;
        const count = getCategoryCount(sectionId);
        const Icon = SECTION_ICONS[sectionId];
        const label = LABEL_MAP[sectionId] ?? sectionId;

        return (
          <button
            key={sectionId}
            ref={(el) => {
              if (el) tabRefs.current.set(sectionId, el);
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSectionChange(sectionId)}
            className={`tasting-tab relative flex flex-col items-center gap-1 px-3 py-2 flex-shrink-0 transition-colors duration-150 ${
              isActive ? 'tasting-tab-active text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'
            }`}
            style={{ fontFamily: 'var(--font-display)', fontSize: '11px' }}
          >
            {/* Icon */}
            {Icon && <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />}

            {/* Label */}
            <span className="whitespace-nowrap">{label}</span>

            {/* Count badge */}
            {count > 0 && (
              <span className="tasting-tab-count absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-tea-gold/20 text-tea-gold text-[9px] font-bold px-1">
                {count}
              </span>
            )}

            {/* Gold dot for tabs with selections */}
            <span
              className={`tasting-tab-dot w-1 h-1 rounded-full bg-tea-gold transition-opacity duration-200 ${
                count > 0 && !isActive ? 'tasting-tab-dot-visible opacity-100' : 'opacity-0'
              }`}
            />

            {/* Animated underline indicator */}
            {isActive && (
              <motion.div
                layoutId="tasting-tab-indicator"
                className="absolute bottom-0 left-2 right-2 h-[2px] bg-tea-gold rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
