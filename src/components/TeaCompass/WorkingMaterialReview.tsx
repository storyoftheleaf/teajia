import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';

export interface WorkingMaterialNote {
  id: string;
  kind: 'identity' | 'origin' | 'history' | 'brewing' | 'tasting' | 'purchase' | 'supplier_claim' | 'uncertain';
  text: string;
  quote: string;
  requestId: string;
  sourceId: string;
  title: string;
  start: number;
  end: number;
  attribution: 'you' | 'supplier' | 'unclear';
  relevance: 'this_tea' | 'background' | 'uncertain';
}
export interface WorkingMaterialResult {
  notes: WorkingMaterialNote[];
  coverage: { sources: number; characters: number; chunks: number; completedChunks: number };
  sourceSignature: string;
}
export interface WorkingMaterialReviewProps {
  result?: WorkingMaterialResult;
  busy: boolean;
  stale: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  onAnalyze: () => void;
  canAnalyze: boolean;
  error?: string;
}
const attribution = { you: 'Your observation', supplier: 'Supplier’s claim', unclear: 'Speaker unclear' };
const relevance = { this_tea: 'This tea', background: 'Background context', uncertain: 'Tea match uncertain' };

/** Read-only review: selection feeds the draft; committing the record is a separate action. */
export function WorkingMaterialReview({ result, busy, stale, selected, onToggle, onAnalyze, canAnalyze, error }: WorkingMaterialReviewProps) {
  const complete = !!result && result.coverage.completedChunks === result.coverage.chunks;
  const selectedCount = result?.notes.filter(note => selected.includes(note.id)).length ?? 0;
  return <section aria-label="Working material" aria-busy={busy} className="min-w-0 text-tea-text">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h3 className={T.h3}>From your transcripts</h3>
      <button type="button" onClick={onAnalyze} disabled={busy || !canAnalyze} className="tap-target min-h-11 rounded-md px-2 text-ui-12 text-tea-text-sec underline decoration-tea-border underline-offset-4 hover:text-tea-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold disabled:opacity-50">
        {busy ? 'Reviewing transcripts…' : result ? 'Refresh working material' : 'Review full transcripts'}
      </button>
    </div>
    <p className={`${T.bodyLight} text-tea-text-sec`}>Choose the notes that should guide the public description.</p>
    {busy && <p role="status" className="mt-2 text-ui-12 text-tea-text-sec">Reading every part of the linked transcripts. Keep reviewing here while it finishes.</p>}
    {error && <p role="alert" className="mt-2 break-words text-ui-13 text-tea-text">{error}</p>}
    {stale && <p role="status" className="mt-2 text-ui-13 text-tea-text-sec">The source material has changed. Refresh these notes before using them in a description.</p>}
    {!result && !busy && <p className="mt-3 text-ui-13 text-tea-text-dim">{canAnalyze ? 'Review the linked transcripts to gather source notes here. Nothing is saved by reviewing.' : 'Link a transcript to gather its working notes here.'}</p>}
    {result && <>
      <div className="mt-3 flex flex-wrap justify-between gap-x-3 gap-y-1 border-b border-tea-border pb-2 text-ui-12 text-tea-text-dim">
        <p>{complete ? `All ${result.coverage.characters.toLocaleString()} characters reviewed in ${result.coverage.chunks} ${result.coverage.chunks === 1 ? 'part' : 'parts'}` : `${result.coverage.completedChunks} of ${result.coverage.chunks} parts reviewed, review incomplete`}</p>
        <p>{selectedCount} selected</p>
      </div>
      {!result.notes.length && <p className="py-3 text-ui-13 text-tea-text-sec">No supported notes about this tea were found in these transcripts.</p>}
      <ul className="min-w-0 divide-y divide-tea-border">
        {result.notes.map(note => <li key={note.id} className="min-w-0 py-3">
          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input type="checkbox" checked={selected.includes(note.id)} disabled={busy || stale || !complete} onChange={() => onToggle(note.id)} aria-label={`Use ${note.text}`} className="mt-1 h-5 w-5 shrink-0 accent-tea-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold disabled:opacity-50" />
            <span className="min-w-0 flex-1">
              <span className={`${T.bodyLight} block break-words`}>{note.text}</span>
              <span className="mt-1 block text-ui-12 text-tea-text-dim">{attribution[note.attribution]} · {relevance[note.relevance]}</span>
            </span>
          </label>
          {note.relevance === 'uncertain' && <p className="mb-1 pl-8 text-ui-12 text-tea-text-sec">Confirm which tea this refers to before using it.</p>}
          <details className="min-w-0 pl-8">
            <summary className="tap-target flex min-h-11 cursor-pointer items-center break-words text-ui-12 text-tea-text-sec underline decoration-tea-border underline-offset-4 hover:text-tea-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold">Source passage · {note.title}</summary>
            <blockquote className={`${T.bodyLight} whitespace-pre-wrap break-words border-t border-tea-border pt-2 text-tea-text-sec`}>{note.quote}</blockquote>
          </details>
        </li>)}
      </ul>
    </>}
  </section>;
}
