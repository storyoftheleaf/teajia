import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { SessionFlowItem } from '../../../../types/events';
import { inputClass } from '../shared';
import SectionHeader from './SectionHeader';

export interface SessionFlowSectionProps {
  sessionFlow: SessionFlowItem[];
  isOpen: boolean;
  onToggle: () => void;
  onAddFlowItem: () => void;
  onUpdateFlowItem: (idx: number, field: keyof SessionFlowItem, value: any) => void;
  onRemoveFlowItem: (idx: number) => void;
  onMoveFlowItem: (idx: number, dir: -1 | 1) => void;
}

const SessionFlowSection: React.FC<SessionFlowSectionProps> = ({
  sessionFlow,
  isOpen,
  onToggle,
  onAddFlowItem,
  onUpdateFlowItem,
  onRemoveFlowItem,
  onMoveFlowItem,
}) => {
  return (
    <div className="border-b border-tea-border">
      <SectionHeader label="Session Flow" count={sessionFlow.length} isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="pb-6 space-y-3">
          {sessionFlow.map((item, idx) => (
            <div key={idx} className="flex gap-3 items-start border-b border-tea-border pb-3">
              <div className="flex flex-col gap-1 shrink-0 mt-1">
                <button type="button" onClick={() => onMoveFlowItem(idx, -1)} disabled={idx === 0} className="text-tea-text-sec hover:text-tea-text disabled:opacity-20 transition-colors">
                  <ArrowUp size={12} />
                </button>
                <button type="button" onClick={() => onMoveFlowItem(idx, 1)} disabled={idx === sessionFlow.length - 1} className="text-tea-text-sec hover:text-tea-text disabled:opacity-20 transition-colors">
                  <ArrowDown size={12} />
                </button>
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => onUpdateFlowItem(idx, 'title', e.target.value)}
                  className={inputClass}
                  placeholder="Step title"
                />
                <input
                  type="text"
                  value={item.description || ''}
                  onChange={(e) => onUpdateFlowItem(idx, 'description', e.target.value)}
                  className={inputClass}
                  placeholder="Description"
                />
              </div>
              <div className="w-16 shrink-0">
                <input
                  type="number"
                  value={item.duration_minutes}
                  onChange={(e) => onUpdateFlowItem(idx, 'duration_minutes', parseInt(e.target.value) || 0)}
                  className={`${inputClass} text-center text-xs`}
                  min={0}
                  title="Minutes"
                />
                <span className="text-ui-9 text-tea-text-sec block text-center">min</span>
              </div>
              <button type="button" aria-label="Remove step" onClick={() => onRemoveFlowItem(idx)} className="text-tea-text-sec hover:text-tea-text p-1 mt-1 tap-target">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onAddFlowItem}
            className="flex items-center gap-1 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors"
          >
            <Plus size={12} /> Add Step
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(SessionFlowSection);
