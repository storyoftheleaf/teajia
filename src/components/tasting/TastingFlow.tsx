import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Circle, Leaf, Wind, Moon,
  Undo2,
} from 'lucide-react';
import type { TastingData } from '../../types';
import { useTastingFlow } from './useTastingFlow';
import { BodyZone } from './BodyZone';
import { ThroatZone } from './ThroatZone';
import { FlavorSection } from './FlavorSection';
import { StateZone } from './StateZone';
import { VoiceNoteField } from './VoiceNoteField';

/* ─── Section definition (exported so TastingSession can render the tab bar) ─── */

export type SectionId = 'body' | 'throat' | 'flavor' | 'state';

export interface SectionDef {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

export const ALL_SECTIONS: SectionDef[] = [
  { id: 'body',   label: 'Body',   icon: Circle },
  { id: 'throat', label: 'Finish', icon: Wind },
  { id: 'flavor', label: 'Flavor', icon: Leaf },
  { id: 'state',  label: 'State',  icon: Moon },
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
  teaType?: string;
  /** When provided, section state is controlled by the parent (TastingSession).
   *  When omitted, TastingFlow manages section state internally (admin views). */
  activeSectionId?: SectionId;
  onSectionChange?: (id: SectionId) => void;
  /** Whether the note panel is open — controlled by parent when provided */
  showNote?: boolean;
  /** Incrementing signal to start recording — fires on every hold gesture */
  startNoteSignal?: number;
  /** Incrementing signal from parent to stop recording (on pointer release) */
  stopNoteSignal?: number;
  /** Expose section counts back to parent for badge rendering */
  onCountsChange?: (counts: Record<SectionId, number>) => void;
}

export const TastingFlow: React.FC<TastingFlowProps> = ({
  value,
  onChange,
  teaType,
  activeSectionId: controlledSectionId,
  onSectionChange: onControlledSectionChange,
  showNote = false,
  startNoteSignal = 0,
  stopNoteSignal = 0,
  onCountsChange,
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

  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const prevCanUndo = useRef(flow.canUndo);

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
          return flow.getCategoryCount('body') + flow.getCategoryCount('liquor-color');
        case 'throat':
          return (
            flow.getCategoryCount('finish') +
            (value.cleanliness ? 1 : 0) +
            (value.huiGan ? 1 : 0)
          );
        case 'flavor':
          return flow.getCategoryCount('flavor');
        case 'state':
          return (
            flow.getCategoryCount('feeling') +
            (value.clarity ? 1 : 0) +
            (value.quality != null ? 1 : 0)
          );
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
      body:   getSectionCount('body'),
      throat: getSectionCount('throat'),
      flavor: getSectionCount('flavor'),
      state:  getSectionCount('state'),
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

  /* ─── Undo toast ─── */

  useEffect(() => {
    if (flow.canUndo && !prevCanUndo.current) {
      setUndoToastVisible(true);
      const timer = setTimeout(() => setUndoToastVisible(false), 3000);
      return () => clearTimeout(timer);
    }
    prevCanUndo.current = flow.canUndo;
  }, [flow.canUndo]);

  /* ─── Section content renderer ─── */

  function renderSectionContent(sectionId: SectionId) {
    switch (sectionId) {
      case 'body':
        return <BodyZone flow={flow} />;
      case 'throat':
        return <ThroatZone flow={flow} value={value} onChange={onChange} />;
      case 'flavor':
        return <FlavorSection flow={flow} value={value} onChange={onChange} teaType={teaType} />;
      case 'state':
        return <StateZone flow={flow} value={value} onChange={onChange} />;
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
            {showNote ? (
              <motion.div
                key="notes-panel"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="px-3 py-4"
              >
                <VoiceNoteField
                  values={value.notes || []}
                  onChange={(notes) => onChange({ ...value, notes: notes.length ? notes : undefined })}
                  startSignal={startNoteSignal}
                  stopSignal={stopNoteSignal}
                />
              </motion.div>
            ) : (
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
                {renderSectionContent(activeSection.id)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Undo toast */}
      <AnimatePresence>
        {undoToastVisible && flow.canUndo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-40 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-tea-surface px-4 py-2.5 rounded-lg shadow-lg"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <button
              type="button"
              onClick={() => { flow.undo(); setUndoToastVisible(false); }}
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
