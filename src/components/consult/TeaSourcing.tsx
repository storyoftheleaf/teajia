import React from 'react';
import { Icons } from '../Icons';

interface TeaSourcingProps {
  onBack: () => void;
  onOpenInquiry: () => void;
}

export const TeaSourcing: React.FC<TeaSourcingProps> = ({ onBack, onOpenInquiry }) => {
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
      <div className="mb-12">
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-tea-ink dark:text-tea-paper font-light leading-tight mb-4">
          Tea Sourcing
        </h1>
        <p className="text-tea-ink/70 dark:text-tea-paper/70 text-lg md:text-xl leading-relaxed max-w-2xl">
          Quality tea for collectors, spaces, and businesses
        </p>
      </div>

      {/* Body */}
      <div className="max-w-xl space-y-6 mb-12">
        <p className="text-tea-ink/80 dark:text-tea-paper/80 text-base leading-relaxed">
          For individual collectors seeking access to rare and exceptional teas.
        </p>
        <p className="text-tea-ink/80 dark:text-tea-paper/80 text-base leading-relaxed">
          For retreat centers, hotels, cafes, and communities wanting to bring quality tea into what they do.
        </p>
        <p className="text-tea-ink/80 dark:text-tea-paper/80 text-base leading-relaxed">
          I source directly from Taiwan, China, and trusted origins.
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={onOpenInquiry}
        className="inline-flex items-center gap-2 px-6 py-3 bg-tea-seal text-white uppercase tracking-wider text-xs font-medium rounded-sm hover:bg-tea-seal/90 transition-all duration-300"
      >
        Inquire
        <Icons.Next className="w-4 h-4" />
      </button>
    </div>
  );
};
