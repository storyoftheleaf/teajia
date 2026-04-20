import React, { useState, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, Columns3, Columns2, Grid2x2 } from 'lucide-react';
/** Minimal shape for label printing — works with TeaSample or TeaCompassEntry */
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
  columns?: number;
  labelSize?: 'small' | 'medium';
  showSetName?: string;
  /** Custom base URL for QR codes (default: https://teajia.co/s/) */
  qrBaseUrl?: string;
}

const COLUMN_OPTIONS = [2, 3, 4] as const;

function LabelCell({ sample, size, qrBaseUrl }: { sample: LabelItem; size: 'small' | 'medium'; qrBaseUrl: string }) {
  const qrValue = `${qrBaseUrl}${sample.id}`;
  const qrPx = size === 'small' ? 56 : 66;
  const typeLine = [sample.type, sample.year].filter(Boolean).join(' \u00b7 ');

  return (
    <div className="label-cell relative flex items-center gap-1.5 overflow-hidden">
      {/* QR Code */}
      <div className="flex-shrink-0 label-qr">
        <QRCodeCanvas
          value={qrValue}
          size={qrPx}
          level="M"
          {...({ marginSize: 0 } as any)}
          bgColor="transparent"
          fgColor="#000000"
        />
      </div>

      {/* Text stack */}
      <div className="flex-1 min-w-0 flex flex-col justify-center leading-tight">
        <div
          className="font-serif font-bold truncate label-name"
          title={sample.name}
        >
          {sample.name || 'Unnamed'}
        </div>

        {sample.chineseName && (
          <div className="font-serif italic truncate label-chinese text-tea-text-sec print:text-neutral-600">
            {sample.chineseName}
          </div>
        )}

        {typeLine && (
          <div className="font-sans truncate label-meta text-tea-text-sec print:text-neutral-500">
            {typeLine}
          </div>
        )}

        {sample.originRegion && (
          <div className="font-sans truncate label-meta text-tea-text-dim print:text-neutral-400">
            {sample.originRegion}
          </div>
        )}
      </div>

      {/* Tiny ID in bottom-right */}
      <span className="absolute bottom-0.5 right-1 font-mono label-id text-tea-text-dim print:text-neutral-300 select-none">
        {sample.id.slice(0, 6)}
      </span>
    </div>
  );
}

export const SampleLabelSheet: React.FC<SampleLabelSheetProps> = ({
  samples,
  columns: initialColumns = 3,
  labelSize: initialSize = 'small',
  showSetName,
  qrBaseUrl = 'https://teajia.co/s/',
}) => {
  const [columns, setColumns] = useState<number>(initialColumns);
  const [labelSize, setLabelSize] = useState<'small' | 'medium'>(initialSize);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(samples.map(s => s.id)));

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (samples.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-tea-text-sec">
        <p className="text-sm">No samples to print.</p>
      </div>
    );
  }

  const columnIcon = (n: number) => {
    if (n === 2) return <Columns2 size={16} />;
    if (n === 3) return <Columns3 size={16} />;
    return <Grid2x2 size={16} />;
  };

  return (
    <>
      {/* ---- Print stylesheet ---- */}
      <style>{`
        @media print {
          /* Hide everything except the label sheet */
          body > *:not(#label-print-root),
          .print-hide {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #label-print-root {
            display: block !important;
          }

          /* Avery 5160 layout: 0.5in top/bottom, 0.1875in sides */
          .label-sheet {
            margin: 0.5in 0.1875in !important;
            padding: 0 !important;
            background: white !important;
          }
          .label-grid {
            display: grid !important;
            grid-template-columns: repeat(${columns}, 2.625in) !important;
            gap: 0 !important;
            width: auto !important;
          }
          .label-cell {
            width: 2.625in !important;
            height: 1in !important;
            padding: 0.0625in 0.1in !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            border: 0.5px dashed #ccc !important;
            background: white !important;
            color: black !important;
            break-inside: avoid !important;
          }
          .label-name {
            font-size: 9pt !important;
            line-height: 1.15 !important;
            color: black !important;
          }
          .label-chinese {
            font-size: 7.5pt !important;
            line-height: 1.15 !important;
            color: #444 !important;
          }
          .label-meta {
            font-size: 6.5pt !important;
            line-height: 1.2 !important;
            color: #555 !important;
          }
          .label-id {
            font-size: 5pt !important;
            color: #aaa !important;
          }
          .label-qr canvas {
            width: 0.7in !important;
            height: 0.7in !important;
          }
          /* Rows: avoid page-break inside a row */
          .label-row-group {
            break-inside: avoid !important;
          }
        }

        /* Screen label preview sizing */
        @media screen {
          .label-cell {
            border: 1px dashed var(--color-tea-border, #3a3a3a);
            border-radius: 4px;
          }
          .label-cell .label-name {
            font-size: 0.8rem;
          }
          .label-cell .label-chinese {
            font-size: 0.7rem;
          }
          .label-cell .label-meta {
            font-size: 0.625rem;
          }
          .label-cell .label-id {
            font-size: 0.5rem;
          }
        }
      `}</style>

      {/* ---- Screen header & controls ---- */}
      <div className="print-hide space-y-4 mb-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            {showSetName && (
              <h2 className="text-lg font-serif text-tea-text">{showSetName}</h2>
            )}
            <p className="text-sm text-tea-text-sec">
              {selectedIds.size} of {samples.length} label{samples.length !== 1 ? 's' : ''} selected
            </p>
            <p className="text-xs text-tea-text-dim mt-0.5">
              QR codes link to a public tasting page at teajia.co/s/— guests can scan and log their notes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider
                         bg-tea-gold text-tea-bg hover:bg-tea-gold/90 transition-colors"
            >
              <Printer size={14} />
              Print Labels
            </button>
          </div>
        </div>

        {/* Options row */}
        <div className="flex items-center gap-4 flex-wrap text-sm">
          {/* Column toggle */}
          <div className="flex items-center gap-1.5 text-tea-text-sec">
            <span className="text-xs uppercase tracking-wider mr-1">Columns</span>
            {COLUMN_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setColumns(n)}
                className={`p-1.5 rounded-md transition-colors ${
                  columns === n
                    ? 'bg-tea-gold/15 text-tea-gold'
                    : 'text-tea-text-dim hover:text-tea-text-sec'
                }`}
                aria-label={`${n} columns`}
              >
                {columnIcon(n)}
              </button>
            ))}
          </div>

          {/* Size toggle */}
          <div className="flex items-center gap-1.5 text-tea-text-sec">
            <span className="text-xs uppercase tracking-wider mr-1">Size</span>
            {(['small', 'medium'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setLabelSize(s)}
                className={`px-2.5 py-1 rounded-md text-xs capitalize transition-colors ${
                  labelSize === s
                    ? 'bg-tea-gold/15 text-tea-gold'
                    : 'text-tea-text-dim hover:text-tea-text-sec'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Per-sample selection */}
        <div className="print-hide border-t pt-3" style={{ borderColor: 'var(--tea-accent-sub)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-tea-text-dim">Select labels</span>
            <div className="flex gap-3 text-xs text-tea-text-dim">
              <button onClick={() => setSelectedIds(new Set(samples.map(s => s.id)))} className="hover:text-tea-text transition-colors">All</button>
              <button onClick={() => setSelectedIds(new Set())} className="hover:text-tea-text transition-colors">None</button>
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {samples.map((s) => (
              <label key={s.id} className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer hover:bg-tea-surface transition-colors">
                <input
                  type="checkbox"
                  checked={selectedIds.has(s.id)}
                  onChange={() => {
                    setSelectedIds(prev => {
                      const next = new Set(prev);
                      next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                      return next;
                    });
                  }}
                  className="accent-[var(--tea-gold)]"
                />
                <span className="text-sm text-tea-text truncate flex-1">{s.name || 'Unnamed'}</span>
                {s.type && <span className="text-[10px] text-tea-text-dim shrink-0">{s.type}</span>}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Label grid (visible on screen + print) ---- */}
      <div id="label-print-root">
        <div className="label-sheet">
          <div
            className="label-grid grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {samples.filter(s => selectedIds.has(s.id)).map((sample) => (
              <LabelCell key={sample.id} sample={sample} size={labelSize} qrBaseUrl={qrBaseUrl} />
            ))}
          </div>
        </div>
      </div>

    </>
  );
};
