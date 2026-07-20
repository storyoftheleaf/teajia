import React, { useRef } from 'react';
import { Camera, FileUp } from 'lucide-react';
import { ImportEvidencePreview } from './ImportEvidencePreview';
import type { ImportDraft, ImportEvidence } from './importTypes';
import type { CurateJourney } from '../types';
import { ImportJourneyPicker } from './ImportJourneyPicker';
import { IMPORT_BATCH_MAX_BYTES, IMPORT_SOURCE_MAX_COUNT, prepareImportEvidenceFile } from './importEvidenceSelection';
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
  const pastedText = draft.text.trim();
  const sourceCount = draft.evidence.length + (pastedText.length > 0 ? 1 : 0);
  const sourceLimitExceeded = sourceCount > IMPORT_SOURCE_MAX_COUNT;
  const attachmentBytes = draft.evidence.reduce((sum, item) => sum + (item.file && item.status !== 'failed' ? item.size : 0), 0);
  const recordBytes = attachmentBytes + new TextEncoder().encode(draft.text).byteLength;
  const batchSizeLimitExceeded = recordBytes > IMPORT_BATCH_MAX_BYTES;
  const canSubmit = !sourceLimitExceeded && !batchSizeLimitExceeded && (pastedText.length > 0 || draft.evidence.some(item => item.file && item.status !== 'failed'));
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="curate-import-text" className="block text-ui-12 uppercase tracking-[0.12em] text-tea-text-sec">Vendor list or invoice</label>
        <textarea
          id="curate-import-text"
          disabled={busy}
          value={draft.text}
          onChange={event => { const text = event.target.value; onChange(current => ({ ...current, text })); }}
          placeholder="Paste WeChat fragments, a vendor list, or invoice lines. One item per line works well."
          className="min-h-64 w-full resize-y border-0 border-b border-tea-border bg-transparent px-0 py-4 font-body text-ui-16 leading-relaxed text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-0 lg:min-h-56 lg:text-ui-14"
        />
      </div>
      <ImportJourneyPicker lookup={journeyLookup} journeyId={draft.journeyId} busy={busy} onRetry={onRetryJourneys} onSelect={async journeyId => { if (busy) return false; onChange(current => ({ ...current, journeyId })); return true; }} onCreate={onCreateJourney} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <input ref={photoRef} disabled={busy} tabIndex={-1} aria-hidden="true" aria-label="Add photos" className="sr-only" type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={event => { addFiles(event.target.files, 'photo'); event.target.value = ''; }} />
        <button type="button" disabled={busy} onClick={() => photoRef.current?.click()} className="tap-target inline-flex min-h-11 items-center gap-2 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">
          <Camera size={16} /> Add photos
        </button>
        <input ref={fileRef} disabled={busy} tabIndex={-1} aria-hidden="true" aria-label="Add files" className="sr-only" type="file" accept=".pdf,.csv,.json,.txt,.doc,.docx,.xls,.xlsx,.ods,.odt,application/pdf,application/json,text/csv,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,application/vnd.oasis.opendocument.text" multiple onChange={event => { addFiles(event.target.files, 'file'); event.target.value = ''; }} />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="tap-target inline-flex min-h-11 items-center gap-2 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">
          <FileUp size={16} /> Add files
        </button>
        <p className="basis-full text-ui-11 text-tea-text-sec">DOC, DOCX, XLS, XLSX, ODT, ODS, and HEIC records are supported.</p>
        <p className="basis-full text-ui-11 text-tea-text-sec">Up to 50 records per import. Each file can be up to 5 MB, with 20 MB total, including pasted text.</p>
      </div>
      <ImportEvidencePreview evidence={draft.evidence} disabled={busy} onRemove={id => onChange(current => ({ ...current, evidence: current.evidence.filter(item => item.id !== id) }))} onReplace={replaceFile} onClear={() => onChange(current => ({ ...current, evidence: [] }))} />
      {sourceLimitExceeded && <p role="alert" className="text-ui-12 text-tea-gold">This import has {sourceCount} records. Remove records until the total is 50 or fewer.</p>}
      {batchSizeLimitExceeded && <p role="alert" className="text-ui-12 text-tea-gold">Record content totals more than 20 MB. Shorten the pasted text or remove or replace files before starting the import.</p>}
      <p className="text-ui-12 leading-relaxed text-tea-text-sec">Original records remain private in Teajia. Bounded record content is sent to configured AI providers for analysis, and uncertain readings stay marked for review.</p>
      <p className="text-ui-12 leading-relaxed text-tea-text-sec">Review reuses or creates a Library identity. Received records add stock, in-transit records wait for receipt, and Library-only records create no holding. Nothing is saved until you confirm the batch.</p>
      <button ref={submitRef} type="button" disabled={busy || !canSubmit} onClick={() => { if (!busy) onSubmit(); }} className="tap-target ml-auto flex min-h-11 items-center justify-center rounded-md bg-tea-gold px-5 text-ui-13 font-medium text-tea-bg disabled:cursor-not-allowed disabled:opacity-50">
        Start import
      </button>
    </div>
  );
};
