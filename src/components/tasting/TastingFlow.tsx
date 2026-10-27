import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Circle, Leaf, Moon, Palette,
} from 'lucide-react';
import type { TastingData } from '../../types';
import { useTastingFlow } from './useTastingFlow';
import { ConnectedSensations } from './ConnectedSensations';
import { ApprovedTasteWheel } from './ApprovedTasteWheel';
import { StorageZone } from './StorageZone';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { resolveTermLabel } from '../../data/tastingTaxonomy';
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
  { id: 'body',       label: 'Texture',   subtitle: 'How does it feel in your mouth?',    icon: Circle },
  { id: 'state',      label: 'Effect', subtitle: 'What did the tea do to you?',        icon: Moon },
  { id: 'flavor',     label: 'Taste', subtitle: 'What do you taste?',                 icon: Leaf },
  { id: 'appearance', label: 'Storage',   subtitle: 'Storage character and appearance',    icon: Palette },
];

/* ─── Transition variants ─── */

const sectionVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  // No exit variant on purpose. See the swap comment further down: sections are
  // replaced outright, so nothing ever animates out.
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
  reveal?: { word: string; group?: string; sense?: 'taste' | 'aroma'; stamp: number };
}

export const TastingFlow: React.FC<TastingFlowProps> = ({
  value,
  onChange,
  activeSectionId: controlledSectionId,
  onCountsChange,
  reveal,
}) => {
  // Uncontrolled fallback, used when admin views don't provide activeSectionId
  const [internalSectionId] = useState<SectionId>('body');
  const activeSectionId = controlledSectionId ?? internalSectionId;
  const flow = useTastingFlow(value, onChange);
  const sections = ALL_SECTIONS;

  const contentRef = useRef<HTMLDivElement>(null);

  const activeIdx = sections.findIndex((s) => s.id === activeSectionId);

  /* ─── Slide direction ───────────────────────────────────────────────────
   *
   * Worked out during the render that changes section, NOT in an effect
   * afterwards. The effect version stored a fresh timestamp beside the
   * direction, and that timestamp was part of the panel's key, so one tap
   * changed the key twice: once for the new section, then again a frame later.
   * A ref read and written in render keeps one section change to one key
   * change, which is what a keyed swap needs to be predictable. */
  const prevSectionRef = useRef<SectionId>(activeSectionId);
  const directionRef = useRef(0);
  if (prevSectionRef.current !== activeSectionId) {
    const prevIdx = sections.findIndex((s) => s.id === prevSectionRef.current);
    directionRef.current = activeIdx > prevIdx ? 1 : -1;
    prevSectionRef.current = activeSectionId;
  }
  const direction = directionRef.current;

  /* ─── Count helpers ─── */

  const sectionCounts = useMemo<Record<SectionId, number>>(() => ({
    body:
      (value.body?.length ?? 0) +
      (value.finish?.length ?? 0) +
      (value.cleanliness ? 1 : 0) +
      (value.huiGan ? 1 : 0) +
      (value.tangGan ? 1 : 0) +
      (value.sensoryCustom?.body?.length ?? 0),
    state:
      (value.feeling?.length ?? 0) +
      (value.sensoryCustom?.state?.length ?? 0),
    flavor: (value.flavor?.length ?? 0) + (value.aroma?.length ?? 0),
    appearance:
      (value['liquor-color']?.length ?? 0) +
      (value.clarity ? 1 : 0) +
      (value.storageCharacter != null ? 1 : 0) +
      (value.storageNotes?.length ?? 0),
  }), [
    value.body,
    value.finish,
    value.cleanliness,
    value.huiGan,
    value.tangGan,
    value.feeling,
    value.sensoryCustom,
    value.aroma,
    value.flavor,
    value['liquor-color'],
    value.clarity,
    value.storageCharacter,
    value.storageNotes,
  ]);

  // Push counts to parent whenever they change
  useEffect(() => {
    if (!onCountsChange) return;
    onCountsChange(sectionCounts);
  }, [onCountsChange, sectionCounts]);

  useEffect(() => {
    if (activeSectionId !== 'appearance' || !reveal) return;
    const normalize = (text: string | null | undefined) => text?.trim().toLocaleLowerCase() ?? '';
    const labels = new Set([normalize(reveal.word), normalize(resolveTermLabel(reveal.word))]);
    const isColor = value['liquor-color']?.includes(reveal.word);
    const isAppearance = isColor || value.clarity === reveal.word || reveal.group === 'appearance';
    const root = isAppearance
      ? contentRef.current?.querySelector<HTMLElement>('[aria-labelledby="tasting-appearance-heading"]')
      : contentRef.current;
    const controls = Array.from(root?.querySelectorAll<HTMLElement>('button, input, [role="radio"]') ?? []);
    const target = reveal.word === 'storage-character'
      ? controls.find(control => normalize(control.getAttribute('aria-label')).startsWith('storage character'))
      : controls.find(control => [
        control.textContent,
        control.getAttribute('aria-label'),
        control.getAttribute('aria-valuetext'),
        control.getAttribute('value'),
      ].some(label => !!normalize(label) && labels.has(normalize(label))))
        // The compact colour bar exposes the group rather than individual radios.
        ?? (isColor ? root?.querySelector<HTMLElement>('[role="radiogroup"][aria-label="Liquor color"]') : null);
    if (!target) return;
    target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    target.classList.add('connected-sensation-return');
    const timer = window.setTimeout(() => target.classList.remove('connected-sensation-return'), 1600);
    return () => { window.clearTimeout(timer); target.classList.remove('connected-sensation-return'); };
  }, [activeSectionId, reveal?.word, reveal?.stamp]);

  /* ─── Section content renderer ─── */

  function renderSectionContent(sectionId: SectionId) {
    switch (sectionId) {
      case 'body':
      case 'state':
        return <ConnectedSensations value={value} onChange={onChange} section={sectionId} reveal={reveal} />;
      case 'flavor':
        return <ApprovedTasteWheel value={value} onChange={onChange} reveal={reveal ? { ...reveal, sense: reveal.sense ?? 'taste' } : undefined} />;
      case 'appearance':
        return <><h2 className={`${TYPOGRAPHY_CLASSES.h2} mb-4 text-tea-text`}>Storage</h2><StorageZone value={value} onChange={onChange} />
          <section aria-labelledby="tasting-appearance-heading" className="mt-5 border-t border-tea-border pt-4">
            <h2 id="tasting-appearance-heading" className={`${TYPOGRAPHY_CLASSES.h3} mb-3`}>Appearance</h2>
            <AppearanceZone flow={flow} value={value} onChange={onChange} compact />
          </section></>;
      default:
        return null;
    }
  }

  const activeSection = sections[activeIdx] || sections[0];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">

        {/* Section content: full width. The tabs live in TastingSession's bottom bar. */}
        <div
          ref={contentRef}
          className="relative overflow-x-hidden overflow-y-auto h-full tasting-scroll"
        >
          {/* One panel, swapped by key, animating only on the way IN.

              There is deliberately no exit animation and no presence wrapper
              here. The previous form held the outgoing panel until its exit
              finished before mounting the incoming one, and that handover never
              completed: the tab you tapped lit up while the panel underneath
              stayed on the first section forever, which made the whole bottom
              tab row look dead. An entrance-only swap cannot wedge, because
              nothing has to finish before the next section can appear. */}
          <motion.div
            key={activeSection.id}
            custom={direction}
            variants={sectionVariants}
            initial="enter"
            animate="center"
            transition={sectionTransition}
            className={`pb-4 pt-3 ${activeSection.id === 'flavor' ? 'px-1.5' : 'px-4'}`}
          >
            {renderSectionContent(activeSection.id)}
          </motion.div>
        </div>
      </div>

    </div>
  );
};
