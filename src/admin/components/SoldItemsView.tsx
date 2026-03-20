import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { Download, AlertCircle, Archive, ScrollText, Loader2, Search, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, BarChart3, RefreshCw } from 'lucide-react';
import { Product } from '../types';
import { useActivityLogs, useStockLedger } from '../hooks/useAdminData';
import { api } from '../../lib/api';
import { useToast } from './Toast';
import { fmtNum } from '../../utils/formatNumber';

const ROW_HEIGHT = 36;
const PAGE_SIZE = 50;

const ACTION_TYPES = [
  { value: '', label: 'All' },
  { value: 'FULFILLMENT', label: 'Fulfillment' },
  { value: 'INVOICE_CREATED', label: 'Created' },
  { value: 'INVOICE_VOIDED', label: 'Voided' },
  { value: 'INVOICE_EDITED', label: 'Edited' },
  { value: 'INVOICE_SPLIT', label: 'Split' },
  { value: 'INVOICE_DELETED', label: 'Deleted' },
  { value: 'STOCK_ADJUSTED', label: 'Stock Adj.' },
  { value: 'PRODUCT_SOLD_OUT', label: 'Sold Out' },
];

const REASON_LABELS: Record<string, string> = {
  FULFILLMENT: 'Sale',
  VOID: 'Void Restore',
  MANUAL_ADJUST: 'Manual',
  IMPORT: 'Import',
  CREATION: 'Created',
};

export const RecordsView = ({ products, initialTab }: { products: Product[]; initialTab?: 'archive' | 'log' | 'ledger' }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const mappedInitial = initialTab === 'log' ? 'logs' : (initialTab || 'archive');
  const [activeTab, setActiveTab] = useState<'archive' | 'logs' | 'ledger'>(mappedInitial as any);
  const soldOutProducts = products.filter(p => p.status === 'Sold Out');

  // Logbook state
  const [logOffset, setLogOffset] = useState(0);
  const [logAction, setLogAction] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logSearchInput, setLogSearchInput] = useState('');

  const { data: logData, isLoading: logsLoading } = useActivityLogs({
    limit: PAGE_SIZE,
    offset: logOffset,
    action: logAction || undefined,
    search: logSearch || undefined,
  });
  const logs = logData?.logs || [];
  const logsTotal = logData?.total || 0;

  // Stock ledger state
  const [ledgerOffset, setLedgerOffset] = useState(0);
  const { data: ledgerData, isLoading: ledgerLoading } = useStockLedger(null, PAGE_SIZE, ledgerOffset);
  const ledgerEntries = ledgerData?.entries || [];
  const ledgerTotal = ledgerData?.total || 0;

  // Archive reactivation
  const [reactivating, setReactivating] = useState<string | null>(null);
  const handleReactivate = async (product: Product) => {
    setReactivating(product.id);
    try {
      await api.products.update(product.id, { status: 'Active' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast(`${product.givenName || product.productName} reactivated.`, 'success');
    } catch (err: any) {
      showToast('Reactivation failed: ' + err.message, 'error');
    }
    setReactivating(null);
  };

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

  const handleLogSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLogSearch(logSearchInput);
    setLogOffset(0);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-tea-bg">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-tea-bg/90 backdrop-blur-md border-b border-tea-border py-2.5">
        <div className="px-6 max-w-7xl mx-auto flex items-center gap-4 flex-wrap">
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
              className={`px-3 py-1.5 rounded-md text-xs uppercase tracking-wider font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'archive' ? 'bg-tea-bg text-tea-text shadow-sm' : 'text-tea-text-sec hover:text-tea-text'}`}
            >
              <Archive size={12} /> Archive
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-md text-xs uppercase tracking-wider font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'logs' ? 'bg-tea-bg text-tea-text shadow-sm' : 'text-tea-text-sec hover:text-tea-text'}`}
            >
              <ScrollText size={12} /> Logbook
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1.5 rounded-md text-xs uppercase tracking-wider font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'ledger' ? 'bg-tea-bg text-tea-text shadow-sm' : 'text-tea-text-sec hover:text-tea-text'}`}
            >
              <BarChart3 size={12} /> Stock Ledger
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {activeTab === 'archive' && (
              <button onClick={handleExportArchive} disabled={soldOutProducts.length === 0} className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-tea-text-sec hover:text-tea-text transition-colors px-3 py-1.5 border border-transparent hover:border-tea-border rounded-lg disabled:opacity-50">
                <Download size={14} /> Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Logbook filters row */}
        {activeTab === 'logs' && (
          <div className="px-6 max-w-7xl mx-auto flex items-center gap-2 mt-2 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {ACTION_TYPES.map(at => (
                <button
                  key={at.value}
                  onClick={() => { setLogAction(at.value); setLogOffset(0); }}
                  className={logAction === at.value ? 'pill-active' : 'pill'}
                >
                  {at.label}
                </button>
              ))}
            </div>
            <form onSubmit={handleLogSearch} className="relative w-40 ml-auto">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" />
              <input
                type="text"
                placeholder="Search details..."
                value={logSearchInput}
                onChange={(e) => setLogSearchInput(e.target.value)}
                className="w-full bg-transparent border-b border-tea-border rounded-none pl-7 pr-3 py-1 text-xs text-tea-text outline-none focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
              />
            </form>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-tea-bg md:px-6">

        {/* TAB: ARCHIVE */}
        {activeTab === 'archive' && (
          <div className="w-full max-w-7xl mx-auto bg-tea-surface min-h-full hidden md:block">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[10%]" />
                <col className="w-[13%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[16%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
                <tr>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">Product</th>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">Type</th>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">Vendor</th>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-right">Cost</th>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-right">Retail</th>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-center">Sold Out</th>
                  <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {soldOutProducts.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3 text-tea-text-sec">
                      <Archive size={32} strokeWidth={1} className="opacity-40" />
                      <span className="font-serif italic">No sold out products.</span>
                    </div>
                  </td></tr>
                ) : (
                  soldOutProducts.map(product => (
                    <tr key={product.id} className="transition-colors border-b border-tea-border group hover:bg-tea-bg/50" style={{ height: ROW_HEIGHT }}>
                      <td className="px-4 align-middle overflow-hidden">
                        <div className="flex flex-col justify-center h-full">
                          <button
                            onClick={() => navigate(`/admin/catalog?search=${encodeURIComponent(product.givenName || product.productName)}`)}
                            className="text-sm font-serif text-tea-text tracking-wide truncate hover:text-tea-accent transition-colors text-left"
                          >
                            {product.givenName || product.productName}
                          </button>
                          {product.givenName && (
                            <span className="text-[10px] text-tea-text-sec font-sans mt-0.5 truncate block">{product.productName}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 align-middle overflow-hidden">
                        <span className="text-xs text-tea-text-sec truncate block">{product.type}</span>
                      </td>
                      <td className="px-4 align-middle overflow-hidden">
                        <span className="text-xs text-tea-text-sec truncate block">{product.vendor || '—'}</span>
                      </td>
                      <td className="px-4 align-middle overflow-hidden text-right">
                        <span className="num text-xs text-tea-text-sec">{product.costPerGramUSD != null ? `$${fmtNum(product.costPerGramUSD)}` : '-'}</span>
                      </td>
                      <td className="px-4 align-middle overflow-hidden text-right">
                        <span className="num text-xs text-tea-text">{product.pricePerGramUSD != null ? `$${fmtNum(product.pricePerGramUSD)}` : '-'}</span>
                      </td>
                      <td className="px-4 align-middle text-center">
                        <span className="text-[10px] text-tea-text-sec/60">
                          {(product as any).soldOutAt ? new Date((product as any).soldOutAt).toLocaleDateString() : '—'}
                        </span>
                      </td>
                      <td className="px-4 align-middle text-center">
                        <button
                          onClick={() => handleReactivate(product)}
                          disabled={reactivating === product.id}
                          className="text-xs text-tea-gold hover:text-tea-gold/80 flex items-center gap-1 transition-colors mx-auto disabled:opacity-50"
                        >
                          {reactivating === product.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <RefreshCw size={12} />
                          )}
                          Reactivate
                        </button>
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
              <div className="flex flex-col items-center gap-3 py-16 text-tea-text-sec">
                <Archive size={32} strokeWidth={1} className="opacity-40" />
                <span className="font-serif italic">No sold out products.</span>
              </div>
            ) : (
              soldOutProducts.map((product, idx) => (
                <div
                  key={product.id}
                  className={`px-4 py-2.5 flex items-center gap-3 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-tea-text text-sm font-serif truncate">{product.givenName || product.productName}</div>
                    <div className="text-[10px] text-tea-text-sec/70 mt-0.5">{product.type} · {product.vendor || '—'}</div>
                  </div>
                  <button
                    onClick={() => handleReactivate(product)}
                    disabled={reactivating === product.id}
                    className="text-[10px] text-tea-gold hover:text-tea-gold/80 transition-colors shrink-0 disabled:opacity-50"
                  >
                    {reactivating === product.id ? <Loader2 size={10} className="animate-spin" /> : 'Reactivate'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: LOGBOOK */}
        {activeTab === 'logs' && (
          <>
            {logsLoading ? (
              <div className="p-12 text-center text-tea-text-sec font-serif italic"><Loader2 className="animate-spin inline mr-2" /> Fetching logs...</div>
            ) : (
              <div className="w-full max-w-7xl mx-auto bg-tea-surface min-h-full hidden md:block">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-[54%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
                    <tr>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">Timestamp</th>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">User</th>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">Action</th>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-16 text-tea-text-sec">
                          <AlertCircle size={24} className="inline opacity-30 mb-2" /><br />
                          <span className="font-serif italic">No activity recorded yet.</span>
                          {(logAction || logSearch) && (
                            <button
                              onClick={() => { setLogAction(''); setLogSearch(''); setLogSearchInput(''); setLogOffset(0); }}
                              className="block text-xs text-tea-gold hover:text-tea-gold/80 mx-auto mt-2 transition-colors"
                            >
                              Clear filters
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      logs.map((log: any) => (
                        <tr key={log.id} className="transition-colors border-b border-tea-border group hover:bg-tea-bg/50" style={{ height: ROW_HEIGHT }}>
                          <td className="px-4 align-middle overflow-hidden">
                            <span className="text-xs text-tea-text-sec font-mono">{new Date(log.created_at).toLocaleString()}</span>
                          </td>
                          <td className="px-4 align-middle overflow-hidden">
                            <span className="text-xs text-tea-text">{log.user_email || 'System'}</span>
                          </td>
                          <td className="px-4 align-middle overflow-hidden">
                            <span className="badge-status badge-status-default text-[9px]">{log.action}</span>
                          </td>
                          <td className="px-4 align-middle overflow-hidden">
                            <span className="text-xs text-tea-text-sec truncate block">{log.details}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {logsTotal > PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-tea-border bg-tea-bg">
                    <span className="text-[10px] text-tea-text-sec">{logOffset + 1}–{Math.min(logOffset + PAGE_SIZE, logsTotal)} of {logsTotal}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setLogOffset(Math.max(0, logOffset - PAGE_SIZE))}
                        disabled={logOffset === 0}
                        className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setLogOffset(logOffset + PAGE_SIZE)}
                        disabled={logOffset + PAGE_SIZE >= logsTotal}
                        className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Logs — Mobile */}
            {!logsLoading && (
              <div className="md:hidden pb-24">
                {logs.length === 0 ? (
                  <div className="text-center py-16 text-tea-text-sec font-serif italic">No activity recorded yet.</div>
                ) : (
                  <>
                    {logs.map((log: any, idx: number) => (
                      <div
                        key={log.id}
                        className={`px-4 py-2.5 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'}`}
                      >
                        <div className="flex items-center gap-2 text-[10px] text-tea-text-sec/70">
                          <span className="font-mono">{new Date(log.created_at).toLocaleString()}</span>
                          <span className="opacity-40">·</span>
                          <span>{log.user_email || 'System'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="badge-status badge-status-default text-[9px]">{log.action}</span>
                          <span className="text-xs text-tea-text-sec truncate">{log.details}</span>
                        </div>
                      </div>
                    ))}
                    {/* Mobile pagination */}
                    {logsTotal > PAGE_SIZE && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-[10px] text-tea-text-sec">{logOffset + 1}–{Math.min(logOffset + PAGE_SIZE, logsTotal)} of {logsTotal}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setLogOffset(Math.max(0, logOffset - PAGE_SIZE))} disabled={logOffset === 0} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"><ChevronLeft size={14} /></button>
                          <button onClick={() => setLogOffset(logOffset + PAGE_SIZE)} disabled={logOffset + PAGE_SIZE >= logsTotal} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* TAB: STOCK LEDGER */}
        {activeTab === 'ledger' && (
          <>
            {ledgerLoading ? (
              <div className="p-12 text-center text-tea-text-sec font-serif italic"><Loader2 className="animate-spin inline mr-2" /> Loading ledger...</div>
            ) : (
              <div className="w-full max-w-7xl mx-auto bg-tea-surface min-h-full hidden md:block">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="w-[15%]" />
                    <col className="w-[20%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[15%]" />
                    <col className="w-[18%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
                    <tr>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">Timestamp</th>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">Product</th>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-right">Delta</th>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-right">Balance</th>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-center">Reason</th>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">Invoice</th>
                      <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-tea-text-sec">
                          <BarChart3 size={24} className="inline opacity-30 mb-2" /><br />
                          <span className="font-serif italic">No stock movements recorded.</span>
                        </td>
                      </tr>
                    ) : (
                      ledgerEntries.map((entry: any) => {
                        const isPositive = entry.delta > 0;
                        return (
                          <tr key={entry.id} className="transition-colors border-b border-tea-border group hover:bg-tea-bg/50" style={{ height: ROW_HEIGHT }}>
                            <td className="px-4 align-middle overflow-hidden">
                              <span className="text-xs text-tea-text-sec font-mono">{new Date(entry.created_at).toLocaleString()}</span>
                            </td>
                            <td className="px-4 align-middle overflow-hidden">
                              <button
                                onClick={() => navigate(`/admin/catalog?search=${encodeURIComponent(entry.product_name || '')}`)}
                                className="text-xs text-tea-text hover:text-tea-accent transition-colors truncate block text-left"
                              >
                                {entry.product_name || entry.product_id}
                              </button>
                            </td>
                            <td className="px-4 align-middle text-right">
                              <span className={`text-xs num font-medium flex items-center justify-end gap-0.5 ${isPositive ? 'text-green-500' : 'text-red-400'}`}>
                                {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                {isPositive ? '+' : ''}{entry.delta}g
                              </span>
                            </td>
                            <td className="px-4 align-middle text-right">
                              <span className="text-xs text-tea-text-sec num">{entry.balance_after}g</span>
                            </td>
                            <td className="px-4 align-middle text-center">
                              <span className="badge-status badge-status-default text-[9px]">
                                {REASON_LABELS[entry.reason] || entry.reason}
                              </span>
                            </td>
                            <td className="px-4 align-middle overflow-hidden">
                              {entry.source_invoice_number ? (
                                <button
                                  onClick={() => navigate(`/admin/orders?search=${encodeURIComponent(entry.source_invoice_number)}`)}
                                  className="text-xs text-tea-text-sec hover:text-tea-accent num transition-colors truncate block text-left"
                                >
                                  {entry.source_invoice_number}
                                </button>
                              ) : (
                                <span className="text-xs text-tea-text-sec/40">—</span>
                              )}
                            </td>
                            <td className="px-4 align-middle overflow-hidden">
                              <span className="text-xs text-tea-text-sec truncate block">{entry.user_email || 'System'}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {ledgerTotal > PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-tea-border bg-tea-bg">
                    <span className="text-[10px] text-tea-text-sec">{ledgerOffset + 1}–{Math.min(ledgerOffset + PAGE_SIZE, ledgerTotal)} of {ledgerTotal}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setLedgerOffset(Math.max(0, ledgerOffset - PAGE_SIZE))} disabled={ledgerOffset === 0} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"><ChevronLeft size={14} /></button>
                      <button onClick={() => setLedgerOffset(ledgerOffset + PAGE_SIZE)} disabled={ledgerOffset + PAGE_SIZE >= ledgerTotal} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stock Ledger — Mobile */}
            {!ledgerLoading && (
              <div className="md:hidden pb-24">
                {ledgerEntries.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-tea-text-sec">
                    <BarChart3 size={32} strokeWidth={1} className="opacity-40" />
                    <span className="font-serif italic">No stock movements recorded.</span>
                  </div>
                ) : (
                  <>
                    {ledgerEntries.map((entry: any, idx: number) => {
                      const isPositive = entry.delta > 0;
                      return (
                        <div key={entry.id} className={`px-4 py-2.5 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-tea-text-sec/70 font-mono">{new Date(entry.created_at).toLocaleDateString()}</span>
                            <span className="badge-status badge-status-default text-[9px]">{REASON_LABELS[entry.reason] || entry.reason}</span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-sm text-tea-text font-serif truncate">{entry.product_name || 'Unknown'}</span>
                            <span className={`text-xs num font-medium ${isPositive ? 'text-green-500' : 'text-red-400'}`}>
                              {isPositive ? '+' : ''}{entry.delta}g
                            </span>
                          </div>
                          {entry.source_invoice_number && (
                            <div className="text-[10px] text-tea-text-sec/60 mt-0.5 num">{entry.source_invoice_number}</div>
                          )}
                        </div>
                      );
                    })}
                    {ledgerTotal > PAGE_SIZE && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-[10px] text-tea-text-sec">{ledgerOffset + 1}–{Math.min(ledgerOffset + PAGE_SIZE, ledgerTotal)} of {ledgerTotal}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setLedgerOffset(Math.max(0, ledgerOffset - PAGE_SIZE))} disabled={ledgerOffset === 0} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"><ChevronLeft size={14} /></button>
                          <button onClick={() => setLedgerOffset(ledgerOffset + PAGE_SIZE)} disabled={ledgerOffset + PAGE_SIZE >= ledgerTotal} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
