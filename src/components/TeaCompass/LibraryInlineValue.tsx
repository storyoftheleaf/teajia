import React, { useEffect, useRef, useState } from 'react';

export function LibraryInlineValue({ value, display, label, onSave, readOnly, numeric, hint, className = '' }: {
  value: string; display: string; label: string; onSave: (value: string) => Promise<void>;
  readOnly?: boolean; numeric?: boolean; hint?: string; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const committing = useRef(false);
  const cancelled = useRef(false);
  useEffect(() => { if (status !== 'saved') return; const id = setTimeout(() => setStatus('idle'), 1800); return () => clearTimeout(id); }, [status]);
  const commit = async () => {
    if (committing.current || cancelled.current) return;
    if (draft === value && status !== 'error') { setEditing(false); return; }
    committing.current = true;
    setStatus('saving');
    try { await onSave(draft); setStatus('saved'); setEditing(false); setError(''); }
    catch (reason) { setStatus('error'); setError(reason instanceof Error ? reason.message : 'Could not save. Retry.'); }
    finally { committing.current = false; }
  };
  return <span className={`library-inline-value ${className}`}>
    {editing ? <>
      {hint && <span className="library-inline-hint text-ui-10 text-tea-text-sec">{hint}</span>}
      <input aria-label={label} aria-invalid={status === 'error'} value={draft} autoFocus inputMode={numeric ? 'decimal' : 'text'} disabled={status === 'saving'}
        onFocus={event => event.currentTarget.select()} onChange={event => { setDraft(event.target.value); setError(''); }} onBlur={() => void commit()}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void commit(); } if (event.key === 'Escape') { event.preventDefault(); cancelled.current = true; setEditing(false); setStatus('idle'); } }} />
    </> : readOnly ? <span>{display}</span> : <button type="button" className="tap-target" aria-label={label} onClick={() => { setDraft(value); cancelled.current = false; setEditing(true); }}>{display}</button>}
    {status === 'saving' && <span role="status" className="library-inline-hint text-ui-10 text-tea-text-dim">Saving…</span>}
    {status === 'saved' && <span role="status" className="library-inline-hint text-ui-10 text-tea-text-dim">Saved</span>}
    {status === 'error' && <span role="alert" className="text-ui-11 text-tea-text-sec">{error} <button type="button" className="tap-target" onClick={() => void commit()}>Retry</button></span>}
  </span>;
}
