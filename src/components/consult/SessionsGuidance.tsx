import React from 'react';
import { Icons } from '../Icons';

interface SessionsGuidanceProps {
  onBack: () => void;
  onOpenInquiry: (preselect?: string) => void;
}

export const SessionsGuidance: React.FC<SessionsGuidanceProps> = ({ onBack, onOpenInquiry }) => {
  return (
    <div className="animate-[fadeIn_0.5s_ease-out]">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-tea-ink/50 dark:text-tea-paper/50 hover:text-tea-seal transition-colors duration-300 mb-8"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-xs uppercase tracking-widest">Back</span>
      </button>

      {/* Header */}
      <div className="mb-10">
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-tea-ink dark:text-tea-paper font-light leading-tight mb-4">
          Sessions & Guidance
        </h1>
        <p className="text-tea-ink/70 dark:text-tea-paper/70 text-lg md:text-xl leading-relaxed">
          Choose your path
        </p>
      </div>

      {/* Two cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        {/* Sessions card */}
        <div className="border border-tea-ink/10 dark:border-white/10 rounded-sm p-8 flex flex-col hover:border-tea-seal/30 transition-colors duration-300">
          <h2 className="font-serif text-xl md:text-2xl text-tea-ink dark:text-tea-paper mb-3">
            Sessions
          </h2>
          <p className="text-tea-ink/70 dark:text-tea-paper/70 text-base leading-relaxed mb-2">
            Experience tea with me
          </p>
          <p className="text-tea-ink/50 dark:text-tea-paper/50 text-sm leading-relaxed mb-8">
            Private or group, in Bali
          </p>
          <div className="mt-auto">
            <button
              onClick={() => onOpenInquiry('Personal session or practice guidance')}
              className="inline-flex items-center gap-2 text-tea-seal hover:text-tea-seal/80 transition-colors duration-300 group"
            >
              <span className="text-sm uppercase tracking-wider font-medium">Inquire</span>
              <Icons.Next className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* Guidance card */}
        <div className="border border-tea-ink/10 dark:border-white/10 rounded-sm p-8 flex flex-col hover:border-tea-seal/30 transition-colors duration-300">
          <h2 className="font-serif text-xl md:text-2xl text-tea-ink dark:text-tea-paper mb-3">
            Guidance
          </h2>
          <p className="text-tea-ink/70 dark:text-tea-paper/70 text-base leading-relaxed mb-2">
            Learn and deepen your practice
          </p>
          <p className="text-tea-ink/50 dark:text-tea-paper/50 text-sm leading-relaxed mb-8">
            Digital or in person
          </p>
          <div className="mt-auto">
            <button
              onClick={() => onOpenInquiry('Personal session or practice guidance')}
              className="inline-flex items-center gap-2 text-tea-seal hover:text-tea-seal/80 transition-colors duration-300 group"
            >
              <span className="text-sm uppercase tracking-wider font-medium">Inquire</span>
              <Icons.Next className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
