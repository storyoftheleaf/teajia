import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Leaf, Sparkles, Star, Heart,
  Undo2,
} from 'lucide-react';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import { useTastingFlow } from './useTastingFlow';
import { FlavorZone } from './FlavorZone';
import { FeelZone } from './FeelZone';
import { ExperienceZone } from './ExperienceZone';
import { ColorSwatches } from './ColorSwatches';
import { ImpressionZone } from './ImpressionZone';

/* ─── Section definition ─── */

type SectionId = 'impression' | 'liquor-color' | 'flavor' | 'feel' | 'experience';

interface SectionDef {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  bgClass: string;
}

const ALL_SECTIONS: SectionDef[] = [
  { id: 'impression', label: 'Impression', icon: Star, bgClass: '' },
  { id: 'liquor-color', label: 'Color', icon: Palette, bgClass: 'tasting-section-bg-liquor-color' },
  { id: 'flavor', label: 'Flavor', icon: Leaf, bgClass: 'tasting-section-bg-flavor' },
  { id: 'feel', label: 'Feel', icon: Sparkles, bgClass: 'tasting-section-bg-feeling' },
  { id: 'experience', label: 'Experience', icon: Heart, bgClass: '' },
];

/* ─── Transition variants ─── */

const sectionVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
};

const sectionTransition = {
  x: { type: 'spring' as const, stiffness: 350, damping: 30 },
  opacity: { duration: 0.2 },
};

/* ─── Props ─── */

interface TastingFlowProps {
  mode: 'admin' | 'customer';
  value: TastingData;
  onChange: (data: TastingData) => void;
  teaType?: string;
}

export const TastingFlow: React.FC<TastingFlowProps> = ({ mode, value, onChange, teaType }) => {
  const flow = useTastingFlow(value, onChange);

  // Filter sections based on mode — impression only for customer
  const sections = ALL_SECTIONS.filter(
    (s) => s.id !== 'impression' || mode === 'customer'
  );

  const [activeSectionId, setActiveSectionId] = useState<SectionId>(sections[0].id);
  const [[direction, animKey], setDirection] = useState<[number, number]>([0, 0]);
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const [pulsingTabId, setPulsingTabId] = useState<SectionId | null>(null);

  // Refs for swipe
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const prevCanUndo = useRef(flow.canUndo);

  const activeIdx = sections.findIndex((s) => s.id === activeSectionId);

  /* ─── Navigation ─── */

  const goToSection = useCallback(
    (sectionId: SectionId) => {
      const newIdx = sections.findIndex((s) => s.id === sectionId);
      const oldIdx = sections.findIndex((s) => s.id === activeSectionId);
      const dir = newIdx > oldIdx ? 1 : -1;
      setDirection([dir, Date.now()]);
      setActiveSectionId(sectionId);
    },
    [sections, activeSectionId]
  );

  const goNext = useCallback(() => {
    if (activeIdx < sections.length - 1) {
      goToSection(sections[activeIdx + 1].id);
    }
  }, [activeIdx, sections, goToSection]);

  const goPrev = useCallback(() => {
    if (activeIdx > 0) {
      goToSection(sections[activeIdx - 1].id);
    }
  }, [activeIdx, sections, goToSection]);

  /* ─── Swipe gestures ─── */

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

  /* ─── Undo toast ─── */

  useEffect(() => {
    if (flow.canUndo && !prevCanUndo.current) {
      setUndoToastVisible(true);
      const timer = setTimeout(() => setUndoToastVisible(false), 3000);
      return () => clearTimeout(timer);
    }
    prevCanUndo.current = flow.canUndo;
  }, [flow.canUndo]);

  /* ─── Auto-advance pulse ─── */

  useEffect(() => {
    const count = getSectionCount(activeSectionId);
    if (count === 0 || activeIdx >= sections.length - 1) {
      setPulsingTabId(null);
      return;
    }

    const timer = setTimeout(() => {
      setPulsingTabId(sections[activeIdx + 1].id);
    }, 2000);

    return () => {
      clearTimeout(timer);
      setPulsingTabId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId, activeIdx, sections, value]);

  /* ─── Count helpers ─── */

  function getSectionCount(sectionId: SectionId): number {
    if (sectionId === 'feel') {
      return flow.getCategoryCount('body') + flow.getCategoryCount('finish');
    }
    if (sectionId === 'experience') {
      return flow.getCategoryCount('feeling');
    }
    if (sectionId === 'impression') {
      let count = 0;
      if (value.rating && value.rating > 0) count++;
      if (value.overallImpression) count++;
      return count;
    }
    return flow.getCategoryCount(sectionId as TastingCategoryId);
  }

  function getTotalCount(): number {
    return sections.reduce((sum, s) => sum + getSectionCount(s.id), 0);
  }

  /* ─── Render section content ─── */

  function renderSectionContent(sectionId: SectionId) {
    switch (sectionId) {
      case 'impression':
        return <ImpressionZone value={value} onChange={onChange} />;
      case 'liquor-color':
        return <ColorSwatches flow={flow} />;
      case 'flavor':
        return <FlavorZone flow={flow} teaType={teaType} mode={mode} />;
      case 'feel':
        return <FeelZone flow={flow} mode={mode} />;
      case 'experience':
        return <ExperienceZone flow={flow} />;
      default:
        return null;
    }
  }

  /* ─── Active section def ─── */

  const activeSection = sections[activeIdx] || sections[0];
  const totalSelections = getTotalCount();

  return (
    <div className="flex flex-col gap-1 h-full">
      {/* ─── Tab bar ─── */}
      <div className="md:grid md:grid-cols-[180px_1fr] md:gap-0 flex-1 min-h-0">
        <nav
          className="flex md:flex-col overflow-x-auto md:overflow-x-visible hide-scrollbar gap-0.5 px-1 py-1 md:px-0 md:py-0 md:pr-4 md:border-r md:border-tea-border shrink-0"
          role="tablist"
          aria-label="Tasting sections"
          onKeyDown={(e) => {
            const isHorizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
            const isVertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
            if (!isHorizontal && !isVertical) return;
            e.preventDefault();
            const goForward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
            const nextIdx = goForward
              ? Math.min(activeIdx + 1, sections.length - 1)
              : Math.max(activeIdx - 1, 0);
            if (nextIdx !== activeIdx) {
              goToSection(sections[nextIdx].id);
              // Move focus to the newly active tab
              const nav = e.currentTarget;
              const buttons = nav.querySelectorAll<HTMLButtonElement>('[role="tab"]');
              buttons[nextIdx]?.focus();
            }
          }}
        >
          {sections.map((section) => {
            const isActive = section.id === activeSectionId;
            const count = getSectionCount(section.id);
            const isPulsing = pulsingTabId === section.id;
            const Icon = section.icon;

            return (
              <button
                key={section.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => goToSection(section.id)}
                className={`relative flex items-center justify-center md:justify-start md:w-full gap-1.5 md:gap-2 px-2.5 md:px-3 py-2 md:py-3 min-h-[44px] min-w-[56px] flex-shrink-0 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'text-tea-gold'
                    : 'text-tea-text-dim hover:text-tea-text-sec active:text-tea-text-sec'
                } ${isPulsing ? 'tasting-tab-pulse' : ''}`}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '13px',
                  letterSpacing: '0.04em',
                  background: isActive
                    ? 'radial-gradient(ellipse 100% 80% at 50% 30%, rgb(var(--tea-gold-rgb) / 0.08) 0%, transparent 70%)'
                    : 'transparent',
                }}
              >
                <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                <span className="whitespace-nowrap text-[13px] md:text-[13px]">{section.label}</span>

                {count > 0 && (
                  <span
                    className={`ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1 ${
                      isActive
                        ? 'bg-tea-gold/20 text-tea-gold'
                        : 'bg-tea-surface text-tea-text-sec'
                    }`}
                  >
                    {count}
                  </span>
                )}

                {isActive && (
                  <motion.div
                    layoutId="tasting-section-indicator"
                    className="absolute md:left-0 md:top-1.5 md:bottom-1.5 md:w-[2px] md:h-auto bottom-0 left-2 right-2 h-[2px] md:rounded-r-full rounded-full"
                    style={{
                      background: 'linear-gradient(180deg, rgb(var(--tea-gold-rgb) / 0.6), rgb(var(--tea-gold-rgb) / 0.3))',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* ─── Section content ─── */}
        <div
          ref={contentRef}
          className="relative min-h-[280px] md:pl-5 pt-3 md:pt-0 overflow-x-hidden overflow-y-auto flex-1"
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
              className={`${activeSection.bgClass} rounded-lg px-1 py-1`}
            >
              {renderSectionContent(activeSection.id)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Undo toast ─── */}
      <AnimatePresence>
        {undoToastVisible && flow.canUndo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-tea-surface px-4 py-2.5 rounded-lg shadow-lg"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <button
              type="button"
              onClick={() => {
                flow.undo();
                setUndoToastVisible(false);
              }}
              className="flex items-center gap-1.5 text-tea-gold text-[13px] font-medium hover:text-tea-text transition-colors"
            >
              <Undo2 size={14} />
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
