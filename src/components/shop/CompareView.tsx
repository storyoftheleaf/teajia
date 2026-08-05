import React from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { InventoryItem } from '../../types';
import { useShopPrice } from './shopPrice';

interface CompareViewProps {
  items: InventoryItem[];
  onClose: () => void;
}

export const CompareView: React.FC<CompareViewProps> = ({ items, onClose }) => {
  const { removeCompareItem, clearCompare } = useAppStore();
  // Comparing two teas is comparing two prices, so the prices have to be in one
  // currency, and it has to be the one the reader has been shopping in. This
  // row called the raw dollar formatter, so a reader browsing in Rupiah met
  // dollars in the one view whose entire purpose is holding numbers side by
  // side.
  const shopPrice = useShopPrice();

  if (items.length === 0) return null;

  const rows: { label: string; render: (item: InventoryItem) => React.ReactNode }[] = [
    {
      label: 'Type',
      render: (item) => (
        <span className="text-xs uppercase tracking-wider text-tea-gold">{item.type}</span>
      ),
    },
    {
      label: 'Origin',
      render: (item) => (
        <span className="text-sm text-tea-text">{item.origin || '\u2014'}</span>
      ),
    },
    {
      label: 'Year',
      render: (item) => (
        <span className="num text-sm text-tea-text">{item.year || '\u2014'}</span>
      ),
    },
    {
      label: 'Price / gram',
      render: (item) => {
        const ppg = parseFloat(item.price_per_gram || '0');
        return (
          <span className="num text-sm text-tea-gold font-medium">
            {ppg > 0 ? shopPrice.perGram(ppg) : '\u2014'}
          </span>
        );
      },
    },
    {
      label: 'Tasting Notes',
      render: (item) =>
        item.tags && item.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-ui-10 uppercase tracking-wider px-2 py-0.5 rounded-md bg-tea-accent-sub text-tea-text-sec border border-tea-border"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-tea-text-sec">{'\u2014'}</span>
        ),
    },
    {
      label: 'Mood',
      render: (item) => (
        <span className="text-sm italic text-tea-text-sec">{item.mood || '\u2014'}</span>
      ),
    },
    {
      label: 'Description',
      render: (item) => (
        <p className="text-sm leading-relaxed text-tea-text-sec line-clamp-4">
          {item.description || '\u2014'}
        </p>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-tea-bg/95 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative w-full h-full overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-tea-bg border-b border-tea-border">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm uppercase tracking-[0.15em] text-tea-text font-medium">
                Compare
              </h2>
              <span className="text-xs text-tea-text-sec">
                {items.length} {items.length === 1 ? 'tea' : 'teas'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={clearCompare}
                className="text-xs uppercase tracking-wider text-tea-text-sec hover:text-tea-gold transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Desktop: side-by-side columns */}
          <div className="hidden md:block">
            <table className="w-full border-collapse">
              {/* Product headers */}
              <thead>
                <tr>
                  <th className="w-32 p-3" />
                  {items.map((item) => (
                    <th key={item.id} className="p-3 text-left align-top">
                      <div className="relative bg-tea-surface border border-tea-border rounded-md p-4">
                        <button
                          onClick={() => removeCompareItem(item.id)}
                          className="absolute top-2 right-2 p-1 text-tea-text-sec hover:text-tea-gold transition-colors"
                          aria-label={`Remove ${item.name} from comparison`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {item.image && (
                          <div className="w-full aspect-square rounded-md overflow-hidden mb-3 bg-tea-accent-sub">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <h3 className="font-serif text-lg text-tea-text leading-tight">
                          {item.name}
                        </h3>
                        {item.chineseName && (
                          <p className="text-sm text-tea-text-sec mt-0.5">{item.chineseName}</p>
                        )}
                        <p className="text-xs text-tea-text-sec italic mt-1">{item.variant}</p>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-tea-border">
                    <td className="p-3 align-top">
                      <span className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec">
                        {row.label}
                      </span>
                    </td>
                    {items.map((item) => (
                      <td key={item.id} className="p-3 align-top">
                        {row.render(item)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-6">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-tea-surface border border-tea-border rounded-md overflow-hidden"
              >
                {/* Card header */}
                <div className="p-4 flex items-start gap-3 border-b border-tea-border">
                  {item.image && (
                    <div className="w-16 h-16 rounded-md overflow-hidden shrink-0 bg-tea-accent-sub">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif text-lg text-tea-text leading-tight">{item.name}</h3>
                    {item.chineseName && (
                      <p className="text-sm text-tea-text-sec mt-0.5">{item.chineseName}</p>
                    )}
                    <p className="text-xs text-tea-text-sec italic mt-0.5">{item.variant}</p>
                  </div>
                  <button
                    onClick={() => removeCompareItem(item.id)}
                    className="p-1 text-tea-text-sec hover:text-tea-gold transition-colors shrink-0"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Attributes */}
                <div className="divide-y divide-tea-border">
                  {rows.map((row) => (
                    <div key={row.label} className="px-4 py-2.5 flex items-start gap-3">
                      <span className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec w-20 shrink-0 pt-0.5">
                        {row.label}
                      </span>
                      <div className="flex-1">{row.render(item)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
