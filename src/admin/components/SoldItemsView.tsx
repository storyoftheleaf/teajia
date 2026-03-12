import React, { useState } from 'react';
import Papa from 'papaparse';
import { Download, AlertCircle, Archive, ScrollText, Loader2 } from 'lucide-react';
import { Product } from '../types';
import { useActivityLogs } from '../hooks/useAdminData';
import { fmtNum } from '../../utils/formatNumber';

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
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-tea-border pb-0 gap-4">
        <div className="pb-6">
          <h2 className="text-2xl font-serif text-tea-text">System Records</h2>
          <p className="text-tea-text-sec text-sm mt-1">Archived inventory and system activity logs.</p>
        </div>
        
        <div className="flex gap-1">
             <button 
                onClick={() => setActiveTab('archive')}
                className={`px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] border-t border-l border-r rounded-t-lg transition-colors duration-200 ${activeTab === 'archive' ? 'bg-tea-surface border-tea-border text-tea-text' : 'border-transparent text-tea-text-sec hover:text-tea-text'}`}
             >
                <div className="flex items-center gap-2">
                    <Archive size={14} /> Archive
                </div>
             </button>
             <button 
                onClick={() => setActiveTab('logs')}
                className={`px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] border-t border-l border-r rounded-t-lg transition-colors duration-200 ${activeTab === 'logs' ? 'bg-tea-surface border-tea-border text-tea-text' : 'border-transparent text-tea-text-sec hover:text-tea-text'}`}
             >
                <div className="flex items-center gap-2">
                    <ScrollText size={14} /> Logbook
                </div>
             </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
          
          {/* TAB: ARCHIVE */}
          {activeTab === 'archive' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex justify-end">
                    <button onClick={handleExportArchive} disabled={soldOutProducts.length === 0} className="bg-tea-accent text-tea-bg px-4 py-2 text-xs uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-tea-accent/90 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-tea-accent/10">
                        <Download size={14} /> Export CSV
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto border border-tea-border rounded-xl bg-tea-surface">
                    <table className="w-full text-left text-sm">
                    <thead className="bg-tea-bg text-tea-text-sec font-medium uppercase text-xs tracking-[0.2em] border-b border-tea-border">
                        <tr>
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Vendor</th>
                        <th className="py-3 px-4text-right">Cost</th>
                        <th className="py-3 px-4text-right">Retail</th>
                        <th className="py-3 px-4text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-tea-border">
                        {soldOutProducts.length === 0 ? (
                        <tr><td colSpan={6} className="p-12 text-center text-tea-text-sec font-serif italic">No items in the archive.</td></tr>
                        ) : (
                        soldOutProducts.map(product => (
                            <tr key={product.id} className="hover:bg-tea-bg/50 transition-colors duration-200">
                            <td className="py-3 px-4">
                                <div className="text-tea-text">{product.givenName}</div>
                                <div className="text-tea-text-sec text-xs">{product.productName}</div>
                            </td>
                            <td className="py-3 px-4text-tea-text-sec">{product.type}</td>
                            <td className="py-3 px-4text-tea-text-sec">{product.vendor || '—'}</td>
                            <td className="py-3 px-4text-right text-tea-text-sec num">{product.costPerGramUSD != null ? `$${fmtNum(product.costPerGramUSD)}` : '-'}</td>
                            <td className="py-3 px-4text-right text-tea-text num">{product.pricePerGramUSD != null ? `$${fmtNum(product.pricePerGramUSD)}` : '-'}</td>
                            <td className="py-3 px-4text-center"><span className="text-[10px] uppercase font-bold tracking-wider bg-tea-bg text-tea-text-sec border border-tea-border px-2 py-1 rounded-sm">Sold Out</span></td>
                            </tr>
                        ))
                        )}
                    </tbody>
                    </table>
                </div>
              </div>
          )}

          {/* TAB: LOGBOOK */}
          {activeTab === 'logs' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                  {logsLoading ? (
                      <div className="p-12 text-center text-tea-text-sec flex justify-center items-center"><Loader2 className="animate-spin mr-2" /> Fetching logs...</div>
                  ) : (
                    <div className="overflow-hidden border border-tea-border rounded-xl bg-tea-surface">
                        <table className="w-full text-left text-sm">
                        <thead className="bg-tea-bg text-tea-text-sec font-medium uppercase text-xs tracking-[0.2em] border-b border-tea-border">
                            <tr>
                            <th className="py-3 px-4">Timestamp</th>
                            <th className="py-3 px-4">User</th>
                            <th className="py-3 px-4">Action</th>
                            <th className="py-3 px-4">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-tea-border">
                            {!logs || logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-tea-text-sec">
                                        <div className="flex flex-col items-center gap-2">
                                        <AlertCircle size={24} />
                                        <span className="font-serif italic">No activity recorded yet.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log: any) => (
                                <tr key={log.id} className="hover:bg-tea-bg/50 transition-colors duration-200">
                                    <td className="py-3 px-4text-tea-text-sec font-mono text-xs">{new Date(log.created_at).toLocaleString()}</td>
                                    <td className="py-3 px-4text-tea-text">{log.user_email || 'System'}</td>
                                    <td className="py-3 px-4text-tea-accent font-mono text-xs uppercase">{log.action}</td>
                                    <td className="py-3 px-4text-tea-text-sec">{log.details}</td>
                                </tr>
                                ))
                            )}
                        </tbody>
                        </table>
                    </div>
                  )}
              </div>
          )}

      </div>
    </div>
  );
};