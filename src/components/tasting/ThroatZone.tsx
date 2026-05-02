import React from 'react';
import { motion } from 'framer-motion';
import { X, Wind, ArrowDown, Droplets } from 'lucide-react';
import type { TastingFlowState } from './useTastingFlow';
import type { TastingData } from '../../types';

type Cleanliness = 'clean' | 'some-edge' | 'rough';

const PASSAGE_OPTIONS: { id: Cleanliness; label: string; sub: string }[] = [
  { id: 'clean',     label: 'Smooth',  sub: 'glides clean' },
  { id: 'some-edge', label: 'Slight edge', sub: 'faint roughness' },
  { id: 'rough',     label: 'Rough',   sub: 'scratchy, harsh' },
];

const FINISH_DURATIONS = [
  { id: 'finish-short',  label: 'Short' },
  { id: 'finish-medium', label: 'Medium' },
  { id: 'lingering',     label: 'Lingering' },
] as const;

const FINISH_CHARACTER = [
  { id: 'finish-dry',     label: 'Dry',     hint: 'A drying sensation at the back of the mouth — like strong black tea or unripe fruit.' },
  { id: 'finish-bitter',  label: 'Bitter',  hint: 'A distinct bitterness that settles in the throat after swallowing.' },
  { id: 'finish-cooling', label: 'Cooling', hint: 'A minty or camphor coolness — common in aged puer and high-mountain oolongs.' },
  { id: 'finish-warming', label: 'Warming', hint: 'A gentle heat that spreads from the throat down into the chest.' },
] as const;

const THROAT_TERMS: { id: string; label: string; sub: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'throat-opening', label: 'Opens up',     sub: 'throat relaxes and expands',       icon: Wind },
  { id: 'throat-depth',   label: 'Chest reach',  sub: 'sensation travels into the chest', icon: ArrowDown },
  { id: 'salivating',     label: 'Salivates',    sub: '生津 · saliva rises in the mouth', icon: Droplets },
];

const SELECTED_BG = 'radial-gradient(ellipse 100% 100% at 50% 50%, rgb(var(--tea-gold-rgb) / 0.28) 0%, rgb(var(--tea-gold-rgb) / 0.10) 70%)';

/* ── Chinese concept toggle — single tap row ── */

interface ChineseConceptToggleProps {
  character: string;
  pinyin: string;
  english: string;
  active: boolean;
  onToggle: () => void;
}

const ChineseConceptToggle: React.FC<ChineseConceptToggleProps> = ({
  character, pinyin, english, active, onToggle,
}) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.98 }}
    onClick={onToggle}
    aria-pressed={active}
    className={`flex items-center gap-3 w-full text-left py-2.5 px-3 rounded-lg transition-colors duration-200 min-h-[44px] ${
      active ? 'bg-tea-gold/10' : 'bg-tea-surface hover:bg-tea-elevated'
    }`}
  >
    <span
      className={`shrink-0 text-ui-20 leading-none w-6 text-center transition-all duration-200 ${active ? 'text-tea-gold' : 'text-tea-text-dim'}`}
      style={{ fontFamily: 'serif', opacity: active ? 0.85 : 0.28 }}
      aria-hidden
    >
      {character}
    </span>
    <div className="flex-1 min-w-0">
      <span
        className={`text-ui-13 font-medium transition-colors duration-200 ${active ? 'text-tea-gold' : 'text-tea-text'}`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {pinyin}
      </span>
      <span className="text-ui-12 text-tea-text-sec ml-2" style={{ fontFamily: 'var(--font-body)' }}>
        {english}
      </span>
    </div>
    {active && (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="shrink-0 w-[6px] h-[6px] rounded-full bg-tea-gold"
      />
    )}
  </motion.button>
);

interface ThroatZoneProps {
  flow: TastingFlowState;
  value: TastingData;
  onChange: (data: TastingData) => void;
  simplified?: boolean;
}

const ThroatZoneInner: React.FC<ThroatZoneProps> = ({ flow, value, onChange, simplified = false }) => {
  const finishSelected = flow.value.finish || [];
  const selectedDuration = FINISH_DURATIONS.find(d => finishSelected.includes(d.id))?.id ?? null;
  const [lastSelectedFinishChar, setLastSelectedFinishChar] = React.useState<string | null>(null);
  const lastFinishHint = FINISH_CHARACTER.find(
    c => c.id === lastSelectedFinishChar && finishSelected.includes(c.id)
  )?.hint;

  const totalCount =
    THROAT_TERMS.filter(t => finishSelected.includes(t.id)).length +
    finishSelected.filter(id =>
      FINISH_DURATIONS.some(d => d.id === id) || FINISH_CHARACTER.some(c => c.id === id)
    ).length +
    (value.cleanliness ? 1 : 0) +
    (value.qi ? 1 : 0) +
    (value.yun ? 1 : 0) +
    (value.huiGan ? 1 : 0) +
    (value.tangGan ? 1 : 0);

  const toggleDuration = (id: string) => {
    if (selectedDuration === id) {
      flow.toggleTerm('finish', id);
    } else {
      if (selectedDuration) flow.toggleTerm('finish', selectedDuration);
      flow.toggleTerm('finish', id);
    }
  };

  const setPassage = (v: Cleanliness) => {
    onChange({ ...value, cleanliness: value.cleanliness === v ? undefined : v });
  };

  const handleClearAll = () => {
    for (const id of [...finishSelected]) flow.toggleTerm('finish', id);
    if (value.cleanliness || value.qi || value.yun || value.huiGan || value.tangGan) {
      onChange({ ...value, cleanliness: undefined, qi: false, yun: false, huiGan: false, tangGan: false });
    }
  };

  return (
    <div role="group" aria-label="Finish and throat sensation">
      <div className="flex justify-end mb-1 -mt-1">
        <motion.button
          type="button"
          onClick={handleClearAll}
          animate={{ opacity: totalCount > 0 ? 1 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ pointerEvents: totalCount > 0 ? 'auto' : 'none' }}
          className="text-ui-11 text-tea-text-dim hover:text-tea-text-sec transition-colors flex items-center gap-1 px-2 py-1"
          aria-label="Clear all finish selections"
        >
          <X size={10} />
          Clear
        </motion.button>
      </div>

      {/* ── Finish ── */}
      <div className="mb-4">
        <div className="mb-3">
          <div
            className="text-ui-12 uppercase tracking-[0.12em] text-tea-text-sec font-semibold"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Finish
          </div>
          <p className="text-ui-13 text-tea-text-sec mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
            How long does the flavor linger, and what quality does it leave?
          </p>
        </div>

        <div
          className="text-ui-11 uppercase tracking-widest text-tea-text-sec font-semibold mb-1.5"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Duration
        </div>
        <div className="tasting-segment-toggle mb-3" role="radiogroup" aria-label="Finish duration">
          {FINISH_DURATIONS.map((d, i) => {
            const isSel = selectedDuration === d.id;
            return (
              <motion.button
                key={d.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => toggleDuration(d.id)}
                role="radio"
                aria-checked={isSel}
                className={`flex-1 py-2.5 transition-all duration-200 min-h-[44px] relative z-[1] ${
                  isSel
                    ? 'text-tea-gold font-semibold text-ui-15'
                    : 'text-tea-text-sec hover:text-tea-text font-medium text-ui-15'
                }${i < FINISH_DURATIONS.length - 1 ? ' weight-seg-div' : ''}`}
                style={{
                  fontFamily: 'var(--font-body)',
                  background: isSel ? SELECTED_BG : 'transparent',
                }}
              >
                {d.label}
              </motion.button>
            );
          })}
        </div>

        <div
          className="text-ui-11 uppercase tracking-widest text-tea-text-sec font-semibold mb-1.5"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Character
        </div>
        <div className="grid grid-cols-2 gap-2">
          {FINISH_CHARACTER.map(term => {
            const isSelected = finishSelected.includes(term.id);
            return (
              <motion.button
                key={term.id}
                type="button"
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={() => {
                  flow.toggleTerm('finish', term.id);
                  if (!isSelected) setLastSelectedFinishChar(term.id);
                  else if (lastSelectedFinishChar === term.id) setLastSelectedFinishChar(null);
                }}
                aria-pressed={isSelected}
                className={`tag-selectable w-full justify-center text-ui-14 ${isSelected ? 'tag-selectable-active' : ''}`}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {term.label}
              </motion.button>
            );
          })}
        </div>
        <motion.div
          initial={false}
          animate={{ opacity: lastFinishHint ? 1 : 0, height: lastFinishHint ? 'auto' : 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          {lastFinishHint && (
            <p className="text-ui-13 text-tea-text-sec mt-2 px-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              {lastFinishHint}
            </p>
          )}
        </motion.div>
      </div>

      <div className="divider-warm my-4" />

      {/* ── Passage ── */}
      <div className="mb-4">
        <div className="mb-3">
          <div
            className="text-ui-12 uppercase tracking-[0.12em] text-tea-text-sec font-semibold"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Passage
          </div>
          <p className="text-ui-13 text-tea-text-sec mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
            How does the tea feel going down the throat — smooth or scratchy?
          </p>
        </div>
        <div className="tasting-segment-toggle" role="radiogroup" aria-label="Passage quality">
          {PASSAGE_OPTIONS.map((opt, i) => {
            const isSel = value.cleanliness === opt.id;
            return (
              <motion.button
                key={opt.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setPassage(opt.id)}
                role="radio"
                aria-checked={isSel}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 transition-all duration-200 min-h-[52px] relative z-[1] ${
                  isSel
                    ? 'text-tea-gold'
                    : 'text-tea-text-sec hover:text-tea-text'
                }${i < PASSAGE_OPTIONS.length - 1 ? ' weight-seg-div' : ''}`}
                style={{
                  fontFamily: 'var(--font-body)',
                  background: isSel ? SELECTED_BG : 'transparent',
                }}
              >
                <span className={`text-ui-14 leading-tight ${isSel ? 'font-semibold' : 'font-medium'}`}>
                  {opt.label}
                </span>
                <span className={`text-ui-11 leading-tight mt-0.5 ${isSel ? 'text-tea-gold/70' : 'text-tea-text-sec'}`}>
                  {opt.sub}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="divider-warm my-4" />

      {/* ── Throat feel ── */}
      <div className="mb-4">
        <div className="mb-3">
          <div
            className="text-ui-12 uppercase tracking-[0.12em] text-tea-text-sec font-semibold"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Throat feel
          </div>
          <p className="text-ui-13 text-tea-text-sec mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
            Any distinct sensations in the throat or chest after swallowing?
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {THROAT_TERMS.map(term => {
            const isSelected = finishSelected.includes(term.id);
            const Icon = term.icon;
            return (
              <motion.button
                key={term.id}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => flow.toggleTerm('finish', term.id)}
                aria-pressed={isSelected}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl min-h-[52px] text-left w-full transition-all duration-200 ${
                  isSelected
                    ? 'bg-tea-gold/25 text-tea-gold'
                    : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
                }`}
                style={{
                  fontFamily: 'var(--font-body)',
                  boxShadow: isSelected ? '0 0 0 1.5px rgb(var(--tea-gold-rgb) / 0.5), inset 0 1px 0 rgb(var(--tea-gold-rgb) / 0.15)' : undefined,
                }}
              >
                <Icon
                  size={16}
                  className={`shrink-0 transition-opacity ${isSelected ? 'opacity-80' : 'opacity-20'}`}
                />
                <div className="flex flex-col">
                  <span className={`text-ui-14 leading-tight ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                    {term.label}
                  </span>
                  <span className={`text-ui-12 leading-tight mt-0.5 ${isSelected ? 'text-tea-gold/70' : 'text-tea-text-sec'}`}>
                    {term.sub}
                  </span>
                </div>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto shrink-0 w-4 h-4 rounded-full bg-tea-gold/30 flex items-center justify-center"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-tea-gold" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="divider-warm my-4" />

      {/* ── Chinese Tea Concepts ── */}
      {!simplified && (
        <div className="pb-2 flex flex-col gap-1.5">
          <ChineseConceptToggle
            character="回甘"
            pinyin="Huí Gān"
            english="a returning sweetness that rises in the throat minutes after swallowing — the mark of a high-quality tea"
            active={!!value.huiGan}
            onToggle={() => onChange({ ...value, huiGan: !value.huiGan })}
          />
          <ChineseConceptToggle
            character="汤感"
            pinyin="Tāng Gǎn"
            english="the weight and presence of the liquor itself — how the tea 'fills' the mouth as a substance, distinct from flavor"
            active={!!value.tangGan}
            onToggle={() => onChange({ ...value, tangGan: !value.tangGan })}
          />
          <ChineseConceptToggle
            character="气"
            pinyin="Qì"
            english="a warmth or aliveness felt in the chest, back, or shoulders after swallowing — the tea's energy moving through the body"
            active={!!value.qi}
            onToggle={() => onChange({ ...value, qi: !value.qi })}
          />
          <ChineseConceptToggle
            character="韵"
            pinyin="Yùn"
            english="the tea's character that keeps unfolding — each sip reveals something new and the finish lingers long after you swallow"
            active={!!value.yun}
            onToggle={() => onChange({ ...value, yun: !value.yun })}
          />
        </div>
      )}
    </div>
  );
};

export const ThroatZone = React.memo(ThroatZoneInner);
ThroatZone.displayName = 'ThroatZone';
