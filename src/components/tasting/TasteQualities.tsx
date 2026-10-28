import type { TastingData } from '../../types';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { BASIC_TASTES, toggleBasicTaste } from './tasteQualityState';

export function TasteQualities({ value, onChange }: { value: TastingData; onChange(value: TastingData): void }) {
  const helpClass = `${TYPOGRAPHY_CLASSES.accountMeta} text-tea-text-sec`;
  return <div className="tasting-taste-qualities">
    <section aria-label="Taste qualities">
      <h3 className={`${TYPOGRAPHY_CLASSES.label} tasting-quality-label`}>Taste qualities</h3>
      <p className={helpClass}>Honey or caramel describe a resemblance; Sweet means sweetness in the sip. Aroma is smell; Taste is what you notice in the sip.</p>
      <div className="tasting-basic-tastes">
        {BASIC_TASTES.map(taste => <button key={taste} type="button" aria-pressed={value.basicTastes?.includes(taste) ?? false} onClick={() => onChange(toggleBasicTaste(value, taste))} className={TYPOGRAPHY_CLASSES.link} data-priority={taste === 'Salty' ? 'secondary' : undefined} title={taste === 'Umami' ? 'A savory, broth-like taste' : undefined}>{taste === 'Umami' ? 'Savory (umami)' : taste}</button>)}
      </div>
    </section>
  </div>;
}
