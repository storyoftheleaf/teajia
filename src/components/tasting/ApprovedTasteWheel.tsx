import { useCallback, useEffect, useRef, useState } from 'react';
import type { TastingData } from '../../types';
import type { WheelHandle } from './approvedWheel/TeaWheel';
import { broadFamilyLabel, toggleBroadFamily, toggleBasicWheelTaste, tastingWordFamily, tastingWordLabel, toggleWheelObservation, wheelNotes, type WheelSense } from './approvedWheel/observations';
import './approvedWheel/approved-wheel.css';
import { families, FIVE_TASTES_NAME } from './approvedWheel/families';
import { basicTasteLabel } from './tasteQualityState';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

export { tastingWordLabel, tastingWordId, tastingWordFamily } from './approvedWheel/observations';
interface ApprovedTasteWheelProps {
  value: TastingData;
  onChange(value: TastingData): void;
  reveal?: { word: string; sense: WheelSense; stamp: number };
}

/** The approved wheel, controlled entirely by the existing tasting session. */
export function ApprovedTasteWheel({ value, onChange, reveal }: ApprovedTasteWheelProps) {
  const host = useRef<HTMLDivElement>(null);
  const wheel = useRef<WheelHandle | null>(null);
  const current = useRef({ value, onChange });
  current.current = { value, onChange };
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [activeFamily, setActiveFamily] = useState<string | null>(null);
  const broad = [...new Set((value.flavorFamilies || []).map(tastingWordLabel))];
  const familyDetails = families.find(family => family.name === activeFamily);
  const tastes = [...new Set((value.flavor || []).map(tastingWordLabel))];
  const aromas = [...new Set((value.aroma || []).map(tastingWordLabel))];
  useEffect(() => {
    if (!host.current) return;
    let cancelled = false;
    setLoadState('loading');
    import('./approvedWheel/TeaWheel').then(({ mount }) => {
      if (cancelled || !host.current) return;
      wheel.current = mount(host.current, {
        notes: wheelNotes(current.current.value), splitSenses: true, study: 5, innerGlow: false, compactSummary: true,
        onNavigate: setActiveFamily,
        onToggle(word) {
          const next = toggleBasicWheelTaste(current.current.value, word);
          current.current = { ...current.current, value: next };
          wheel.current?.updateNotes(wheelNotes(next));
          current.current.onChange(next);
        },
        onToggleSense(word, _group, sense) {
          const next = toggleWheelObservation(current.current.value, word, sense);
          current.current = { ...current.current, value: next };
          wheel.current?.updateNotes(wheelNotes(next));
          current.current.onChange(next);
        },
      });
      setLoadState('ready');
    }).catch(() => { if (!cancelled) setLoadState('error'); });
    return () => { cancelled = true; wheel.current?.destroy(); wheel.current = null; };
  }, [attempt]);
  useEffect(() => { wheel.current?.updateNotes(wheelNotes(value)); }, [value]);
  const showWord = useCallback((input: string, sense: WheelSense) => {
    if (input.startsWith('basic:')) {
      wheel.current?.navigate(FIVE_TASTES_NAME);
      wheel.current?.locate(basicTasteLabel(input.slice(6) as NonNullable<TastingData['basicTastes']>[number]), 'taste');
      host.current?.scrollIntoView({ block: 'nearest' });
      return;
    }
    const isBroad = input.startsWith('family:');
    const word = tastingWordLabel(isBroad ? input.slice(7) : input);
    const family = tastingWordFamily(word);
    if (family) { wheel.current?.navigate(family); if (!isBroad) wheel.current?.locate(word, sense); }
    host.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }, []);
  // A recap request is an event. Recreated prop objects must not replay it
  // after a selection and pull the wheel back to an earlier family.
  useEffect(() => {
    if (reveal && loadState === 'ready') showWord(reveal.word, reveal.sense);
  }, [reveal?.word, reveal?.sense, reveal?.stamp, showWord, loadState]);

  return <div className="approved-taste-wheel study-phone" aria-label="Taste and aroma tasting">
    <section className="approved-wheel-journey" aria-label="Taste and aroma wheel" aria-busy={loadState === 'loading'}>
      {loadState !== 'ready' && <div className="tasting-wheel-loading tasting-loading-state" role={loadState === 'error' ? 'alert' : 'status'}>
        <span>{loadState === 'error' ? 'The taste wheel could not load.' : 'Loading taste wheel…'}</span>
        {loadState === 'error' && <button type="button" className="tap-target" onClick={() => setAttempt(n => n + 1)}>Try again</button>}
      </div>}
      <div ref={host} />
    </section>
    {familyDetails && !familyDetails.singleSense && <section className="tasting-family-record" aria-label="Broad flavor observation">
      <div>
        <p className={`${TYPOGRAPHY_CLASSES.accountMeta} text-tea-text-sec`}>{familyDetails.description}</p>
        <p className={`${TYPOGRAPHY_CLASSES.accountMeta} text-tea-text-dim`}>The family is enough. Specific notes are optional.</p>
      </div>
      <button type="button" className={TYPOGRAPHY_CLASSES.link} aria-pressed={broad.includes(broadFamilyLabel(familyDetails.name))} onClick={() => onChange(toggleBroadFamily(value, familyDetails.name))}>Record {broadFamilyLabel(familyDetails.name)}</button>
    </section>}
    {broad.length > 0 && <section className="tasting-sense-lists" aria-label="Recorded flavor families">
      <div className="tasting-sense-row"><span className="tasting-sense-label">Family</span><div className="tasting-sense-words">
        {broad.map(word => <button key={word} type="button" aria-label={`Remove ${word} family`} onClick={() => onChange(toggleBroadFamily(value, word))}>{word} <span aria-hidden="true">×</span></button>)}
      </div></div>
    </section>}
    {(tastes.length > 0 || aromas.length > 0) && <section className="tasting-sense-lists" aria-label="All selected tastes and aromas">
      {(['taste', 'aroma'] as const).filter(sense => (sense === 'taste' ? tastes : aromas).length > 0).map(sense => <div key={sense} className="tasting-sense-row">
        <span className="tasting-sense-label">{sense === 'taste' ? 'Taste' : 'Aroma'}</span>
        <div className="tasting-sense-words">
          {(sense === 'taste' ? tastes : aromas).map(word => <button key={word} type="button" onClick={() => showWord(word, sense)} aria-label={`Show ${word} ${sense === 'taste' ? 'Taste' : 'Aroma'} on wheel`}>{word}</button>)}
        </div>
      </div>)}
    </section>}
    {familyDetails?.singleSense && <p className={`${TYPOGRAPHY_CLASSES.accountMeta} tasting-five-tastes-help text-tea-text-sec`}>{familyDetails.description}</p>}
    {!!value.basicTastes?.length && <section className="tasting-sense-lists" aria-label="Selected five tastes"><div className="tasting-sense-row">
      <span className="tasting-sense-label">Five tastes</span><div className="tasting-sense-words">{value.basicTastes.map(taste => <button key={taste} type="button" onClick={() => showWord(`basic:${taste}`, 'taste')} aria-label={`Show ${basicTasteLabel(taste)} on wheel`}>{basicTasteLabel(taste)}</button>)}</div>
    </div></section>}
  </div>;
}
