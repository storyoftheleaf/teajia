import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { api, type CurateImportSource } from '../../../lib/api';
import { savedRecordAnalysisMessage } from './importErrorMessage';

export const ImportEvidenceCard: React.FC<{ source: CurateImportSource; analysisBusy?: boolean; disabled?: boolean; onRetry?: (sourceId: string) => void }> = ({ source, analysisBusy = false, disabled = false, onRetry }) => {
  const filename = String(source.metadata?.filename || 'Record');
  const contentType = String(source.metadata?.content_type || 'application/octet-stream');
  const isImage = contentType.startsWith('image/');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(isImage);
  const [error, setError] = useState<string | null>(null);
  const status = source.analysis_status === 'analyzed' ? 'Analyzed'
    : source.analysis_status === 'reference_only' ? 'Reference only · not analyzed'
    : source.analysis_status === 'failed' ? `Analysis failed · ${savedRecordAnalysisMessage(source.analysis_error)}`
    : 'Saved · awaiting analysis';

  const load = async () => {
    setBusy(true); setError(null);
    try {
      const blob = await api.curateImports.getEvidence(source.batch_id, source.id);
      const url = URL.createObjectURL(blob);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = url;
      setObjectUrl(url);
      if (!isImage) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open record'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (isImage) void load();
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
    // Source identity is immutable; object URL cleanup happens on replacement/unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id]);

  return (
    <div data-testid="import-evidence-source" className={source.analysis_status === 'failed' ? 'rounded-md border border-tea-border bg-tea-surface p-3' : 'border-b border-tea-border py-3'}>
      {isImage && objectUrl && <img src={objectUrl} alt={`Record preview: ${filename}`} className="mb-2 max-h-48 w-full rounded-md object-contain" />}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><p className="truncate text-ui-13 text-tea-text">{filename}</p><p className="text-ui-11 text-tea-text-dim">{status}</p></div>
        <button type="button" onClick={load} disabled={busy || analysisBusy || disabled} aria-label={`${isImage ? 'View' : 'Open'} ${filename}`} className="tap-target inline-flex min-h-11 items-center gap-2 px-2 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}{isImage ? 'View' : 'Open'}
        </button>
        {source.analysis_status === 'failed' && onRetry && <button type="button" onClick={() => onRetry(source.id)} disabled={analysisBusy || disabled} aria-label={`Retry analysis for ${filename}`} className="tap-target min-h-11 px-2 text-ui-12 text-tea-gold disabled:opacity-50">{analysisBusy ? 'Retrying…' : 'Retry analysis'}</button>}
      </div>
      {error && <p role="alert" className="mt-2 text-ui-12 text-tea-gold">{error}</p>}
    </div>
  );
};
