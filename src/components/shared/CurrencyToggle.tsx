import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.15em] font-mono text-tea-text/70 bg-tea-gold/5 border border-tea-gold/10 rounded-sm hover:bg-tea-gold/10 transition-colors overflow-hidden"
      >
        {/* Flip animation on currency/unit change */}
        <AnimatePresence mode="wait">
          <motion.span
            key={`${currency}-${unit}`}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <span>{CURRENCY_SYMBOLS[currency as CostCurrency]}</span>
            <span className="opacity-50">&middot;</span>
            <span>{unit}</span>
          </motion.span>
        </AnimatePresence>
      </button>

      <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-modal" onClick={() => setIsOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full right-0 mt-1 z-modal bg-tea-elevated border border-tea-border rounded-sm shadow-2xl overflow-hidden origin-top-right min-w-[140px]"
          >
            {/* Currency options */}
            <div className="border-b border-tea-border px-3 py-2">
              <span className="text-[9px] uppercase tracking-[0.15em] text-tea-text-sec">Currency</span>
            </div>
            {DISPLAY_CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => { onCurrencyChange(c); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-tea-gold/10 transition-colors flex items-center justify-between ${
                  currency === c ? 'text-tea-gold' : 'text-tea-text/70'
                }`}
              >
                <span>{CURRENCY_SYMBOLS[c as CostCurrency]} {c}</span>
                {currency === c && <span className="text-tea-gold">&#10003;</span>}
              </button>
            ))}

            {/* Unit options */}
            <div className="border-t border-tea-border border-b border-tea-border px-3 py-2">
              <span className="text-[9px] uppercase tracking-[0.15em] text-tea-text-sec">Weight</span>
            </div>
            {(['g', 'oz'] as const).map((u) => (
              <button
                key={u}
                onClick={() => { onUnitChange(u); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-tea-gold/10 transition-colors flex items-center justify-between ${
                  unit === u ? 'text-tea-gold' : 'text-tea-text/70'
                }`}
              >
                <span>{u === 'g' ? 'Grams (g)' : 'Ounces (oz)'}</span>
                {unit === u && <span className="text-tea-gold">&#10003;</span>}
              </button>
            ))}
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
};

export type { DisplayCurrency };
