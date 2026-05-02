import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { api } from '../../lib/api';
import { TEA_TYPE_COLORS } from '../../designTokens';
import type { TeaCompassEntry } from './types';

interface VendorHistoryProps {
  vendorId?: string;
  vendorName?: string;
  onBuyAgain: (entry: {
    name: string;
    type?: string;
    form?: string;
    priceAmount?: number;
    priceCurrency: string;
    pricePerUnitGrams?: number;
  }) => void;
}

// Unified item shape for display
interface HistoryItem {
  id: string;
  name: string;
  type?: string;
  form?: string;
  priceAmount?: number;
  priceCurrency: string;
  pricePerUnitGrams?: number;
  source: 'compass' | 'inventory';
  status: 'want' | 'draft' | 'in-stock' | 'bought' | 'logged' | 'buying';
  sortOrder: number;
}

const STATUS_CONFIG: Record<HistoryItem['status'], { label: string; dotColor: string }> = {
  want:     { label: 'Want',     dotColor: 'var(--tea-gold)' },
  buying:   { label: 'Buying',   dotColor: 'var(--tea-gold)' },
  draft:    { label: 'Draft',    dotColor: 'var(--tea-text-sec)' },
  'in-stock': { label: 'In Stock', dotColor: 'var(--tea-gold-lt)' },
  bought:   { label: 'Bought',   dotColor: 'var(--tea-text-dim)' },
  logged:   { label: 'Logged',   dotColor: 'var(--tea-text-dim)' },
};

const SORT_ORDER: Record<HistoryItem['status'], number> = {
  want: 0,
  buying: 1,
  draft: 2,
  'in-stock': 3,
  bought: 4,
  logged: 5,
};

function compassStatusToHistoryStatus(s: TeaCompassEntry['status']): HistoryItem['status'] {
  if (s === 'want') return 'want';
  if (s === 'buying') return 'buying';
  if (s === 'in_stock') return 'bought';
  return 'logged';
}

function getTypeBadgeStyle(type?: string): React.CSSProperties {
  const color = TEA_TYPE_COLORS[type as keyof typeof TEA_TYPE_COLORS]?.card ?? '#737373';
  return {
    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
    color,
  };
}

export const VendorHistory: React.FC<VendorHistoryProps> = ({
  vendorId,
  vendorName,
  onBuyAgain,
}) => {
  const entries = useTeaCompassStore((s) => s.entries);

  // API products state
  const [apiProducts, setApiProducts] = useState<any[]>([]);
  const [fetched, setFetched] = useState(false);

  // Expanded item for "buy again" detail
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch vendor products from API when vendorId is set
  useEffect(() => {
    if (!vendorId) {
      setApiProducts([]);
      setFetched(true);
      return;
    }

    let cancelled = false;
    setFetched(false);

    api.customers.getSuppliedProducts(vendorId)
      .then((data) => {
        if (!cancelled) {
          setApiProducts(Array.isArray(data) ? data : data?.products ?? []);
          setFetched(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiProducts([]);
          setFetched(true);
        }
      });

    return () => { cancelled = true; };
  }, [vendorId]);

  // Build unified list
  const items = useMemo(() => {
    const result: HistoryItem[] = [];
    const seen = new Set<string>();

    // 1. Compass entries for this vendor
    const matchName = vendorName?.toLowerCase();
    const compassForVendor = entries.filter((e) => {
      if (vendorId && e.vendorId === vendorId) return true;
      if (matchName && e.vendorName?.toLowerCase() === matchName) return true;
      return false;
    });

    for (const e of compassForVendor) {
      const status = compassStatusToHistoryStatus(e.status);
      result.push({
        id: `compass-${e.id}`,
        name: e.name || '(untitled)',
        type: e.type,
        form: e.form,
        priceAmount: e.priceAmount,
        priceCurrency: e.priceCurrency,
        pricePerUnitGrams: e.pricePerUnitGrams,
        source: 'compass',
        status,
        sortOrder: SORT_ORDER[status],
      });
      // Track by name to avoid duplicates with inventory
      if (e.name) seen.add(e.name.toLowerCase());
    }

    // 2. API products
    for (const p of apiProducts) {
      const name = p.given_name || p.givenName || p.product_name || p.productName || '';
      if (name && seen.has(name.toLowerCase())) continue;

      const rawStatus = (p.status || '').toLowerCase();
      let status: HistoryItem['status'] = 'in-stock';
      if (rawStatus === 'draft') status = 'draft';
      else if (rawStatus === 'archived' || rawStatus === 'sold out') status = 'bought';

      result.push({
        id: `inv-${p.id}`,
        name,
        type: p.type,
        form: p.form,
        priceAmount: p.price_per_gram_usd || p.pricePerGramUSD,
        priceCurrency: 'USD',
        pricePerUnitGrams: undefined,
        source: 'inventory',
        status,
        sortOrder: SORT_ORDER[status],
      });
    }

    // Sort: want first, then draft, in-stock, bought, logged
    result.sort((a, b) => a.sortOrder - b.sortOrder);

    return result;
  }, [entries, apiProducts, vendorId, vendorName]);

  // Don't render if no items or still loading with no data
  if (!fetched && !items.length) return null;
  if (items.length === 0) return null;

  const handleItemTap = (item: HistoryItem) => {
    setExpandedId((prev) => (prev === item.id ? null : item.id));
  };

  const handleBuyAgain = (item: HistoryItem) => {
    onBuyAgain({
      name: item.name,
      type: item.type,
      form: item.form,
      priceAmount: item.priceAmount,
      priceCurrency: item.priceCurrency,
      pricePerUnitGrams: item.pricePerUnitGrams,
    });
    setExpandedId(null);
  };

  return (
    <div className="space-y-1.5 mb-3">
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="text-ui-10 text-tea-text-sec uppercase tracking-caps font-serif">
          From {vendorName || 'this vendor'}
        </span>
        {items.length > 3 && (
          <span className="text-ui-11 text-tea-text-dim flex items-center gap-0.5">
            See all <ChevronRight size={10} />
          </span>
        )}
      </div>

      {/* Horizontal scroll strip */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {items.map((item) => {
          const cfg = STATUS_CONFIG[item.status];
          const isExpanded = expandedId === item.id;
          const typeColor = item.type ? TEA_TYPE_COLORS[item.type as keyof typeof TEA_TYPE_COLORS]?.card : null;

          return (
            <div
              key={item.id}
              className="min-w-[130px] max-w-[155px] shrink-0 flex flex-col"
            >
              {/* Card */}
              <button
                type="button"
                onClick={() => handleItemTap(item)}
                className="bg-tea-surface rounded-lg p-2.5 text-left transition-colors hover:bg-tea-elevated w-full"
                style={typeColor ? { borderTop: `2px solid ${typeColor}35` } : undefined}
              >
                {/* Name */}
                <p className="text-tea-text text-ui-12 font-serif truncate leading-tight">
                  {item.name}
                </p>

                {/* Type badge + status row */}
                <div className="flex items-center gap-1.5 mt-2">
                  {item.type && (
                    <span
                      className="text-ui-10 font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                      style={getTypeBadgeStyle(item.type)}
                    >
                      {item.type}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-ui-11 text-tea-text-sec ml-auto">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: cfg.dotColor }}
                    />
                    {cfg.label}
                  </span>
                </div>
              </button>

              {/* Expanded detail / buy again */}
              {isExpanded && (
                <div className="bg-tea-surface rounded-b-lg px-2.5 pb-2.5 -mt-1 pt-1.5 space-y-1.5">
                  {item.priceAmount != null && (
                    <p className="text-ui-11 text-tea-text-sec num">
                      {item.priceCurrency === 'USD' ? '$' : item.priceCurrency + ' '}
                      {item.priceAmount}
                      {item.pricePerUnitGrams ? ` / ${item.pricePerUnitGrams}g` : ''}
                    </p>
                  )}
                  {item.form && (
                    <p className="text-ui-11 text-tea-text-sec">{item.form}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleBuyAgain(item)}
                    className="pill-active flex items-center gap-1 text-ui-11 w-full justify-center py-1.5"
                  >
                    <RotateCcw size={10} />
                    Add to order
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VendorHistory;
