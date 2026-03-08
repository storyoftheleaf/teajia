import React from 'react';
import { Icons } from '../Icons';
import { TeaGlossary } from '../TeaGlossary';

const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-text/5 px-2 -ml-2';

interface GlossaryProps {
  onBack: () => void;
}

export const Glossary: React.FC<GlossaryProps> = ({ onBack }) => {
  return (
    <div className="w-full">
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-text/70" />
        <span className="font-serif text-sm text-tea-text/70">Learn</span>
      </button>

      <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-3 text-tea-text">
        Glossary
      </h1>
      <p className="font-serif text-base text-tea-text/60 mb-8">
        Terms, characters, meanings
      </p>

      <TeaGlossary isFullView={true} />
    </div>
  );
};
