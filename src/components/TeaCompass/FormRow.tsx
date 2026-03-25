import React from 'react';
import { TEA_FORMS, type TeaForm } from './types';

interface FormRowProps {
  selected?: TeaForm;
  onSelect: (form: TeaForm) => void;
}

export const FormRow: React.FC<FormRowProps> = ({ selected, onSelect }) => {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {TEA_FORMS.map((form) => (
        <button
          key={form}
          type="button"
          onClick={() => onSelect(form)}
          className={`whitespace-nowrap ${selected === form ? 'pill-active' : 'pill'}`}
        >
          {form}
        </button>
      ))}
    </div>
  );
};

export default FormRow;
