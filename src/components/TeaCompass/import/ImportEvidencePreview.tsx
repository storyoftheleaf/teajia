import React, { useRef } from 'react';
import { FileText, Image, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import type { ImportEvidence } from './importTypes';

interface Props {
  evidence: ImportEvidence[];
  onRemove?: (id: string) => void;
  onReplace?: (id: string, file: File) => void;
  onClear?: () => void;
  disabled?: boolean;
}

const statusCopy = (item: ImportEvidence) => {
  if (item.status === 'uploading') return 'Uploading…';
  if (item.status === 'pending') return 'Uploaded · awaiting analysis';
  if (item.status === 'analyzed') return 'Analyzed';
  if (item.status === 'reference_only') return 'Reference only · not analyzed';
  if (item.status === 'reselect') return 'Reselect to upload';
  if (item.status === 'failed') return item.error || 'Upload failed';
  if (/\.(doc|docx)$/i.test(item.name)) return 'Reference only · not analyzed';
  return 'Ready to upload';
};

const ReplaceEvidenceButton: React.FC<{ item: ImportEvidence; disabled: boolean; onReplace: (id: string, file: File) => void }> = ({ item, disabled, onReplace }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return <>
    <input ref={inputRef} disabled={disabled} tabIndex={-1} aria-hidden="true" aria-label={`Replace ${item.name}`} className="sr-only" type="file" onChange={event => { const file = event.target.files?.[0]; if (file) onReplace(item.id, file); event.target.value = ''; }} />
    <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} aria-label={`Replace attachment ${item.name}`} className="tap-target inline-flex min-h-11 items-center gap-1 px-1 text-ui-11 text-tea-gold disabled:opacity-50"><RotateCcw size={14} aria-hidden="true" /> Replace</button>
  </>;
};

export const ImportEvidencePreview: React.FC<Props> = ({ evidence, onRemove, onReplace, onClear, disabled = false }) => {
  if (!evidence.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-ui-11 uppercase tracking-[0.12em] text-tea-text-dim">Attached evidence</p>
        {onClear && <button type="button" disabled={disabled} onClick={onClear} aria-label="Clear all attachments" className="tap-target min-h-11 text-ui-11 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Clear all</button>}
      </div>
      <ul className="grid gap-2" aria-label="Attached evidence">
        {evidence.map(item => (
          <li key={item.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-tea-border bg-tea-surface px-3 py-2 text-ui-12 text-tea-text-sec">
            {item.status === 'uploading' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : item.kind === 'photo' ? <Image size={15} aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
            <div className="min-w-0 flex-1"><p className="truncate text-tea-text">{item.name}</p><p className={item.status === 'failed' ? 'text-tea-gold' : 'text-tea-text-dim'}>{statusCopy(item)}</p></div>
            {onReplace && <ReplaceEvidenceButton item={item} disabled={disabled} onReplace={onReplace} />}
            {onRemove && <button type="button" disabled={disabled} onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name}`} className="tap-target inline-flex min-h-11 items-center gap-1 px-1 text-ui-11 text-tea-text-sec hover:text-tea-text disabled:opacity-50"><Trash2 size={14} aria-hidden="true" /> Remove</button>}
          </li>
        ))}
      </ul>
    </div>
  );
};
