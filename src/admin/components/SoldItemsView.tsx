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

const ROW_HEIGHT = 44;
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

// Canonical ledger column header — used across all three tab tables
const headerCellClass = (align: 'left' | 'right' | 'center' = 'left') =>
  `px-4 py-3 border-b border-tea-border font-serif text-ui-11 uppercase tracking-display font-normal text-tea-text-sec text-${align}`;

export const RecordsView = ({ products, initialTab }: { products: Product[]; initialTab?: 'archive' | 'log' | 'ledger' }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const mappedInitial = initialTab === 'log' ? 'logs' : (initialTab || 'archive');
  // When hosted by ActivityView (initialTab provided), hide redundant internal tabs
  const isHosted = !!initialTab;
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
      await api.products.updateByDomain(product.id, { status: 'Active' });
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

  // Active counter for the top strip — varies by tab
  const activeCount =
    activeTab === 'archive' ? soldOutProducts.length :
    activeTab === 'logs'    ? logsTotal :
                              ledgerTotal;
  const activeLabel =
    activeTab === 'archive' ? (soldOutProducts.length === 1 ? 'item' : 'items') :
    activeTab === 'logs'    ? (logsTotal === 1 ? 'entry' : 'entries') :
                              (ledgerTotal === 1 ? 'movement' : 'movements');

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">

      {/* Header — when hosted by ActivityView, skip the redundant tab bar and only show contextual controls */}
      {isHosted ? (
        /* Slim contextual header: just the action controls for the active tab */
        (activeTab === 'logs' || activeTab === 'archive') ? (
          <div className="sticky top-0 z-sticky bg-tea-bg/90 backdrop-blur-md border-b border-tea-border py-2 flex-shrink-0">
            <div className="px-3 md:px-6 max-w-5xl mx-auto flex items-center gap-2">
              {activeTab === 'logs' && (
                <>
                  <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar flex-1 min-w-0">
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
                  <form onSubmit={handleLogSearch} className="relative w-28 md:w-40 shrink-0">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" />
                    <input
                      type="text"
                      placeholder="search"
                      value={logSearchInput}
                      onChange={(e) => setLogSearchInput(e.target.value)}
                      className="w-full bg-transparent border-b border-tea-border rounded-none pl-8 pr-3 py-1.5 text-ui-12 text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
                    />
                  </form>
                </>
              )}
              {activeTab === 'archive' && (
                <div className="ml-auto flex items-center gap-3">
                  <span className="label-caps text-tea-text-dim tabular-nums">{activeCount} {activeLabel}</span>
                  <button
                    onClick={handleExportArchive}
                    disabled={soldOutProducts.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-ui-12 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download size={13} />
                    <span>Export CSV</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null /* Ledger tab has no contextual controls */
      ) : (
        /* Standalone mode: full header with tab bar */
        <div className="sticky top-0 z-sticky bg-tea-bg/90 backdrop-blur-md border-b border-tea-border flex-shrink-0">
          <div className="px-4 md:px-6 lg:px-10 pt-6 pb-3 max-w-5xl mx-auto flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="h2 text-tea-text">System Records</h1>
              <div className="label-caps text-tea-text-dim mt-1">Archive · Log · Stock ledger</div>
            </div>
            {activeTab === 'archive' && (
              <button
                onClick={handleExportArchive}
                disabled={soldOutProducts.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-ui-12 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            )}
          </div>

          {/* Tab strip — bottom-border underline */}
          <div className="flex items-center gap-6 px-4 md:px-6 lg:px-10 max-w-5xl mx-auto border-b border-tea-border">
            {([
              { id: 'archive', label: 'Archive', icon: <Archive size={13} /> },
              { id: 'logs', label: 'Log', icon: <ScrollText size={13} /> },
              { id: 'ledger', label: 'Stock Ledger', icon: <BarChart3 size={13} /> },
            ] as const).map(t => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-1.5 py-2.5 text-ui-12 uppercase tracking-caps font-sans whitespace-nowrap transition-colors border-b ${
                    isActive ? 'text-tea-text border-tea-gold' : 'text-tea-text-sec hover:text-tea-text border-transparent'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'logs' && (
            <div className="px-3 md:px-6 max-w-5xl mx-auto flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar flex-1 min-w-0">
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
              <form onSubmit={handleLogSearch} className="relative w-28 md:w-40 shrink-0">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" />
                <input
                  type="text"
                  placeholder="search"
                  value={logSearchInput}
                  onChange={(e) => setLogSearchInput(e.target.value)}
                  className="w-full bg-transparent border-b border-tea-border rounded-none pl-8 pr-3 py-1.5 text-ui-12 text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
                />
              </form>
            </div>
          )}

          {/* Top strip — counter (right-aligned) */}
          <div className="px-4 md:px-6 lg:px-10 max-w-5xl mx-auto flex items-center justify-end py-2">
            <span className="label-caps text-tea-text-dim tabular-nums">{activeCount} {activeLabel}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-tea-bg md:px-6">

        {/* TAB: ARCHIVE */}
        {activeTab === 'archive' && (
          <div className="w-full max-w-5xl mx-auto bg-tea-surface min-h-full hidden md:block">
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
              <thead className="sticky top-0 z-sticky bg-tea-bg">
                <tr>
                  <th className={headerCellClass('left')}>Product</th>
                  <th className={headerCellClass('left')}>Type</th>
                  <th className={headerCellClass('left')}>Vendor</th>
                  <th className={headerCellClass('right')}>Cost</th>
                  <th className={headerCellClass('right')}>Retail</th>
                  <th className={headerCellClass('center')}>Sold Out</th>
                  <th className={headerCellClass('center')}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {soldOutProducts.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3 text-tea-text-sec">
                      <Archive size={32} strokeWidth={1} className="opacity-40" />
                      <span className="font-serif italic text-ui-15">No sold out products.</span>
                    </div>
                  </td></tr>
                ) : (
                  soldOutProducts.map(product => (
                    <tr key={product.id} className="border-b border-tea-border last:border-b-0 transition-colors hover:bg-tea-accent-sub group" style={{ height: ROW_HEIGHT }}>
                      <td className="px-4 py-3 align-middle overflow-hidden">
                        <div className="flex flex-col justify-center h-full">
                          <button
                            onClick={() => navigate(`/admin/catalog?search=${encodeURIComponent(product.givenName || product.productName)}`)}
                            className="font-display text-ui-17 leading-tight text-tea-text-sec truncate hover:text-tea-readgold transition-colors text-left"
                          >
                            {product.givenName || product.productName}
                          </button>
                          {product.givenName && (
                            <span className="font-sans text-ui-11 text-tea-text-dim mt-0.5 truncate block">{product.productName}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle overflow-hidden">
                        <span className="font-sans text-ui-11 uppercase tracking-caps text-tea-text-dim truncate block">{product.type}</span>
                      </td>
                      <td className="px-4 py-3 align-middle overflow-hidden">
                        <span className="font-serif text-ui-15 text-tea-text-sec truncate block">{product.vendor || '—'}</span>
                      </td>
                      <td className="px-4 py-3 align-middle overflow-hidden text-right">
                        <span className="font-serif text-ui-15 text-right tabular-nums text-tea-text-dim">{product.costPerGramUSD != null ? `$${fmtNum(product.costPerGramUSD)}` : '—'}</span>
                      </td>
                      <td className="px-4 py-3 align-middle overflow-hidden text-right">
                        <span className="font-serif text-ui-15 text-right tabular-nums text-tea-text-sec">{product.pricePerGramUSD != null ? `$${fmtNum(product.pricePerGramUSD)}` : '—'}</span>
                      </td>
                      <td className="px-4 py-3 align-middle text-center">
                        <span className="font-serif text-ui-13 text-tea-text-dim tabular-nums">
                          {(product as any).soldOutAt ? new Date((product as any).soldOutAt).toLocaleDateString() : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle text-center">
                        <button
                          onClick={() => handleReactivate(product)}
                          disabled={reactivating === product.id}
                          className="font-sans text-ui-12 text-tea-readgold hover:text-tea-gold-lt flex items-center gap-1 transition-colors mx-auto disabled:opacity-50"
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
          <div className="md:hidden pb-nav">
            {soldOutProducts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-tea-text-sec">
                <Archive size={32} strokeWidth={1} className="opacity-40" />
                <span className="font-serif italic text-ui-15">No sold out products.</span>
              </div>
            ) : (
              soldOutProducts.map((product) => (
                <div
                  key={product.id}
                  className="px-4 py-3 flex items-center gap-3 border-b border-tea-border last:border-b-0 transition-colors active:bg-tea-accent-sub"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-ui-17 leading-tight text-tea-text-sec truncate">{product.givenName || product.productName}</div>
                    <div className="font-sans text-ui-11 text-tea-text-dim mt-0.5">{product.type} · {product.vendor || '—'}</div>
                  </div>
                  <button
                    onClick={() => handleReactivate(product)}
                    disabled={reactivating === product.id}
                    className="font-sans text-ui-12 text-tea-readgold hover:text-tea-gold-lt transition-colors shrink-0 disabled:opacity-50"
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
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-tea-text-sec">
                <Loader2 size={20} className="animate-spin" />
                <span className="font-serif italic text-ui-15">Fetching logs...</span>
              </div>
            ) : (
              <div className="w-full max-w-5xl mx-auto bg-tea-surface min-h-full hidden md:block">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-[54%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-sticky bg-tea-bg">
                    <tr>
                      <th className={headerCellClass('left')}>Timestamp</th>
                      <th className={headerCellClass('left')}>User</th>
                      <th className={headerCellClass('left')}>Action</th>
                      <th className={headerCellClass('left')}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-16">
                          <div className="flex flex-col items-center gap-3 text-tea-text-sec">
                            <AlertCircle size={28} strokeWidth={1} className="opacity-40" />
                            <span className="font-serif italic text-ui-15">No activity recorded yet.</span>
                            {(logAction || logSearch) && (
                              <button
                                onClick={() => { setLogAction(''); setLogSearch(''); setLogSearchInput(''); setLogOffset(0); }}
                                className="font-sans text-ui-12 text-tea-readgold hover:text-tea-gold-lt mt-1 transition-colors"
                              >
                                Clear filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      logs.map((log: any) => (
                        <tr key={log.id} className="border-b border-tea-border last:border-b-0 transition-colors hover:bg-tea-accent-sub group" style={{ height: ROW_HEIGHT }}>
                          <td className="px-4 py-3 align-middle overflow-hidden">
                            <span className="font-serif text-ui-13 text-tea-text-sec tabular-nums">{new Date(log.created_at).toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3 align-middle overflow-hidden">
                            <span className="font-serif text-ui-15 text-tea-text truncate block">{log.user_email || 'System'}</span>
                          </td>
                          <td className="px-4 py-3 align-middle overflow-hidden">
                            <span className="badge-status badge-status-default text-ui-9">{log.action}</span>
                          </td>
                          <td className="px-4 py-3 align-middle overflow-hidden">
                            <span className="font-serif text-ui-15 text-tea-text-sec truncate block">{log.details}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Bottom strip — pagination */}
                {logsTotal > PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-tea-border bg-tea-bg">
                    <span className="font-serif text-ui-13 tabular-nums text-tea-text-dim">
                      {logOffset + 1}–{Math.min(logOffset + PAGE_SIZE, logsTotal)} of {logsTotal}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setLogOffset(Math.max(0, logOffset - PAGE_SIZE))}
                        disabled={logOffset === 0}
                        className="tap-target text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setLogOffset(logOffset + PAGE_SIZE)}
                        disabled={logOffset + PAGE_SIZE >= logsTotal}
                        className="font-sans text-ui-12 text-tea-readgold hover:text-tea-gold-lt transition-colors disabled:opacity-30"
                      >
                        Load more
                      </button>
                      <button
                        onClick={() => setLogOffset(logOffset + PAGE_SIZE)}
                        disabled={logOffset + PAGE_SIZE >= logsTotal}
                        className="tap-target text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"
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
              <div className="md:hidden pb-nav">
                {logs.length === 0 ? (
                  <div className="text-center py-16 text-tea-text-sec font-serif italic text-ui-15">No activity recorded yet.</div>
                ) : (
                  <>
                    {logs.map((log: any) => (
                      <div
                        key={log.id}
                        className="px-4 py-3 border-b border-tea-border last:border-b-0 transition-colors active:bg-tea-accent-sub"
                      >
                        <div className="flex items-center gap-2 font-serif text-ui-11 text-tea-text-dim tabular-nums">
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                          <span className="opacity-40">·</span>
                          <span className="font-sans">{log.user_email || 'System'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="badge-status badge-status-default text-ui-9">{log.action}</span>
                          <span className="font-serif text-ui-13 text-tea-text-sec truncate">{log.details}</span>
                        </div>
                      </div>
                    ))}
                    {/* Mobile pagination */}
                    {logsTotal > PAGE_SIZE && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-tea-border">
                        <span className="font-serif text-ui-13 tabular-nums text-tea-text-dim">
                          {logOffset + 1}–{Math.min(logOffset + PAGE_SIZE, logsTotal)} of {logsTotal}
                        </span>
                        <button
                          onClick={() => setLogOffset(logOffset + PAGE_SIZE)}
                          disabled={logOffset + PAGE_SIZE >= logsTotal}
                          className="font-sans text-ui-12 text-tea-readgold hover:text-tea-gold-lt transition-colors disabled:opacity-30"
                        >
                          Load more
                        </button>
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
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-tea-text-sec">
                <Loader2 size={20} className="animate-spin" />
                <span className="font-serif italic text-ui-15">Loading ledger...</span>
              </div>
            ) : (
              <div className="w-full max-w-5xl mx-auto bg-tea-surface min-h-full hidden md:block">
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
                  <thead className="sticky top-0 z-sticky bg-tea-bg">
                    <tr>
                      <th className={headerCellClass('left')}>Timestamp</th>
                      <th className={headerCellClass('left')}>Product</th>
                      <th className={headerCellClass('right')}>Delta</th>
                      <th className={headerCellClass('right')}>Balance</th>
                      <th className={headerCellClass('center')}>Reason</th>
                      <th className={headerCellClass('left')}>Invoice</th>
                      <th className={headerCellClass('left')}>User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16">
                          <div className="flex flex-col items-center gap-3 text-tea-text-sec">
                            <BarChart3 size={28} strokeWidth={1} className="opacity-40" />
                            <span className="font-serif italic text-ui-15">No stock movements recorded.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      ledgerEntries.map((entry: any) => {
                        const isPositive = entry.delta > 0;
                        return (
                          <tr key={entry.id} className="border-b border-tea-border last:border-b-0 transition-colors hover:bg-tea-accent-sub group" style={{ height: ROW_HEIGHT }}>
                            <td className="px-4 py-3 align-middle overflow-hidden">
                              <span className="font-serif text-ui-13 text-tea-text-sec tabular-nums">{new Date(entry.created_at).toLocaleString()}</span>
                            </td>
                            <td className="px-4 py-3 align-middle overflow-hidden">
                              <button
                                onClick={() => navigate(`/admin/catalog?search=${encodeURIComponent(entry.product_name || '')}`)}
                                className="font-display text-ui-17 leading-tight text-tea-text hover:text-tea-readgold transition-colors truncate block text-left"
                              >
                                {entry.product_name || entry.product_id}
                              </button>
                            </td>
                            <td className="px-4 py-3 align-middle text-right">
                              <span className="font-serif text-ui-15 text-right tabular-nums text-tea-text inline-flex items-center justify-end gap-0.5">
                                {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                                {isPositive ? '+' : ''}{entry.delta}g
                              </span>
                            </td>
                            <td className="px-4 py-3 align-middle text-right">
                              <span className="font-serif text-ui-15 text-right tabular-nums text-tea-text-sec">{entry.balance_after}g</span>
                            </td>
                            <td className="px-4 py-3 align-middle text-center">
                              <span className="badge-status badge-status-default text-ui-9">
                                {REASON_LABELS[entry.reason] || entry.reason}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-middle overflow-hidden">
                              {entry.source_invoice_number ? (
                                <button
                                  onClick={() => navigate(`/admin/orders?search=${encodeURIComponent(entry.source_invoice_number)}`)}
                                  className="font-serif text-ui-15 text-tea-text-sec hover:text-tea-readgold tabular-nums transition-colors truncate block text-left"
                                >
                                  {entry.source_invoice_number}
                                </button>
                              ) : (
                                <span className="font-serif text-ui-15 text-tea-text-dim">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-middle overflow-hidden">
                              <span className="font-serif text-ui-15 text-tea-text-sec truncate block">{entry.user_email || 'System'}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Bottom strip — pagination */}
                {ledgerTotal > PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-tea-border bg-tea-bg">
                    <span className="font-serif text-ui-13 tabular-nums text-tea-text-dim">
                      {ledgerOffset + 1}–{Math.min(ledgerOffset + PAGE_SIZE, ledgerTotal)} of {ledgerTotal}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setLedgerOffset(Math.max(0, ledgerOffset - PAGE_SIZE))}
                        disabled={ledgerOffset === 0}
                        className="tap-target text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setLedgerOffset(ledgerOffset + PAGE_SIZE)}
                        disabled={ledgerOffset + PAGE_SIZE >= ledgerTotal}
                        className="font-sans text-ui-12 text-tea-readgold hover:text-tea-gold-lt transition-colors disabled:opacity-30"
                      >
                        Load more
                      </button>
                      <button
                        onClick={() => setLedgerOffset(ledgerOffset + PAGE_SIZE)}
                        disabled={ledgerOffset + PAGE_SIZE >= ledgerTotal}
                        className="tap-target text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stock Ledger — Mobile */}
            {!ledgerLoading && (
              <div className="md:hidden pb-nav">
                {ledgerEntries.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-tea-text-sec">
                    <BarChart3 size={32} strokeWidth={1} className="opacity-40" />
                    <span className="font-serif italic text-ui-15">No stock movements recorded.</span>
                  </div>
                ) : (
                  <>
                    {ledgerEntries.map((entry: any) => {
                      const isPositive = entry.delta > 0;
                      return (
                        <div key={entry.id} className="px-4 py-3 border-b border-tea-border last:border-b-0 transition-colors active:bg-tea-accent-sub">
                          <div className="flex items-center justify-between">
                            <span className="font-serif text-ui-11 text-tea-text-dim tabular-nums">{new Date(entry.created_at).toLocaleDateString()}</span>
                            <span className="badge-status badge-status-default text-ui-9">{REASON_LABELS[entry.reason] || entry.reason}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-display text-ui-17 leading-tight text-tea-text truncate">{entry.product_name || 'Unknown'}</span>
                            <span className={`font-serif text-ui-15 tabular-nums ${isPositive ? 'text-tea-green' : 'text-tea-error'}`}>
                              {isPositive ? '+' : ''}{entry.delta}g
                            </span>
                          </div>
                          {entry.source_invoice_number && (
                            <div className="font-serif text-ui-11 text-tea-text-dim mt-0.5 tabular-nums">{entry.source_invoice_number}</div>
                          )}
                        </div>
                      );
                    })}
                    {ledgerTotal > PAGE_SIZE && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-tea-border">
                        <span className="font-serif text-ui-13 tabular-nums text-tea-text-dim">
                          {ledgerOffset + 1}–{Math.min(ledgerOffset + PAGE_SIZE, ledgerTotal)} of {ledgerTotal}
                        </span>
                        <button
                          onClick={() => setLedgerOffset(ledgerOffset + PAGE_SIZE)}
                          disabled={ledgerOffset + PAGE_SIZE >= ledgerTotal}
                          className="font-sans text-ui-12 text-tea-readgold hover:text-tea-gold-lt transition-colors disabled:opacity-30"
                        >
                          Load more
                        </button>
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
