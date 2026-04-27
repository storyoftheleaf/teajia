import React, { useState, useCallback, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Check, Printer } from 'lucide-react';

interface LabelItem {
  id: string;
  name: string;
  chineseName?: string;
  type?: string;
  year?: number;
  originRegion?: string;
}

interface SampleLabelSheetProps {
  samples: LabelItem[];
  columns?: 2 | 3;
  labelSize?: 'small' | 'medium';
  showSetName?: string;
  qrBaseUrl?: string;
}

// 4-column removed: 4 × 2.625in = 10.5in which overflows 8.5in letter paper
const COLUMN_OPTIONS = [2, 3] as const;
// Avery 5160: 10 rows per sheet
const AVERY_ROWS_PER_SHEET = 10;

function LabelCell({
  sample,
  qrBaseUrl,
  qrSize,
}: {
  sample: LabelItem;
  qrBaseUrl: string;
  qrSize: number;
}) {
  const typeLine = [sample.type, sample.year].filter(Boolean).join(' · ');

  return (
    <div className="label-cell">
      <div className="label-qr">
        <QRCodeCanvas
          value={`${qrBaseUrl}${sample.id}`}
          size={qrSize}
          level="M"
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      <div className="label-body">
        <div className="label-name">{sample.name || 'Unnamed'}</div>
        {sample.chineseName && (
          <div className="label-chinese">{sample.chineseName}</div>
        )}
        {typeLine && <div className="label-meta">{typeLine}</div>}
        {sample.originRegion && (
          <div className="label-region">{sample.originRegion}</div>
        )}
      </div>
      <span className="label-id">{sample.id.slice(0, 6)}</span>
    </div>
  );
}

export const SampleLabelSheet: React.FC<SampleLabelSheetProps> = ({
  samples,
  columns: initialColumns = 3,
  labelSize: initialSize = 'medium',
  showSetName,
  qrBaseUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://teajia.co'}/s/`,
}) => {
  const [columns, setColumns] = useState<2 | 3>(initialColumns ?? 3);
  const [labelSize, setLabelSize] = useState(initialSize);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(samples.map(s => s.id))
  );

  const selected = useMemo(
    () => samples.filter(s => selectedIds.has(s.id)),
    [samples, selectedIds]
  );

  const hasSelection = selected.length > 0;
  const pageEstimate = Math.max(1, Math.ceil(selected.length / (columns * AVERY_ROWS_PER_SHEET)));
  const qrSize = labelSize === 'small' ? 52 : 62;

  const toggleOne = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  if (samples.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-tea-text-sec">
        <p className="text-sm">No samples to print.</p>
      </div>
    );
  }

  return (
    <>
      {/* print-color-adjust ensures QR code fill isn't stripped by the browser */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body > * { visibility: hidden; }
          #label-print-root,
          #label-print-root * { visibility: visible; }
          #label-print-root {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
          }
          .label-sheet-inner {
            margin: 0.5in 0.1875in;
            padding: 0;
            background: white;
          }
          .label-print-grid {
            display: grid !important;
            grid-template-columns: repeat(${columns}, 2.625in) !important;
            gap: 0 !important;
            padding: 0 !important;
          }
          .label-row-group {
            display: contents !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .label-cell {
            width: 2.625in !important;
            height: 1in !important;
            padding: 0.05in 0.05in 0.05in 0.04in !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            border: 0.5px dashed #ccc !important;
            background: white !important;
            break-inside: avoid !important;
            display: flex !important;
            align-items: center !important;
            gap: 0.07in !important;
            position: relative !important;
          }
          .label-qr {
            flex-shrink: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border-radius: 0 !important;
          }
          .label-qr canvas {
            width: 0.7in !important;
            height: 0.7in !important;
          }
          .label-body {
            flex: 1 !important;
            min-width: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            padding-bottom: 8pt !important;
          }
          .label-name {
            font-size: 8.5pt !important;
            font-weight: 700 !important;
            line-height: 1.2 !important;
            color: black !important;
            font-family: Georgia, serif !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .label-chinese {
            font-size: 7pt !important;
            line-height: 1.2 !important;
            color: #333 !important;
            font-family: Georgia, serif !important;
            font-style: italic !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .label-meta {
            font-size: 6pt !important;
            line-height: 1.3 !important;
            color: #555 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .label-region {
            font-size: 6pt !important;
            line-height: 1.3 !important;
            color: #666 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .label-id {
            position: absolute !important;
            bottom: 2.5pt !important;
            right: 4pt !important;
            font-size: 5pt !important;
            color: #bbb !important;
            font-family: monospace !important;
            letter-spacing: 0.02em !important;
          }
          .print-hide { display: none !important; }
        }

        @media screen {
          .label-cell {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 7px 8px 16px 7px;
            position: relative;
            background: #faf7f2;
            border: 1px dashed rgba(180, 155, 110, 0.35);
            border-radius: 2px;
            overflow: hidden;
            min-height: 72px;
          }
          .label-qr {
            flex-shrink: 0;
            background: white;
            border-radius: 2px;
            padding: 2px;
            line-height: 0;
          }
          .label-body {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .label-name {
            font-size: 11px;
            font-weight: 600;
            line-height: 1.3;
            color: #1a1008;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-family: var(--font-display, Georgia, serif);
          }
          .label-chinese {
            font-size: 9px;
            line-height: 1.3;
            color: #5a4432;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-family: var(--font-display, Georgia, serif);
            font-style: italic;
          }
          .label-meta {
            font-size: 8.5px;
            line-height: 1.3;
            color: #7a6450;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .label-region {
            font-size: 8px;
            line-height: 1.3;
            color: #9a8468;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .label-id {
            position: absolute;
            bottom: 3px;
            right: 5px;
            font-size: 7px;
            color: #c0ab8a;
            font-family: monospace;
            letter-spacing: 0.05em;
          }
          .label-print-grid {
            display: grid;
            gap: 5px;
          }
          .label-row-group {
            display: contents;
          }
          .label-sheet-inner {
            background: #f5f0e8;
            border-radius: 4px;
            padding: 12px;
            margin: 12px auto 32px;
            width: calc(100% - 40px);
            box-shadow: 0 4px 32px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.2);
            max-width: 640px;
          }
        }
      `}</style>

      {/* Controls — sticky within the scrollable container so they stay accessible during preview */}
      <div className="print-hide sticky top-0 z-10 bg-tea-bg/98 backdrop-blur-sm border-b border-tea-border shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
        {/* Info row */}
        <div className="px-5 pt-4 pb-2">
          {showSetName && (
            <p className="text-ui-10 font-medium uppercase tracking-widest text-tea-text-dim mb-1">
              {showSetName}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm ${!hasSelection ? 'text-tea-gold/70' : 'text-tea-text'}`}>
              {selected.length} of {samples.length} label{samples.length !== 1 ? 's' : ''} selected
            </span>
            {hasSelection ? (
              <span className="text-xs text-tea-text-dim">
                · ~{pageEstimate} sheet{pageEstimate !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-xs text-tea-gold/50">— select labels to print</span>
            )}
          </div>
          <p className="text-ui-10 text-tea-text-dim mt-1 leading-relaxed">
            QR links to <span className="font-mono text-tea-text-sec">teajia.co/s/</span>
            {' · '}Format: <span className="text-tea-text-sec">Avery 5160</span> · 8.5 × 11in, 30 per sheet
          </p>
        </div>

        {/* Controls + Print button row */}
        <div className="px-5 pb-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-ui-10 font-medium uppercase tracking-widest text-tea-text-dim">
              Columns
            </span>
            <div className="flex rounded-md border border-tea-border overflow-hidden">
              {COLUMN_OPTIONS.map((n, i) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setColumns(n)}
                  className={`w-9 py-1.5 text-xs font-medium transition-colors ${
                    i > 0 ? 'border-l border-tea-border' : ''
                  } ${
                    columns === n
                      ? 'bg-tea-gold/15 text-tea-gold'
                      : 'text-tea-text-dim hover:text-tea-text hover:bg-tea-surface'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-ui-10 font-medium uppercase tracking-widest text-tea-text-dim">
              Size
            </span>
            <div className="flex rounded-md border border-tea-border overflow-hidden">
              {(['Small', 'Medium'] as const).map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setLabelSize(s.toLowerCase() as 'small' | 'medium')}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    i > 0 ? 'border-l border-tea-border' : ''
                  } ${
                    labelSize === s.toLowerCase()
                      ? 'bg-tea-gold/15 text-tea-gold'
                      : 'text-tea-text-dim hover:text-tea-text hover:bg-tea-surface'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!hasSelection}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                hasSelection
                  ? 'bg-tea-gold text-tea-bg hover:bg-tea-gold/90'
                  : 'bg-tea-surface text-tea-text-dim cursor-not-allowed'
              }`}
            >
              <Printer size={12} />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Label selection list */}
      <div className="print-hide px-5 py-3 border-b border-tea-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ui-10 font-medium uppercase tracking-widest text-tea-text-dim">
            Select labels
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set(samples.map(s => s.id)))}
              className="text-ui-10 font-medium uppercase tracking-widest text-tea-text-sec hover:text-tea-gold transition-colors"
            >
              All
            </button>
            <span className="text-tea-text-dim text-ui-10">·</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-ui-10 font-medium uppercase tracking-widest text-tea-text-sec hover:text-tea-gold transition-colors"
            >
              None
            </button>
          </div>
        </div>
        <div className="max-h-44 overflow-y-auto overscroll-contain space-y-0.5">
          {samples.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-2.5 px-1 py-1.5 rounded cursor-pointer hover:bg-tea-surface/60 transition-colors select-none"
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedIds.has(s.id)}
                onChange={() => toggleOne(s.id)}
              />
              <span
                className={`flex-shrink-0 w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                  selectedIds.has(s.id)
                    ? 'bg-tea-gold border-tea-gold'
                    : 'border-tea-border bg-transparent'
                }`}
              >
                {selectedIds.has(s.id) && (
                  <Check size={9} strokeWidth={3} className="text-tea-bg" />
                )}
              </span>
              <span className="text-xs text-tea-text truncate flex-1">
                {s.name || 'Unnamed'}
              </span>
              {s.type && (
                <span className="text-ui-10 text-tea-text-dim shrink-0">{s.type}</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Preview heading */}
      <div className="print-hide px-5 pt-3">
        <span className="text-ui-10 font-medium uppercase tracking-widest text-tea-text-dim">
          Preview
        </span>
      </div>

      {/* Label grid — screen preview + print target */}
      <div id="label-print-root">
        <div className="label-sheet-inner">
          {hasSelection ? (
            <div
              className="label-print-grid"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {/* Row groups: display:contents on screen keeps grid flow; break-inside:avoid on print */}
              {Array.from({ length: Math.ceil(selected.length / columns) }, (_, rowIdx) => (
                <div key={rowIdx} className="label-row-group">
                  {selected.slice(rowIdx * columns, (rowIdx + 1) * columns).map((sample) => (
                    <LabelCell
                      key={sample.id}
                      sample={sample}
                      qrBaseUrl={qrBaseUrl}
                      qrSize={qrSize}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="print-hide py-10 text-center">
              <p className="text-xs text-tea-text-dim">No labels selected — check the list above.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
