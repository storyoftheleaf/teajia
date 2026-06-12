import React from 'react';
import { TEA_TYPES, type TeaType } from './types';

interface TypeGridProps {
  selected?: TeaType;
  onSelect: (type: TeaType) => void;
}

export const TypeGrid: React.FC<TypeGridProps> = ({ selected, onSelect }) => {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {TEA_TYPES.map((type) => {
        const active = selected === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className={`min-h-[44px] rounded-md border px-3 py-2 text-left text-ui-13 transition-colors ${
              active
                ? 'border-tea-gold/30 bg-tea-accent-sub text-tea-text'
                : 'border-tea-border bg-tea-bg text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text'
            }`}
          >
            {type}
          </button>
        );
      })}
    </div>
  );
};

export default TypeGrid;
