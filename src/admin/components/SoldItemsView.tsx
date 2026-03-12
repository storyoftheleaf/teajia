import React, { useState } from 'react';
import Papa from 'papaparse';
import { Download, AlertCircle, Archive, ScrollText, Loader2 } from 'lucide-react';
import { Product } from '../types';
import { useActivityLogs } from '../hooks/useAdminData';
import { fmtNum } from '../../utils/formatNumber';

const ROW_HEIGHT = 36;

export const RecordsView = ({ products }: { products: Product[] }) => {
  const [activeTab, setActiveTab] = useState<'archive' | 'logs'>('archive');
  const soldOutProducts = products.filter(p => p.status === 'Sold Out');
  const { data: logs, isLoading: logsLoading } = useActivityLogs();

  const handleExportArchive = () => {
    const csv = Papa.unparse(soldOutProducts.map(p => ({
        Type: p.type,
        'Given Name': p.givenName,
        'Product Name': p.productName,
        Year: p.year,
        Origin: `${p.originRegion}, ${p.originCountry}`,
        Vendor: p.vendor || 'N/A',
        'Cost (USD)': p.costPerGramUSD,
        'Retail (USD)': p.pricePerGramUSD,
        'Last Stock': p.stockGrams,
    })));

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `teajia_sold_archive_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-tea-bg">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-tea-bg/90 backdrop-blur-md border-b border-tea-border py-2.5">
        <div className="px-6 max-w-7xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Archive size={16} className="text-tea-accent" />
            <h2 className="text-sm font-serif text-tea-text uppercase tracking-[0.15em]">
              System Records
            </h2>
          </div>

          {/* Tabs */}
          <div className="flex items-center bg-tea-surface rounded-lg border border-tea-border p-0.5 ml-4">
            <button
              onClick={() => setActiveTab('archive')}
              className={`px-3 py-1.5 rounded-md text-xs uppercase tracking-wider font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'archive' ? 'bg-tea-bg text-tea-text shadow-sm' : 'text-tea-text-dim hover:text-tea-text'}`}
            >
              <Archive size={12} /> Archive
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-md text-xs uppercase tracking-wider font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'logs' ? 'bg-tea-bg text-tea-text shadow-sm' : 'text-tea-text-dim hover:text-tea-text'}`}
            >
              <ScrollText size={12} /> Logbook
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {activeTab === 'archive' && (
              <button onClick={handleExportArchive} disabled={soldOutProducts.length === 0} className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-tea-text-dim hover:text-tea-text transition-colors px-3 py-1.5 border border-transparent hover:border-tea-border rounded-lg disabled:opacity-50">
                <Download size={14} /> Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-tea-bg md:px-6">

        {/* TAB: ARCHIVE */}
        {activeTab === 'archive' && (
          <div className="w-full max-w-7xl mx-auto bg-tea-surface min-h-full hidden md:block">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[12%]" />
                <col className="w-[15%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
                <tr>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-dim text-left">Product</th>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-dim text-left">Type</th>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-dim text-left">Vendor</th>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-dim text-right">Cost</th>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-dim text-right">Retail</th>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-dim text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {soldOutProducts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-16 text-tea-text-dim font-serif italic">No items in the archive.</td></tr>
                ) : (
                  soldOutProducts.map(product => (
                    <tr key={product.id} className="transition-colors border-b border-tea-border group hover:bg-tea-bg/50" style={{ height: ROW_HEIGHT }}>
                      <td className="px-4 align-middle overflow-hidden">
                        <div className="flex flex-col justify-center h-full">
                          <span className="text-sm font-serif text-tea-text tracking-wide truncate">{product.givenName || product.productName}</span>
                          {product.givenName && (
                            <span className="text-[10px] text-tea-text-dim font-sans mt-0.5 truncate block">{product.productName}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 align-middle overflow-hidden">
                        <span className="text-xs text-tea-text-dim truncate block">{product.type}</span>
                      </td>
                      <td className="px-4 align-middle overflow-hidden">
                        <span className="text-xs text-tea-text-dim truncate block">{product.vendor || '—'}</span>
                      </td>
                      <td className="px-4 align-middle overflow-hidden text-right">
                        <span className="num text-xs text-tea-text-dim">{product.costPerGramUSD != null ? `$${fmtNum(product.costPerGramUSD)}` : '-'}</span>
                      </td>
                      <td className="px-4 align-middle overflow-hidden text-right">
                        <span className="num text-xs text-tea-text">{product.pricePerGramUSD != null ? `$${fmtNum(product.pricePerGramUSD)}` : '-'}</span>
                      </td>
                      <td className="px-4 align-middle text-center">
                        <span className="text-[10px] uppercase font-bold tracking-wider bg-tea-bg text-tea-text-dim border border-tea-border px-2 py-1 rounded-sm">Sold Out</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB: ARCHIVE — Mobile */}
        {activeTab === 'archive' && (
          <div className="md:hidden pb-24">
            {soldOutProducts.length === 0 ? (
              <div className="text-center py-16 text-tea-text-dim font-serif italic">No items in the archive.</div>
            ) : (
              soldOutProducts.map((product, idx) => (
                <div
                  key={product.id}
                  className={`px-4 py-2.5 flex items-center gap-3 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-tea-text text-sm font-serif truncate">{product.givenName || product.productName}</div>
                    <div className="text-[10px] text-tea-text-dim/70 mt-0.5">{product.type} · {product.vendor || '—'}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-tea-text/80 tabular-nums">${fmtNum(product.pricePerGramUSD)}</div>
                    <div className="text-[10px] text-tea-text-dim/60">Sold Out</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: LOGBOOK */}
        {activeTab === 'logs' && (
          <>
            {logsLoading ? (
              <div className="p-12 text-center text-tea-text-dim font-serif italic"><Loader2 className="animate-spin inline mr-2" /> Fetching logs...</div>
            ) : (
              <div className="w-full max-w-7xl mx-auto bg-tea-surface min-h-full hidden md:block">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="w-[20%]" />
                    <col className="w-[15%]" />
                    <col className="w-[15%]" />
                    <col className="w-[50%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
                    <tr>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-dim text-left">Timestamp</th>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-dim text-left">User</th>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-dim text-left">Action</th>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-dim text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!logs || logs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-16 text-tea-text-dim">
                          <AlertCircle size={24} className="inline opacity-30 mb-2" /><br />
                          <span className="font-serif italic">No activity recorded yet.</span>
                        </td>
                      </tr>
                    ) : (
                      logs.map((log: any) => (
                        <tr key={log.id} className="transition-colors border-b border-tea-border group hover:bg-tea-bg/50" style={{ height: ROW_HEIGHT }}>
                          <td className="px-4 align-middle overflow-hidden">
                            <span className="text-xs text-tea-text-dim font-mono">{new Date(log.created_at).toLocaleString()}</span>
                          </td>
                          <td className="px-4 align-middle overflow-hidden">
                            <span className="text-xs text-tea-text">{log.user_email || 'System'}</span>
                          </td>
                          <td className="px-4 align-middle overflow-hidden">
                            <span className="text-xs text-tea-accent font-mono uppercase">{log.action}</span>
                          </td>
                          <td className="px-4 align-middle overflow-hidden">
                            <span className="text-xs text-tea-text-dim truncate block">{log.details}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Logs — Mobile */}
            {!logsLoading && (
              <div className="md:hidden pb-24">
                {!logs || logs.length === 0 ? (
                  <div className="text-center py-16 text-tea-text-dim font-serif italic">No activity recorded yet.</div>
                ) : (
                  logs.map((log: any, idx: number) => (
                    <div
                      key={log.id}
                      className={`px-4 py-2.5 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'}`}
                    >
                      <div className="flex items-center gap-2 text-[10px] text-tea-text-dim/70">
                        <span className="font-mono">{new Date(log.created_at).toLocaleString()}</span>
                        <span className="opacity-40">·</span>
                        <span>{log.user_email || 'System'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-tea-accent font-mono uppercase">{log.action}</span>
                        <span className="text-xs text-tea-text-dim truncate">{log.details}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
