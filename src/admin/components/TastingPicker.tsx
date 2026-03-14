import React, { useState, useCallback } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import type { TastingData } from '../../types';
import {
  TASTING_TAXONOMY,
  TASTING_CATEGORY_ORDER,
  TERM_MAP,
  type TastingCategoryId,
} from '../../data/tastingTaxonomy';

interface TastingPickerProps {
  value: TastingData;
  onChange: (data: TastingData) => void;
}

export const TastingPicker: React.FC<TastingPickerProps> = ({ value, onChange }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['flavor']));
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  const toggleTerm = useCallback((categoryId: TastingCategoryId, termId: string) => {
    const current = value[categoryId] || [];
    const next = current.includes(termId)
      ? current.filter(t => t !== termId)
      : [...current, termId];
    onChange({ ...value, [categoryId]: next.length ? next : undefined });
  }, [value, onChange]);

  const addCustomTerm = useCallback((categoryId: TastingCategoryId) => {
    const raw = customInputs[categoryId]?.trim();
    if (!raw) return;
    const id = raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!id) return;
    const current = value[categoryId] || [];
    if (current.includes(id)) return;
    onChange({ ...value, [categoryId]: [...current, id] });
    setCustomInputs(prev => ({ ...prev, [categoryId]: '' }));
  }, [value, onChange, customInputs]);

  const getSelectedCount = (categoryId: TastingCategoryId) => {
    return value[categoryId]?.length || 0;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {TASTING_CATEGORY_ORDER.map(catId => {
        const category = TASTING_TAXONOMY.categories.find(c => c.id === catId);
        if (!category) return null;
        const isExpanded = expandedCategories.has(catId);
        const count = getSelectedCount(catId);
        const selected = value[catId] || [];

        return (
          <div key={catId} style={{
            borderRadius: '6px',
            border: '1px solid var(--tea-border)',
            overflow: 'hidden',
          }}>
            {/* Category header */}
            <button
              type="button"
              onClick={() => toggleCategory(catId)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'var(--tea-surface)',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--tea-text)',
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 500,
                letterSpacing: '0.04em',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {category.name}
                {count > 0 && (
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--tea-gold)',
                    fontWeight: 400,
                  }}>
                    {count}
                  </span>
                )}
              </span>
              <ChevronDown
                size={14}
                style={{
                  color: 'var(--tea-text-dim)',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ padding: '8px 12px 12px', background: 'var(--tea-bg)' }}>
                {/* Description */}
                <p style={{
                  fontSize: '11px',
                  color: 'var(--tea-text-dim)',
                  fontStyle: 'italic',
                  margin: '0 0 10px 0',
                  lineHeight: 1.4,
                }}>
                  {category.description}
                </p>

                {category.groups.map(group => (
                  <div key={group.label || 'default'} style={{ marginBottom: '10px' }}>
                    {group.label && (
                      <div style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'var(--tea-text-dim)',
                        marginBottom: '6px',
                        fontWeight: 500,
                      }}>
                        {group.label}
                      </div>
                    )}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: '4px',
                    }}>
                      {group.terms.map(term => {
                        const isSelected = selected.includes(term.id);
                        const termInfo = TERM_MAP.get(term.id);
                        const Icon = termInfo?.icon;
                        return (
                          <button
                            key={term.id}
                            type="button"
                            onClick={() => toggleTerm(catId, term.id)}
                            className={`tag-selectable ${isSelected ? 'tag-selectable-active' : ''}`}
                            style={{ fontFamily: 'var(--font-body)', textAlign: 'left' }}
                          >
                            {Icon && <Icon size={12} style={{ flexShrink: 0, opacity: isSelected ? 1 : 0.5 }} />}
                            {term.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Custom term input */}
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  marginTop: '8px',
                }}>
                  <input
                    type="text"
                    placeholder="Custom term..."
                    value={customInputs[catId] || ''}
                    onChange={e => setCustomInputs(prev => ({ ...prev, [catId]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTerm(catId); } }}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      fontSize: '12px',
                      background: 'var(--tea-surface)',
                      border: '1px solid var(--tea-border)',
                      borderRadius: '4px',
                      color: 'var(--tea-text)',
                      fontFamily: 'var(--font-body)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addCustomTerm(catId)}
                    style={{
                      padding: '5px 8px',
                      background: 'var(--tea-surface)',
                      border: '1px solid var(--tea-border)',
                      borderRadius: '4px',
                      color: 'var(--tea-text-dim)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
