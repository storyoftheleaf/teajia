import React, { useState } from 'react';
import { CostCurrency } from '../../types';
import { CURRENCY_SYMBOLS } from '../../utils/currency';

type DisplayCurrency = 'USD' | 'CNY' | 'JPY';
const DISPLAY_CURRENCIES: DisplayCurrency[] = ['USD', 'CNY', 'JPY'];

interface CurrencyToggleProps {
  currency: DisplayCurrency;
  onCurrencyChange: (currency: DisplayCurrency) => void;
  unit: 'g' | 'oz';
  onUnitChange: (unit: 'g' | 'oz') => void;
}

export const CurrencyToggle: React.FC<CurrencyToggleProps> = ({
  currency,
  onCurrencyChange,
  unit,
  onUnitChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase tracking-widest font-mono text-tea-paper/70 bg-white/5 border border-white/10 rounded-sm hover:bg-white/10 transition-colors"
      >
        <span>{CURRENCY_SYMBOLS[currency as CostCurrency]}</span>
        <span className="opacity-50">·</span>
        <span>{unit}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-[101] bg-tea-elevated border border-tea-border rounded-sm shadow-2xl overflow-hidden animate-[scaleIn_0.15s_ease-out] origin-top-right min-w-[140px]">
            {/* Currency options */}
            <div className="border-b border-white/5 px-3 py-2">
              <span className="text-[9px] uppercase tracking-widest text-white/40">Currency</span>
            </div>
            {DISPLAY_CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => { onCurrencyChange(c); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/10 transition-colors flex items-center justify-between ${
                  currency === c ? 'text-tea-gold' : 'text-tea-paper/70'
                }`}
              >
                <span>{CURRENCY_SYMBOLS[c as CostCurrency]} {c}</span>
                {currency === c && <span className="text-tea-gold">✓</span>}
              </button>
            ))}

            {/* Unit options */}
            <div className="border-t border-white/5 border-b border-white/5 px-3 py-2">
              <span className="text-[9px] uppercase tracking-widest text-white/40">Weight</span>
            </div>
            {(['g', 'oz'] as const).map((u) => (
              <button
                key={u}
                onClick={() => { onUnitChange(u); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/10 transition-colors flex items-center justify-between ${
                  unit === u ? 'text-tea-gold' : 'text-tea-paper/70'
                }`}
              >
                <span>{u === 'g' ? 'Grams (g)' : 'Ounces (oz)'}</span>
                {unit === u && <span className="text-tea-gold">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export type { DisplayCurrency };
