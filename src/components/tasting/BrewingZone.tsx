import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import { TASTING_TAXONOMY, TERM_MAP } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const brewingCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'brewing')!;

const TEMPS = [
  { id: 'low-temp', label: 'Low' },
  { id: 'medium-temp', label: 'Medium' },
  { id: 'high-temp', label: 'High' },
] as const;

// Group-level empty state prompts
const GROUP_PROMPTS: Record<string, string> = {
  'Approach': 'How are you steeping?',
  'Vessel': 'What vessel are you using?',
  'Character': 'How does the session feel?',
};

interface BrewingZoneProps {
  flow: TastingFlowState;
  mode?: 'admin' | 'customer';
}

const BrewingZoneInner: React.FC<BrewingZoneProps> = ({ flow, mode }) => {
  const selected = flow.value.brewing || [];
  const brewingCount = flow.getCategoryCount('brewing');
  const clearCategory = flow.clearCategory;

  const selectedTemp = TEMPS.find(t => selected.includes(t.id))?.id ?? null;

  // Custom term input state per group
  const [customInputGroup, setCustomInputGroup] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customInputGroup && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [customInputGroup]);

  const toggleTemp = (id: string) => {
    if (selectedTemp === id) {
      flow.toggleTerm('brewing', id);
    } else {
      if (selectedTemp) flow.toggleTerm('brewing', selectedTemp);
      if (!selected.includes(id)) flow.toggleTerm('brewing', id);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (trimmed) {
      flow.addCustomTerm('brewing', trimmed);
      setCustomInput('');
      setCustomInputGroup(null);
    }
  };

  // Non-temperature groups
  const otherGroups = brewingCategory.groups.filter(g => g.label !== 'Temperature');

  return (
    <div role="group" aria-label="Brewing parameters">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-[11px] uppercase tracking-[0.15em] text-tea-text-dim font-medium"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Brew
        </div>
        {brewingCount > 0 && (
          <button
            type="button"
            onClick={() => clearCategory('brewing')}
            className="text-tea-text-dim hover:text-tea-text transition-colors p-0.5"
            aria-label="Clear all brewing selections"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Description — only when nothing selected */}
      {brewingCount === 0 && (
        <p
          className="text-xs text-tea-text-dim italic mb-3"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          How are you preparing this tea?
        </p>
      )}

      {/* Temperature toggle — segmented control */}
      <div
        role="radiogroup"
        aria-label="Water temperature"
        className="flex rounded-lg overflow-hidden mb-3 temp-toggle"
      >
        {TEMPS.map((t, i) => (
          <motion.button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selectedTemp === t.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => toggleTemp(t.id)}
            className={`flex-1 py-3 text-xs font-medium transition-all duration-200 min-h-[44px] ${
              selectedTemp === t.id
                ? 'bg-tea-gold-lt text-tea-gold'
                : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
            } ${i < TEMPS.length - 1 ? 'temp-segment-border' : ''}`}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {t.label}
          </motion.button>
        ))}
      </div>

      {/* Other brewing groups */}
      {otherGroups.map(group => {
        const groupSelected = group.terms.filter(t => selected.includes(t.id));
        const prompt = GROUP_PROMPTS[group.label];

        return (
          <div key={group.label} className="mb-3">
            <div
              className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim mb-1.5 font-medium"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {group.label}
            </div>

            {/* Empty state prompt per group */}
            {groupSelected.length === 0 && prompt && (
              <p
                className="text-[11px] text-tea-text-dim italic mb-1.5"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {prompt}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {group.terms.map(term => {
                const isSelected = selected.includes(term.id);
                const termInfo = TERM_MAP.get(term.id);
                const Icon = termInfo?.icon;
                return (
                  <motion.button
                    key={term.id}
                    type="button"
                    whileTap={{ scale: 0.93 }}
                    onClick={() => flow.toggleTerm('brewing', term.id)}
                    className={`tag-selectable ${isSelected ? 'tag-selectable-active' : ''}`}
                    style={{ fontFamily: 'var(--font-body)', fontSize: '12px' }}
                    aria-pressed={isSelected}
                  >
                    {Icon && (
                      <Icon
                        size={12}
                        className={`shrink-0 ${isSelected ? 'opacity-100' : 'opacity-40'}`}
                      />
                    )}
                    {term.label}
                  </motion.button>
                );
              })}

              {/* Admin custom term button */}
              {mode === 'admin' && (
                <>
                  {customInputGroup === group.label ? (
                    <form onSubmit={handleCustomSubmit} className="inline-flex items-center gap-1">
                      <input
                        ref={customInputRef}
                        type="text"
                        value={customInput}
                        onChange={e => setCustomInput(e.target.value)}
                        onBlur={() => {
                          if (!customInput.trim()) setCustomInputGroup(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Escape') {
                            setCustomInput('');
                            setCustomInputGroup(null);
                          }
                        }}
                        placeholder="Custom term..."
                        className="text-xs bg-tea-surface text-tea-text px-2 py-1 rounded w-24 outline-none"
                        style={{ fontFamily: 'var(--font-body)' }}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCustomInputGroup(group.label)}
                      className="tag-selectable flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity"
                      aria-label={`Add custom ${group.label.toLowerCase()} term`}
                    >
                      <Plus size={11} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* CSS for temperature segment borders via CSS variables instead of inline style */}
      <style>{`
        .temp-segment-border {
          border-right: 1px solid var(--tea-border);
        }
      `}</style>
    </div>
  );
};

export const BrewingZone = React.memo(BrewingZoneInner);
BrewingZone.displayName = 'BrewingZone';
