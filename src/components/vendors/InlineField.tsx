import React, { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '../shared/Button';

/**
 * A field that reads as text and becomes an input when tapped. Enter (or Save)
 * keeps it, Escape (or Cancel) puts it back. Says so when a save fails, so a
 * change that didn't land never looks saved.
 *
 * Adrian, 2026-11-23, on the vendor page: "nothing is editable ... make it
 * editable."
 */
export const InlineField: React.FC<{
  label: string;
  value: string | null | undefined;
  onSave: (next: string) => Promise<void>;
  placeholder?: string;
  multiline?: boolean;
  /** Refuse an empty value (a vendor's name). */
  required?: boolean;
  /** How the saved value reads when not editing. Defaults to the value. */
  display?: React.ReactNode;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  /** Open straight into the editor (a parent's own Edit button opened it). */
  startEditing?: boolean;
  /** Called whenever the editor closes, saved or not. */
  onClose?: () => void;
  /** The card's own heading already names the field: keep the label for screen readers only. */
  hideLabel?: boolean;
}> = ({ label, value, onSave, placeholder = 'Add', multiline, required, display, inputMode, startEditing = false, onClose, hideLabel }) => {
  const current = value ?? '';
  const [editing, setEditingState] = useState(startEditing);
  const setEditing = (next: boolean) => { setEditingState(next); if (!next) onClose?.(); };
  const [draft, setDraft] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => { if (!editing) setDraft(current); }, [current, editing]);
  useEffect(() => { if (editing) field.current?.focus(); }, [editing]);

  const cancel = () => { setDraft(current); setError(''); setEditing(false); };
  const save = async () => {
    const next = multiline ? draft.replace(/\s+$/, '') : draft.trim();
    if (next === current.trim()) { setEditing(false); setError(''); return; }
    if (required && !next) { setError(`${label} can't be empty.`); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Button
        type="button"
        variant="plain"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${label.toLowerCase()}`}
        className="group flex w-full min-h-tap items-start gap-3 rounded-md px-2 py-2 -mx-2 text-left transition-colors hover:bg-tea-accent-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
      >
        <span className="w-24 shrink-0 pt-0.5 text-ui-12 text-tea-text-sec">{label}</span>
        <span className={`min-w-0 flex-1 break-words text-ui-14 ${current ? 'text-tea-text' : 'text-tea-text-sec'} ${multiline ? 'whitespace-pre-line' : ''}`}>
          {current ? (display ?? current) : placeholder}
        </span>
        <Pencil size={14} strokeWidth={1.5} aria-hidden="true" className="mt-1 shrink-0 text-tea-text-sec opacity-60 group-hover:opacity-100" />
      </Button>
    );
  }

  const shared = {
    ref: field,
    value: draft,
    'aria-label': label,
    disabled: saving,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(e.target.value),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); }
    },
    className: 'input-field min-h-tap w-full px-3 py-2 text-ui-16',
  };

  return (
    <div className="py-2 space-y-2">
      {!hideLabel && <p aria-hidden="true" className="text-ui-12 text-tea-text-sec">{label}</p>}
      {multiline
        ? <textarea {...shared} rows={Math.min(16, Math.max(4, draft.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 36)), 1)))} />
        : <input {...shared} inputMode={inputMode} autoComplete="off" />}
      {error && <p role="alert" className="text-ui-12 text-tea-error">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="quiet" size="sm" onClick={cancel} disabled={saving}>Cancel</Button>
        <Button type="button" variant="primary" size="sm" onClick={() => void save()} loading={saving}>Save</Button>
      </div>
    </div>
  );
};
