import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { api, type CurateImportSource } from '../../../lib/api';
import { useAppStore } from '../../../lib/store';

function InvoiceFile({ source }: { source: CurateImportSource }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const filename = String(source.metadata.filename || 'Invoice file');
  const download = async () => {
    setBusy(true); setError('');
    try {
      const blob = await api.curateImports.getEvidence(source.batch_id, source.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { setError('The original file could not be opened. Try again.'); }
    finally { setBusy(false); }
  };
  return <div><span>{filename}</span><button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => void download()}>{busy ? 'Opening…' : 'Download original'}</button>{error && <p role="alert">{error}</p>}</div>;
}

/** Read source evidence without opening the mutable intake workspace. */
export function PurchaseInvoiceEvidence({ importId, title }: { importId: string; title: string | null }) {
  const accountId = useAppStore(state => state.activeAccountId);
  const [open, setOpen] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['purchase-invoice-evidence', accountId, importId],
    queryFn: () => api.curateImports.get(importId), enabled: open, staleTime: 60_000,
  });
  return <details className="purchase-tracking-history" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="tap-target"><FileText size={14}/>Invoice</summary>
    {open && <div className="purchase-tracking-history-content">
      <p>{data?.batch.title || title || 'Source invoice'}</p>
      {isPending && <p role="status">Loading source…</p>}
      {isError && <p role="alert">The invoice could not be loaded. <button type="button" className="tap-target underline" onClick={() => void refetch()}>Try again</button></p>}
      {data?.sources.map(source => <React.Fragment key={source.id}>
        {source.r2_object_key && <InvoiceFile source={source}/>}
        {source.pasted_text && <p className="whitespace-pre-wrap max-h-64 overflow-y-auto">{source.pasted_text}</p>}
      </React.Fragment>)}
      {data && !data.sources.some(source => source.r2_object_key || source.pasted_text) && <p className="text-tea-text-sec">No original file or source text was saved with this import.</p>}
    </div>}
  </details>;
}
