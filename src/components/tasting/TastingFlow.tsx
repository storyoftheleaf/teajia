import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coffee, Palette, Leaf, Circle, Sparkles, Moon, Star,
  Undo2, Zap,
} from 'lucide-react';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import { SECTION_ICONS } from '../../data/tastingTaxonomy';
import { useTastingFlow } from './useTastingFlow';
import { FlavorZone } from './FlavorZone';
import { MouthfeelZone } from './MouthfeelZone';
import { FeelingCards } from './FeelingCards';
import { ColorSwatches } from './ColorSwatches';
import { BrewingZone } from './BrewingZone';
import { ImpressionZone } from './ImpressionZone';
import { TastingProfileStrip } from './TastingProfileStrip';

const FlavorWheel = React.lazy(() => import('./FlavorWheel'));
const RapidEntryMode = React.lazy(() => import('./RapidEntryMode'));

/* ─── Section definition ─── */

type SectionId = 'impression' | 'brewing' | 'liquor-color' | 'flavor' | 'mouthfeel' | 'feeling';

interface SectionDef {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  bgClass: string;
}

const ALL_SECTIONS: SectionDef[] = [
  { id: 'impression', label: 'Impression', icon: Star, bgClass: '' },
  { id: 'brewing', label: 'Brew', icon: Coffee, bgClass: 'tasting-section-bg-brewing' },
  { id: 'liquor-color', label: 'Color', icon: Palette, bgClass: 'tasting-section-bg-liquor-color' },
  { id: 'flavor', label: 'Flavor', icon: Leaf, bgClass: 'tasting-section-bg-flavor' },
  { id: 'mouthfeel', label: 'Mouthfeel', icon: Circle, bgClass: 'tasting-section-bg-body' },
  { id: 'feeling', label: 'Feel', icon: Moon, bgClass: 'tasting-section-bg-feeling' },
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
  const [showFlavorWheel, setShowFlavorWheel] = useState(false);
  const [showRapidEntry, setShowRapidEntry] = useState(false);
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const [pulsingTabId, setPulsingTabId] = useState<SectionId | null>(null);

  // Refs for swipe
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track previous canUndo to detect new undo opportunities
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

      // Only swipe if horizontal movement dominates
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
    // After 2s of inactivity, if current section has at least 1 selection, pulse the next tab
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
    // We intentionally track value changes to reset the timer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId, activeIdx, sections, value]);

  /* ─── Count helpers ─── */

  function getSectionCount(sectionId: SectionId): number {
    if (sectionId === 'mouthfeel') {
      return flow.getCategoryCount('body') + flow.getCategoryCount('finish');
    }
    if (sectionId === 'impression') {
      let count = 0;
      if (value.rating && value.rating > 0) count++;
      if (value.overallImpression) count++;
      return count;
    }
    return flow.getCategoryCount(sectionId as TastingCategoryId);
  }

  const handleRemoveTerm = (categoryId: TastingCategoryId, termId: string) => {
    flow.toggleTerm(categoryId, termId);
  };

  /* ─── Render section content ─── */

  function renderSectionContent(sectionId: SectionId) {
    switch (sectionId) {
      case 'impression':
        return <ImpressionZone value={value} onChange={onChange} />;
      case 'brewing':
        return <BrewingZone flow={flow} mode={mode} />;
      case 'liquor-color':
        return <ColorSwatches flow={flow} />;
      case 'flavor':
        return (
          <div className="flex flex-col gap-3">
            <FlavorZone flow={flow} teaType={teaType} mode={mode} />
            {/* Flavor wheel toggle */}
            <button
              type="button"
              onClick={() => setShowFlavorWheel(!showFlavorWheel)}
              className="self-center text-[11px] text-tea-text-dim hover:text-tea-gold transition-colors py-1 px-3"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {showFlavorWheel ? 'Hide flavor wheel' : 'Show flavor wheel'}
            </button>
            {showFlavorWheel && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-8 text-tea-text-dim text-xs">
                    Loading wheel...
                  </div>
                }
              >
                <FlavorWheel />
              </Suspense>
            )}
          </div>
        );
      case 'mouthfeel':
        return <MouthfeelZone flow={flow} mode={mode} />;
      case 'feeling':
        return <FeelingCards flow={flow} mode={mode} />;
      default:
        return null;
    }
  }

  /* ─── Active section def ─── */

  const activeSection = sections[activeIdx] || sections[0];

  return (
    <div className="flex flex-col gap-1">
      {/* Profile strip */}
      {flow.hasAnySelection && (
        <div className="mb-3">
          <TastingProfileStrip value={value} onRemove={handleRemoveTerm} />
        </div>
      )}

      {/* Admin rapid entry toggle */}
      {mode === 'admin' && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={() => setShowRapidEntry(!showRapidEntry)}
            className="flex items-center gap-1.5 text-[11px] text-tea-text-dim hover:text-tea-gold transition-colors px-2 py-1"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <Zap size={12} />
            {showRapidEntry ? 'Section view' : 'Rapid entry'}
          </button>
        </div>
      )}

      {/* Rapid entry mode (admin only) */}
      {showRapidEntry && mode === 'admin' ? (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12 text-tea-text-dim text-xs">
              Loading rapid entry...
            </div>
          }
        >
          <RapidEntryMode flow={flow} />
        </Suspense>
      ) : (
        /* ─── Desktop: two-pane / Mobile: tab + swipe ─── */
        <div className="md:grid md:grid-cols-[180px_1fr] md:gap-0">
          {/* ─── Tab bar ─── */}
          {/* Mobile: horizontal scroll tabs at top */}
          {/* Desktop: vertical left rail */}
          <nav
            className="flex md:flex-col overflow-x-auto md:overflow-x-visible hide-scrollbar gap-0.5 px-1 py-1.5 md:px-0 md:py-0 md:pr-3 md:border-r md:border-tea-border/30"
            role="tablist"
            aria-label="Tasting sections"
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
                  className={`relative flex items-center md:w-full gap-2 px-3 py-2 md:py-2.5 flex-shrink-0 rounded-md transition-all duration-150 ${
                    isActive
                      ? 'bg-tea-gold/10 text-tea-gold'
                      : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/50'
                  } ${isPulsing ? 'tasting-tab-pulse' : ''}`}
                  style={{ fontFamily: 'var(--font-display)', fontSize: '11px' }}
                >
                  <Icon size={15} strokeWidth={isActive ? 2 : 1.5} />
                  <span className="whitespace-nowrap hidden md:inline">{section.label}</span>
                  <span className="whitespace-nowrap md:hidden">{section.label}</span>

                  {/* Count indicator */}
                  {count > 0 && (
                    <span
                      className={`ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-bold px-1 ${
                        isActive
                          ? 'bg-tea-gold/20 text-tea-gold'
                          : 'bg-tea-surface text-tea-text-sec'
                      }`}
                    >
                      {count}
                    </span>
                  )}

                  {/* Active indicator — mobile bottom line, desktop left bar */}
                  {isActive && (
                    <motion.div
                      layoutId="tasting-section-indicator"
                      className="absolute md:left-0 md:top-1 md:bottom-1 md:w-[2px] md:h-auto bottom-0 left-2 right-2 h-[2px] md:rounded-r-full rounded-full bg-tea-gold"
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
            className="relative min-h-[280px] md:pl-4 pt-3 md:pt-0 overflow-hidden"
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
                className={`${activeSection.bgClass} rounded-lg p-1`}
              >
                {renderSectionContent(activeSection.id)}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ─── Undo toast ─── */}
      <AnimatePresence>
        {undoToastVisible && flow.canUndo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-tea-surface px-4 py-2.5 rounded-lg shadow-lg"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <button
              type="button"
              onClick={() => {
                flow.undo();
                setUndoToastVisible(false);
              }}
              className="flex items-center gap-1.5 text-tea-gold text-[12px] font-medium hover:text-tea-text transition-colors"
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
