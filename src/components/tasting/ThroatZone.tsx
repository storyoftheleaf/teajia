import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Wind, ArrowDown, Droplets } from 'lucide-react';
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

/* ── Chinese concept toggle card ── */

interface ChineseConceptToggleProps {
  character: string;
  pinyin: string;
  english: string;
  description: string;
  active: boolean;
  onToggle: () => void;
}

const ChineseConceptToggle: React.FC<ChineseConceptToggleProps> = ({
  character, pinyin, english, description, active, onToggle,
}) => {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      className={`rounded-xl overflow-hidden transition-all duration-200 ${
        active ? 'bg-tea-gold/10' : 'bg-tea-surface'
      }`}
      style={{
        boxShadow: active ? '0 0 0 1.5px rgb(var(--tea-gold-rgb) / 0.4)' : '0 0 0 1px var(--tea-border)',
      }}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Chinese character — decorative */}
        <div
          className={`shrink-0 text-[28px] leading-none transition-colors duration-200 ${
            active ? 'text-tea-gold' : 'text-tea-text-dim'
          }`}
          style={{ fontFamily: 'serif', opacity: active ? 0.9 : 0.25, marginTop: 2 }}
          aria-hidden
        >
          {character}
        </div>

        {/* Label + description toggle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span
                className={`text-[13px] font-medium leading-tight transition-colors ${active ? 'text-tea-gold' : 'text-tea-text'}`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {pinyin}
              </span>
              <span
                className="text-[11px] text-tea-text-dim ml-1.5"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {english}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(p => !p)}
              className="shrink-0 text-[10px] text-tea-text-dim hover:text-tea-text-sec transition-colors px-1.5 py-0.5 rounded"
              style={{ fontFamily: 'var(--font-body)' }}
              aria-label={expanded ? 'Hide description' : 'What is this?'}
            >
              {expanded ? 'less' : '?'}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="text-[11px] text-tea-text-sec mt-1.5 leading-relaxed overflow-hidden"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {description}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Toggle button */}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        className={`w-full py-2 text-[12px] font-medium border-t transition-all duration-200 ${
          active
            ? 'border-tea-gold/20 text-tea-gold bg-tea-gold/5'
            : 'border-tea-border text-tea-text-dim hover:text-tea-text'
        }`}
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
      >
        {active ? `${character} · Noticed` : `I noticed this`}
      </button>
    </motion.div>
  );
};

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
    (value.huiGan ? 1 : 0);

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

  const toggleHuiGan = () => {
    onChange({ ...value, huiGan: !value.huiGan });
  };

  const handleClearAll = () => {
    for (const id of [...finishSelected]) flow.toggleTerm('finish', id);
    if (value.cleanliness || value.huiGan) {
      onChange({ ...value, cleanliness: undefined, huiGan: false });
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
          className="text-[11px] text-tea-text-dim hover:text-tea-text-sec transition-colors flex items-center gap-1 px-2 py-1"
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
            className="text-[12px] uppercase tracking-[0.12em] text-tea-text-dim font-medium"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Finish
          </div>
          <p className="text-[11px] text-tea-text-sec mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
            How long does the flavor linger, and what quality does it leave?
          </p>
        </div>

        <div
          className="text-[10px] uppercase tracking-[0.1em] text-tea-text-dim mb-1.5"
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
                    ? 'text-tea-gold font-semibold text-[15px]'
                    : 'text-tea-text-sec hover:text-tea-text font-medium text-[15px]'
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
          className="text-[10px] uppercase tracking-[0.1em] text-tea-text-dim mb-1.5"
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
                className={`tag-selectable w-full justify-center text-[13px] ${isSelected ? 'tag-selectable-active' : ''}`}
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
            <p className="text-[12px] text-tea-text-sec mt-2 px-0.5" style={{ fontFamily: 'var(--font-body)' }}>
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
            className="text-[12px] uppercase tracking-[0.12em] text-tea-text-dim font-medium"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Passage
          </div>
          <p className="text-[11px] text-tea-text-sec mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
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
                <span className={`text-[14px] leading-tight ${isSel ? 'font-semibold' : 'font-medium'}`}>
                  {opt.label}
                </span>
                <span className={`text-[10px] leading-tight mt-0.5 ${isSel ? 'text-tea-gold/70' : 'text-tea-text-dim'}`}>
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
            className="text-[12px] uppercase tracking-[0.12em] text-tea-text-dim font-medium"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Throat feel
          </div>
          <p className="text-[11px] text-tea-text-sec mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
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
                  <span className={`text-[13px] leading-tight ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                    {term.label}
                  </span>
                  <span className={`text-[11px] leading-tight mt-0.5 ${isSelected ? 'text-tea-gold/70' : 'text-tea-text-dim'}`}>
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
        <div className="pb-2">
          <div className="mb-3">
            <div
              className="text-[12px] uppercase tracking-[0.12em] text-tea-text-dim font-medium"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Traditional markers
            </div>
            <p className="text-[11px] text-tea-text-sec mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              These are concepts from Chinese tea culture that describe experiences beyond taste.
              Like Qi in Qigong, they refer to sensations felt in the body, not just the mouth.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <ChineseConceptToggle
              character="回甘"
              pinyin="Huí Gān"
              english="Returning sweetness"
              description="After you swallow, wait. Deep in the throat — lower than you'd expect — a quiet sweetness rises. This is not in your mouth. It surfaces slowly, like an echo of the tea. A mark of quality."
              active={!!value.huiGan}
              onToggle={toggleHuiGan}
            />
            <ChineseConceptToggle
              character="韵"
              pinyin="Yùn"
              english="Resonance"
              description="The character of the tea that lingers and deepens after you swallow. Like a note that keeps ringing after the bell has been struck. Some teas fade immediately — those with yùn keep speaking."
              active={!!value.yun}
              onToggle={() => onChange({ ...value, yun: !value.yun })}
            />
            <ChineseConceptToggle
              character="气"
              pinyin="Qì"
              english="Vitality"
              description="A warmth or aliveness felt in the chest, back, or shoulders. The same qi from Qigong — the tea's energy moving through the body, not just the mouth. Some teas wake you; others settle you."
              active={!!value.qi}
              onToggle={() => onChange({ ...value, qi: !value.qi })}
            />
            <ChineseConceptToggle
              character="汤感"
              pinyin="Tāng Gǎn"
              english="Soup feel"
              description="How substantial the liquid feels — dense and coating, like a broth, or light and clean, like water. A rich tāng gǎn means the tea takes up space in the mouth. Thin liquor offers little."
              active={!!value.tangGan}
              onToggle={() => onChange({ ...value, tangGan: !value.tangGan })}
            />
          </div>
        </div>
      )}

      {/* Simplified: Hui Gan only */}
      {simplified && (
        <div className="pb-2">
          <div className="mb-3">
            <div
              className="text-[12px] uppercase tracking-[0.12em] text-tea-text-dim font-medium"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              回甘 Returning sweetness
            </div>
            <p className="text-[11px] text-tea-text-sec mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              A sweetness that rises deep in the throat a minute after swallowing.
            </p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={toggleHuiGan}
            aria-pressed={!!value.huiGan}
            className={`tasting-huigan-toggle w-full justify-center ${value.huiGan ? 'tasting-huigan-toggle-active' : ''}`}
          >
            <motion.span animate={{ rotate: value.huiGan ? [0, -12, 12, 0] : 0 }} transition={{ duration: 0.4 }}>
              <Sparkles size={14} className={`shrink-0 transition-opacity ${value.huiGan ? 'opacity-100' : 'opacity-30'}`} />
            </motion.span>
            <span>{value.huiGan ? '回甘 · Present' : '回甘 · Did you notice this?'}</span>
          </motion.button>
        </div>
      )}
    </div>
  );
};

export const ThroatZone = React.memo(ThroatZoneInner);
ThroatZone.displayName = 'ThroatZone';
