import React, { useRef } from 'react';
import { Camera, FileUp } from 'lucide-react';
import { ImportEvidencePreview } from './ImportEvidencePreview';
import type { ImportDraft, ImportEvidence } from './importTypes';
import type { CurateJourney } from '../types';
import { ImportJourneyPicker } from './ImportJourneyPicker';
import { prepareImportEvidenceFile } from './importEvidenceSelection';
import type { LookupState } from '../../../lib/api';

interface ImportInputProps {
  draft: ImportDraft;
  onChange: React.Dispatch<React.SetStateAction<ImportDraft>>;
  onSubmit: () => void;
  submitRef?: React.RefObject<HTMLButtonElement | null>;
  journeyLookup: LookupState<CurateJourney>;
  onRetryJourneys: () => void;
  busy: boolean;
  onCreateJourney: (input: { name: string; season?: string; year?: number }) => Promise<boolean>;
}

const evidenceFromFile = (file: File, kind: ImportEvidence['kind'], id: string = crypto.randomUUID()): ImportEvidence => {
  const prepared = prepareImportEvidenceFile(file);
  return { id, file: prepared.file, kind, name: file.name, size: file.size, type: prepared.file?.type ?? file.type, status: prepared.error ? 'failed' : 'ready', error: prepared.error };
};

export const ImportInput: React.FC<ImportInputProps> = ({ draft, onChange, onSubmit, submitRef, journeyLookup, onRetryJourneys, busy, onCreateJourney }) => {
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const addFiles = (files: FileList | null, kind: ImportEvidence['kind']) => {
    const additions = Array.from(files || []).map(file => evidenceFromFile(file, kind));
    onChange(current => ({ ...current, evidence: [...current.evidence, ...additions] }));
  };
  const replaceFile = (id: string, file: File) => onChange(current => ({ ...current, evidence: current.evidence.map(item => item.id === id ? evidenceFromFile(file, item.kind, id) : item) }));
  const canSubmit = draft.text.trim().length > 0 || draft.evidence.some(item => item.file && item.status !== 'failed');
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="curate-import-text" className="mb-2 block text-ui-12 uppercase tracking-[0.12em] text-tea-text-sec">Paste a list or invoice text</label>
        <textarea
          id="curate-import-text"
          disabled={busy}
          value={draft.text}
          onChange={event => { const text = event.target.value; onChange(current => ({ ...current, text })); }}
          rows={8}
          placeholder="Paste WeChat fragments, a vendor list, or invoice lines. One item per line works well."
          className="w-full resize-y rounded-md border border-tea-border bg-tea-surface px-3 py-3 text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/20 lg:text-ui-14"
        />
      </div>
      <ImportJourneyPicker lookup={journeyLookup} journeyId={draft.journeyId} busy={busy} onRetry={onRetryJourneys} onSelect={async journeyId => { if (busy) return false; onChange(current => ({ ...current, journeyId })); return true; }} onCreate={onCreateJourney} />
      <div className="flex flex-wrap gap-2">
        <input ref={photoRef} disabled={busy} tabIndex={-1} className="sr-only" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple aria-label="Add photos" onChange={event => { addFiles(event.target.files, 'photo'); event.target.value = ''; }} />
        <button type="button" disabled={busy} onClick={() => photoRef.current?.click()} className="tap-target inline-flex min-h-11 items-center gap-2 rounded-md border border-tea-border px-3 text-ui-12 text-tea-text-sec hover:border-tea-gold hover:text-tea-text disabled:opacity-50">
          <Camera size={16} /> Add photos
        </button>
        <input ref={fileRef} disabled={busy} tabIndex={-1} className="sr-only" type="file" accept=".pdf,.csv,.json,.txt,.doc,.docx,application/pdf,application/json,text/csv,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple aria-label="Add files or invoices" onChange={event => { addFiles(event.target.files, 'file'); event.target.value = ''; }} />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="tap-target inline-flex min-h-11 items-center gap-2 rounded-md border border-tea-border px-3 text-ui-12 text-tea-text-sec hover:border-tea-gold hover:text-tea-text disabled:opacity-50">
          <FileUp size={16} /> Add files or invoices
        </button>
        <p className="basis-full text-ui-11 text-tea-text-sec">DOC and DOCX are saved as reference-only and are not analyzed.</p>
      </div>
      <ImportEvidencePreview evidence={draft.evidence} disabled={busy} onRemove={id => onChange(current => ({ ...current, evidence: current.evidence.filter(item => item.id !== id) }))} onReplace={replaceFile} onClear={() => onChange(current => ({ ...current, evidence: [] }))} />
      {draft.evidence.some(item => item.kind === 'photo' || /\.(pdf|docx?)$/i.test(item.name)) && <p className="text-ui-12 leading-relaxed text-tea-text-sec">Photos and PDFs are analyzed with the pasted text. DOC and DOCX stay attached as reference-only. Originals remain private evidence, and uncertain readings stay marked for review.</p>}
      <p className="text-ui-12 leading-relaxed text-tea-text-dim">Nothing is added to your Library until you review it. Uncertain fields stay visibly marked.</p>
      <button ref={submitRef} type="button" disabled={busy || !canSubmit} onClick={() => { if (!busy) onSubmit(); }} className="tap-target ml-auto flex min-h-11 items-center justify-center rounded-md bg-tea-gold px-5 text-ui-13 font-medium text-tea-bg disabled:cursor-not-allowed disabled:opacity-50">
        Start import
      </button>
    </div>
  );
};
