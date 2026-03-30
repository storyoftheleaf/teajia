import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Moon, Zap, Flame, Sun, Anchor, Maximize2, Sparkles } from 'lucide-react';
import type { TastingData } from '../../types';
import { TastingSlider } from './TastingSlider';
import { FlavorFamilies } from './FlavorFamilies';
import { VoiceNoteField } from './VoiceNoteField';

/* ─── Mood options ─── */

const MOOD_OPTIONS = [
  { id: 'calm', label: 'Calm', icon: Moon },
  { id: 'focused', label: 'Focused', icon: Zap },
  { id: 'warming', label: 'Warming', icon: Flame },
  { id: 'uplifting', label: 'Uplifting', icon: Sun },
  { id: 'grounding', label: 'Grounding', icon: Anchor },
  { id: 'expansive', label: 'Expansive', icon: Maximize2 },
] as const;

/* ─── Body weight options ─── */

const BODY_OPTIONS = [
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'full', label: 'Full' },
] as const;

/* ─── Props ─── */

interface TastingCaptureProps {
  value: TastingData;
  onChange: (data: TastingData) => void;
  teaType?: string;
  /** Pre-populated notes from Compass or previous context */
  initialNote?: string;
}

/**
 * Single-page tasting capture. No tabs, no navigation.
 * Three blocks: Quality (sliders), Energy (mood + body + hui gan), Taste (families + voice).
 * Everything optional. Even one slider drag is a valid entry.
 */
const TastingCaptureInner: React.FC<TastingCaptureProps> = ({
  value,
  onChange,
  teaType,
  initialNote,
}) => {
  /* ─── Updaters ─── */

  const setField = useCallback(
    <K extends keyof TastingData>(key: K, val: TastingData[K]) => {
      onChange({ ...value, [key]: val });
    },
    [value, onChange],
  );

  const selectedBody = BODY_OPTIONS.find(b => value.body?.includes(b.id))?.id ?? null;

  const toggleBody = useCallback(
    (id: string) => {
      if (selectedBody === id) {
        // Deselect
        setField('body', (value.body || []).filter(b => b !== id));
      } else {
        // Replace
        const cleaned = (value.body || []).filter(b => !BODY_OPTIONS.some(opt => opt.id === b));
        setField('body', [...cleaned, id]);
      }
    },
    [selectedBody, value.body, setField],
  );

  const toggleFlavor = useCallback(
    (termId: string) => {
      const current = value.flavor || [];
      const next = current.includes(termId)
        ? current.filter(t => t !== termId)
        : [...current, termId];
      setField('flavor', next);
    },
    [value.flavor, setField],
  );

  const toggleHuiGan = useCallback(() => {
    setField('huiGan', value.huiGan ? undefined : true);
  }, [value.huiGan, setField]);

  const setMood = useCallback(
    (moodId: string) => {
      setField('mood', value.mood === moodId ? undefined : moodId);
    },
    [value.mood, setField],
  );

  const noteValue = value.voiceNote ?? initialNote ?? '';

  return (
    <div className="flex flex-col gap-6">
      {/* ════════════════════════════════════════
          QUALITY — three 1-10 sliders
         ════════════════════════════════════════ */}
      <section>
        <div className="tasting-capture-label mb-4">How good</div>
        <div className="flex flex-col gap-5">
          <TastingSlider
            label="Quality"
            sublabel="overall impression"
            value={value.quality}
            onChange={v => setField('quality', v)}
          />
          <TastingSlider
            label="Cleanliness"
            sublabel="how pure it tastes"
            value={value.cleanliness}
            onChange={v => setField('cleanliness', v)}
          />
          <TastingSlider
            label="Patience"
            sublabel="how many steepings"
            value={value.patience}
            onChange={v => setField('patience', v)}
          />
        </div>
      </section>

      {/* Warm divider */}
      <div className="divider-warm" />

      {/* ════════════════════════════════════════
          ENERGY — mood + body + hui gan
         ════════════════════════════════════════ */}
      <section>
        <div className="tasting-capture-label mb-3">How it feels</div>

        {/* Mood — single select pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {MOOD_OPTIONS.map(({ id, label, icon: Icon }) => {
            const isActive = value.mood === id;
            return (
              <motion.button
                key={id}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setMood(id)}
                className={`tasting-mood-pill ${isActive ? 'tasting-mood-pill-active' : ''}`}
                aria-pressed={isActive}
              >
                <Icon size={14} strokeWidth={isActive ? 2 : 1.5} />
                {label}
              </motion.button>
            );
          })}
        </div>

        {/* Body — 3-way segment toggle */}
        <div className="flex items-center gap-3 mb-3">
          <span className="tasting-capture-label shrink-0">Body</span>
          <div className="tasting-segment-toggle flex-1" role="radiogroup" aria-label="Body weight">
            {BODY_OPTIONS.map((b, i) => (
              <motion.button
                key={b.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => toggleBody(b.id)}
                role="radio"
                aria-checked={selectedBody === b.id}
                className={`flex-1 py-2 text-[13px] font-medium transition-all duration-200 min-h-[40px] relative z-[1] ${
                  selectedBody === b.id
                    ? 'text-tea-gold'
                    : 'text-tea-text-sec hover:text-tea-text'
                }${i < BODY_OPTIONS.length - 1 ? ' weight-segment-border' : ''}`}
                style={{
                  fontFamily: 'var(--font-body)',
                  background: selectedBody === b.id
                    ? 'radial-gradient(ellipse 100% 100% at 50% 50%, rgb(var(--tea-gold-rgb) / 0.12) 0%, rgb(var(--tea-gold-rgb) / 0.04) 70%)'
                    : 'transparent',
                }}
              >
                {b.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Hui Gan toggle */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={toggleHuiGan}
          className={`tasting-huigan-toggle ${value.huiGan ? 'tasting-huigan-toggle-active' : ''}`}
          aria-pressed={!!value.huiGan}
        >
          <Sparkles size={13} strokeWidth={value.huiGan ? 2 : 1.5} />
          <span>Hui Gan</span>
          <span className="text-[10px] opacity-50 ml-0.5" style={{ fontFamily: 'var(--font-body)' }}>
            returning sweetness
          </span>
        </motion.button>
      </section>

      {/* Warm divider */}
      <div className="divider-warm" />

      {/* ════════════════════════════════════════
          TASTE — flavor families + voice note
         ════════════════════════════════════════ */}
      <section>
        <div className="tasting-capture-label mb-3">What it tastes like</div>

        <FlavorFamilies
          selected={value.flavor || []}
          onToggle={toggleFlavor}
          teaType={teaType}
        />

        {/* Voice note / free text */}
        <div className="mt-4">
          <VoiceNoteField
            value={noteValue}
            onChange={v => setField('voiceNote', v)}
          />
        </div>
      </section>
    </div>
  );
};

export const TastingCapture = React.memo(TastingCaptureInner);
TastingCapture.displayName = 'TastingCapture';
