import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Circle, Leaf, Moon, Palette,
  X,
} from 'lucide-react';
import type { TastingData } from '../../types';
import { useTastingFlow } from './useTastingFlow';
import { BodyZone } from './BodyZone';
import { ThroatZone } from './ThroatZone';
import { StateZone } from './StateZone';
import { FlavorSplit } from './FlavorSplit';
import { AppearanceZone } from './AppearanceZone';

/* ─── Section definition (exported so TastingSession can render the tab bar) ─── */

export type SectionId = 'body' | 'state' | 'flavor' | 'appearance';

export interface SectionDef {
  id: SectionId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

export const ALL_SECTIONS: SectionDef[] = [
  { id: 'body',       label: 'Body',   subtitle: 'How does it feel in your mouth?',    icon: Circle },
  { id: 'state',      label: 'Effect', subtitle: 'What did the tea do to you?',        icon: Moon },
  { id: 'flavor',     label: 'Flavor', subtitle: 'What do you taste?',                 icon: Leaf },
  { id: 'appearance', label: 'Look',   subtitle: 'What does the liquor look like?',    icon: Palette },
];

/* ─── Transition variants ─── */

const sectionVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

const sectionTransition = {
  x: { type: 'spring' as const, stiffness: 260, damping: 28, mass: 0.8 },
  opacity: { duration: 0.12 },
};

/* ─── Props ─── */

interface TastingFlowProps {
  mode: 'admin' | 'customer';
  value: TastingData;
  onChange: (data: TastingData) => void;
  /** When provided, section state is controlled by the parent (TastingSession).
   *  When omitted, TastingFlow manages section state internally (admin views). */
  activeSectionId?: SectionId;
  onSectionChange?: (id: SectionId) => void;
  /** Expose section counts back to parent for badge rendering */
  onCountsChange?: (counts: Record<SectionId, number>) => void;
  /** Hides advanced terms for first-time users */
  simplified?: boolean;
  /** Tea type used to highlight likely flavor families */
  teaType?: string;
}

export const TastingFlow: React.FC<TastingFlowProps> = ({
  value,
  onChange,
  activeSectionId: controlledSectionId,
  onSectionChange: onControlledSectionChange,
  onCountsChange,
  simplified = false,
  teaType,
}) => {
  // Uncontrolled fallback — used when admin views don't provide activeSectionId
  const [internalSectionId, setInternalSectionId] = useState<SectionId>('body');
  const activeSectionId = controlledSectionId ?? internalSectionId;
  const onSectionChange = (id: SectionId) => {
    setInternalSectionId(id);
    onControlledSectionChange?.(id);
  };
  const flow = useTastingFlow(value, onChange);
  const sections = ALL_SECTIONS;

  // Track direction for slide animation internally
  const prevSectionRef = useRef<SectionId>(activeSectionId);
  const [[direction, animKey], setAnimState] = useState<[number, number]>([0, 0]);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeIdx = sections.findIndex((s) => s.id === activeSectionId);

  /* ─── Sync animation direction when controlled section changes ─── */

  useEffect(() => {
    if (prevSectionRef.current !== activeSectionId) {
      const prevIdx = sections.findIndex((s) => s.id === prevSectionRef.current);
      const newIdx = sections.findIndex((s) => s.id === activeSectionId);
      setAnimState([newIdx > prevIdx ? 1 : -1, Date.now()]);
      prevSectionRef.current = activeSectionId;
    }
  }, [activeSectionId, sections]);

  /* ─── Count helpers ─── */

  const getSectionCount = useCallback(
    (sectionId: SectionId): number => {
      switch (sectionId) {
        case 'body':
          return (
            flow.getCategoryCount('body') +
            flow.getCategoryCount('finish') +
            (value.cleanliness ? 1 : 0) +
            (value.huiGan ? 1 : 0)
          );
        case 'state':
          return (
            flow.getCategoryCount('feeling') +
            (value.quality != null ? 1 : 0)
          );
        case 'flavor':
          return flow.getCategoryCount('flavor');
        case 'appearance':
          return flow.getCategoryCount('liquor-color') + (value.clarity ? 1 : 0);
        default:
          return 0;
      }
    },
    [flow, value]
  );

  // Push counts to parent whenever they change
  useEffect(() => {
    if (!onCountsChange) return;
    onCountsChange({
      body:       getSectionCount('body'),
      state:      getSectionCount('state'),
      flavor:     getSectionCount('flavor'),
      appearance: getSectionCount('appearance'),
    });
  }, [getSectionCount, onCountsChange]);

  /* ─── Swipe ─── */

  const goNext = useCallback(() => {
    if (activeIdx < sections.length - 1) onSectionChange(sections[activeIdx + 1].id);
  }, [activeIdx, sections, onSectionChange]);

  const goPrev = useCallback(() => {
    if (activeIdx > 0) onSectionChange(sections[activeIdx - 1].id);
  }, [activeIdx, sections, onSectionChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) goNext();
        else goPrev();
      }
    },
    [goNext, goPrev]
  );


  /* ─── Section content renderer ─── */

  function renderSectionContent(sectionId: SectionId) {
    switch (sectionId) {
      case 'body':
        return (
          <>
            <BodyZone flow={flow} value={value} onChange={onChange} />
            <div className="divider-warm my-3" />
            <ThroatZone flow={flow} value={value} onChange={onChange} simplified={simplified} />
          </>
        );
      case 'state':
        return <StateZone flow={flow} value={value} onChange={onChange} />;
      case 'flavor': {
        const flavorCount = flow.getCategoryCount('flavor');
        return (
          <div role="group" aria-label="Flavor and taste">
            <div className="flex justify-end mb-1 -mt-1">
              <button
                type="button"
                onClick={() => flow.clearCategory('flavor')}
                className={`text-[11px] text-tea-text-dim hover:text-tea-text-sec transition-colors flex items-center gap-1 px-2 py-1 ${flavorCount > 0 ? 'visible' : 'invisible'}`}
                aria-label="Clear flavor selections"
                tabIndex={flavorCount > 0 ? 0 : -1}
              >
                <X size={10} />
                Clear
              </button>
            </div>
            <FlavorSplit
              selected={value.flavor || []}
              onToggle={(termId) => flow.toggleTerm('flavor', termId)}
              teaType={teaType}
            />
          </div>
        );
      }
      case 'appearance':
        return <AppearanceZone flow={flow} value={value} onChange={onChange} />;
      default:
        return null;
    }
  }

  const activeSection = sections[activeIdx] || sections[0];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">

        {/* Section content — full width, tabs live in TastingSession's bottom bar */}
        <div
          ref={contentRef}
          className="relative overflow-x-hidden overflow-y-auto h-full tasting-scroll"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={activeSection.id + animKey}
              custom={direction}
              variants={sectionVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={sectionTransition}
              className="px-4 pb-4 pt-3"
            >
              <p
                className="text-[11px] text-tea-text-dim italic mb-3"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {activeSection.subtitle}
              </p>
              {renderSectionContent(activeSection.id)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
};
