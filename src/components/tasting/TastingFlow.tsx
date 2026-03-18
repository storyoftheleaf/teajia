import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Leaf, Sparkles, Star, Heart,
  Undo2, Zap,
} from 'lucide-react';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import { useTastingFlow } from './useTastingFlow';
import { FlavorZone } from './FlavorZone';
import { FeelZone } from './FeelZone';
import { ExperienceZone } from './ExperienceZone';
import { ColorSwatches } from './ColorSwatches';
import { ImpressionZone } from './ImpressionZone';
import { TastingProfileStrip } from './TastingProfileStrip';

/* ─── Props ─── */

interface TastingFlowProps {
  mode: 'admin' | 'customer';
  value: TastingData;
  onChange: (data: TastingData) => void;
  teaType?: string;
}

export const TastingFlow: React.FC<TastingFlowProps> = ({ mode, value, onChange, teaType }) => {
  const flow = useTastingFlow(value, onChange);

  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const prevCanUndo = useRef(flow.canUndo);

  /* ─── Undo toast ─── */

  useEffect(() => {
    if (flow.canUndo && !prevCanUndo.current) {
      setUndoToastVisible(true);
      const timer = setTimeout(() => setUndoToastVisible(false), 3000);
      return () => clearTimeout(timer);
    }
    prevCanUndo.current = flow.canUndo;
  }, [flow.canUndo]);

  const handleRemoveTerm = (categoryId: TastingCategoryId, termId: string) => {
    flow.toggleTerm(categoryId, termId);
  };

  /* ─── Section header helper ─── */

  const SectionHeader = ({ icon: Icon, label, count }: { icon: React.ComponentType<any>; label: string; count: number }) => (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} strokeWidth={1.8} className="text-tea-gold/70" />
      <span
        className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec font-medium"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {label}
      </span>
      {count > 0 && (
        <span className="min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-bold bg-tea-gold/15 text-tea-gold px-1">
          {count}
        </span>
      )}
    </div>
  );

  const colorCount = flow.getCategoryCount('liquor-color' as TastingCategoryId);
  const flavorCount = flow.getCategoryCount('flavor' as TastingCategoryId);
  const feelCount = flow.getCategoryCount('body') + flow.getCategoryCount('finish');
  const experienceCount = flow.getCategoryCount('feeling');

  return (
    <div className="flex flex-col gap-0">
      {/* Profile strip — compact summary at top */}
      {flow.hasAnySelection && (
        <div className="mb-3">
          <TastingProfileStrip value={value} onRemove={handleRemoveTerm} />
        </div>
      )}

      {/* Customer impression (customer mode only) */}
      {mode === 'customer' && (
        <div className="mb-4">
          <SectionHeader icon={Star} label="Impression" count={value.rating ? 1 : 0} />
          <ImpressionZone value={value} onChange={onChange} />
        </div>
      )}

      {/* ── Color ── */}
      <div className="mb-4">
        <SectionHeader icon={Palette} label="Color" count={colorCount} />
        <div className="tasting-section-bg-liquor-color rounded-lg px-1 py-1">
          <ColorSwatches flow={flow} />
        </div>
      </div>

      <div className="divider-warm my-1" />

      {/* ── Flavor ── */}
      <div className="mb-4 pt-3">
        <SectionHeader icon={Leaf} label="Flavor" count={flavorCount} />
        <div className="tasting-section-bg-flavor rounded-lg px-1 py-1">
          <FlavorZone flow={flow} teaType={teaType} mode={mode} />
        </div>
      </div>

      <div className="divider-warm my-1" />

      {/* ── Feel (Weight, Texture, Finish) ── */}
      <div className="mb-4 pt-3">
        <SectionHeader icon={Sparkles} label="Feel" count={feelCount} />
        <div className="tasting-section-bg-feeling rounded-lg px-1 py-1">
          <FeelZone flow={flow} mode={mode} />
        </div>
      </div>

      <div className="divider-warm my-1" />

      {/* ── Experience (formerly State of Mind) ── */}
      <div className="mb-2 pt-3">
        <SectionHeader icon={Heart} label="Experience" count={experienceCount} />
        <div className="rounded-lg px-1 py-1">
          <ExperienceZone flow={flow} />
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
