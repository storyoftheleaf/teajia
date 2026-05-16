import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer } from 'lucide-react';
import type { LedgerTransaction, LedgerLineItem } from '../../lib/ledgerStore';
import type { TeaCompassEntry } from './types';

// A tag can come from either a ledger line item (bought) or a compass entry (sample/logged)
interface TagItem {
  id: string;
  name: string;
  chineseName?: string;
  type?: string;
  form?: string;
  year?: number;
  originRegion?: string;
  compassEntryId?: string;
  vendorName?: string;
}

function fromLineItem(item: LedgerLineItem, vendorName: string): TagItem {
  return {
    id: item.id,
    name: item.name,
    chineseName: item.chineseName,
    type: item.type,
    form: item.form,
    year: item.year,
    compassEntryId: item.compassEntryId,
    vendorName,
  };
}

function fromCompassEntry(entry: TeaCompassEntry): TagItem {
  return {
    id: entry.id,
    name: entry.name || 'Unnamed',
    chineseName: entry.chineseName,
    type: entry.type,
    form: entry.form,
    year: entry.year,
    originRegion: entry.originRegion,
    compassEntryId: entry.id,
    vendorName: entry.vendorName,
  };
}

interface TeaTagSheetProps {
  /** Print tags for all items in a ledger transaction */
  transaction?: LedgerTransaction;
  /** Print tags for specific compass entries (samples, library selection) */
  entries?: TeaCompassEntry[];
  onClose: () => void;
}

export const TeaTagSheet: React.FC<TeaTagSheetProps> = ({ transaction, entries, onClose }) => {
  const baseUrl = window.location.origin;

  const tags: TagItem[] = transaction
    ? transaction.items.map((item) => fromLineItem(item, transaction.counterpartyName))
    : (entries || []).map(fromCompassEntry);

  const contextLabel = transaction
    ? `${transaction.counterpartyName} · ${new Date(transaction.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    : `${tags.length} ${tags.length === 1 ? 'tag' : 'tags'}`;

  return (
    <>
      {/* Print styles: hide everything except this sheet */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #tea-tag-sheet-root {
            display: flex !important;
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: white;
            flex-direction: column;
          }
          .tag-no-print { display: none !important; }
          .tag-grid-item {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* bg-white kept literal — this sheet is designed for printing tea tags; the screen view mirrors the print output */}
      <div
        id="tea-tag-sheet-root"
        className="fixed inset-0 z-50 bg-white flex flex-col"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {/* Controls bar */}
        <div className="tag-no-print flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-medium text-gray-900">Tea Tags</h2>
            <p className="text-xs text-gray-500 mt-0.5">{contextLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400">Print · cut · attach to tin or bag</p>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={16} />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg text-sm font-medium rounded-xl hover:bg-tea-gold/90 transition-colors"
            >
              <Printer size={14} />
              Print
            </button>
          </div>
        </div>

        {/* Tag grid — scrollable preview */}
        <div className="flex-1 overflow-auto bg-gray-50 p-8">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, 85mm)',
              gap: '5mm',
              justifyContent: 'center',
            }}
          >
            {tags.map((tag) => {
              const url = tag.compassEntryId
                ? `${baseUrl}/admin/compass?entry=${encodeURIComponent(tag.compassEntryId)}`
                : null;

              return (
                <div
                  key={tag.id}
                  className="tag-grid-item"
                  style={{
                    width: '85mm',
                    minHeight: '45mm',
                    border: '0.5px solid #ccc',
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'stretch',
                    backgroundColor: 'white',
                    overflow: 'hidden',
                  }}
                >
                  {/* QR code */}
                  {url && (
                    <div
                      style={{
                        width: '44mm',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4mm',
                        borderRight: '0.5px solid #eee',
                      }}
                    >
                      <QRCodeSVG
                        value={url}
                        size={108}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#1a1a1a"
                      />
                    </div>
                  )}

                  {/* Text */}
                  <div
                    style={{
                      flex: 1,
                      padding: '4mm 4mm 4mm 3.5mm',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: '1.8mm',
                    }}
                  >
                    {/* English name */}
                    <div style={{ fontSize: '9.5pt', fontWeight: '700', color: '#111', lineHeight: 1.25 }}>
                      {tag.name}
                    </div>

                    {/* Chinese name */}
                    {tag.chineseName && (
                      <div style={{ fontSize: '9pt', color: '#444', lineHeight: 1.2, fontFamily: 'STSong, SimSun, serif' }}>
                        {tag.chineseName}
                      </div>
                    )}

                    {/* Type · Form · Year */}
                    {(tag.type || tag.year || tag.form) && (
                      <div style={{ fontSize: '7.5pt', color: '#666', lineHeight: 1.3 }}>
                        {[tag.type, tag.form !== 'Loose' ? tag.form : null, tag.year].filter(Boolean).join(' · ')}
                      </div>
                    )}

                    {/* Region */}
                    {tag.originRegion && (
                      <div style={{ fontSize: '7.5pt', color: '#888' }}>
                        {tag.originRegion}
                      </div>
                    )}

                    {/* Vendor · Date */}
                    <div
                      style={{
                        fontSize: '7pt',
                        color: '#aaa',
                        marginTop: '0.5mm',
                        borderTop: '0.5px solid #f0f0f0',
                        paddingTop: '1.5mm',
                      }}
                    >
                      {[
                        tag.vendorName,
                        transaction
                          ? new Date(transaction.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                          : new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default TeaTagSheet;
