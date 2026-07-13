import React, { useRef } from 'react';
import { Camera, FileUp } from 'lucide-react';
import { ImportEvidencePreview } from './ImportEvidencePreview';
import type { ImportDraft, ImportEvidence } from './importTypes';
import type { CurateJourney } from '../types';

interface ImportInputProps {
  draft: ImportDraft;
  onChange: React.Dispatch<React.SetStateAction<ImportDraft>>;
  onSubmit: () => void;
  submitRef?: React.RefObject<HTMLButtonElement | null>;
  journeys: CurateJourney[];
}

export const ImportInput: React.FC<ImportInputProps> = ({ draft, onChange, onSubmit, submitRef, journeys }) => {
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const addFiles = (files: FileList | null, kind: ImportEvidence['kind']) => {
    const additions = Array.from(files || []).map(file => ({ id: crypto.randomUUID(), file, kind }));
    onChange(current => ({ ...current, evidence: [...current.evidence, ...additions] }));
  };
  const canSubmit = draft.text.trim().length > 0 || draft.evidence.length > 0;
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="curate-import-text" className="mb-2 block text-ui-12 uppercase tracking-[0.12em] text-tea-text-sec">Paste a list or invoice text</label>
        <textarea
          id="curate-import-text"
          value={draft.text}
          onChange={event => { const text = event.target.value; onChange(current => ({ ...current, text })); }}
          rows={8}
          placeholder="Paste WeChat fragments, a vendor list, or invoice lines. One item per line works well."
          className="w-full resize-y rounded-md border border-tea-border bg-tea-surface px-3 py-3 text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/20 lg:text-ui-14"
        />
      </div>
      <label className="block text-ui-12 text-tea-text-sec">Sourcing run <span className="text-tea-text-dim">· optional</span>
        <select aria-label="Sourcing run" value={draft.journeyId || ''} onChange={event => onChange(current => ({ ...current, journeyId: event.target.value || null }))} className="mt-2 min-h-11 w-full rounded-md border border-tea-border bg-tea-surface px-3 text-ui-16 text-tea-text outline-none focus:border-tea-gold lg:text-ui-13">
          <option value="">No sourcing run</option>
          {journeys.map(journey => <option key={journey.id} value={journey.id}>{[journey.name, journey.season, journey.year].filter(Boolean).join(' · ')}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <input ref={photoRef} tabIndex={-1} className="sr-only" type="file" accept="image/*" multiple aria-label="Add photos" onChange={event => addFiles(event.target.files, 'photo')} />
        <button type="button" onClick={() => photoRef.current?.click()} className="tap-target inline-flex min-h-11 items-center gap-2 rounded-md border border-tea-border px-3 text-ui-12 text-tea-text-sec hover:border-tea-gold hover:text-tea-text">
          <Camera size={16} /> Add photos
        </button>
        <input ref={fileRef} tabIndex={-1} className="sr-only" type="file" accept=".pdf,.csv,.json,.txt,.doc,.docx,application/pdf,application/json,text/csv,text/plain" multiple aria-label="Add files or invoices" onChange={event => addFiles(event.target.files, 'file')} />
        <button type="button" onClick={() => fileRef.current?.click()} className="tap-target inline-flex min-h-11 items-center gap-2 rounded-md border border-tea-border px-3 text-ui-12 text-tea-text-sec hover:border-tea-gold hover:text-tea-text">
          <FileUp size={16} /> Add files or invoices
        </button>
      </div>
      <ImportEvidencePreview evidence={draft.evidence} />
      {draft.evidence.some(item => item.kind === 'photo' || /\.(pdf|docx?)$/i.test(item.file.name)) && <p className="text-ui-12 leading-relaxed text-tea-text-sec">Photos and scanned documents stay attached as exact evidence. Add item names manually during review; this import does not guess from images.</p>}
      <p className="text-ui-12 leading-relaxed text-tea-text-dim">Nothing is added to your Library until you review it. Uncertain fields stay visibly marked.</p>
      <button ref={submitRef} type="button" disabled={!canSubmit} onClick={onSubmit} className="tap-target ml-auto flex min-h-11 items-center justify-center rounded-md bg-tea-gold px-5 text-ui-13 font-medium text-tea-bg disabled:cursor-not-allowed disabled:opacity-50">
        Start import
      </button>
    </div>
  );
};
