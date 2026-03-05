import React from 'react';
import { Icons } from '../Icons';
import { teaMapPins } from '../../data/teaMapPins';

const TYPE_STYLES: Record<string, { label: string; color: string }> = {
  'tea-house': { label: 'Tea House', color: 'bg-tea-seal/10 text-tea-seal border border-tea-seal/20' },
  'shop': { label: 'Shop', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-400/30' },
  'farm': { label: 'Farm', color: 'bg-tea-green/10 text-tea-green border border-tea-green/30' },
  'space': { label: 'Space', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-400/30' },
};

interface TeaMapProps {
  onBack: () => void;
}

export const TeaMap: React.FC<TeaMapProps> = ({ onBack }) => {
  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      {/* Back */}
      <div className="mb-4 -mx-2 md:mx-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 w-full px-3 py-3 rounded-none md:rounded-lg bg-tea-ink/[0.03] dark:bg-white/[0.03] hover:bg-tea-ink/[0.06] dark:hover:bg-white/[0.06] transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-tea-seal/10 dark:bg-tea-seal/20 flex items-center justify-center shrink-0">
            <Icons.Back className="w-4 h-4 text-tea-seal" />
          </div>
          <span className="text-sm font-medium text-tea-seal">Library</span>
          <span className="text-tea-ink/20 dark:text-tea-paper/20">/</span>
          <span className="text-sm text-tea-ink/50 dark:text-tea-paper/50 truncate">Tea Map</span>
        </button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h2 className="font-serif text-xl text-tea-ink dark:text-tea-paper mb-1">Tea Map</h2>
        <p className="text-sm text-tea-ink/50 dark:text-tea-paper/50 font-serif italic">
          Tea houses, shops, and spaces worth visiting
        </p>
      </div>

      {/* Pins list */}
      <div className="flex flex-col gap-4">
        {teaMapPins.map(pin => {
          const style = TYPE_STYLES[pin.type] || TYPE_STYLES['space'];
          return (
            <div
              key={pin.id}
              className="rounded-[2px] border border-tea-ink/10 dark:border-white/10 bg-tea-ink/[0.02] dark:bg-white/[0.02] p-4 md:p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-tea-seal/10 dark:bg-tea-seal/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icons.Location className="w-5 h-5 text-tea-seal" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-serif text-base text-tea-ink dark:text-tea-paper font-medium">
                      {pin.name}
                    </h3>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${style.color}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className="text-xs text-tea-ink/40 dark:text-tea-paper/40 mb-2">
                    {pin.location}
                  </p>
                  <p className="text-sm text-tea-ink/70 dark:text-tea-paper/70 leading-relaxed">
                    {pin.note}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
