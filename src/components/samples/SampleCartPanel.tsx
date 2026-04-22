import React, { useState } from 'react';
import { FlaskConical, Printer, MessageCircle, BookOpen, Trash2, X, Check } from 'lucide-react';
import { useSampleCartStore } from '../../samples/sampleCartStore';
import { useSampleStore } from '../../samples/sampleStore';
import { createEmptySample, createEmptySampleSet } from '../../samples/types';

const GRAM_PRESETS = [5, 10, 15, 25, 50];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildWhatsAppText(items: ReturnType<typeof useSampleCartStore.getState>['items']): string {
  if (items.length === 0) return '';

  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const vendor = item.vendorName || 'Unknown Vendor';
    if (!grouped.has(vendor)) grouped.set(vendor, []);
    grouped.get(vendor)!.push(item);
  }

  const lines: string[] = ['*Sample List*', ''];
  for (const [vendor, vendorItems] of grouped) {
    lines.push(`_${vendor}_`);
    for (const item of vendorItems) {
      const name = item.chineseName ? `${item.name} (${item.chineseName})` : item.name;
      lines.push(`• ${name} — ${item.grams}g`);
    }
    lines.push('');
  }
  lines.push(`_${items.length} tea${items.length !== 1 ? 's' : ''} · ${items.reduce((s, i) => s + i.grams, 0)}g total_`);
  return lines.join('\n');
}

function buildPrintContent(items: ReturnType<typeof useSampleCartStore.getState>['items']): string {
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const vendor = item.vendorName || 'Unknown Vendor';
    if (!grouped.has(vendor)) grouped.set(vendor, []);
    grouped.get(vendor)!.push(item);
  }

  let html = `<html><head><title>Sample List</title><style>
    body { font-family: Georgia, serif; padding: 40px; color: #222; max-width: 600px; }
    h1 { font-size: 22px; margin-bottom: 24px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #777; margin: 20px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    li { font-size: 14px; margin: 6px 0; list-style: none; display: flex; justify-content: space-between; }
    .grams { color: #888; font-size: 12px; }
    .total { margin-top: 24px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
  </style></head><body>`;
  html += `<h1>Sample List</h1>`;
  for (const [vendor, vendorItems] of grouped) {
    html += `<h2>${vendor}</h2><ul>`;
    for (const item of vendorItems) {
      const name = item.chineseName ? `${item.name} <span style="color:#888">${item.chineseName}</span>` : item.name;
      html += `<li><span>${name}</span><span class="grams">${item.grams}g</span></li>`;
    }
    html += `</ul>`;
  }
  const totalGrams = items.reduce((s, i) => s + i.grams, 0);
  html += `<div class="total">${items.length} tea${items.length !== 1 ? 's' : ''} · ${totalGrams}g total</div>`;
  html += `</body></html>`;
  return html;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SampleCartPanelProps {
  onClose?: () => void;
}

export const SampleCartPanel: React.FC<SampleCartPanelProps> = ({ onClose }) => {
  const items = useSampleCartStore((s) => s.items);
  const removeItem = useSampleCartStore((s) => s.removeItem);
  const updateGrams = useSampleCartStore((s) => s.updateGrams);
  const clear = useSampleCartStore((s) => s.clear);

  const addSample = useSampleStore((s) => s.addSample);
  const addSampleSet = useSampleStore((s) => s.addSampleSet);

  const [savedConfirm, setSavedConfirm] = useState(false);

  const isEmpty = items.length === 0;
  const totalGrams = items.reduce((s, i) => s + i.grams, 0);

  // Group by vendor
  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const v = item.vendorName || 'Unknown';
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(item);
    }
    return [...map.entries()];
  }, [items]);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=700,height=600');
    if (!win) return;
    win.document.write(buildPrintContent(items));
    win.document.close();
    win.focus();
    win.print();
  };

  const handleWhatsApp = () => {
    const text = buildWhatsAppText(items);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleSaveAsSet = () => {
    const set = createEmptySampleSet({ purpose: 'sourcing' });
    set.name = `Sample Cart — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const samples = items.map((item) => {
      const s = createEmptySample(set.id, {
        sourceName: item.vendorName,
        type: item.type as any,
      });
      s.name = item.name;
      s.chineseName = item.chineseName;
      s.grams = item.grams;
      s.compassEntryId = item.compassEntryId;
      s.productId = item.productId;
      return s;
    });

    set.sampleIds = samples.map((s) => s.id);
    addSampleSet(set);
    for (const sample of samples) addSample(sample);

    clear();
    setSavedConfirm(true);
    setTimeout(() => setSavedConfirm(false), 3000);
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-tea-border">
        <div className="flex items-center gap-2">
          <FlaskConical size={15} className="text-tea-gold" />
          <span className="font-serif text-[15px] text-tea-text">Sample List</span>
          {!isEmpty && (
            <span className="text-[11px] text-tea-text-dim tabular-nums">
              {items.length} tea{items.length !== 1 ? 's' : ''} · {totalGrams}g
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isEmpty && (
            <button
              type="button"
              onClick={clear}
              className="p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated transition-colors"
              title="Clear all"
            >
              <Trash2 size={13} />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <FlaskConical size={28} className="text-tea-gold/20 mb-4" />
            <p className="font-serif text-[14px] text-tea-text/50 mb-1">Your sample list is empty</p>
            <p className="text-[12px] text-tea-text-dim max-w-[200px] leading-relaxed">
              Tap the flask icon on any tea to add it here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-tea-border">
            {grouped.map(([vendor, vendorItems]) => (
              <div key={vendor}>
                <div className="px-4 py-2 bg-tea-elevated/50">
                  <span className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim font-medium">
                    {vendor}
                  </span>
                </div>
                <div className="divide-y divide-tea-border/50">
                  {vendorItems.map((item) => (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-[13px] text-tea-text font-serif truncate">{item.name || 'Unnamed'}</p>
                          {item.chineseName && (
                            <p className="text-[11px] text-tea-text-dim font-chinese leading-snug">{item.chineseName}</p>
                          )}
                          {item.type && (
                            <p className="text-[10px] text-tea-text-dim mt-0.5">{item.type}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="shrink-0 p-1 rounded text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated transition-colors mt-0.5"
                          aria-label="Remove"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      {/* Gram presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {GRAM_PRESETS.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => updateGrams(item.id, g)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                              item.grams === g
                                ? 'bg-tea-gold/15 text-tea-gold'
                                : 'bg-tea-elevated text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface'
                            }`}
                          >
                            {g}g
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer actions ── */}
      {!isEmpty && (
        <div className="shrink-0 px-4 py-3 border-t border-tea-border space-y-2">

          {savedConfirm ? (
            <div className="flex items-center justify-center gap-2 py-2 text-[12px] text-tea-gold">
              <Check size={13} />
              Saved as Sample Set — cart cleared
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSaveAsSet}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-tea-gold/10 text-tea-gold text-[12px] font-semibold hover:bg-tea-gold/15 transition-colors"
            >
              <BookOpen size={13} />
              Save as Sample Set
            </button>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-tea-border text-tea-text-sec text-[12px] hover:bg-tea-surface transition-colors"
            >
              <Printer size={13} />
              Print
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-tea-border text-tea-text-sec text-[12px] hover:bg-tea-surface transition-colors"
            >
              <MessageCircle size={13} />
              WhatsApp
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default SampleCartPanel;
