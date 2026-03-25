import React from 'react';
import { TEA_TYPES, type TeaType } from './types';

interface TypeGridProps {
  selected?: TeaType;
  onSelect: (type: TeaType) => void;
}

export const TypeGrid: React.FC<TypeGridProps> = ({ selected, onSelect }) => {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {TEA_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className={selected === type ? 'pill-active' : 'pill'}
        >
          {type}
        </button>
      ))}
    </div>
  );
};

export default TypeGrid;
