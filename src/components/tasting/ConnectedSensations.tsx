import React, { useEffect, useId, useRef, useState } from 'react';
import { Info, Plus, X } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { TastingData } from '../../types';
import { SENSATION_GROUPS, sensationIsSelected, toggleSensation, addSensoryCustom, removeSensoryCustom, type SensationSection, type SensoryTastingData } from './connectedSensationsVocabulary';

interface ConnectedSensationsProps {
  value: TastingData;
  onChange: (value: TastingData) => void;
  section: SensationSection;
  reveal?: { word: string; group?: string; stamp: number };
}

export function ConnectedSensations({ value, onChange, section, reveal }: ConnectedSensationsProps) {
  const [guide, setGuide] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [highlight, setHighlight] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const prefix = useId();
  const data = value as SensoryTastingData;
  const groups = SENSATION_GROUPS[section];

  useEffect(() => {
    setCustom('');
    setGuide(null);
  }, [section]);

  useEffect(() => {
    if (!reveal) return;
    const group = groups.find(item => item.id === reveal.group || item.terms.some(term => term.id === reveal.word || term.label === reveal.word));
    const target = Array.from(host.current?.querySelectorAll<HTMLElement>('[data-sensation-word]') ?? []).find(node => node.dataset.sensationWord === reveal.word || node.textContent === reveal.word);
    const groupNode = Array.from(host.current?.querySelectorAll<HTMLElement>('[data-sensation-group]') ?? []).find(node => node.dataset.sensationGroup === (group?.id ?? reveal.group));
    (target ?? groupNode)?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    setHighlight(reveal.word);
    const timer = window.setTimeout(() => setHighlight(null), 1600);
    return () => window.clearTimeout(timer);
  }, [reveal?.stamp, reveal?.word, reveal?.group, groups]);

  const saveCustom = () => {
    const next = addSensoryCustom(data, section, custom);
    if (custom.trim()) { onChange(next); setCustom(''); }
  };

  return (
    <div ref={host} className={`connected-sensations connected-sensations-${section}`} aria-label={section === 'body' ? 'Texture' : 'Effect'}>
      <h2 className={`${TYPOGRAPHY_CLASSES.h2} mb-4 text-tea-text`}>{section === 'body' ? 'How does it feel?' : 'How do you feel?'}</h2>
      {groups.map(group => (
        <section key={group.id} data-sensation-group={group.id} className="connected-sensation-family" aria-labelledby={`${prefix}-${group.id}`}>
          <div className="flex min-h-11 items-center justify-between gap-2">
            <h3 id={`${prefix}-${group.id}`} className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{group.label}</h3>
            <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-tea-text-dim focus-visible:ring-2 focus-visible:ring-tea-gold" aria-label={`Explain ${group.label}`} aria-expanded={guide === group.id} aria-controls={`${prefix}-${group.id}-guide`} onClick={() => setGuide(guide === group.id ? null : group.id)}><Info size={15} strokeWidth={1.3} /></button>
          </div>
          <div className={`connected-sensation-choices ${group.terms.length === 3 ? 'connected-sensation-three' : ''} ${group.single ? 'connected-sensation-single' : ''}`} role="group" aria-label={group.label}>
            {group.terms.map(term => (
              <button key={`${term.id}-${highlight === term.id || highlight === term.label ? reveal?.stamp : ''}`} type="button" data-sensation-word={term.id} aria-pressed={sensationIsSelected(data, term)} className={`${group.single ? TYPOGRAPHY_CLASSES.link : TYPOGRAPHY_CLASSES.bodyLight} connected-sensation-choice ${highlight === term.id || highlight === term.label ? 'connected-sensation-return' : ''}`} onClick={() => { setHighlight(null); onChange(toggleSensation(data, section, group.id, term.id)); }}>{term.label}</button>
            ))}
          </div>
          <div id={`${prefix}-${group.id}-guide`} hidden={guide !== group.id} className="pt-3">
            <p className={`${TYPOGRAPHY_CLASSES.accountMeta} mb-2 text-tea-text-dim`}>{group.hint}</p>
            <dl>{group.terms.map(term => <div key={term.id} className="border-b border-tea-border py-2"><dt className={`${TYPOGRAPHY_CLASSES.link} text-tea-text`}>{term.label}</dt><dd className={`${TYPOGRAPHY_CLASSES.accountMeta} mt-1 text-tea-text-sec`}>{term.meaning}</dd></div>)}</dl>
          </div>
        </section>
      ))}
      <section className="connected-sensation-family" data-sensation-group="custom" aria-label="Your own words">
        {!!data.sensoryCustom?.[section]?.length && <div className="mb-2 flex flex-wrap gap-2">{data.sensoryCustom[section]!.map(word => <button type="button" key={`${word}-${highlight === word ? reveal?.stamp : ''}`} data-sensation-word={word} aria-label={`Remove ${word}`} className={`${TYPOGRAPHY_CLASSES.link} flex min-h-11 items-center gap-2 rounded-xl bg-tea-elevated px-3 text-tea-text focus-visible:ring-2 focus-visible:ring-tea-gold ${highlight === word ? 'connected-sensation-return' : ''}`} onClick={() => onChange(removeSensoryCustom(data, section, word))}>{word}<X size={12} aria-hidden="true" /></button>)}</div>}
        <div className="flex items-center gap-2 rounded-xl border border-tea-border bg-tea-surface pl-3 focus-within:ring-1 focus-within:ring-tea-gold">
          <input aria-label={`Add your own ${section === 'body' ? 'texture' : 'effect'} word`} className={`${TYPOGRAPHY_CLASSES.link} min-h-11 min-w-0 flex-1 bg-transparent text-tea-text placeholder:text-tea-text-dim focus:outline-none`} value={custom} onChange={event => setCustom(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); saveCustom(); } }} placeholder="Your own words…" />
          <button type="button" aria-label="Add word" disabled={!custom.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-tea-text-sec disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-tea-gold" onClick={saveCustom}><Plus size={18} /></button>
        </div>
      </section>
    </div>
  );
}
