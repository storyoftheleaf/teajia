import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { TeaCompassEntry } from './types';

interface DetectedIntent {
  type: 'price' | 'grams' | 'year';
  label: string;
  value: number | string;
  currency?: string;
}

const PRICE_PATTERN = /(?:(NT\$|NT|USD|\$|¥|CNY|MYR|IDR|HKD|RM|Rp)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(NT\$|NT|USD|\$|¥|CNY|MYR|IDR|HKD|RM|Rp))/gi;
const GRAMS_PATTERN = /\b(\d+)\s*g(?:rams?)?\b/gi;
const YEAR_PATTERN = /\b(19[5-9]\d|20[0-2]\d)\b/g;

const CURRENCY_MAP: Record<string, string> = {
  'NT$': 'NT', 'NT': 'NT', 'USD': 'USD', '$': 'USD', '¥': 'Yuan',
  'CNY': 'Yuan', 'MYR': 'MYR', 'RM': 'MYR', 'IDR': 'IDR', 'Rp': 'IDR', 'HKD': 'HKD',
};

function detectIntents(text: string): DetectedIntent[] {
  const intents: DetectedIntent[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;

  PRICE_PATTERN.lastIndex = 0;
  while ((match = PRICE_PATTERN.exec(text)) !== null) {
    const sym = match[1] || match[4];
    const raw = (match[2] || match[3]).replace(',', '.');
    const amount = parseFloat(raw);
    const currency = CURRENCY_MAP[sym] || 'NT';
    const key = `price-${amount}-${currency}`;
    if (!seen.has(key) && !isNaN(amount)) {
      seen.add(key);
      intents.push({ type: 'price', label: `${sym}${Math.round(amount)}`, value: amount, currency });
    }
  }

  GRAMS_PATTERN.lastIndex = 0;
  while ((match = GRAMS_PATTERN.exec(text)) !== null) {
    const grams = parseInt(match[1], 10);
    const key = `grams-${grams}`;
    if (!seen.has(key) && grams > 0 && grams <= 5000) {
      seen.add(key);
      intents.push({ type: 'grams', label: `${grams}g`, value: grams });
    }
  }

  YEAR_PATTERN.lastIndex = 0;
  while ((match = YEAR_PATTERN.exec(text)) !== null) {
    const year = parseInt(match[1], 10);
    const key = `year-${year}`;
    if (!seen.has(key)) {
      seen.add(key);
      intents.push({ type: 'year', label: String(year), value: year });
    }
  }

  return intents;
}

interface IntentBarProps {
  entry: TeaCompassEntry;
  onApply: (updates: Partial<TeaCompassEntry>) => void;
}

export const IntentBar: React.FC<IntentBarProps> = ({ entry, onApply }) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [intents, setIntents] = useState<DetectedIntent[]>([]);

  useEffect(() => {
    if (!entry.notes.trim()) { setIntents([]); return; }
    const detected = detectIntents(entry.notes);
    setIntents(detected);
  }, [entry.notes]);

  const actionable = intents.filter((intent) => {
    const key = `${intent.type}-${intent.value}`;
    if (dismissed.has(key)) return false;
    if (intent.type === 'price' && entry.priceAmount != null) return false;
    if (intent.type === 'grams' && entry.pricePerUnitGrams != null) return false;
    if (intent.type === 'year' && entry.year != null) return false;
    return true;
  });

  if (actionable.length === 0) {
    return null;
  }

  const handleApply = (intent: DetectedIntent) => {
    const key = `${intent.type}-${intent.value}`;
    if (intent.type === 'price') {
      onApply({ priceAmount: intent.value as number, priceCurrency: (intent.currency as any) || entry.priceCurrency });
    } else if (intent.type === 'grams') {
      onApply({ pricePerUnitGrams: intent.value as number });
    } else if (intent.type === 'year') {
      onApply({ year: intent.value as number });
    }
    setDismissed((prev) => new Set([...prev, key]));
  };

  const handleDismiss = (intent: DetectedIntent) => {
    const key = `${intent.type}-${intent.value}`;
    setDismissed((prev) => new Set([...prev, key]));
  };

  return (
    <div className="flex items-center gap-2 px-1 flex-wrap">
      <Sparkles size={11} className="text-tea-gold/60 shrink-0" />
      <span className="text-ui-12 text-tea-text-dim shrink-0">Detected:</span>
      {actionable.map((intent) => {
        const key = `${intent.type}-${intent.value}`;
        return (
          <span key={key} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleApply(intent)}
              className="tap-target min-h-11 px-1 text-ui-12 text-tea-gold/80 hover:text-tea-gold underline underline-offset-2 decoration-dashed transition-colors"
            >
              {intent.label}
            </button>
            <button
              type="button"
              onClick={() => handleDismiss(intent)}
              className="tap-target min-h-11 min-w-11 text-ui-12 text-tea-text-dim hover:text-tea-text-sec transition-colors"
              aria-label={`Dismiss detected ${intent.label}`}
            >
              <X size={8} />
            </button>
          </span>
        );
      })}
    </div>
  );
};

export default IntentBar;
