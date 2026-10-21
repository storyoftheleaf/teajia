import { useEffect, useId, useState } from 'react';
import { Mic } from 'lucide-react';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { useAppStore } from '../../lib/store';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useVoiceRecorder } from './useVoiceRecorder';
import { mediaUrl } from '../../lib/mediaUrl';
import type { TeaCompassEntry } from './types';
import { TEA_TYPES, TEA_FORMS } from '../../wisdom';
import type { Currency } from '../../admin/types';

const inputClass = 'input-field w-full min-w-0 min-h-11 px-3 py-2 text-ui-16';

/** Local drafts avoid a server write on every keystroke. Blur commits to the
 * existing Compass sync, so both entry points edit the same durable record. */
function TextField({ label, value, multiline = false, onCommit }: {
  label: string; value?: string; multiline?: boolean; onCommit: (text: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  const commit = () => { if (draft !== (value ?? '')) onCommit(draft); };
  return <label htmlFor={id} className="block min-w-0 space-y-1">
    <span className={`${T.label} text-tea-text-sec`}>{label}</span>
    {multiline
      ? <textarea id={id} value={draft} rows={4} className={`${inputClass} resize-y`} onChange={event => setDraft(event.target.value)} onBlur={commit} />
      : <input id={id} value={draft} className={inputClass} onChange={event => setDraft(event.target.value)} onBlur={commit} />}
  </label>;
}

function NumberField({ label, value, onCommit }: { label: string; value?: number; onCommit: (value: number | undefined) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value ?? ''));
  const [error, setError] = useState('');
  useEffect(() => { setDraft(String(value ?? '')); }, [value]);
  return <label htmlFor={id} className="block min-w-0 space-y-1">
    <span className={`${T.label} text-tea-text-sec`}>{label}</span>
    <input id={id} type="number" min="0" step="any" inputMode="decimal" className={inputClass} value={draft}
      onChange={event => setDraft(event.target.value)} onBlur={() => {
        const next = draft.trim() === '' ? undefined : Number(draft);
        if (next !== undefined && (!Number.isFinite(next) || next < 0)) { setError('Enter zero or a positive number.'); return; }
        setError(''); if (next !== value) onCommit(next);
      }} aria-invalid={!!error} />
    {error && <span role="alert" className="text-ui-12 text-tea-text-sec">{error}</span>}
  </label>;
}

function RecordVoice({ entryId }: { entryId: string }) {
  const userId = useAppStore(s => s.activeUserId) ?? 'guest';
  const accountId = useAppStore(s => s.activeAccountId) ?? 'guest';
  const context = `curate:${accountId}:${userId}:${entryId}`;
  const voice = useVoiceRecorder((text, capturedContext) => {
    if (capturedContext !== context || useAppStore.getState().activeAccountId !== accountId || (useAppStore.getState().activeUserId ?? 'guest') !== userId) return false;
    const store = useTeaCompassStore.getState();
    const entry = store.getEntry(entryId);
    if (!entry || store.accountScopeId !== accountId) return false;
    store.updateEntry(entryId, { notes: [entry.notes.trim(), text.trim()].filter(Boolean).join('\n\n') });
    return true;
  }, context, userId);
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="tap-target min-h-11 inline-flex items-center gap-2 text-ui-12 text-tea-text-sec"
        disabled={voice.state === 'transcribing' || voice.state === 'error'} onClick={voice.handlePress}>
        <Mic size={14} />{voice.state === 'recording' ? 'Stop recording' : voice.state === 'transcribing' ? 'Transcribing…' : 'Record a note'}
      </button>
      {voice.state === 'error' && !voice.pendingRecording && <button type="button" className="tap-target min-h-11 text-ui-12 text-tea-gold" onClick={() => void voice.discardPending()}>Try recording again</button>}
      {voice.pendingRecording && <button type="button" className="tap-target min-h-11 text-ui-12 text-tea-gold" disabled={voice.state === 'transcribing'} onClick={() => void voice.retryPending()}>Retry transcript</button>}
      {voice.pendingRecording && <button type="button" className="tap-target min-h-11 text-ui-12 text-tea-text-sec" disabled={voice.state === 'transcribing'} onClick={() => void voice.discardPending()}>Discard recording</button>}
    </div>
    {voice.errorMessage && <p role="alert" className="text-ui-12 text-tea-text-sec">{voice.errorMessage}</p>}
    <p className="text-ui-11 text-tea-text-dim">Voice transcripts are added to your notes.</p>
  </div>;
}

export function TeaRecordFields({ entry, onChange }: { entry: TeaCompassEntry; onChange: (patch: Partial<TeaCompassEntry>) => void }) {
  return <section aria-label="Edit tea record" className="space-y-4 min-w-0">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <TextField label="Tea name" value={entry.name} onCommit={name => onChange({ name })} />
      <TextField label="Chinese name" value={entry.chineseName} onCommit={chineseName => onChange({ chineseName })} />
      <TextField label="Source" value={entry.vendorName} onCommit={vendorName => onChange({ vendorName, vendorId: undefined, linkedCustomerId: undefined, vendorDetails: undefined })} />
      <TextField label="Origin" value={entry.originRegion} onCommit={originRegion => onChange({ originRegion })} />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <NumberField label="Year" value={entry.year} onCommit={year => onChange({ year })} />
      {entry.category === 'tea' && <label className="block min-w-0 space-y-1"><span className={`${T.label} text-tea-text-sec`}>Tea type</span>
        <select className={inputClass} value={entry.type ?? ''} onChange={event => onChange({ type: event.target.value as TeaCompassEntry['type'] || undefined })}>
          <option value="">Not recorded</option>{TEA_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
        </select></label>}
      {entry.category === 'tea' && <label className="block min-w-0 space-y-1"><span className={`${T.label} text-tea-text-sec`}>Form</span>
        <select className={inputClass} value={entry.form ?? ''} onChange={event => onChange({ form: event.target.value as TeaCompassEntry['form'] || undefined })}>
          <option value="">Not recorded</option>{TEA_FORMS.map(form => <option key={form} value={form}>{form}</option>)}
        </select></label>}
    </div>
    <TextField label="Description" value={entry.description ?? ''} multiline onCommit={description => onChange({ description })} />
    <TextField label="Notes" value={entry.notes} multiline onCommit={notes => onChange({ notes })} />
    <details className="border-t border-tea-border pt-3">
      <summary className={`${T.label} cursor-pointer min-h-11`}>Quoted price</summary>
      <div className="grid grid-cols-2 gap-3 pb-3">
        <NumberField label="Quoted amount" value={entry.priceAmount} onCommit={priceAmount => onChange({ priceAmount })} />
        <label className="block min-w-0 space-y-1"><span className={`${T.label} text-tea-text-sec`}>Currency</span><select className={inputClass} value={entry.priceCurrency} onChange={event => onChange({ priceCurrency: event.target.value as Currency })}>
          {['Yuan', 'USD', 'NT', 'HKD', 'IDR', 'JPY', 'MYR', 'UNK'].map(currency => <option key={currency} value={currency}>{currency}</option>)}
        </select></label>
        {entry.category === 'tea' && <NumberField label="Price basis (g)" value={entry.pricePerUnitGrams} onCommit={pricePerUnitGrams => onChange({ pricePerUnitGrams })} />}
      </div>
    </details>
    <RecordVoice key={entry.id} entryId={entry.id} />
    {entry.audioClips.length > 0 && <details className="border-t border-tea-border pt-3">
      <summary className={`${T.label} min-h-11 cursor-pointer`}>Voice recordings ({entry.audioClips.length})</summary>
      <div className="space-y-3">{entry.audioClips.map((clip, index) => <div key={`${clip.timestamp}:${index}`} className="space-y-2 min-w-0">
        <p className="text-ui-11 text-tea-text-dim">{new Date(clip.timestamp).toLocaleString()}</p>
        <audio controls preload="none" src={mediaUrl(clip.url)} className="w-full max-w-full" aria-label={`Voice recording ${index + 1}`} />
        {clip.transcript && <p className="text-ui-12 text-tea-text-sec whitespace-pre-wrap">{clip.transcript}</p>}
      </div>)}</div>
    </details>}
    {(entry.vendorDetails || entry.sourceEntryId || entry.linkedCustomerId) && <details className="border-t border-tea-border pt-3">
      <summary className={`${T.label} min-h-11 cursor-pointer`}>Source attribution</summary>
      {entry.vendorName && <p className="text-ui-12 text-tea-text-sec">{entry.vendorName}</p>}
      {entry.vendorDetails && <dl className="text-ui-12 text-tea-text-sec space-y-1">{Object.entries(entry.vendorDetails).filter(([, value]) => value != null && value !== '').map(([key, value]) => <div key={key} className="break-words"><dt className="inline text-tea-text-dim">{key}: </dt><dd className="inline">{String(value)}</dd></div>)}</dl>}
      {entry.sourceEntryId && <p className="text-ui-12 text-tea-text-dim break-all">Shared from record {entry.sourceEntryId}</p>}
    </details>}
  </section>;
}
