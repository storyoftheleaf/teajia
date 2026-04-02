import React, { useState, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, Columns3, Columns2, Grid2x2, FileDown } from 'lucide-react';
import type { TeaSample } from './types';

interface SampleLabelSheetProps {
  samples: TeaSample[];
  columns?: number;
  labelSize?: 'small' | 'medium';
  showSetName?: string;
}

const COLUMN_OPTIONS = [2, 3, 4] as const;

function LabelCell({ sample, size }: { sample: TeaSample; size: 'small' | 'medium' }) {
  const qrValue = `https://teajia.co/s/${sample.id}`;
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
          marginSize={0}
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
}) => {
  const [columns, setColumns] = useState<number>(initialColumns);
  const [labelSize, setLabelSize] = useState<'small' | 'medium'>(initialSize);
  const [toastVisible, setToastVisible] = useState(false);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportPdf = useCallback(() => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
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
              {samples.length} label{samples.length !== 1 ? 's' : ''} ready to print
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                         bg-tea-surface text-tea-text-sec hover:text-tea-text transition-colors"
            >
              <FileDown size={14} />
              Export PDF
            </button>
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
            {samples.map((sample) => (
              <LabelCell key={sample.id} sample={sample} size={labelSize} />
            ))}
          </div>
        </div>
      </div>

      {/* ---- Coming soon toast ---- */}
      {toastVisible && (
        <div className="print-hide fixed bottom-20 left-1/2 -translate-x-1/2 z-50
                        bg-tea-surface text-tea-text text-sm px-4 py-2.5 rounded-lg shadow-lg
                        animate-fade-in">
          PDF export coming soon
        </div>
      )}
    </>
  );
};
