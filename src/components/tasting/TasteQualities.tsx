import { useId } from 'react';
import type { TastingData } from '../../types';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { BASIC_TASTES, RETURNING_SWEETNESS, setReturningSweetness, toggleBasicTaste } from './tasteQualityState';

export function TasteQualities({ value, onChange }: { value: TastingData; onChange(value: TastingData): void }) {
  const helpId = useId();
  const recorded = value.huiGanIntensity;
  const level = recorded === undefined ? 0 : Math.max(0, Math.min(3, Math.round(recorded)));
  const legacy = recorded === undefined && value.huiGan === true;
  const unrecorded = recorded === undefined && value.huiGan === undefined;
  const helpClass = `${TYPOGRAPHY_CLASSES.accountMeta} text-tea-text-sec`;
  const status = unrecorded ? 'Unrecorded' : legacy ? 'Returning sweetness recorded; strength not specified' : RETURNING_SWEETNESS[level];
  return <div className="tasting-taste-qualities">
    <section aria-label="Taste qualities">
      <h3 className={`${TYPOGRAPHY_CLASSES.label} tasting-quality-label`}>Taste qualities</h3>
      <p className={helpClass}>Honey or caramel describe a resemblance; Sweet means sweetness in the sip. Aroma is smell; Taste is what you notice in the sip.</p>
      <div className="tasting-basic-tastes">
        {BASIC_TASTES.map(taste => <button key={taste} type="button" aria-pressed={value.basicTastes?.includes(taste) ?? false} onClick={() => onChange(toggleBasicTaste(value, taste))} className={TYPOGRAPHY_CLASSES.link} data-priority={taste === 'Salty' ? 'secondary' : undefined} title={taste === 'Umami' ? 'A savory, broth-like taste' : undefined}>{taste === 'Umami' ? 'Savory (umami)' : taste}</button>)}
      </div>
    </section>
    <section aria-label="Returning sweetness">
      <div className="tasting-huigan-heading">
        <h3 className={`${TYPOGRAPHY_CLASSES.label} tasting-quality-label`} title="Hui gan">Returning sweetness</h3>
        {(recorded !== undefined || value.huiGan !== undefined) && <button type="button" aria-label="Clear returning sweetness" className={`${TYPOGRAPHY_CLASSES.link} min-h-11 min-w-11 text-tea-text-sec`} onClick={() => onChange(setReturningSweetness(value, undefined))}>Clear</button>}
      </div>
      <p id={helpId} className={helpClass}>Sweetness develops or becomes clearer after swallowing, sometimes as bitterness fades.</p>
      {unrecorded && <p className={helpClass}>Unrecorded</p>}
      <div className="tasting-storage-rail tasting-huigan-rail" data-selected={!unrecorded && !legacy}>
        <div className="tasting-storage-ticks" aria-hidden="true">{RETURNING_SWEETNESS.map(label => <i key={label} />)}</div>
        <input type="range" min="0" max="3" step="1" value={level} aria-label="Returning sweetness intensity" aria-describedby={helpId} aria-valuetext={status} onChange={event => onChange(setReturningSweetness(value, Number(event.target.value)))} onPointerUp={event => onChange(setReturningSweetness(value, Number(event.currentTarget.value)))} onKeyDown={event => { if (event.key === 'Home') { event.preventDefault(); onChange(setReturningSweetness(value, 0)); } }} />
      </div>
      <div className="tasting-huigan-labels" aria-hidden="true">{RETURNING_SWEETNESS.map((label, index) => <span key={label} data-current={!unrecorded && !legacy && index === level}>{label}</span>)}</div>
      {legacy && <p className={`${TYPOGRAPHY_CLASSES.accountMeta} text-tea-text-sec`}>Previously recorded; strength not specified.</p>}
    </section>
  </div>;
}
